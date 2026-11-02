import type { DomainEvent, EventMetadata } from '../../../shared/domain/domain-event';

export interface ReservationCancelledPayload {
  reservationId: string;
  refundAmount: number;
  currency: string;
}

export class ReservationCancelled implements DomainEvent<
  'ReservationCancelled',
  ReservationCancelledPayload
> {
  readonly eventType = 'ReservationCancelled' as const;
  constructor(
    readonly payload: ReservationCancelledPayload,
    readonly metadata: EventMetadata,
  ) {}
}
