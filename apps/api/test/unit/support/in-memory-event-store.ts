import { ConcurrencyError, type EventStore } from '../../../src/shared/application/ports/event-store';
import type { DomainEvent, StoredEvent } from '../../../src/shared/domain/domain-event';
import type { Tx } from '../../../src/shared/application/ports/unit-of-work';
import { asInMemoryTx } from './in-memory-unit-of-work';

export class InMemoryEventStore implements EventStore {
  private readonly all: StoredEvent[] = [];
  private nextPosition = 1;

  async append(
    streamId: string,
    expectedVersion: number,
    events: readonly DomainEvent[],
    tx: Tx,
  ): Promise<StoredEvent[]> {
    const current = this.all.filter((e) => e.streamId === streamId).length;
    if (current !== expectedVersion) throw new ConcurrencyError(streamId, expectedVersion);
    const stored = events.map((event, i) => ({
      position: this.nextPosition + i,
      streamId,
      streamVersion: expectedVersion + i + 1,
      event,
    }));
    this.nextPosition += events.length;
    asInMemoryTx(tx).stage(() => this.all.push(...stored));
    return stored;
  }

  async load(streamId: string): Promise<StoredEvent[]> {
    return this.all.filter((e) => e.streamId === streamId).sort((a, b) => a.streamVersion - b.streamVersion);
  }

  async readAll(fromPosition: number, batchSize: number): Promise<StoredEvent[]> {
    return this.all
      .filter((e) => e.position > fromPosition)
      .sort((a, b) => a.position - b.position)
      .slice(0, batchSize);
  }

  seed(streamId: string, events: readonly DomainEvent[]): void {
    for (const event of events) {
      const version = this.all.filter((e) => e.streamId === streamId).length + 1;
      this.all.push({ position: this.nextPosition, streamId, streamVersion: version, event });
      this.nextPosition += 1;
    }
  }
}
