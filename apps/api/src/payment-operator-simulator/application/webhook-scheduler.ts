import type { AppLogger } from '../../shared/application/ports/logger';
import { signWebhook, type PaymentOutcome } from '../../shared/contracts/webhook-signature';

export interface WebhookSchedulerOptions {
  apiBaseUrl: string;
  secret: string;
  retries: number;
  retryDelayMs: number;
}

export type WebhookTransport = (url: string, body: Record<string, unknown>) => Promise<void>;

const REASON_BY_OUTCOME: Record<PaymentOutcome, string | null> = {
  paid: null,
  rejected: 'rejected_by_operator',
  abandoned: 'abandoned_by_guest',
};

/**
 * Plays the external payment operator: the decision is delivered later, over HTTP, signed,
 * and retried on network failure. Scheduled deliveries die with the process (ADR-007).
 */
export class WebhookScheduler {
  constructor(
    private readonly options: WebhookSchedulerOptions,
    private readonly transport: WebhookTransport,
    private readonly logger: AppLogger,
  ) {}

  schedule(paymentId: string, outcome: PaymentOutcome, delaySeconds: number): void {
    setTimeout(() => void this.deliver(paymentId, outcome, 1), delaySeconds * 1000);
  }

  private async deliver(paymentId: string, outcome: PaymentOutcome, attempt: number): Promise<void> {
    const sentAt = new Date().toISOString();
    const body = {
      paymentId,
      outcome,
      reason: REASON_BY_OUTCOME[outcome],
      sentAt,
      signature: signWebhook(this.options.secret, paymentId, outcome, sentAt),
    };
    try {
      await this.transport(`${this.options.apiBaseUrl}/webhooks/payments`, body);
    } catch (error) {
      if (error instanceof NoRetryError) {
        this.logger.error(`Webhook for ${paymentId} was refused: ${error.message}`);
        return;
      }
      if (attempt > this.options.retries) {
        this.logger.error(`Webhook for ${paymentId} gave up after ${attempt} attempts: ${String(error)}`);
        return;
      }
      this.logger.warn(`Webhook for ${paymentId} failed (attempt ${attempt}), retrying: ${String(error)}`);
      setTimeout(() => void this.deliver(paymentId, outcome, attempt + 1), this.options.retryDelayMs);
    }
  }
}

export const fetchWebhookTransport: WebhookTransport = async (url, body) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    // A rejected webhook (bad signature, unknown payment) is not a transport failure; do not retry
    throw new NoRetryError(`Webhook answered HTTP ${response.status}`);
  }
};

export class NoRetryError extends Error {}
