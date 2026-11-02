import { createHmac, timingSafeEqual } from 'node:crypto';

export type PaymentOutcome = 'paid' | 'rejected' | 'abandoned';

/** `hex(HMAC_SHA256(secret, paymentId.outcome.sentAt))` (contracts/openapi.yaml, ADR-007). */
export function signWebhook(
  secret: string,
  paymentId: string,
  outcome: PaymentOutcome,
  sentAt: string,
): string {
  return createHmac('sha256', secret).update(`${paymentId}.${outcome}.${sentAt}`).digest('hex');
}

export function verifyWebhookSignature(
  secret: string,
  paymentId: string,
  outcome: PaymentOutcome,
  sentAt: string,
  signature: string,
): boolean {
  const expected = Buffer.from(signWebhook(secret, paymentId, outcome, sentAt), 'hex');
  const actual = Buffer.from(signature, 'hex');
  return expected.length === actual.length && actual.length > 0 && timingSafeEqual(expected, actual);
}
