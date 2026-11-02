import type { DomainEvent, EventMetadata } from '../../../shared/domain/domain-event';

export interface ReservationRequestedPayload {
  reservationId: string;
  roomId: number;
  checkIn: string;
  checkOut: string;
  nights: number;
  guestName: string;
  guestEmail: string;
  totalAmount: number;
  currency: string;
  secureCodeHash: string;
  paymentId: string;
}

export class ReservationRequested implements DomainEvent<
  'ReservationRequested',
  ReservationRequestedPayload
> {
  readonly eventType = 'ReservationRequested' as const;
  constructor(
    readonly payload: ReservationRequestedPayload,
    readonly metadata: EventMetadata,
  ) {}
}
