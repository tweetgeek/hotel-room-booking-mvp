import { DomainError } from '../../../shared/domain/domain-error';

export class InvalidSecureCodeError extends DomainError {
  constructor(attemptsLeft: number) {
    super('INVALID_SECURE_CODE', 401, 'Secure code does not match.', { attemptsLeft });
  }
}
