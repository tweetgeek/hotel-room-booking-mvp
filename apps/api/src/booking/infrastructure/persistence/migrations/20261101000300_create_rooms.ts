import type { Knex } from 'knex';

export async function up(db: Knex): Promise<void> {
  await db.raw(`
    CREATE TABLE rooms (
      id               INT PRIMARY KEY,
      name             VARCHAR(100) NOT NULL,
      description      TEXT         NOT NULL,
      features         JSON         NOT NULL,
      price_per_night  INT          NOT NULL,
      currency         CHAR(3)      NOT NULL DEFAULT 'PLN',
      check_in_time    CHAR(5)      NOT NULL DEFAULT '15:00',
      check_out_time   CHAR(5)      NOT NULL DEFAULT '11:00',
      image_url        VARCHAR(255) NULL
    )
  `);
}

export async function down(db: Knex): Promise<void> {
  await db.schema.dropTableIfExists('rooms');
}
