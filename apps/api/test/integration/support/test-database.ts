import knex, { type Knex } from 'knex';
import { seed as seedRooms } from '../../../src/booking/infrastructure/persistence/seeds/001_rooms';

const WRITE_AND_READ_TABLES = [
  'events',
  'room_night_locks',
  'rm_reservations',
  'rm_reservation_timeline',
  'rm_room_nights',
  'projection_checkpoints',
];

export function connectTestDatabase(): Knex {
  return knex({
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST ?? '127.0.0.1',
      port: Number(process.env.DB_PORT ?? 3307),
      user: process.env.DB_USER ?? 'hotel',
      password: process.env.DB_PASSWORD ?? 'hotel',
      database: process.env.DB_TEST_NAME ?? 'hotel_test',
      timezone: '+00:00',
      dateStrings: true,
    },
    pool: { min: 0, max: 5 },
  });
}

export async function truncateAll(db: Knex): Promise<void> {
  for (const table of WRITE_AND_READ_TABLES) {
    await db.raw(`TRUNCATE TABLE ${table}`);
  }
  await seedRooms(db);
  await db('projection_checkpoints').insert({ name: 'reservations', last_position: 0 });
}
