import { commandWorld, createCommand } from './support';
import {
  VerifySecureCodeCommand,
  VerifySecureCodeHandler,
} from '../../../../src/booking/application/commands/verify-secure-code.command';
import { InvalidSecureCodeError, TooManyAttemptsError } from '../../../../src/booking/domain/errors';
import { NotFoundError } from '../../../../src/shared/domain/errors/not-found.error';

async function worldWithReservation() {
  const w = commandWorld();
  const created = await w.createHandler.execute(createCommand());
  const handler = new VerifySecureCodeHandler(w.repository, w.access, w.logger);
  return { ...w, created, handler };
}

describe('VerifySecureCodeHandler', () => {
  it('issues a 15-minute access token for the correct code and resets the attempt counter', async () => {
    const w = await worldWithReservation();
    await expect(
      w.handler.execute(new VerifySecureCodeCommand(w.created.reservationId, 'wrong1')),
    ).rejects.toBeInstanceOf(InvalidSecureCodeError);

    const granted = await w.handler.execute(
      new VerifySecureCodeCommand(w.created.reservationId, w.created.secureCode),
    );

    expect(granted).toEqual({ accessToken: w.access.lastIssuedToken, expiresInSeconds: 900 });
    expect(await w.access.resolveToken(granted.accessToken)).toMatchObject({
      value: w.created.reservationId,
    });
    expect(w.access.failedAttempts(w.created.reservationId)).toBe(0);
  });

  it('accepts the code with a hyphen but not with different casing', async () => {
    const w = await worldWithReservation();
    const code = w.created.secureCode;
    await expect(
      w.handler.execute(
        new VerifySecureCodeCommand(w.created.reservationId, `${code.slice(0, 3)}-${code.slice(3)}`),
      ),
    ).resolves.toBeDefined();
    const flipped = code === code.toLowerCase() ? code.toUpperCase() : code.toLowerCase();
    await expect(
      w.handler.execute(new VerifySecureCodeCommand(w.created.reservationId, flipped)),
    ).rejects.toBeInstanceOf(InvalidSecureCodeError);
  });

  it('counts down attemptsLeft 4, 3, 2, 1, 0 and then refuses with TooManyAttemptsError', async () => {
    const w = await worldWithReservation();
    const seen: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      try {
        await w.handler.execute(new VerifySecureCodeCommand(w.created.reservationId, 'wrong1'));
      } catch (error) {
        seen.push((error as InvalidSecureCodeError).extras.attemptsLeft as number);
      }
    }
    expect(seen).toEqual([4, 3, 2, 1, 0]);

    await expect(
      w.handler.execute(new VerifySecureCodeCommand(w.created.reservationId, w.created.secureCode)),
    ).rejects.toMatchObject({
      code: 'TOO_MANY_ATTEMPTS',
      extras: { retryAfterSeconds: expect.any(Number) },
    });
    await expect(
      w.handler.execute(new VerifySecureCodeCommand(w.created.reservationId, 'wrong1')),
    ).rejects.toBeInstanceOf(TooManyAttemptsError);
  });

  it('answers NotFoundError for an unknown reservation without counting an attempt', async () => {
    const w = await worldWithReservation();
    await expect(
      w.handler.execute(new VerifySecureCodeCommand('RES-ZZZZZZ', 'abcdef')),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(w.access.failedAttempts('RES-ZZZZZZ')).toBe(0);
  });
});
