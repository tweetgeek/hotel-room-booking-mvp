import type { Knex } from 'knex';

// rm_* tables are written only by the reservation projector and can be truncated and rebuilt
// from the event store at any time (ADR-004)
export async function up(db: Knex): Promise<void> {
  await db.raw(`
    CREATE TABLE rm_reservations (
      id               VARCHAR(40)  PRIMARY KEY,
      room_id          INT          NOT NULL,
      check_in         DATE         NOT NULL,
      check_out        DATE         NOT NULL,
      nights           INT          NOT NULL,
      guest_name       VARCHAR(100) NOT NULL,
      guest_email      VARCHAR(255) NOT NULL,
      total_amount     INT          NOT NULL,
      currency         CHAR(3)      NOT NULL,
      status           VARCHAR(20)  NOT NULL,
      rejection_reason VARCHAR(40)  NULL,
      refund_amount    INT          NULL,
      payment_id       VARCHAR(40)  NOT NULL,
      created_at       DATETIME(3)  NOT NULL,
      updated_at       DATETIME(3)  NOT NULL,
      UNIQUE KEY uq_payment (payment_id),
      KEY idx_status_created (status, created_at)
    )
  `);
  await db.raw(`
    CREATE TABLE rm_reservation_timeline (
      reservation_id VARCHAR(40)  NOT NULL,
      position       BIGINT       NOT NULL,
      event_type     VARCHAR(100) NOT NULL,
      occurred_at    DATETIME(3)  NOT NULL,
      reason         VARCHAR(40)  NULL,
      PRIMARY KEY (reservation_id, position)
    )
  `);
  await db.raw(`
    CREATE TABLE rm_room_nights (
      room_id        INT                        NOT NULL,
      night          DATE                       NOT NULL,
      reservation_id VARCHAR(40)                NOT NULL,
      status         ENUM('held', 'confirmed')  NOT NULL,
      PRIMARY KEY (room_id, night),
      KEY idx_reservation (reservation_id)
    )
  `);
  await db.raw(`
    CREATE TABLE projection_checkpoints (
      name          VARCHAR(100) PRIMARY KEY,
      last_position BIGINT       NOT NULL DEFAULT 0
    )
  `);
}

export async function down(db: Knex): Promise<void> {
  await db.schema.dropTableIfExists('projection_checkpoints');
  await db.schema.dropTableIfExists('rm_room_nights');
  await db.schema.dropTableIfExists('rm_reservation_timeline');
  await db.schema.dropTableIfExists('rm_reservations');
}
