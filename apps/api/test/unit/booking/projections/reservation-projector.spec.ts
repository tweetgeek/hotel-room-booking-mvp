import { ReservationProjector } from '../../../../src/booking/application/projections/reservation-projector';
import type { StoredEvent } from '../../../../src/shared/domain/domain-event';

const meta = { correlationId: 'c', causationId: 'Test', occurredAt: '2026-11-03T10:00:00.000Z' };

const stored = (
  position: number,
  eventType: string,
  payload: Record<string, unknown>,
  occurredAt = meta.occurredAt,
): StoredEvent => ({
  position,
  streamId: 'RES-7F3K2A',
  streamVersion: position,
  event: { eventType, payload, metadata: { ...meta, occurredAt } },
});

const requested = stored(1, 'ReservationRequested', {
  reservationId: 'RES-7F3K2A',
  roomId: 1,
  checkIn: '2026-11-10',
  checkOut: '2026-11-13',
  nights: 3,
  guestName: 'Anna Kowalska',
  guestEmail: 'anna@example.com',
  totalAmount: 96000,
  currency: 'PLN',
  secureCodeHash: 'scrypt$ab$cd',
  paymentId: 'PAY-9Q2M4H7ZXT',
});

describe('ReservationProjector', () => {
  const projector = new ReservationProjector();

  it('ReservationRequested inserts the reservation, a timeline entry and held nights, and invalidates the room calendar', () => {
    const plan = projector.project(requested);

    expect(plan.changes).toEqual([
      {
        kind: 'upsert',
        table: 'rm_reservations',
        row: {
          id: 'RES-7F3K2A',
          room_id: 1,
          check_in: '2026-11-10',
          check_out: '2026-11-13',
          nights: 3,
          guest_name: 'Anna Kowalska',
          guest_email: 'anna@example.com',
          total_amount: 96000,
          currency: 'PLN',
          status: 'PendingPayment',
          rejection_reason: null,
          refund_amount: null,
          payment_id: 'PAY-9Q2M4H7ZXT',
          created_at: '2026-11-03 10:00:00.000',
          updated_at: '2026-11-03 10:00:00.000',
        },
      },
      {
        kind: 'insert-ignore',
        table: 'rm_reservation_timeline',
        rows: [
          {
            reservation_id: 'RES-7F3K2A',
            position: 1,
            event_type: 'ReservationRequested',
            occurred_at: '2026-11-03 10:00:00.000',
            reason: null,
          },
        ],
      },
      {
        kind: 'insert-ignore',
        table: 'rm_room_nights',
        rows: [
          { room_id: 1, night: '2026-11-10', reservation_id: 'RES-7F3K2A', status: 'held' },
          { room_id: 1, night: '2026-11-11', reservation_id: 'RES-7F3K2A', status: 'held' },
          { room_id: 1, night: '2026-11-12', reservation_id: 'RES-7F3K2A', status: 'held' },
        ],
      },
    ]);
    expect(plan.cacheKeys).toEqual(['reservation:RES-7F3K2A:details', 'reservation:RES-7F3K2A:status']);
    expect(plan.roomNightsOfReservation).toBe('RES-7F3K2A');
    expect(JSON.stringify(plan)).not.toContain('secureCodeHash');
  });

  it('PaymentConfirmed sets Confirmed and marks the nights confirmed', () => {
    const plan = projector.project(
      stored(2, 'PaymentConfirmed', { reservationId: 'RES-7F3K2A', paymentId: 'PAY-9Q2M4H7ZXT' }),
    );

    expect(plan.changes).toEqual([
      {
        kind: 'update',
        table: 'rm_reservations',
        where: { id: 'RES-7F3K2A' },
        set: { status: 'Confirmed', updated_at: '2026-11-03 10:00:00.000' },
      },
      {
        kind: 'insert-ignore',
        table: 'rm_reservation_timeline',
        rows: [
          {
            reservation_id: 'RES-7F3K2A',
            position: 2,
            event_type: 'PaymentConfirmed',
            occurred_at: '2026-11-03 10:00:00.000',
            reason: null,
          },
        ],
      },
      {
        kind: 'update',
        table: 'rm_room_nights',
        where: { reservation_id: 'RES-7F3K2A' },
        set: { status: 'confirmed' },
      },
    ]);
    expect(plan.roomNightsOfReservation).toBe('RES-7F3K2A');
  });

  it('PaymentRejected stores the reason and frees the nights', () => {
    const plan = projector.project(
      stored(2, 'PaymentRejected', {
        reservationId: 'RES-7F3K2A',
        paymentId: 'PAY-9Q2M4H7ZXT',
        reason: 'abandoned_by_guest',
      }),
    );

    expect(plan.changes[0]).toEqual({
      kind: 'update',
      table: 'rm_reservations',
      where: { id: 'RES-7F3K2A' },
      set: {
        status: 'Rejected',
        rejection_reason: 'abandoned_by_guest',
        updated_at: '2026-11-03 10:00:00.000',
      },
    });
    expect(plan.changes[1]).toMatchObject({
      table: 'rm_reservation_timeline',
      rows: [{ reason: 'abandoned_by_guest' }],
    });
    expect(plan.changes[2]).toEqual({
      kind: 'delete',
      table: 'rm_room_nights',
      where: { reservation_id: 'RES-7F3K2A' },
    });
  });

  it('ReservationExpired and ReservationCancelled free the nights; cancellation records the refund', () => {
    const expired = projector.project(stored(2, 'ReservationExpired', { reservationId: 'RES-7F3K2A' }));
    expect(expired.changes[0]).toMatchObject({ table: 'rm_reservations', set: { status: 'Expired' } });
    expect(expired.changes[2]).toEqual({
      kind: 'delete',
      table: 'rm_room_nights',
      where: { reservation_id: 'RES-7F3K2A' },
    });

    const cancelled = projector.project(
      stored(3, 'ReservationCancelled', {
        reservationId: 'RES-7F3K2A',
        refundAmount: 96000,
        currency: 'PLN',
      }),
    );
    expect(cancelled.changes[0]).toMatchObject({
      table: 'rm_reservations',
      set: { status: 'Cancelled', refund_amount: 96000 },
    });
    expect(cancelled.changes[2]).toEqual({
      kind: 'delete',
      table: 'rm_room_nights',
      where: { reservation_id: 'RES-7F3K2A' },
    });
  });

  it('is a pure function: projecting the same event twice yields the same plan', () => {
    expect(projector.project(requested)).toEqual(projector.project(requested));
  });

  it('ignores event types it does not know', () => {
    expect(projector.project(stored(9, 'SomethingElse', {}))).toEqual({ changes: [], cacheKeys: [] });
  });
});
