import { Inject, Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import type { ReadModelCache } from '../../application/ports/read-model-cache';
import { REDIS_CACHE } from '../../../shared/infrastructure/redis/redis.module';

export interface CacheOptions {
  lockTtlMs: number;
  pollIntervalMs: number;
  waitTimeoutMs: number;
}

export const READ_MODEL_CACHE_OPTIONS = Symbol('ReadModelCacheOptions');

const DEFAULT_OPTIONS: CacheOptions = { lockTtlMs: 3000, pollIntervalMs: 50, waitTimeoutMs: 3000 };

// Only the lock owner may delete the lock, otherwise a slow loader could drop a newer owner's lock
const RELEASE_IF_OWNER = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  end
  return 0
`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Cache-aside with a stampede lock (research R-07, ADR-005): after a miss exactly one caller
 * runs the loader and fills the key; the others poll for the value and fall back to their own
 * loader (without writing) only if the owner did not deliver in time.
 */
@Injectable()
export class RedisReadModelCache implements ReadModelCache {
  private readonly options: CacheOptions;

  constructor(
    @Inject(REDIS_CACHE) private readonly redis: Redis,
    @Optional() @Inject(READ_MODEL_CACHE_OPTIONS) options: Partial<CacheOptions> = {},
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async getOrLoad<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const hit = await this.redis.get(key);
    if (hit !== null) return JSON.parse(hit) as T;

    const lockKey = `${key}:lock`;
    const token = randomUUID();
    const acquired = await this.redis.set(lockKey, token, 'PX', this.options.lockTtlMs, 'NX');
    if (acquired === 'OK') {
      try {
        const value = await loader();
        await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        return value;
      } finally {
        await this.redis.eval(RELEASE_IF_OWNER, 1, lockKey, token);
      }
    }

    const deadline = Date.now() + this.options.waitTimeoutMs;
    while (Date.now() < deadline) {
      await sleep(this.options.pollIntervalMs);
      const value = await this.redis.get(key);
      if (value !== null) return JSON.parse(value) as T;
    }
    return loader();
  }

  async invalidate(keys: readonly string[]): Promise<void> {
    if (keys.length > 0) await this.redis.del(...keys);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      if (keys.length > 0) await this.redis.del(...keys);
    } while (cursor !== '0');
  }
}
