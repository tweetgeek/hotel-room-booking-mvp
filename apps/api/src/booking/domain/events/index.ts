import type { DomainEvent } from '../../../shared/domain/domain-event';
import { PaymentConfirmed, type PaymentConfirmedPayload } from './payment-confirmed';
import { PaymentRejected, type PaymentRejectedPayload } from './payment-rejected';
import { ReservationCancelled, type ReservationCancelledPayload } from './reservation-cancelled';
import { ReservationExpired, type ReservationExpiredPayload } from './reservation-expired';
import { ReservationRequested, type ReservationRequestedPayload } from './reservation-requested';

export { PaymentConfirmed, PaymentRejected, ReservationCancelled, ReservationExpired, ReservationRequested };
export type {
  PaymentConfirmedPayload,
  PaymentRejectedPayload,
  ReservationCancelledPayload,
  ReservationExpiredPayload,
  ReservationRequestedPayload,
};

export type ReservationEvent =
  ReservationRequested | PaymentConfirmed | PaymentRejected | ReservationExpired | ReservationCancelled;

export const RESERVATION_EVENT_TYPES = [
  'ReservationRequested',
  'PaymentConfirmed',
  'PaymentRejected',
  'ReservationExpired',
  'ReservationCancelled',
] as const;

/** Turns a stored envelope back into the typed event class; a new payload shape would get a new type here (ADR-002). */
export function rehydrateReservationEvent(event: DomainEvent): ReservationEvent {
  switch (event.eventType) {
    case 'ReservationRequested':
      return new ReservationRequested(event.payload as ReservationRequestedPayload, event.metadata);
    case 'PaymentConfirmed':
      return new PaymentConfirmed(event.payload as PaymentConfirmedPayload, event.metadata);
    case 'PaymentRejected':
      return new PaymentRejected(event.payload as PaymentRejectedPayload, event.metadata);
    case 'ReservationExpired':
      return new ReservationExpired(event.payload as ReservationExpiredPayload, event.metadata);
    case 'ReservationCancelled':
      return new ReservationCancelled(event.payload as ReservationCancelledPayload, event.metadata);
    default:
      throw new Error(`Unknown reservation event type: ${event.eventType}`);
  }
}
