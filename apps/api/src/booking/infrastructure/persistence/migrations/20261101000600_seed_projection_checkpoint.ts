import type { Knex } from 'knex';

// The checkpoint row exists from the start so the projection runner only ever UPDATEs it;
// concurrent upserts of one row trigger ER_CHECKREAD on MariaDB 11 (ADR-004)
export async function up(db: Knex): Promise<void> {
  await db('projection_checkpoints')
    .insert({ name: 'reservations', last_position: 0 })
    .onConflict('name')
    .ignore();
}

export async function down(db: Knex): Promise<void> {
  await db('projection_checkpoints').where({ name: 'reservations' }).delete();
}
