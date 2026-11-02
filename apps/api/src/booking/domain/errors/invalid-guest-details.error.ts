import { DomainError } from '../../../shared/domain/domain-error';

export class InvalidGuestDetailsError extends DomainError {
  constructor(
    field: 'guestName' | 'guestEmail',
    code: 'REQUIRED' | 'TOO_LONG' | 'INVALID_EMAIL',
    message: string,
  ) {
    super('VALIDATION_FAILED', 422, message, { details: [{ field, code }] });
  }
}
