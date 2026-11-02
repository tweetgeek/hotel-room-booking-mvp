import { Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import { ConcurrencyError, type EventStore } from '../../../shared/application/ports/event-store';
import type { Tx } from '../../../shared/application/ports/unit-of-work';
import type { DomainEvent, EventMetadata, StoredEvent } from '../../../shared/domain/domain-event';
import { toSqlDateTime } from '../../../shared/domain/time-format';
import { KNEX } from '../../../shared/infrastructure/persistence/knex.token';
import { asKnexTx } from '../../../shared/infrastructure/persistence/knex-unit-of-work';

interface EventRow {
  position: number | string;
  stream_id: string;
  stream_version: number;
  event_type: string;
  payload: string | Record<string, unknown>;
  metadata: string | EventMetadata;
  occurred_at: string;
}

const MYSQL_DUPLICATE_ENTRY = 'ER_DUP_ENTRY';

function parseJson<T>(value: string | T): T {
  return typeof value === 'string' ? (JSON.parse(value) as T) : value;
}

function toStoredEvent(row: EventRow): StoredEvent {
  return {
    position: Number(row.position),
    streamId: row.stream_id,
    streamVersion: row.stream_version,
    event: {
      eventType: row.event_type,
      payload: parseJson<unknown>(row.payload),
      metadata: parseJson<EventMetadata>(row.metadata),
    },
  };
}

/** Append-only `events` table with optimistic concurrency on (stream_id, stream_version) (ADR-002). */
@Injectable()
export class MariaDbEventStore implements EventStore {
  constructor(@Inject(KNEX) private readonly db: Knex) {}

  async append(
    streamId: string,
    expectedVersion: number,
    events: readonly DomainEvent[],
    tx: Tx,
  ): Promise<StoredEvent[]> {
    if (events.length === 0) return [];
    const trx = asKnexTx(tx);
    const rows = events.map((event, index) => ({
      stream_id: streamId,
      stream_version: expectedVersion + index + 1,
      event_type: event.eventType,
      payload: JSON.stringify(event.payload),
      metadata: JSON.stringify(event.metadata),
      occurred_at: toSqlDateTime(event.metadata.occurredAt),
    }));
    try {
      await trx('events').insert(rows);
    } catch (error) {
      if (isDuplicateEntry(error)) throw new ConcurrencyError(streamId, expectedVersion);
      throw error;
    }
    const stored = await trx<EventRow>('events')
      .where({ stream_id: streamId })
      .andWhere('stream_version', '>', expectedVersion)
      .orderBy('stream_version');
    return stored.map(toStoredEvent);
  }

  async load(streamId: string): Promise<StoredEvent[]> {
    const rows = await this.db<EventRow>('events').where({ stream_id: streamId }).orderBy('stream_version');
    return rows.map(toStoredEvent);
  }

  async readAll(fromPosition: number, batchSize: number): Promise<StoredEvent[]> {
    const rows = await this.db<EventRow>('events')
      .where('position', '>', fromPosition)
      .orderBy('position')
      .limit(batchSize);
    return rows.map(toStoredEvent);
  }
}

function isDuplicateEntry(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: string }).code === MYSQL_DUPLICATE_ENTRY
  );
}
