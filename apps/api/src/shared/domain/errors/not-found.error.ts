import { DomainError } from '../domain-error';

// One message for "never existed" and "exists but hidden", so ids cannot be probed (spec edge case)
export class NotFoundError extends DomainError {
  constructor(resource = 'Resource') {
    super('NOT_FOUND', 404, `${resource} not found.`);
  }
}
