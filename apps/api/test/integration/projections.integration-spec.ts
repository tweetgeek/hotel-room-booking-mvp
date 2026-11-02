import { createTestApp, type TestApp } from './support/create-test-app';
import { truncateAll } from './support/test-database';
import { flushTestRedis } from './support/test-redis';
import { CommandBus } from '@nestjs/cqrs';
import { CreateReservationCommand } from '../../src/booking/application/commands/create-reservation.command';
import { ConfirmPaymentCommand } from '../../src/booking/application/commands/confirm-payment.command';
import { RejectPaymentCommand } from '../../src/booking/application/commands/reject-payment.command';

describe('ProjectionRunner on MariaDB', () => {
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

  async function create() {
    return commandBus.execute(
      new CreateReservationCommand({
        roomId: 2,
        checkIn: '2027-03-10',
        checkOut: '2027-03-12',
        guestName: 'Jan Nowak',
        guestEmail: 'jan@example.com',
        correlationId: 'corr-it',
      }),
    );
  }

  it('updates rm_* tables, the checkpoint and the views right after the command commits', async () => {
    const { reservationId, paymentId } = await create();

    const reservation = await app.db('v_reservation_details').where({ id: reservationId }).first();
    expect(reservation).toMatchObject({
      room_name: 'Pokój rodzinny',
      status: 'PendingPayment',
      nights: 2,
      total_amount: 90000,
      payment_id: paymentId,
      rejection_reason: null,
    });
    expect(await app.db('v_room_blocked_nights').where({ room_id: 2 }).orderBy('night')).toEqual([
      expect.objectContaining({ night: '2027-03-10', status: 'held' }),
      expect.objectContaining({ night: '2027-03-11', status: 'held' }),
    ]);
    const timeline = await app.db('v_reservation_timeline').where({ reservation_id: reservationId });
    expect(timeline.map((t) => t.event_type)).toEqual(['ReservationRequested']);
    expect(await app.db('projection_checkpoints').where({ name: 'reservations' }).first()).toMatchObject({
      last_position: 1,
    });

    await commandBus.execute(new ConfirmPaymentCommand(reservationId, paymentId, 'corr-2'));

    expect(await app.db('v_reservation_status').where({ id: reservationId }).first()).toMatchObject({
      status: 'Confirmed',
    });
    expect((await app.db('v_room_blocked_nights').where({ room_id: 2 })).map((n) => n.status)).toEqual([
      'confirmed',
      'confirmed',
    ]);
    expect(await app.db('projection_checkpoints').where({ name: 'reservations' }).first()).toMatchObject({
      last_position: 2,
    });
  });

  it('invalidates the cached status, details and room calendar after each event', async () => {
    const { reservationId, paymentId } = await create();
    await app.cache.mset(
      `reservation:${reservationId}:status`,
      'stale',
      `reservation:${reservationId}:details`,
      'stale',
      'room:2:nights:2027-03-01:2027-05-31',
      'stale',
      'room:1:nights:2027-03-01:2027-05-31',
      'untouched',
    );

    await commandBus.execute(
      new RejectPaymentCommand(reservationId, paymentId, 'rejected_by_operator', 'corr-2'),
    );

    expect(await app.cache.get(`reservation:${reservationId}:status`)).toBeNull();
    expect(await app.cache.get(`reservation:${reservationId}:details`)).toBeNull();
    expect(await app.cache.get('room:2:nights:2027-03-01:2027-05-31')).toBeNull();
    expect(await app.cache.get('room:1:nights:2027-03-01:2027-05-31')).toBe('untouched');
    expect(await app.db('v_room_blocked_nights').where({ room_id: 2 })).toEqual([]);
    expect(await app.db('v_reservation_status').where({ id: reservationId }).first()).toMatchObject({
      status: 'Rejected',
      rejection_reason: 'rejected_by_operator',
    });
  });
});
