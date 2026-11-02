import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { CLOCK, type Clock } from '../../../shared/application/ports/clock';
import { ID_GENERATOR, type IdGenerator } from '../../../shared/application/ports/id-generator';
import { APP_LOGGER, type AppLogger } from '../../../shared/application/ports/logger';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../shared/application/ports/unit-of-work';
import { CalendarDate } from '../../../shared/domain/calendar-date';
import { NotFoundError } from '../../../shared/domain/errors/not-found.error';
import { RoomId } from '../../../shared/domain/ids';
import { GuestDetails } from '../../domain/guest-details';
import { Reservation } from '../../domain/reservation';
import { SecureCode } from '../../domain/secure-code';
import { Stay } from '../../domain/stay';
import { EVENT_PUBLISHER, type EventPublisher } from '../ports/event-publisher';
import { RESERVATION_ACCESS, type ReservationAccess } from '../ports/reservation-access';
import { RESERVATION_REPOSITORY, type ReservationRepository } from '../ports/reservation-repository';
import { ROOM_CATALOG, type RoomCatalog } from '../ports/room-catalog';
import { ROOM_NIGHT_LOCKS, type RoomNightLocks } from '../ports/room-night-locks';

export interface CreateReservationProps {
  roomId: number;
  checkIn: string;
  checkOut: string;
  guestName: string;
  guestEmail: string;
  correlationId: string;
}

export class CreateReservationCommand {
  readonly roomId: number;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly guestName: string;
  readonly guestEmail: string;
  readonly correlationId: string;

  constructor(props: CreateReservationProps) {
    this.roomId = props.roomId;
    this.checkIn = props.checkIn;
    this.checkOut = props.checkOut;
    this.guestName = props.guestName;
    this.guestEmail = props.guestEmail;
    this.correlationId = props.correlationId;
  }
}

export interface CreateReservationResult {
  reservationId: string;
  paymentId: string;
  /** The only moment the secure code is ever visible (FR-013). */
  secureCode: string;
  accessToken: string;
  status: 'PendingPayment';
  totalAmount: number;
  currency: string;
  nights: number;
}

@CommandHandler(CreateReservationCommand)
export class CreateReservationHandler implements ICommandHandler<
  CreateReservationCommand,
  CreateReservationResult
> {
  constructor(
    @Inject(ROOM_CATALOG) private readonly catalog: RoomCatalog,
    @Inject(RESERVATION_REPOSITORY) private readonly repository: ReservationRepository,
    @Inject(ROOM_NIGHT_LOCKS) private readonly locks: RoomNightLocks,
    @Inject(RESERVATION_ACCESS) private readonly access: ReservationAccess,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly publisher: EventPublisher,
    @Inject(APP_LOGGER) private readonly logger: AppLogger,
  ) {}

  async execute(command: CreateReservationCommand): Promise<CreateReservationResult> {
    const roomId = RoomId.of(command.roomId);
    const pricePerNight = await this.catalog.priceOf(roomId);
    if (!pricePerNight) throw new NotFoundError('Room');

    const stay = Stay.create(
      CalendarDate.parse(command.checkIn),
      CalendarDate.parse(command.checkOut),
      this.clock.today(),
    );
    const guest = GuestDetails.create(command.guestName, command.guestEmail);
    const secureCode = SecureCode.generate();
    const id = this.ids.reservationId();
    const paymentId = this.ids.paymentId();

    const reservation = Reservation.request({
      id,
      roomId,
      stay,
      guest,
      pricePerNight,
      secureCodeHash: await secureCode.hash(),
      paymentId,
      metadata: {
        correlationId: command.correlationId,
        causationId: 'CreateReservation',
        occurredAt: this.clock.now().toISOString(),
      },
    });

    const stored = await this.uow.run(async (tx) => {
      await this.locks.acquire(roomId, stay.nights(), id, tx);
      return this.repository.save(reservation, tx);
    });
    reservation.markEventsCommitted();
    await this.publisher.publish(stored);
    const { token } = await this.access.issueToken(id);
    this.logger.log(`Reservation ${id.value} requested for room ${roomId.value}`);

    return {
      reservationId: id.value,
      paymentId: paymentId.value,
      secureCode: secureCode.value,
      accessToken: token,
      status: 'PendingPayment',
      totalAmount: reservation.totalAmount.amount,
      currency: reservation.totalAmount.currency,
      nights: stay.nightCount,
    };
  }
}
