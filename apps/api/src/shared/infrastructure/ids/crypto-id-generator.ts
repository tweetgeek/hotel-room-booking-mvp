import { randomBytes, randomUUID } from 'node:crypto';
import { CROCKFORD_ALPHABET, PaymentId, ReservationId } from '../../domain/ids';
import type { IdGenerator } from '../../application/ports/id-generator';

function randomCrockford(length: number): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += CROCKFORD_ALPHABET[bytes[i] % CROCKFORD_ALPHABET.length];
  }
  return out;
}

export class CryptoIdGenerator implements IdGenerator {
  reservationId(): ReservationId {
    return ReservationId.of(`RES-${randomCrockford(6)}`);
  }

  paymentId(): PaymentId {
    return PaymentId.of(`PAY-${randomCrockford(10)}`);
  }

  accessToken(): string {
    return randomBytes(32).toString('hex');
  }

  correlationId(): string {
    return randomUUID();
  }
}
