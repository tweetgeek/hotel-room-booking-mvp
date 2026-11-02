import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import knex, { type Knex } from 'knex';
import type { Env } from '../config/env.schema';
import { UNIT_OF_WORK } from '../../application/ports/unit-of-work';
import { KnexUnitOfWork } from './knex-unit-of-work';
import { KNEX } from './knex.token';

export { KNEX } from './knex.token';

export function createKnex(config: ConfigService<Env, true>): Knex {
  return knex({
    client: 'mysql2',
    connection: {
      host: config.get('DB_HOST', { infer: true }),
      port: config.get('DB_PORT', { infer: true }),
      user: config.get('DB_USER', { infer: true }),
      password: config.get('DB_PASSWORD', { infer: true }),
      database: config.get('DB_NAME', { infer: true }),
      timezone: '+00:00',
      dateStrings: true,
    },
    pool: {
      min: 0,
      max: 10,
      afterCreate: (
        connection: { query: (sql: string, cb: (err: unknown) => void) => void },
        done: (err: unknown, conn: unknown) => void,
      ) => {
        // Every session compares DATETIME columns in UTC so `occurred_at` never shifts with the host zone.
        // READ COMMITTED: MariaDB 11.6+ (innodb_snapshot_isolation) fails a REPEATABLE READ update of a row
        // changed after the snapshot with ER_CHECKREAD; our invariants rely on unique keys, not on snapshots (ADR-004)
        connection.query("SET time_zone = '+00:00'", (zoneError) => {
          if (zoneError) return done(zoneError, connection);
          connection.query('SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED', (isolationError) =>
            done(isolationError, connection),
          );
        });
      },
    },
  });
}

@Global()
@Module({
  providers: [
    { provide: KNEX, useFactory: createKnex, inject: [ConfigService] },
    KnexUnitOfWork,
    { provide: UNIT_OF_WORK, useExisting: KnexUnitOfWork },
  ],
  exports: [KNEX, UNIT_OF_WORK],
})
export class KnexModule implements OnModuleDestroy {
  constructor(@Inject(KNEX) private readonly db: Knex) {}

  async onModuleDestroy(): Promise<void> {
    await this.db.destroy();
  }
}
