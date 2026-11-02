import { PaymentId, ReservationId } from '../../../src/shared/domain/ids';
import type { IdGenerator } from '../../../src/shared/application/ports/id-generator';

export class SequentialIdGenerator implements IdGenerator {
  private counter = 0;

  reservationId(): ReservationId {
    this.counter += 1;
    return ReservationId.of(`RES-${String(this.counter).padStart(6, '0')}`);
  }

  paymentId(): PaymentId {
    this.counter += 1;
    return PaymentId.of(`PAY-${String(this.counter).padStart(10, '0')}`);
  }

  accessToken(): string {
    this.counter += 1;
    return `token-${this.counter}`.padEnd(64, '0');
  }

  correlationId(): string {
    this.counter += 1;
    return `corr-${this.counter}`;
  }
}
