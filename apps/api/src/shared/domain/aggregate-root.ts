import type { DomainEvent } from './domain-event';

/**
 * State is only ever changed by applying events: `raise` for new decisions, `replay` for history.
 * `version` counts committed events and is the optimistic-concurrency token for the event store.
 */
export abstract class AggregateRoot<E extends DomainEvent = DomainEvent> {
  private committedVersion = 0;
  private uncommitted: E[] = [];

  get version(): number {
    return this.committedVersion;
  }

  get uncommittedEvents(): readonly E[] {
    return this.uncommitted;
  }

  markEventsCommitted(): void {
    this.committedVersion += this.uncommitted.length;
    this.uncommitted = [];
  }

  protected raise(event: E): void {
    this.apply(event);
    this.uncommitted.push(event);
  }

  protected replay(history: readonly E[]): void {
    for (const event of history) {
      this.apply(event);
      this.committedVersion += 1;
    }
  }

  protected abstract apply(event: E): void;
}
