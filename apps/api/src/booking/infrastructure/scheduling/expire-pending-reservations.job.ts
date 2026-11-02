import { Inject, Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Interval } from '@nestjs/schedule';
import { CLOCK, type Clock } from '../../../shared/application/ports/clock';
import { APP_LOGGER, type AppLogger } from '../../../shared/application/ports/logger';
import { ExpireReservationCommand } from '../../application/commands/expire-reservation.command';
import { READ_MODEL_VIEWS, type ReadModelViews } from '../../application/ports/read-model-views';

export const PENDING_PAYMENT_TTL_MINUTES = Symbol('PendingPaymentTtlMinutes');
export const EXPIRY_CHECK_INTERVAL_MS = 60_000;

/** Expires reservations whose hold period passed; FR-011 allows up to one minute of lag. */
@Injectable()
export class ExpirePendingReservationsJob {
  constructor(
    @Inject(READ_MODEL_VIEWS) private readonly views: ReadModelViews,
    private readonly commandBus: CommandBus,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(PENDING_PAYMENT_TTL_MINUTES) private readonly ttlMinutes: number,
    @Inject(APP_LOGGER) private readonly logger: AppLogger,
  ) {}

  @Interval(EXPIRY_CHECK_INTERVAL_MS)
  async run(): Promise<number> {
    const cutoff = new Date(this.clock.now().getTime() - this.ttlMinutes * 60_000).toISOString();
    const ids = await this.views.pendingReservationsCreatedBefore(cutoff);
    let expired = 0;
    for (const id of ids) {
      try {
        const result = await this.commandBus.execute(
          new ExpireReservationCommand(id, `expiry-job-${cutoff}`),
        );
        if (result.applied) expired += 1;
      } catch (error) {
        // One stuck reservation must not stop the others from expiring
        this.logger.error(`Expiring ${id} failed: ${String(error)}`);
      }
    }
    if (expired > 0) this.logger.log(`Expired ${expired} pending reservation(s) created before ${cutoff}`);
    return expired;
  }
}
