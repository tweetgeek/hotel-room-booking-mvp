import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { randomUUID } from 'node:crypto';
import { GetPaymentViewQuery, type PaymentView } from '../../shared/contracts/get-payment-view.query';
import { verifyWebhookSignature } from '../../shared/contracts/webhook-signature';
import type { Env } from '../../shared/infrastructure/config/env.schema';
import { ConfirmPaymentCommand } from '../application/commands/confirm-payment.command';
import { RejectPaymentCommand } from '../application/commands/reject-payment.command';
import type { DecisionResult } from '../application/commands/decision-support';
import { InvalidSignatureError } from '../domain/errors/invalid-signature.error';
import type { RejectionReason } from '../domain/rejection-reason';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';

@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // Always 200 for a well-signed webhook; `applied: false` tells the operator the decision came too late (FR-010)
  @Post('payments')
  @HttpCode(200)
  async receive(@Body() body: PaymentWebhookDto): Promise<{ received: true; applied: boolean }> {
    const secret = this.config.get('WEBHOOK_SECRET', { infer: true });
    if (!verifyWebhookSignature(secret, body.paymentId, body.outcome, body.sentAt, body.signature)) {
      throw new InvalidSignatureError();
    }
    const view: PaymentView = await this.queryBus.execute(new GetPaymentViewQuery(body.paymentId));
    const correlationId = randomUUID();

    const result: DecisionResult =
      body.outcome === 'paid'
        ? await this.commandBus.execute(
            new ConfirmPaymentCommand(view.reservationId, body.paymentId, correlationId),
          )
        : await this.commandBus.execute(
            new RejectPaymentCommand(
              view.reservationId,
              body.paymentId,
              reasonFor(body.outcome, body.reason),
              correlationId,
            ),
          );
    return { received: true, applied: result.applied };
  }
}

function reasonFor(
  outcome: 'rejected' | 'abandoned',
  given: RejectionReason | null | undefined,
): RejectionReason {
  if (given) return given;
  return outcome === 'abandoned' ? 'abandoned_by_guest' : 'rejected_by_operator';
}
