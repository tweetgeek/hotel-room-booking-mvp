import request from 'supertest';
import { createE2eApp, type E2eApp } from './support/create-e2e-app';
import { waitForStatus } from './support/http';
import { connectTestDatabase, truncateAll } from '../integration/support/test-database';
import { flushTestRedis } from '../integration/support/test-redis';

/**
 * SC-007: reservation -> operator decision -> webhook -> details via secure code -> cancellation
 * -> the same nights can be reserved again. Runs against the real HTTP server, MariaDB and Redis.
 */
describe('Guest journey (E2E)', () => {
  let app: E2eApp;

  beforeAll(async () => {
    const db = connectTestDatabase();
    await truncateAll(db);
    await db.destroy();
    await flushTestRedis();
    app = await createE2eApp();
  });
  afterAll(() => app.close());

  it('walks the whole journey end to end', async () => {
    const api = request(app.baseUrl);

    const rooms = await api.get('/rooms').expect(200);
    expect(rooms.body).toHaveLength(3);

    const stay = { roomId: 1, checkIn: '2027-08-10', checkOut: '2027-08-13' };
    const created = await api
      .post('/reservations')
      .send({ ...stay, guestName: 'Anna Kowalska', guestEmail: 'anna@example.com' })
      .expect(201);
    const { reservationId, paymentId, secureCode, accessToken } = created.body;
    expect(secureCode).toMatch(/^[A-Za-z0-9]{6}$/);
    expect(created.body).toMatchObject({ status: 'PendingPayment', totalAmount: 96000, nights: 3 });

    const blocked = await api.get('/rooms/1/blocked-nights?from=2027-08-01&to=2027-08-31').expect(200);
    expect(blocked.body.nights.map((n: { night: string; status: string }) => [n.night, n.status])).toEqual([
      ['2027-08-10', 'held'],
      ['2027-08-11', 'held'],
      ['2027-08-12', 'held'],
    ]);

    const payment = await api.get(`/payment-operator/payments/${paymentId}`).expect(200);
    expect(payment.body).toMatchObject({
      reservationId,
      amount: 96000,
      roomName: 'Pokój dwuosobowy z balkonem',
      status: 'PendingPayment',
    });

    await api
      .post(`/payment-operator/payments/${paymentId}/decide`)
      .send({ outcome: 'paid', delaySeconds: 0 })
      .expect(202);
    expect(await waitForStatus(app.baseUrl, reservationId)).toBe('Confirmed');

    // A new device: the permanent link plus the secure code (typed with the display hyphen)
    const unlocked = await api
      .post(`/reservations/${reservationId}/access`)
      .send({ secureCode: `${secureCode.slice(0, 3)}-${secureCode.slice(3)}` })
      .expect(200);
    expect(unlocked.body.accessToken).not.toBe(accessToken);

    const details = await api
      .get(`/reservations/${reservationId}`)
      .set('X-Reservation-Access', unlocked.body.accessToken)
      .expect(200);
    expect(details.body).toMatchObject({
      status: 'Confirmed',
      cancellable: true,
      guestName: 'Anna Kowalska',
    });
    expect(details.body.timeline.map((t: { eventType: string }) => t.eventType)).toEqual([
      'ReservationRequested',
      'PaymentConfirmed',
    ]);
    expect(JSON.stringify(details.body)).not.toContain('secureCode');

    const cancelled = await api
      .post(`/reservations/${reservationId}/cancel`)
      .set('X-Reservation-Access', accessToken)
      .expect(200);
    expect(cancelled.body).toMatchObject({ status: 'Cancelled', cancellable: false, refundAmount: 96000 });

    const freed = await api.get('/rooms/1/blocked-nights?from=2027-08-01&to=2027-08-31').expect(200);
    expect(freed.body.nights).toEqual([]);

    const again = await api
      .post('/reservations')
      .send({ ...stay, guestName: 'Jan Nowak', guestEmail: 'jan@example.com' })
      .expect(201);
    expect(again.body.reservationId).not.toBe(reservationId);
  });
});
