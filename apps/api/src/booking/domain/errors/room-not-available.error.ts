import { DomainError } from '../../../shared/domain/domain-error';

export class RoomNotAvailableError extends DomainError {
  constructor() {
    super('ROOM_NOT_AVAILABLE', 409, 'At least one requested night is already blocked.');
  }
}
