import { DomainError } from '../../../shared/domain/domain-error';

export class InvalidSignatureError extends DomainError {
  constructor() {
    super('INVALID_SIGNATURE', 401, 'Webhook signature does not match.');
  }
}
