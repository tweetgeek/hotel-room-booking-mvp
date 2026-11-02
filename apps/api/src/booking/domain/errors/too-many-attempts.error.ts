import { DomainError } from '../../../shared/domain/domain-error';

export class TooManyAttemptsError extends DomainError {
  constructor(retryAfterSeconds: number) {
    super('TOO_MANY_ATTEMPTS', 429, 'Too many secure code attempts; try again later.', { retryAfterSeconds });
  }
}
