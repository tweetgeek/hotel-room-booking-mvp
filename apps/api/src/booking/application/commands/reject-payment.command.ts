import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { CLOCK, type Clock } from '../../../shared/application/ports/clock';
import { APP_LOGGER, type AppLogger } from '../../../shared/application/ports/logger';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../shared/application/ports/unit-of-work';
import { PaymentId } from '../../../shared/domain/ids';
import type { RejectionReason } from '../../domain/rejection-reason';
import { EVENT_PUBLISHER, type EventPublisher } from '../ports/event-publisher';
import { RESERVATION_REPOSITORY, type ReservationRepository } from '../ports/reservation-repository';
import { ROOM_NIGHT_LOCKS, type RoomNightLocks } from '../ports/room-night-locks';
import { applyDecision, type DecisionResult } from './decision-support';

export class RejectPaymentCommand {
  constructor(
    readonly reservationId: string,
    readonly paymentId: string,
    readonly reason: RejectionReason,
    readonly correlationId: string,
  ) {}
}

@CommandHandler(RejectPaymentCommand)
export class RejectPaymentHandler implements ICommandHandler<RejectPaymentCommand, DecisionResult> {
  constructor(
    @Inject(RESERVATION_REPOSITORY) readonly repository: ReservationRepository,
    @Inject(ROOM_NIGHT_LOCKS) readonly locks: RoomNightLocks,
    @Inject(CLOCK) readonly clock: Clock,
    @Inject(UNIT_OF_WORK) readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) readonly publisher: EventPublisher,
    @Inject(APP_LOGGER) readonly logger: AppLogger,
  ) {}

  execute(command: RejectPaymentCommand): Promise<DecisionResult> {
    return applyDecision(
      this,
      command.reservationId,
      'RejectPayment',
      command.correlationId,
      (reservation, metadata) =>
        reservation.rejectPayment(PaymentId.of(command.paymentId), command.reason, metadata),
      true,
    );
  }
}
