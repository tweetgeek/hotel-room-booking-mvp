/**
 * Public query contract of the booking context, used by the payment operator simulator
 * through the QueryBus (ADR-001, ADR-007). The handler lives in booking/application/queries.
 */
export class GetPaymentViewQuery {
  constructor(readonly paymentId: string) {}
}

export interface PaymentView {
  paymentId: string;
  reservationId: string;
  amount: number;
  currency: string;
  checkIn: string;
  checkOut: string;
  roomName: string;
  status: 'PendingPayment' | 'Confirmed' | 'Rejected' | 'Expired' | 'Cancelled';
}
