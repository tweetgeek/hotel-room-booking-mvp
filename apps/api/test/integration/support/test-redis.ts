import Redis from 'ioredis';

export function connectTestRedis(db: 2 | 3): Redis {
  return new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6380', { db });
}

export async function flushTestRedis(): Promise<void> {
  for (const db of [2, 3] as const) {
    const client = connectTestRedis(db);
    await client.flushdb();
    await client.quit();
  }
}
