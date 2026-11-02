import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

// Loaded by Jest before any module so ConfigModule sees the test database and Redis databases
// (research R-11): the UI's data in `hotel` and Redis db 0/1 are never touched by tests.
loadEnv({ path: resolve(__dirname, '../../../../../.env') });
process.env.DB_NAME = process.env.DB_TEST_NAME ?? 'hotel_test';
process.env.REDIS_CACHE_DB = '2';
process.env.REDIS_ACCESS_DB = '3';
process.env.WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? 'test-webhook-secret';
process.env.PENDING_PAYMENT_TTL_MINUTES = process.env.PENDING_PAYMENT_TTL_MINUTES ?? '15';
