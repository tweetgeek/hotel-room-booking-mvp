import type Redis from 'ioredis';
import { connectTestRedis } from './support/test-redis';
import { RedisReservationAccess } from '../../src/booking/infrastructure/access/redis-reservation-access';
import { CryptoIdGenerator } from '../../src/shared/infrastructure/ids/crypto-id-generator';
import { ReservationId } from '../../src/shared/domain/ids';

describe('RedisReservationAccess', () => {
  let redis: Redis;
  let access: RedisReservationAccess;
  const id = ReservationId.of('RES-7F3K2A');

  beforeAll(() => {
    redis = connectTestRedis(3);
  });
  beforeEach(async () => {
    await redis.flushdb();
    access = new RedisReservationAccess(redis, new CryptoIdGenerator());
  });
  afterAll(() => redis.quit());

  it('issues tokens that expire after 900 s and resolve to the reservation', async () => {
    const { token, expiresInSeconds } = await access.issueToken(id);
    expect(expiresInSeconds).toBe(900);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(await redis.ttl(`access:${token}`)).toBeGreaterThan(890);
    expect((await access.resolveToken(token))?.value).toBe('RES-7F3K2A');
    expect(await access.resolveToken('unknown')).toBeNull();
  });

  it('counts failed attempts in a 15-minute window started by the first attempt', async () => {
    expect(await access.attemptsLeft(id)).toEqual({ attemptsLeft: 5, retryAfterSeconds: 0 });

    for (let i = 1; i <= 5; i += 1) {
      const state = await access.registerFailedAttempt(id);
      expect(state.attemptsLeft).toBe(5 - i);
    }
    const ttl = await redis.ttl('secure-code-attempts:RES-7F3K2A');
    expect(ttl).toBeGreaterThan(890);
    expect(ttl).toBeLessThanOrEqual(900);

    const locked = await access.attemptsLeft(id);
    expect(locked.attemptsLeft).toBe(0);
    expect(locked.retryAfterSeconds).toBeGreaterThan(890);

    await access.clearAttempts(id);
    expect(await redis.exists('secure-code-attempts:RES-7F3K2A')).toBe(0);
    expect(await access.attemptsLeft(id)).toEqual({ attemptsLeft: 5, retryAfterSeconds: 0 });
  });
});
