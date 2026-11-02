import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import type { Env } from '../shared/infrastructure/config/env.schema';
import { WebhookScheduler, fetchWebhookTransport } from './application/webhook-scheduler';
import { PaymentOperatorController } from './presentation/payment-operator.controller';

/** A separate bounded context in the same process; talks to booking only via QueryBus and the webhook (ADR-007). */
@Module({
  imports: [CqrsModule],
  controllers: [PaymentOperatorController],
  providers: [
    {
      provide: WebhookScheduler,
      useFactory: (config: ConfigService<Env, true>) =>
        new WebhookScheduler(
          {
            apiBaseUrl: config.get('API_BASE_URL', { infer: true }),
            secret: config.get('WEBHOOK_SECRET', { infer: true }),
            retries: 3,
            retryDelayMs: 1000,
          },
          fetchWebhookTransport,
          new Logger(WebhookScheduler.name),
        ),
      inject: [ConfigService],
    },
  ],
})
export class PaymentOperatorModule {}
