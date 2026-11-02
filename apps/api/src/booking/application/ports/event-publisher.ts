import type { StoredEvent } from '../../../shared/domain/domain-event';

export const EVENT_PUBLISHER = Symbol('EventPublisher');

/** Called by command handlers after the transaction committed (contracts/events.md). */
export interface EventPublisher {
  publish(events: readonly StoredEvent[]): Promise<void>;
}
