import type { DomainEvent, EventMetadata } from '../../../shared/domain/domain-event';
import type { RejectionReason } from '../rejection-reason';

export interface PaymentRejectedPayload {
  reservationId: string;
  paymentId: string;
  reason: RejectionReason;
}

export class PaymentRejected implements DomainEvent<'PaymentRejected', PaymentRejectedPayload> {
  readonly eventType = 'PaymentRejected' as const;
  constructor(
    readonly payload: PaymentRejectedPayload,
    readonly metadata: EventMetadata,
  ) {}
}
