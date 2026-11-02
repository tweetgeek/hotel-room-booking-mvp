import request from 'supertest';
import { CommandBus } from '@nestjs/cqrs';
import { createTestApp, type TestApp } from './support/create-test-app';
import { truncateAll } from './support/test-database';
import { flushTestRedis } from './support/test-redis';
import { CreateReservationCommand } from '../../src/booking/application/commands/create-reservation.command';
import { ConfirmPaymentCommand } from '../../src/booking/application/commands/confirm-payment.command';

describe('POST /reservations/:id/cancel (HTTP)', () => {
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

  async function confirmed() {
    const created = await commandBus.execute(
      new CreateReservationCommand({
        roomId: 3,
        checkIn: '2027-05-10',
        checkOut: '2027-05-12',
        guestName: 'Ewa Nowak',
        guestEmail: 'ewa@example.com',
        correlationId: 'corr-it',
      }),
    );
    await commandBus.execute(new ConfirmPaymentCommand(created.reservationId, created.paymentId, 'corr-2'));
    return created;
  }

  it('cancels a confirmed reservation, frees the nights and extends the timeline', async () => {
    const created = await confirmed();
    const server = app.app.getHttpServer();

    const response = await request(server)
      .post(`/reservations/${created.reservationId}/cancel`)
      .set('X-Reservation-Access', created.accessToken)
      .expect(200);

    expect(response.body).toMatchObject({ status: 'Cancelled', cancellable: false, refundAmount: 124000 });
    expect(response.body.timeline.map((t: { eventType: string }) => t.eventType)).toEqual([
      'ReservationRequested',
      'PaymentConfirmed',
      'ReservationCancelled',
    ]);
    expect(await app.db('v_room_blocked_nights').where({ room_id: 3 })).toEqual([]);
    expect(await app.db('room_night_locks').where({ reservation_id: created.reservationId })).toEqual([]);

    const again = await request(server)
      .post(`/reservations/${created.reservationId}/cancel`)
      .set('X-Reservation-Access', created.accessToken)
      .expect(422);
    expect(again.body.code).toBe('RESERVATION_NOT_CANCELLABLE');
  });

  it('requires the access token', async () => {
    const created = await confirmed();
    const response = await request(app.app.getHttpServer())
      .post(`/reservations/${created.reservationId}/cancel`)
      .expect(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });
});
