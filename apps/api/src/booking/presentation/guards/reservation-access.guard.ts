import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { UnauthorizedError } from '../../../shared/domain/errors/unauthorized.error';
import { RESERVATION_ACCESS, type ReservationAccess } from '../../application/ports/reservation-access';

export const ACCESS_HEADER = 'x-reservation-access';

interface AccessRequest {
  headers: Record<string, string | string[] | undefined>;
  params: Record<string, string>;
}

/** The token must exist and must belong to the reservation named in the path (FR-014). */
@Injectable()
export class ReservationAccessGuard implements CanActivate {
  constructor(@Inject(RESERVATION_ACCESS) private readonly access: ReservationAccess) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AccessRequest>();
    const header = request.headers[ACCESS_HEADER];
    const token = Array.isArray(header) ? header[0] : header;
    if (!token) throw new UnauthorizedError();
    const reservationId = await this.access.resolveToken(token);
    if (!reservationId || reservationId.value !== request.params.reservationId) throw new UnauthorizedError();
    return true;
  }
}
