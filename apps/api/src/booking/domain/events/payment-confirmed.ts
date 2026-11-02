import type { DomainEvent, EventMetadata } from '../../../shared/domain/domain-event';

export interface PaymentConfirmedPayload {
  reservationId: string;
  paymentId: string;
}

export class PaymentConfirmed implements DomainEvent<'PaymentConfirmed', PaymentConfirmedPayload> {
  readonly eventType = 'PaymentConfirmed' as const;
  constructor(
    readonly payload: PaymentConfirmedPayload,
    readonly metadata: EventMetadata,
  ) {}
}
