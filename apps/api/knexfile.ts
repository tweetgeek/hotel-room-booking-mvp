import { config as loadEnv } from 'dotenv';
import type { Knex } from 'knex';
import { resolve } from 'node:path';

// The single .env lives at the monorepo root, not in the workspace knex runs from
loadEnv({ path: resolve(__dirname, '../../.env') });

const shared: Knex.Config = {
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'hotel',
    password: process.env.DB_PASSWORD ?? 'hotel',
    database: process.env.DB_NAME ?? 'hotel',
    // Event timestamps are stored and compared in UTC regardless of the server zone (research R-05)
    timezone: '+00:00',
  },
  migrations: {
    directory: resolve(__dirname, 'src/booking/infrastructure/persistence/migrations'),
    extension: 'ts',
  },
  seeds: {
    directory: resolve(__dirname, 'src/booking/infrastructure/persistence/seeds'),
    extension: 'ts',
  },
};

const config: Record<string, Knex.Config> = {
  development: shared,
  test: {
    ...shared,
    connection: {
      ...(shared.connection as Knex.MySql2ConnectionConfig),
      database: process.env.DB_TEST_NAME ?? 'hotel_test',
    },
  },
};

export default config;
