import type { ReservationId } from '../../../shared/domain/ids';

export const RESERVATION_ACCESS = Symbol('ReservationAccess');

export interface IssuedToken {
  token: string;
  expiresInSeconds: number;
}

export interface AttemptWindow {
  attemptsLeft: number;
  /** Seconds until the window resets; 0 when no attempt is recorded. */
  retryAfterSeconds: number;
}

export const MAX_SECURE_CODE_ATTEMPTS = 5;
export const ATTEMPT_WINDOW_SECONDS = 900;

/** Bearer tokens for the reservation page, issued after creation or a correct secure code (ADR-006). */
export interface ReservationAccess {
  issueToken(reservationId: ReservationId): Promise<IssuedToken>;
  resolveToken(token: string): Promise<ReservationId | null>;
  /** 5 failed attempts per 15 minutes, counted from the first failure (FR-015). */
  attemptsLeft(reservationId: ReservationId): Promise<AttemptWindow>;
  registerFailedAttempt(reservationId: ReservationId): Promise<AttemptWindow>;
  clearAttempts(reservationId: ReservationId): Promise<void>;
}
