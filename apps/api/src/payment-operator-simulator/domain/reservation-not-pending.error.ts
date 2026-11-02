import { DomainError } from '../../shared/domain/domain-error';

// The operator cannot accept money for a reservation that already expired or has a decision (Q16, ADR-007)
export class ReservationNotPendingError extends DomainError {
  constructor(status: string) {
    super('RESERVATION_NOT_PENDING', 409, `Reservation is ${status}; no payment decision can be taken.`);
  }
}
