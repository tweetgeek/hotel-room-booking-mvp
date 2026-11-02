import { DomainError } from '../../domain/domain-error';
import type { DomainEvent, StoredEvent } from '../../domain/domain-event';
import type { Tx } from './unit-of-work';

export const EVENT_STORE = Symbol('EventStore');

export class ConcurrencyError extends DomainError {
  constructor(streamId: string, expectedVersion: number) {
    super(
      'CONCURRENCY_CONFLICT',
      409,
      `Stream ${streamId} was modified; expected version ${expectedVersion}.`,
    );
  }
}

export interface EventStore {
  /** Appends `events` as versions expectedVersion+1… or throws `ConcurrencyError`. */
  append(
    streamId: string,
    expectedVersion: number,
    events: readonly DomainEvent[],
    tx: Tx,
  ): Promise<StoredEvent[]>;
  load(streamId: string): Promise<StoredEvent[]>;
  /** Events with position > fromPosition, ordered by position, at most batchSize. */
  readAll(fromPosition: number, batchSize: number): Promise<StoredEvent[]>;
}
