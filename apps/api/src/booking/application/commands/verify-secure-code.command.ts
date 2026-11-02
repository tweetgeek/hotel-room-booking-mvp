import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { APP_LOGGER, type AppLogger } from '../../../shared/application/ports/logger';
import { NotFoundError } from '../../../shared/domain/errors/not-found.error';
import { ReservationId } from '../../../shared/domain/ids';
import { InvalidSecureCodeError } from '../../domain/errors/invalid-secure-code.error';
import { TooManyAttemptsError } from '../../domain/errors/too-many-attempts.error';
import { SecureCode } from '../../domain/secure-code';
import { RESERVATION_ACCESS, type IssuedToken, type ReservationAccess } from '../ports/reservation-access';
import { RESERVATION_REPOSITORY, type ReservationRepository } from '../ports/reservation-repository';

export class VerifySecureCodeCommand {
  constructor(
    readonly reservationId: string,
    readonly secureCode: string,
  ) {}
}

export interface AccessGranted {
  accessToken: string;
  expiresInSeconds: number;
}

/** The hash lives in the aggregate's first event; verification is an application concern (ADR-006). */
@CommandHandler(VerifySecureCodeCommand)
export class VerifySecureCodeHandler implements ICommandHandler<VerifySecureCodeCommand, AccessGranted> {
  constructor(
    @Inject(RESERVATION_REPOSITORY) private readonly repository: ReservationRepository,
    @Inject(RESERVATION_ACCESS) private readonly access: ReservationAccess,
    @Inject(APP_LOGGER) private readonly logger: AppLogger,
  ) {}

  async execute(command: VerifySecureCodeCommand): Promise<AccessGranted> {
    const id = ReservationId.of(command.reservationId);
    const reservation = await this.repository.load(id);
    if (!reservation) throw new NotFoundError('Reservation');

    const window = await this.access.attemptsLeft(id);
    if (window.attemptsLeft <= 0) throw new TooManyAttemptsError(window.retryAfterSeconds);

    const matches = await SecureCode.fromInput(command.secureCode).matches(reservation.secureCodeHash);
    if (!matches) {
      const after = await this.access.registerFailedAttempt(id);
      this.logger.warn(`Wrong secure code for ${id.value}; ${after.attemptsLeft} attempt(s) left`);
      throw new InvalidSecureCodeError(after.attemptsLeft);
    }

    await this.access.clearAttempts(id);
    const issued: IssuedToken = await this.access.issueToken(id);
    return { accessToken: issued.token, expiresInSeconds: issued.expiresInSeconds };
  }
}
