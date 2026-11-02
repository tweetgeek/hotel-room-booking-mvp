import { InvalidValueError } from './domain-error';

// Crockford base32 leaves out I, L, O and U so guests can read ids aloud without ambiguity (research R-04)
export const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const RESERVATION_ID = /^RES-[0-9A-HJKMNP-TV-Z]{6}$/;
const PAYMENT_ID = /^PAY-[0-9A-HJKMNP-TV-Z]{10}$/;

export class ReservationId {
  private constructor(readonly value: string) {}

  static of(value: string): ReservationId {
    if (!RESERVATION_ID.test(value)) {
      throw new InvalidValueError(
        `Reservation id must match RES- plus six Crockford base32 characters, got "${value}"`,
      );
    }
    return new ReservationId(value);
  }

  equals(other: ReservationId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

export class PaymentId {
  private constructor(readonly value: string) {}

  static of(value: string): PaymentId {
    if (!PAYMENT_ID.test(value)) {
      throw new InvalidValueError(
        `Payment id must match PAY- plus ten Crockford base32 characters, got "${value}"`,
      );
    }
    return new PaymentId(value);
  }

  equals(other: PaymentId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

export class RoomId {
  private constructor(readonly value: number) {}

  static of(value: number): RoomId {
    if (!Number.isInteger(value) || value < 1) {
      throw new InvalidValueError(`Room id must be a positive integer, got ${value}`);
    }
    return new RoomId(value);
  }

  equals(other: RoomId): boolean {
    return this.value === other.value;
  }
}
