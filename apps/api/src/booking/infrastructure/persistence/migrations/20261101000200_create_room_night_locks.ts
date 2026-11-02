import type { Knex } from 'knex';

// Guards the cross-aggregate invariant "one active reservation per room night" inside the
// same transaction that appends the events (ADR-003). Not a read model; never rebuilt.
export async function up(db: Knex): Promise<void> {
  await db.raw(`
    CREATE TABLE room_night_locks (
      room_id        INT         NOT NULL,
      night          DATE        NOT NULL,
      reservation_id VARCHAR(40) NOT NULL,
      PRIMARY KEY (room_id, night),
      KEY idx_reservation (reservation_id)
    )
  `);
}

export async function down(db: Knex): Promise<void> {
  await db.schema.dropTableIfExists('room_night_locks');
}
