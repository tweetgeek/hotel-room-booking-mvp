import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { ID_GENERATOR, type IdGenerator } from '../../../shared/application/ports/id-generator';
import { ReservationId } from '../../../shared/domain/ids';
import { REDIS_ACCESS } from '../../../shared/infrastructure/redis/redis.module';
import {
  ATTEMPT_WINDOW_SECONDS,
  MAX_SECURE_CODE_ATTEMPTS,
  type AttemptWindow,
  type IssuedToken,
  type ReservationAccess,
} from '../../application/ports/reservation-access';

export const ACCESS_TOKEN_TTL_SECONDS = 900;

@Injectable()
export class RedisReservationAccess implements ReservationAccess {
  constructor(
    @Inject(REDIS_ACCESS) private readonly redis: Redis,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async issueToken(reservationId: ReservationId): Promise<IssuedToken> {
    const token = this.ids.accessToken();
    await this.redis.set(`access:${token}`, reservationId.value, 'EX', ACCESS_TOKEN_TTL_SECONDS);
    return { token, expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS };
  }

  async resolveToken(token: string): Promise<ReservationId | null> {
    const id = await this.redis.get(`access:${token}`);
    return id ? ReservationId.of(id) : null;
  }

  async attemptsLeft(reservationId: ReservationId): Promise<AttemptWindow> {
    const key = attemptsKey(reservationId);
    const [count, ttl] = await Promise.all([this.redis.get(key), this.redis.ttl(key)]);
    return toWindow(Number(count ?? 0), ttl);
  }

  async registerFailedAttempt(reservationId: ReservationId): Promise<AttemptWindow> {
    const key = attemptsKey(reservationId);
    const count = await this.redis.incr(key);
    // The window starts with the first failure and is not extended by later ones
    if (count === 1) await this.redis.expire(key, ATTEMPT_WINDOW_SECONDS);
    return toWindow(count, await this.redis.ttl(key));
  }

  async clearAttempts(reservationId: ReservationId): Promise<void> {
    await this.redis.del(attemptsKey(reservationId));
  }
}

const attemptsKey = (reservationId: ReservationId): string => `secure-code-attempts:${reservationId.value}`;

function toWindow(count: number, ttl: number): AttemptWindow {
  return {
    attemptsLeft: Math.max(0, MAX_SECURE_CODE_ATTEMPTS - count),
    retryAfterSeconds: count > 0 && ttl > 0 ? ttl : 0,
  };
}
