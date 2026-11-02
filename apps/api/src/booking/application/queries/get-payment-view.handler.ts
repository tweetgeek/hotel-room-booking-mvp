import { Inject } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { GetPaymentViewQuery, type PaymentView } from '../../../shared/contracts/get-payment-view.query';
import { NotFoundError } from '../../../shared/domain/errors/not-found.error';
import { READ_MODEL_VIEWS, type ReadModelViews } from '../ports/read-model-views';

@QueryHandler(GetPaymentViewQuery)
export class GetPaymentViewHandler implements IQueryHandler<GetPaymentViewQuery, PaymentView> {
  constructor(@Inject(READ_MODEL_VIEWS) private readonly views: ReadModelViews) {}

  // Not cached: the simulator must see the current status to refuse decisions on expired reservations
  async execute(query: GetPaymentViewQuery): Promise<PaymentView> {
    const row = await this.views.reservationByPaymentId(query.paymentId);
    if (!row) throw new NotFoundError('Payment');
    return {
      paymentId: row.paymentId,
      reservationId: row.id,
      amount: row.totalAmount,
      currency: row.currency,
      checkIn: row.checkIn,
      checkOut: row.checkOut,
      roomName: row.roomName,
      status: row.status,
    };
  }
}
