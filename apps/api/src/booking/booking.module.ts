import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { CLOCK } from '../shared/application/ports/clock';
import { EVENT_STORE } from '../shared/application/ports/event-store';
import { ID_GENERATOR } from '../shared/application/ports/id-generator';
import { APP_LOGGER } from '../shared/application/ports/logger';
import type { Env } from '../shared/infrastructure/config/env.schema';
import { CryptoIdGenerator } from '../shared/infrastructure/ids/crypto-id-generator';
import { SystemClock } from '../shared/infrastructure/time/system-clock';
import { CancelReservationHandler } from './application/commands/cancel-reservation.command';
import { CreateReservationHandler } from './application/commands/create-reservation.command';
import { ConfirmPaymentHandler } from './application/commands/confirm-payment.command';
import { RejectPaymentHandler } from './application/commands/reject-payment.command';
import { ExpireReservationHandler } from './application/commands/expire-reservation.command';
import { VerifySecureCodeHandler } from './application/commands/verify-secure-code.command';
import { EVENT_PUBLISHER } from './application/ports/event-publisher';
import { READ_MODEL_CACHE } from './application/ports/read-model-cache';
import { READ_MODEL_VIEWS } from './application/ports/read-model-views';
import { RESERVATION_ACCESS } from './application/ports/reservation-access';
import { RESERVATION_REPOSITORY } from './application/ports/reservation-repository';
import { ROOM_CATALOG } from './application/ports/room-catalog';
import { ROOM_NIGHT_LOCKS } from './application/ports/room-night-locks';
import { ReservationProjector } from './application/projections/reservation-projector';
import { GetBlockedNightsHandler } from './application/queries/get-blocked-nights.query';
import { GetPaymentViewHandler } from './application/queries/get-payment-view.handler';
import { GetReservationDetailsHandler } from './application/queries/get-reservation-details.query';
import { GetReservationStatusHandler } from './application/queries/get-reservation-status.query';
import { GetRoomCardHandler } from './application/queries/get-room-card.query';
import { ListRoomsHandler } from './application/queries/list-rooms.query';
import { RedisReservationAccess } from './infrastructure/access/redis-reservation-access';
import { RedisReadModelCache } from './infrastructure/cache/redis-read-model-cache';
import { EventStoreReservationRepository } from './infrastructure/persistence/event-store-reservation-repository';
import { KnexRoomCatalog } from './infrastructure/persistence/knex-room-catalog';
import { MariaDbEventStore } from './infrastructure/persistence/mariadb-event-store';
import { MariaDbRoomNightLocks } from './infrastructure/persistence/mariadb-room-night-locks';
import { ProjectionRunner } from './infrastructure/projections/projection-runner';
import { SynchronousEventPublisher } from './infrastructure/projections/synchronous-event-publisher';
import { KnexReadModelViews } from './infrastructure/read-models/knex-read-model-views';
import {
  ExpirePendingReservationsJob,
  PENDING_PAYMENT_TTL_MINUTES,
} from './infrastructure/scheduling/expire-pending-reservations.job';
import { ReservationAccessGuard } from './presentation/guards/reservation-access.guard';
import { ReservationsController } from './presentation/reservations.controller';
import { RoomsController } from './presentation/rooms.controller';
import { WebhooksController } from './presentation/webhooks.controller';

const commandHandlers = [
  CreateReservationHandler,
  ConfirmPaymentHandler,
  RejectPaymentHandler,
  ExpireReservationHandler,
  CancelReservationHandler,
  VerifySecureCodeHandler,
];
const queryHandlers = [
  ListRoomsHandler,
  GetRoomCardHandler,
  GetBlockedNightsHandler,
  GetReservationStatusHandler,
  GetReservationDetailsHandler,
  GetPaymentViewHandler,
];

@Module({
  imports: [CqrsModule],
  controllers: [RoomsController, ReservationsController, WebhooksController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    ReservationProjector,
    ProjectionRunner,
    ReservationAccessGuard,
    ExpirePendingReservationsJob,
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: CryptoIdGenerator },
    { provide: APP_LOGGER, useValue: new Logger('booking') },
    { provide: EVENT_STORE, useClass: MariaDbEventStore },
    { provide: RESERVATION_REPOSITORY, useClass: EventStoreReservationRepository },
    { provide: ROOM_NIGHT_LOCKS, useClass: MariaDbRoomNightLocks },
    { provide: ROOM_CATALOG, useClass: KnexRoomCatalog },
    { provide: RESERVATION_ACCESS, useClass: RedisReservationAccess },
    { provide: READ_MODEL_VIEWS, useClass: KnexReadModelViews },
    { provide: READ_MODEL_CACHE, useClass: RedisReadModelCache },
    { provide: EVENT_PUBLISHER, useClass: SynchronousEventPublisher },
    {
      provide: PENDING_PAYMENT_TTL_MINUTES,
      useFactory: (config: ConfigService<Env, true>) =>
        config.get('PENDING_PAYMENT_TTL_MINUTES', { infer: true }),
      inject: [ConfigService],
    },
  ],
  exports: [ProjectionRunner],
})
export class BookingModule {}
