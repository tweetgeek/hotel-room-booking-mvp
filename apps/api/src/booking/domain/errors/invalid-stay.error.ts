import { DomainError } from '../../../shared/domain/domain-error';

export type StayViolation = 'CHECK_OUT_NOT_AFTER_CHECK_IN' | 'TOO_MANY_NIGHTS' | 'CHECK_IN_IN_PAST';

export class InvalidStayError extends DomainError {
  constructor(field: 'checkIn' | 'checkOut', violation: StayViolation, message: string) {
    super('INVALID_STAY', 422, message, { details: [{ field, code: violation }] });
  }
}
