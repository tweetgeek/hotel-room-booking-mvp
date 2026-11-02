import { WebhookScheduler } from '../../../src/payment-operator-simulator/application/webhook-scheduler';
import { signWebhook, verifyWebhookSignature } from '../../../src/shared/contracts/webhook-signature';
import { createHmac } from 'node:crypto';

describe('webhook signature', () => {
  it('is hex(HMAC_SHA256(secret, paymentId.outcome.sentAt))', () => {
    const expected = createHmac('sha256', 'secret')
      .update('PAY-1.paid.2026-11-03T10:00:00.000Z')
      .digest('hex');
    expect(signWebhook('secret', 'PAY-1', 'paid', '2026-11-03T10:00:00.000Z')).toBe(expected);
    expect(verifyWebhookSignature('secret', 'PAY-1', 'paid', '2026-11-03T10:00:00.000Z', expected)).toBe(
      true,
    );
    expect(verifyWebhookSignature('other', 'PAY-1', 'paid', '2026-11-03T10:00:00.000Z', expected)).toBe(
      false,
    );
    expect(verifyWebhookSignature('secret', 'PAY-1', 'paid', '2026-11-03T10:00:00.000Z', 'abc')).toBe(false);
  });
});

describe('WebhookScheduler', () => {
  const sentAt = '2026-11-03T10:00:00.000Z';
  let deliveries: Array<{ url: string; body: Record<string, unknown> }>;
  let transport: jest.Mock;
  let scheduler: WebhookScheduler;

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date(sentAt) });
    deliveries = [];
    transport = jest.fn(async (url: string, body: Record<string, unknown>) => {
      deliveries.push({ url, body });
    });
    scheduler = new WebhookScheduler(
      { apiBaseUrl: 'http://api.local', secret: 'secret', retries: 3, retryDelayMs: 1000 },
      transport,
      { warn: jest.fn(), error: jest.fn(), log: jest.fn() },
    );
  });
  afterEach(() => jest.useRealTimers());

  it.each([0, 3, 10])('delivers a signed paid webhook after %s seconds', async (delay) => {
    scheduler.schedule('PAY-9Q2M4H7ZXT', 'paid', delay);
    if (delay > 0) {
      await jest.advanceTimersByTimeAsync(delay * 1000 - 1);
      expect(deliveries).toHaveLength(0);
    }
    await jest.advanceTimersByTimeAsync(delay === 0 ? 0 : 1);

    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].url).toBe('http://api.local/webhooks/payments');
    // sentAt is the delivery instant, which the fake clock moved forward by the delay
    const deliveredAt = new Date(Date.parse(sentAt) + delay * 1000).toISOString();
    expect(deliveries[0].body).toEqual({
      paymentId: 'PAY-9Q2M4H7ZXT',
      outcome: 'paid',
      reason: null,
      sentAt: deliveredAt,
      signature: signWebhook('secret', 'PAY-9Q2M4H7ZXT', 'paid', deliveredAt),
    });
  });

  it('maps rejected and abandoned to their reasons', async () => {
    scheduler.schedule('PAY-A', 'rejected', 0);
    scheduler.schedule('PAY-B', 'abandoned', 0);
    await jest.advanceTimersByTimeAsync(0);
    expect(deliveries.map((d) => [d.body.outcome, d.body.reason])).toEqual([
      ['rejected', 'rejected_by_operator'],
      ['abandoned', 'abandoned_by_guest'],
    ]);
  });

  it('retries up to three times every second after a transport failure, then gives up', async () => {
    transport.mockRejectedValue(new Error('ECONNREFUSED'));
    scheduler.schedule('PAY-A', 'paid', 0);

    await jest.advanceTimersByTimeAsync(0);
    expect(transport).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1000);
    expect(transport).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(1000);
    expect(transport).toHaveBeenCalledTimes(3);
    await jest.advanceTimersByTimeAsync(1000);
    expect(transport).toHaveBeenCalledTimes(4);
    await jest.advanceTimersByTimeAsync(5000);
    expect(transport).toHaveBeenCalledTimes(4);
  });
});
