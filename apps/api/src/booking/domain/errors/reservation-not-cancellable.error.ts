import { DomainError } from '../../../shared/domain/domain-error';

export class ReservationNotCancellableError extends DomainError {
  constructor(reason: string) {
    super('RESERVATION_NOT_CANCELLABLE', 422, `Reservation cannot be cancelled: ${reason}.`);
  }
}
