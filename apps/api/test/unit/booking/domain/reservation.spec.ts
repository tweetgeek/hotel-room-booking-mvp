import { Reservation } from '../../../../src/booking/domain/reservation';
import { ReservationStatus } from '../../../../src/booking/domain/reservation-status';
import { Stay } from '../../../../src/booking/domain/stay';
import { GuestDetails } from '../../../../src/booking/domain/guest-details';
import { ReservationNotCancellableError } from '../../../../src/booking/domain/errors';
import type { ReservationEvent } from '../../../../src/booking/domain/events';
import { CalendarDate } from '../../../../src/shared/domain/calendar-date';
import { PaymentId, ReservationId, RoomId } from '../../../../src/shared/domain/ids';
import { Money } from '../../../../src/shared/domain/money';
import type { EventMetadata } from '../../../../src/shared/domain/domain-event';

const d = CalendarDate.parse;
const today = d('2026-11-03');
const meta = (causationId = 'Test'): EventMetadata => ({
  correlationId: 'corr-1',
  causationId,
  occurredAt: '2026-11-03T10:00:00.000Z',
});

function requested(): Reservation {
  return Reservation.request({
    id: ReservationId.of('RES-7F3K2A'),
    roomId: RoomId.of(1),
    stay: Stay.create(d('2026-11-10'), d('2026-11-13'), today),
    guest: GuestDetails.create('Anna Kowalska', 'anna@example.com'),
    pricePerNight: Money.of(32000),
    secureCodeHash: 'scrypt$ab$cd',
    paymentId: PaymentId.of('PAY-9Q2M4H7ZXT'),
    metadata: meta('CreateReservation'),
  });
}

const eventsOf = (r: Reservation) => r.uncommittedEvents.map((e) => e.eventType);

describe('Reservation', () => {
  it('request raises ReservationRequested with the total amount and the secure code hash only', () => {
    const r = requested();
    expect(r.status).toBe(ReservationStatus.PendingPayment);
    expect(eventsOf(r)).toEqual(['ReservationRequested']);
    expect(r.uncommittedEvents[0].payload).toEqual({
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
    expect(r.uncommittedEvents[0].metadata).toEqual(meta('CreateReservation'));
    expect(r.totalAmount.equals(Money.of(96000))).toBe(true);
    expect(r.version).toBe(0);
  });

  it('confirmPayment moves PendingPayment to Confirmed', () => {
    const r = requested();
    r.markEventsCommitted();
    expect(r.confirmPayment(PaymentId.of('PAY-9Q2M4H7ZXT'), meta())).toBe(true);
    expect(r.status).toBe(ReservationStatus.Confirmed);
    expect(eventsOf(r)).toEqual(['PaymentConfirmed']);
    expect(r.uncommittedEvents[0].payload).toEqual({
      reservationId: 'RES-7F3K2A',
      paymentId: 'PAY-9Q2M4H7ZXT',
    });
  });

  it.each(['rejected_by_operator', 'abandoned_by_guest'] as const)(
    'rejectPayment with reason %s',
    (reason) => {
      const r = requested();
      r.markEventsCommitted();
      expect(r.rejectPayment(PaymentId.of('PAY-9Q2M4H7ZXT'), reason, meta())).toBe(true);
      expect(r.status).toBe(ReservationStatus.Rejected);
      expect(r.rejectionReason).toBe(reason);
      expect(r.uncommittedEvents[0].payload).toEqual({
        reservationId: 'RES-7F3K2A',
        paymentId: 'PAY-9Q2M4H7ZXT',
        reason,
      });
    },
  );

  it('expire moves PendingPayment to Expired', () => {
    const r = requested();
    r.markEventsCommitted();
    expect(r.expire(meta())).toBe(true);
    expect(r.status).toBe(ReservationStatus.Expired);
    expect(r.uncommittedEvents[0].payload).toEqual({ reservationId: 'RES-7F3K2A' });
  });

  it('confirm, reject and expire outside PendingPayment raise nothing and throw nothing (FR-010)', () => {
    const r = requested();
    r.confirmPayment(PaymentId.of('PAY-9Q2M4H7ZXT'), meta());
    r.markEventsCommitted();

    expect(r.confirmPayment(PaymentId.of('PAY-9Q2M4H7ZXT'), meta())).toBe(false);
    expect(r.rejectPayment(PaymentId.of('PAY-9Q2M4H7ZXT'), 'rejected_by_operator', meta())).toBe(false);
    expect(r.expire(meta())).toBe(false);
    expect(r.uncommittedEvents).toHaveLength(0);
    expect(r.status).toBe(ReservationStatus.Confirmed);
  });

  it('fromHistory rebuilds state and version from events', () => {
    const source = requested();
    source.rejectPayment(PaymentId.of('PAY-9Q2M4H7ZXT'), 'abandoned_by_guest', meta());
    const history = [...source.uncommittedEvents] as ReservationEvent[];

    const r = Reservation.fromHistory(history);

    expect(r.version).toBe(2);
    expect(r.uncommittedEvents).toHaveLength(0);
    expect(r.status).toBe(ReservationStatus.Rejected);
    expect(r.rejectionReason).toBe('abandoned_by_guest');
    expect(r.id.value).toBe('RES-7F3K2A');
    expect(r.roomId.value).toBe(1);
    expect(r.stay.nightCount).toBe(3);
    expect(r.guest.email).toBe('anna@example.com');
    expect(r.secureCodeHash).toBe('scrypt$ab$cd');
    expect(r.paymentId.value).toBe('PAY-9Q2M4H7ZXT');
  });

  it('cancel is only allowed for Confirmed reservations before the check-in day (US4)', () => {
    const r = requested();
    r.confirmPayment(PaymentId.of('PAY-9Q2M4H7ZXT'), meta());
    r.markEventsCommitted();

    r.cancel(d('2026-11-09'), meta());

    expect(r.status).toBe(ReservationStatus.Cancelled);
    expect(r.uncommittedEvents[0].payload).toEqual({
      reservationId: 'RES-7F3K2A',
      refundAmount: 96000,
      currency: 'PLN',
    });
  });

  it('cancel throws on the check-in day, after it, and in every other status', () => {
    const confirmed = requested();
    confirmed.confirmPayment(PaymentId.of('PAY-9Q2M4H7ZXT'), meta());
    expect(() => confirmed.cancel(d('2026-11-10'), meta())).toThrow(ReservationNotCancellableError);
    expect(() => confirmed.cancel(d('2026-11-11'), meta())).toThrow(ReservationNotCancellableError);

    const pending = requested();
    expect(() => pending.cancel(d('2026-11-01'), meta())).toThrow(ReservationNotCancellableError);

    confirmed.cancel(d('2026-11-09'), meta());
    expect(() => confirmed.cancel(d('2026-11-09'), meta())).toThrow(ReservationNotCancellableError);
  });
});
