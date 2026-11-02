import type { PaymentId, ReservationId } from '../../domain/ids';

export const ID_GENERATOR = Symbol('IdGenerator');

export interface IdGenerator {
  reservationId(): ReservationId;
  paymentId(): PaymentId;
  /** 32 random bytes as hex; bearer token for the reservation page. */
  accessToken(): string;
  correlationId(): string;
}
