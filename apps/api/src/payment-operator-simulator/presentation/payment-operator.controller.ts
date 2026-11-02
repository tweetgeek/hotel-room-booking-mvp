import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { GetPaymentViewQuery, type PaymentView } from '../../shared/contracts/get-payment-view.query';
import { WebhookScheduler } from '../application/webhook-scheduler';
import { ReservationNotPendingError } from '../domain/reservation-not-pending.error';
import { DecideDto } from './dto/decide.dto';
import { PaymentIdPipe } from './payment-id.pipe';

export interface DecisionAccepted {
  paymentId: string;
  outcome: DecideDto['outcome'];
  scheduledInSeconds: number;
}

@Controller('payment-operator/payments')
export class PaymentOperatorController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly scheduler: WebhookScheduler,
  ) {}

  @Get(':paymentId')
  view(@Param('paymentId', PaymentIdPipe) paymentId: string): Promise<PaymentView> {
    return this.queryBus.execute(new GetPaymentViewQuery(paymentId));
  }

  @Post(':paymentId/decide')
  @HttpCode(202)
  async decide(
    @Param('paymentId', PaymentIdPipe) paymentId: string,
    @Body() body: DecideDto,
  ): Promise<DecisionAccepted> {
    const view: PaymentView = await this.queryBus.execute(new GetPaymentViewQuery(paymentId));
    if (view.status !== 'PendingPayment') throw new ReservationNotPendingError(view.status);
    this.scheduler.schedule(paymentId, body.outcome, body.delaySeconds);
    return { paymentId, outcome: body.outcome, scheduledInSeconds: body.delaySeconds };
  }
}
