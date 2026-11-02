import request from 'supertest';

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls the public status endpoint until it leaves PendingPayment or the deadline passes. */
export async function waitForStatus(
  baseUrl: string,
  reservationId: string,
  timeoutMs = 5000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let status = 'PendingPayment';
  while (Date.now() < deadline) {
    const response = await request(baseUrl).get(`/reservations/${reservationId}/status`);
    status = response.body.status;
    if (status !== 'PendingPayment') return status;
    await sleep(200);
  }
  return status;
}
