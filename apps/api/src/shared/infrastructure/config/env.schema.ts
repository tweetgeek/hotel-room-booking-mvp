import { z } from 'zod';

export const envSchema = z.object({
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().positive().default(3307),
  DB_USER: z.string().default('hotel'),
  DB_PASSWORD: z.string().default('hotel'),
  DB_NAME: z.string().default('hotel'),
  DB_TEST_NAME: z.string().default('hotel_test'),
  REDIS_URL: z.string().url().default('redis://127.0.0.1:6380'),
  REDIS_CACHE_DB: z.coerce.number().int().min(0).max(15).default(0),
  REDIS_ACCESS_DB: z.coerce.number().int().min(0).max(15).default(1),
  WEBHOOK_SECRET: z.string().min(8),
  API_BASE_URL: z.string().url().default('http://localhost:3100'),
  PORT: z.coerce.number().int().positive().default(3100),
  PENDING_PAYMENT_TTL_MINUTES: z.coerce.number().int().positive().default(15),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  return envSchema.parse(raw);
}
