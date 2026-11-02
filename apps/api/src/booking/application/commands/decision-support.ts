import type { Clock } from '../../../shared/application/ports/clock';
import type { AppLogger } from '../../../shared/application/ports/logger';
import type { UnitOfWork } from '../../../shared/application/ports/unit-of-work';
import type { EventMetadata } from '../../../shared/domain/domain-event';
import { NotFoundError } from '../../../shared/domain/errors/not-found.error';
import { ReservationId } from '../../../shared/domain/ids';
import type { Reservation } from '../../domain/reservation';
import type { EventPublisher } from '../ports/event-publisher';
import type { ReservationRepository } from '../ports/reservation-repository';
import type { RoomNightLocks } from '../ports/room-night-locks';

export interface DecisionResult {
  applied: boolean;
}

export interface DecisionDeps {
  repository: ReservationRepository;
  locks: RoomNightLocks;
  clock: Clock;
  uow: UnitOfWork;
  publisher: EventPublisher;
  logger: AppLogger;
}

/**
 * Shared flow of ConfirmPayment, RejectPayment and ExpireReservation: load, decide, and when the
 * aggregate applied the decision, save it (releasing night locks if asked) and publish after commit.
 */
export async function applyDecision(
  deps: DecisionDeps,
  reservationId: string,
  causationId: string,
  correlationId: string,
  decide: (reservation: Reservation, metadata: EventMetadata) => boolean,
  releasesNights: boolean,
): Promise<DecisionResult> {
  const id = ReservationId.of(reservationId);
  const reservation = await deps.repository.load(id);
  if (!reservation) throw new NotFoundError('Reservation');

  const metadata: EventMetadata = { correlationId, causationId, occurredAt: deps.clock.now().toISOString() };
  if (!decide(reservation, metadata)) {
    deps.logger.warn(`${causationId} ignored for ${id.value}: status is ${reservation.status}`);
    return { applied: false };
  }

  const stored = await deps.uow.run(async (tx) => {
    const events = await deps.repository.save(reservation, tx);
    if (releasesNights) await deps.locks.release(id, tx);
    return events;
  });
  reservation.markEventsCommitted();
  await deps.publisher.publish(stored);
  return { applied: true };
}
