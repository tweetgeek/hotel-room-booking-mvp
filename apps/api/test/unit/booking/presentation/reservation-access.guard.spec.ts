import type { ExecutionContext } from '@nestjs/common';
import { ReservationAccessGuard } from '../../../../src/booking/presentation/guards/reservation-access.guard';
import { UnauthorizedError } from '../../../../src/shared/domain/errors/unauthorized.error';
import { ReservationId } from '../../../../src/shared/domain/ids';
import { InMemoryReservationAccess } from '../../support/in-memory-reservation-access';

function context(headers: Record<string, string>, reservationId: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers, params: { reservationId } }) }),
  } as unknown as ExecutionContext;
}

describe('ReservationAccessGuard', () => {
  it('allows a token issued for the reservation in the path', async () => {
    const access = new InMemoryReservationAccess();
    const { token } = await access.issueToken(ReservationId.of('RES-7F3K2A'));
    const guard = new ReservationAccessGuard(access);

    expect(await guard.canActivate(context({ 'x-reservation-access': token }, 'RES-7F3K2A'))).toBe(true);
  });

  it('rejects a missing, unknown or foreign token', async () => {
    const access = new InMemoryReservationAccess();
    const { token } = await access.issueToken(ReservationId.of('RES-7F3K2A'));
    const guard = new ReservationAccessGuard(access);

    await expect(guard.canActivate(context({}, 'RES-7F3K2A'))).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(
      guard.canActivate(context({ 'x-reservation-access': 'nope' }, 'RES-7F3K2A')),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(
      guard.canActivate(context({ 'x-reservation-access': token }, 'RES-OTHER1')),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
