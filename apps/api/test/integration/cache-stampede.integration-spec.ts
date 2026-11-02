import type Redis from 'ioredis';
import { connectTestRedis } from './support/test-redis';
import { RedisReadModelCache } from '../../src/booking/infrastructure/cache/redis-read-model-cache';

describe('RedisReadModelCache', () => {
  let redis: Redis;
  let cache: RedisReadModelCache;

  beforeAll(() => {
    redis = connectTestRedis(2);
  });
  beforeEach(async () => {
    await redis.flushdb();
    cache = new RedisReadModelCache(redis, { lockTtlMs: 3000, pollIntervalMs: 20, waitTimeoutMs: 1000 });
  });
  afterAll(() => redis.quit());

  it('runs the loader exactly once for 500 concurrent misses (SC-005)', async () => {
    let loaderCalls = 0;
    const loader = async () => {
      loaderCalls += 1;
      await new Promise((r) => setTimeout(r, 100));
      return { nights: ['2026-11-10'], loadedAt: loaderCalls };
    };

    const results = await Promise.all(
      Array.from({ length: 500 }, () => cache.getOrLoad('room:1:nights:2026-11-01:2026-11-30', 60, loader)),
    );

    expect(loaderCalls).toBe(1);
    expect(new Set(results.map((r) => JSON.stringify(r))).size).toBe(1);
    expect(await redis.ttl('room:1:nights:2026-11-01:2026-11-30')).toBeGreaterThan(50);
    expect(await redis.exists('room:1:nights:2026-11-01:2026-11-30:lock')).toBe(0);
  });

  it('serves a hit without calling the loader', async () => {
    await redis.set('rooms:list', JSON.stringify([{ id: 1 }]));
    const loader = jest.fn();
    expect(await cache.getOrLoad('rooms:list', 600, loader)).toEqual([{ id: 1 }]);
    expect(loader).not.toHaveBeenCalled();
  });

  it('falls back to the loader without writing when another owner holds the lock too long', async () => {
    await redis.set('room:1:card:lock', 'someone-else', 'PX', 10_000);
    const loader = jest.fn(async () => ({ id: 1 }));

    expect(await cache.getOrLoad('room:1:card', 600, loader)).toEqual({ id: 1 });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(await redis.get('room:1:card')).toBeNull();
    expect(await redis.get('room:1:card:lock')).toBe('someone-else');
  });

  it('invalidates single keys and patterns', async () => {
    await redis.mset(
      'reservation:RES-A:details',
      '1',
      'reservation:RES-A:status',
      '2',
      'room:1:nights:a:b',
      '3',
      'room:1:nights:c:d',
      '4',
      'room:2:nights:a:b',
      '5',
    );

    await cache.invalidate(['reservation:RES-A:details', 'reservation:RES-A:status']);
    await cache.invalidatePattern('room:1:nights:*');

    expect(await redis.keys('*')).toEqual(['room:2:nights:a:b']);
  });
});
