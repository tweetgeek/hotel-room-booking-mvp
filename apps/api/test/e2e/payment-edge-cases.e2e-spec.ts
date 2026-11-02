import request from 'supertest';
import { CommandBus } from '@nestjs/cqrs';
import { createE2eApp, type E2eApp } from './support/create-e2e-app';
import { waitForStatus } from './support/http';
import { connectTestDatabase, truncateAll } from '../integration/support/test-database';
import { flushTestRedis } from '../integration/support/test-redis';
import { signWebhook } from '../../src/shared/contracts/webhook-signature';
import { ExpireReservationCommand } from '../../src/booking/application/commands/expire-reservation.command';

describe('Payment edge cases (E2E)', () => {
  let app: E2eApp;
  const secret = process.env.WEBHOOK_SECRET as string;

  beforeAll(async () => {
    const db = connectTestDatabase();
    await truncateAll(db);
    await db.destroy();
    await flushTestRedis();
    app = await createE2eApp();
  });
  afterAll(() => app.close());

  async function createReservation(checkIn: string, checkOut: string) {
    const response = await request(app.baseUrl)
      .post('/reservations')
      .send({ roomId: 2, checkIn, checkOut, guestName: 'Ewa', guestEmail: 'ewa@example.com' })
      .expect(201);
    return response.body as { reservationId: string; paymentId: string };
  }

  it('ignores a repeated webhook (200, applied: false) and rejects a bad signature (401)', async () => {
    const { reservationId, paymentId } = await createReservation('2027-09-01', '2027-09-02');
    const api = request(app.baseUrl);
    await api
      .post(`/payment-operator/payments/${paymentId}/decide`)
      .send({ outcome: 'paid', delaySeconds: 0 })
      .expect(202);
    expect(await waitForStatus(app.baseUrl, reservationId)).toBe('Confirmed');

    const sentAt = new Date().toISOString();
    const repeated = await api
      .post('/webhooks/payments')
      .send({
        paymentId,
        outcome: 'paid',
        reason: null,
        sentAt,
        signature: signWebhook(secret, paymentId, 'paid', sentAt),
      })
      .expect(200);
    expect(repeated.body).toEqual({ received: true, applied: false });

    const forged = await api
      .post('/webhooks/payments')
      .send({ paymentId, outcome: 'rejected', reason: 'rejected_by_operator', sentAt, signature: 'deadbeef' })
      .expect(401);
    expect(forged.body.code).toBe('INVALID_SIGNATURE');

    const status = await api.get(`/reservations/${reservationId}/status`).expect(200);
    expect(status.body.status).toBe('Confirmed');
  });

  it('refuses an operator decision after the reservation expired (409 RESERVATION_NOT_PENDING)', async () => {
    const { reservationId, paymentId } = await createReservation('2027-09-10', '2027-09-11');
    await app.app.get(CommandBus).execute(new ExpireReservationCommand(reservationId, 'e2e-expiry'));

    const refused = await request(app.baseUrl)
      .post(`/payment-operator/payments/${paymentId}/decide`)
      .send({ outcome: 'paid', delaySeconds: 0 })
      .expect(409);
    expect(refused.body.code).toBe('RESERVATION_NOT_PENDING');

    const status = await request(app.baseUrl).get(`/reservations/${reservationId}/status`).expect(200);
    expect(status.body.status).toBe('Expired');
    const freed = await request(app.baseUrl)
      .get('/rooms/2/blocked-nights?from=2027-09-01&to=2027-09-30')
      .expect(200);
    expect(freed.body.nights.map((n: { night: string }) => n.night)).toEqual(['2027-09-01']);
  });

  it('answers 404 with one generic message for unknown reservations and payments', async () => {
    const api = request(app.baseUrl);
    const reservation = await api.get('/reservations/RES-ZZZZZZ/status').expect(404);
    expect(reservation.body).toEqual({ code: 'NOT_FOUND', message: 'Reservation not found.' });
    const payment = await api.get('/payment-operator/payments/PAY-ZZZZZZZZZZ').expect(404);
    expect(payment.body).toEqual({ code: 'NOT_FOUND', message: 'Payment not found.' });
    const malformed = await api.get('/reservations/not-an-id/status').expect(422);
    expect(malformed.body.details).toEqual([{ field: 'reservationId', code: 'INVALID_FORMAT' }]);
  });
});
