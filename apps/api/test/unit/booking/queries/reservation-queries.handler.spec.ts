import {
  GetReservationStatusHandler,
  GetReservationStatusQuery,
} from '../../../../src/booking/application/queries/get-reservation-status.query';
import {
  GetReservationDetailsHandler,
  GetReservationDetailsQuery,
} from '../../../../src/booking/application/queries/get-reservation-details.query';
import { GetPaymentViewHandler } from '../../../../src/booking/application/queries/get-payment-view.handler';
import { GetPaymentViewQuery } from '../../../../src/shared/contracts/get-payment-view.query';
import { NotFoundError } from '../../../../src/shared/domain/errors/not-found.error';
import { InMemoryReadModelCache } from '../../support/in-memory-read-model-cache';
import { InMemoryReadModelViews } from '../../support/in-memory-read-model-views';
import { FixedClock } from '../../support/fixed-clock';
import type { ReservationRow } from '../../../../src/booking/application/ports/read-model-views';

const row = (overrides: Partial<ReservationRow> = {}): ReservationRow => ({
  id: 'RES-7F3K2A',
  roomId: 1,
  roomName: 'Pokój dwuosobowy z balkonem',
  checkInTime: '15:00',
  checkOutTime: '11:00',
  checkIn: '2026-11-10',
  checkOut: '2026-11-13',
  nights: 3,
  guestName: 'Anna Kowalska',
  guestEmail: 'anna@example.com',
  totalAmount: 96000,
  currency: 'PLN',
  status: 'Confirmed',
  rejectionReason: null,
  refundAmount: null,
  paymentId: 'PAY-9Q2M4H7ZXT',
  createdAt: '2026-11-03T10:00:00.000Z',
  updatedAt: '2026-11-03T10:05:00.000Z',
  ...overrides,
});

describe('GetReservationStatusHandler', () => {
  it('returns status and reason under reservation:{id}:status for 5 s', async () => {
    const views = new InMemoryReadModelViews();
    views.reservations.push(row({ status: 'Rejected', rejectionReason: 'abandoned_by_guest' }));
    const cache = new InMemoryReadModelCache();

    const status = await new GetReservationStatusHandler(views, cache).execute(
      new GetReservationStatusQuery('RES-7F3K2A'),
    );

    expect(status).toEqual({ reservationId: 'RES-7F3K2A', status: 'Rejected', reason: 'abandoned_by_guest' });
    expect(cache.ttlOf('reservation:RES-7F3K2A:status')).toBe(5);
  });

  it('throws NotFoundError for an unknown id', async () => {
    const handler = new GetReservationStatusHandler(
      new InMemoryReadModelViews(),
      new InMemoryReadModelCache(),
    );
    await expect(handler.execute(new GetReservationStatusQuery('RES-ZZZZZZ'))).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe('GetReservationDetailsHandler', () => {
  it('returns details with the timeline, cached for 300 s, and cancellable computed from today', async () => {
    const views = new InMemoryReadModelViews();
    views.reservations.push(row());
    views.timeline.push(
      {
        reservationId: 'RES-7F3K2A',
        position: 1,
        eventType: 'ReservationRequested',
        occurredAt: '2026-11-03T10:00:00.000Z',
        reason: null,
      },
      {
        reservationId: 'RES-7F3K2A',
        position: 2,
        eventType: 'PaymentConfirmed',
        occurredAt: '2026-11-03T10:05:00.000Z',
        reason: null,
      },
    );
    const cache = new InMemoryReadModelCache();
    const handler = new GetReservationDetailsHandler(
      views,
      cache,
      FixedClock.at('2026-11-05T12:00:00Z', '2026-11-05'),
    );

    const details = await handler.execute(new GetReservationDetailsQuery('RES-7F3K2A'));

    expect(details).toMatchObject({
      reservationId: 'RES-7F3K2A',
      status: 'Confirmed',
      room: { id: 1, name: 'Pokój dwuosobowy z balkonem', checkInTime: '15:00', checkOutTime: '11:00' },
      cancellable: true,
      timeline: [
        { eventType: 'ReservationRequested', occurredAt: '2026-11-03T10:00:00.000Z', reason: null },
        { eventType: 'PaymentConfirmed', occurredAt: '2026-11-03T10:05:00.000Z', reason: null },
      ],
    });
    expect(cache.ttlOf('reservation:RES-7F3K2A:details')).toBe(300);
  });

  it.each([
    ['Confirmed', '2026-11-10', false],
    ['Confirmed', '2026-11-11', false],
    ['PendingPayment', '2026-11-01', false],
    ['Cancelled', '2026-11-01', false],
    ['Confirmed', '2026-11-09', true],
  ] as const)('status %s on %s -> cancellable %s', async (status, today, expected) => {
    const views = new InMemoryReadModelViews();
    views.reservations.push(row({ status }));
    const handler = new GetReservationDetailsHandler(
      views,
      new InMemoryReadModelCache(),
      FixedClock.at(`${today}T12:00:00Z`, today),
    );
    expect((await handler.execute(new GetReservationDetailsQuery('RES-7F3K2A'))).cancellable).toBe(expected);
  });
});

describe('GetPaymentViewHandler', () => {
  it('finds the reservation by payment id without caching', async () => {
    const views = new InMemoryReadModelViews();
    views.reservations.push(row({ status: 'PendingPayment' }));

    const view = await new GetPaymentViewHandler(views).execute(new GetPaymentViewQuery('PAY-9Q2M4H7ZXT'));

    expect(view).toEqual({
      paymentId: 'PAY-9Q2M4H7ZXT',
      reservationId: 'RES-7F3K2A',
      amount: 96000,
      currency: 'PLN',
      checkIn: '2026-11-10',
      checkOut: '2026-11-13',
      roomName: 'Pokój dwuosobowy z balkonem',
      status: 'PendingPayment',
    });
    await expect(
      new GetPaymentViewHandler(views).execute(new GetPaymentViewQuery('PAY-NOPE')),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
