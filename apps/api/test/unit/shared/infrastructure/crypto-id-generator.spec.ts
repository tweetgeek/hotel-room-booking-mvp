import { CryptoIdGenerator } from '../../../../src/shared/infrastructure/ids/crypto-id-generator';

describe('CryptoIdGenerator', () => {
  const generator = new CryptoIdGenerator();

  it('produces reservation ids with six Crockford base32 characters', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generator.reservationId().value).toMatch(/^RES-[0-9A-HJKMNP-TV-Z]{6}$/);
    }
  });

  it('produces payment ids with ten Crockford base32 characters', () => {
    expect(generator.paymentId().value).toMatch(/^PAY-[0-9A-HJKMNP-TV-Z]{10}$/);
  });

  it('produces 32-byte hex access tokens and correlation ids as UUIDs', () => {
    expect(generator.accessToken()).toMatch(/^[0-9a-f]{64}$/);
    expect(generator.correlationId()).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('does not repeat reservation ids in a small sample', () => {
    const ids = new Set(Array.from({ length: 500 }, () => generator.reservationId().value));
    expect(ids.size).toBe(500);
  });
});
