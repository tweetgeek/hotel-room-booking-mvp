import type { DomainEvent, EventMetadata } from '../../../shared/domain/domain-event';

export interface ReservationExpiredPayload {
  reservationId: string;
}

export class ReservationExpired implements DomainEvent<'ReservationExpired', ReservationExpiredPayload> {
  readonly eventType = 'ReservationExpired' as const;
  constructor(
    readonly payload: ReservationExpiredPayload,
    readonly metadata: EventMetadata,
  ) {}
}
