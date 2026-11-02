import type { Knex } from 'knex';

// The event store is the only source of truth for reservations (ADR-002, constitution III)
export async function up(db: Knex): Promise<void> {
  await db.raw(`
    CREATE TABLE events (
      position       BIGINT AUTO_INCREMENT PRIMARY KEY,
      stream_id      VARCHAR(40)  NOT NULL,
      stream_version INT          NOT NULL,
      event_type     VARCHAR(100) NOT NULL,
      payload        JSON         NOT NULL,
      metadata       JSON         NOT NULL,
      occurred_at    DATETIME(3)  NOT NULL,
      UNIQUE KEY uq_stream (stream_id, stream_version),
      KEY idx_position (position)
    )
  `);
}

export async function down(db: Knex): Promise<void> {
  await db.schema.dropTableIfExists('events');
}
