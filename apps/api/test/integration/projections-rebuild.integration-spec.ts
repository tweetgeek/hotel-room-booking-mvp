import { CommandBus } from '@nestjs/cqrs';
import { createTestApp, type TestApp } from './support/create-test-app';
import { truncateAll } from './support/test-database';
import { flushTestRedis } from './support/test-redis';
import { CreateReservationCommand } from '../../src/booking/application/commands/create-reservation.command';
import { ConfirmPaymentCommand } from '../../src/booking/application/commands/confirm-payment.command';
import { RejectPaymentCommand } from '../../src/booking/application/commands/reject-payment.command';
import { ExpireReservationCommand } from '../../src/booking/application/commands/expire-reservation.command';
import { CancelReservationCommand } from '../../src/booking/application/commands/cancel-reservation.command';
import { ProjectionRunner } from '../../src/booking/infrastructure/projections/projection-runner';

describe('ProjectionRunner.rebuild (US5, SC-004)', () => {
  let app: TestApp;
  let commandBus: CommandBus;

  beforeAll(async () => {
    app = await createTestApp();
    commandBus = app.app.get(CommandBus);
  });
  beforeEach(async () => {
    await truncateAll(app.db);
    await flushTestRedis();
  });
  afterAll(() => app.close());

  async function create(roomId: number, checkIn: string, checkOut: string) {
    return commandBus.execute(
      new CreateReservationCommand({
        roomId,
        checkIn,
        checkOut,
        guestName: 'Gość',
        guestEmail: 'g@example.com',
        correlationId: 'c',
      }),
    );
  }

  async function snapshot() {
    return {
      details: await app.db('v_reservation_details').orderBy('id'),
      timeline: await app.db('v_reservation_timeline').orderBy(['reservation_id', 'position']),
      nights: await app.db('v_room_blocked_nights').orderBy(['room_id', 'night']),
      status: await app.db('v_reservation_status').orderBy('id'),
    };
  }

  it('rebuilds identical read models from the event store and clears the cache', async () => {
    const confirmed = await create(1, '2027-06-01', '2027-06-03');
    await commandBus.execute(new ConfirmPaymentCommand(confirmed.reservationId, confirmed.paymentId, 'c'));
    const rejected = await create(1, '2027-06-10', '2027-06-11');
    await commandBus.execute(
      new RejectPaymentCommand(rejected.reservationId, rejected.paymentId, 'rejected_by_operator', 'c'),
    );
    const abandoned = await create(2, '2027-06-10', '2027-06-11');
    await commandBus.execute(
      new RejectPaymentCommand(abandoned.reservationId, abandoned.paymentId, 'abandoned_by_guest', 'c'),
    );
    const expired = await create(2, '2027-06-20', '2027-06-21');
    await commandBus.execute(new ExpireReservationCommand(expired.reservationId, 'job'));
    const cancelled = await create(3, '2027-06-01', '2027-06-04');
    await commandBus.execute(new ConfirmPaymentCommand(cancelled.reservationId, cancelled.paymentId, 'c'));
    await commandBus.execute(new CancelReservationCommand(cancelled.reservationId, 'c'));
    const pending = await create(3, '2027-07-01', '2027-07-02');

    const before = await snapshot();
    expect(before.status.map((s) => s.status).sort()).toEqual([
      'Cancelled',
      'Confirmed',
      'Expired',
      'PendingPayment',
      'Rejected',
      'Rejected',
    ]);
    const locksBefore = await app.db('room_night_locks').orderBy(['room_id', 'night']);
    const lastPosition = Number((await app.db('events').max({ p: 'position' }).first())?.p);
    await app.cache.set(`reservation:${pending.reservationId}:details`, 'stale');
    await app.db('rm_reservations').where({ id: pending.reservationId }).update({ guest_name: 'CORRUPTED' });

    const replayed = await app.app.get(ProjectionRunner).rebuild();

    expect(replayed).toBe(lastPosition);
    expect(await snapshot()).toEqual(before);
    expect(await app.db('projection_checkpoints').where({ name: 'reservations' }).first()).toMatchObject({
      last_position: lastPosition,
    });
    expect(await app.cache.get(`reservation:${pending.reservationId}:details`)).toBeNull();
    expect(await app.db('room_night_locks').orderBy(['room_id', 'night'])).toEqual(locksBefore);
  });
});
