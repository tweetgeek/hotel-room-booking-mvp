import { DomainError } from '../domain-error';

export class UnauthorizedError extends DomainError {
  constructor() {
    super('UNAUTHORIZED', 401, 'Missing or invalid reservation access token.');
  }
}
