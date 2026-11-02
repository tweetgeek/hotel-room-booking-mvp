import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { CLOCK, type Clock } from '../../../shared/application/ports/clock';
import { APP_LOGGER, type AppLogger } from '../../../shared/application/ports/logger';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../shared/application/ports/unit-of-work';
import { NotFoundError } from '../../../shared/domain/errors/not-found.error';
import { ReservationId } from '../../../shared/domain/ids';
import { EVENT_PUBLISHER, type EventPublisher } from '../ports/event-publisher';
import { RESERVATION_REPOSITORY, type ReservationRepository } from '../ports/reservation-repository';
import { ROOM_NIGHT_LOCKS, type RoomNightLocks } from '../ports/room-night-locks';

export class CancelReservationCommand {
  constructor(
    readonly reservationId: string,
    readonly correlationId: string,
  ) {}
}

@CommandHandler(CancelReservationCommand)
export class CancelReservationHandler implements ICommandHandler<CancelReservationCommand, void> {
  constructor(
    @Inject(RESERVATION_REPOSITORY) private readonly repository: ReservationRepository,
    @Inject(ROOM_NIGHT_LOCKS) private readonly locks: RoomNightLocks,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly publisher: EventPublisher,
    @Inject(APP_LOGGER) private readonly logger: AppLogger,
  ) {}

  async execute(command: CancelReservationCommand): Promise<void> {
    const id = ReservationId.of(command.reservationId);
    const reservation = await this.repository.load(id);
    if (!reservation) throw new NotFoundError('Reservation');

    reservation.cancel(this.clock.today(), {
      correlationId: command.correlationId,
      causationId: 'CancelReservation',
      occurredAt: this.clock.now().toISOString(),
    });

    const stored = await this.uow.run(async (tx) => {
      const events = await this.repository.save(reservation, tx);
      await this.locks.release(id, tx);
      return events;
    });
    reservation.markEventsCommitted();
    await this.publisher.publish(stored);
    this.logger.log(`Reservation ${id.value} cancelled by the guest`);
  }
}
