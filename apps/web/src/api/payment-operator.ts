import { request } from './client';
import type { ReservationStatus } from '../i18n/pl';

export type PaymentOutcome = 'paid' | 'rejected' | 'abandoned';
export type DecisionDelay = 0 | 3 | 10;

export interface PaymentView {
  paymentId: string;
  reservationId: string;
  amount: number;
  currency: string;
  checkIn: string;
  checkOut: string;
  roomName: string;
  status: ReservationStatus;
}

export interface DecisionAccepted {
  paymentId: string;
  outcome: PaymentOutcome;
  scheduledInSeconds: number;
}

export const fetchPayment = (paymentId: string): Promise<PaymentView> =>
  request(`/payment-operator/payments/${paymentId}`);

export const decidePayment = (
  paymentId: string,
  outcome: PaymentOutcome,
  delaySeconds: DecisionDelay,
): Promise<DecisionAccepted> =>
  request(`/payment-operator/payments/${paymentId}/decide`, {
    method: 'POST',
    body: { outcome, delaySeconds },
  });
