import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { CLOCK, type Clock } from '../../../shared/application/ports/clock';
import { APP_LOGGER, type AppLogger } from '../../../shared/application/ports/logger';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../shared/application/ports/unit-of-work';
import { EVENT_PUBLISHER, type EventPublisher } from '../ports/event-publisher';
import { RESERVATION_REPOSITORY, type ReservationRepository } from '../ports/reservation-repository';
import { ROOM_NIGHT_LOCKS, type RoomNightLocks } from '../ports/room-night-locks';
import { applyDecision, type DecisionResult } from './decision-support';

export class ExpireReservationCommand {
  constructor(
    readonly reservationId: string,

    readonly correlationId: string,
  ) {}
}

@CommandHandler(ExpireReservationCommand)
export class ExpireReservationHandler implements ICommandHandler<ExpireReservationCommand, DecisionResult> {
  constructor(
    @Inject(RESERVATION_REPOSITORY) readonly repository: ReservationRepository,
    @Inject(ROOM_NIGHT_LOCKS) readonly locks: RoomNightLocks,
    @Inject(CLOCK) readonly clock: Clock,
    @Inject(UNIT_OF_WORK) readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) readonly publisher: EventPublisher,
    @Inject(APP_LOGGER) readonly logger: AppLogger,
  ) {}

  execute(command: ExpireReservationCommand): Promise<DecisionResult> {
    return applyDecision(
      this,
      command.reservationId,
      'ExpireReservation',
      command.correlationId,
      (reservation, metadata) => reservation.expire(metadata),
      true,
    );
  }
}
