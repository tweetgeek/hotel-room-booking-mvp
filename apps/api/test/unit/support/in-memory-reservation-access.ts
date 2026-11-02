import { ReservationId } from '../../../src/shared/domain/ids';
import {
  ATTEMPT_WINDOW_SECONDS,
  MAX_SECURE_CODE_ATTEMPTS,
  type AttemptWindow,
  type IssuedToken,
  type ReservationAccess,
} from '../../../src/booking/application/ports/reservation-access';

export class InMemoryReservationAccess implements ReservationAccess {
  readonly tokens = new Map<string, string>();
  private readonly attempts = new Map<string, number>();
  lastIssuedToken: string | null = null;
  private counter = 0;

  async issueToken(reservationId: ReservationId): Promise<IssuedToken> {
    this.counter += 1;
    const token = `token-${this.counter}`;
    this.tokens.set(token, reservationId.value);
    this.lastIssuedToken = token;
    return { token, expiresInSeconds: 900 };
  }

  async resolveToken(token: string): Promise<ReservationId | null> {
    const id = this.tokens.get(token);
    return id ? ReservationId.of(id) : null;
  }

  async attemptsLeft(reservationId: ReservationId): Promise<AttemptWindow> {
    return this.window(this.attempts.get(reservationId.value) ?? 0);
  }

  async registerFailedAttempt(reservationId: ReservationId): Promise<AttemptWindow> {
    const count = (this.attempts.get(reservationId.value) ?? 0) + 1;
    this.attempts.set(reservationId.value, count);
    return this.window(count);
  }

  async clearAttempts(reservationId: ReservationId): Promise<void> {
    this.attempts.delete(reservationId.value);
  }

  failedAttempts(reservationId: string): number {
    return this.attempts.get(reservationId) ?? 0;
  }

  private window(count: number): AttemptWindow {
    return {
      attemptsLeft: Math.max(0, MAX_SECURE_CODE_ATTEMPTS - count),
      retryAfterSeconds: count > 0 ? ATTEMPT_WINDOW_SECONDS : 0,
    };
  }
}
