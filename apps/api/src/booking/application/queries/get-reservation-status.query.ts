import { Inject } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { NotFoundError } from '../../../shared/domain/errors/not-found.error';
import { READ_MODEL_CACHE, type ReadModelCache } from '../ports/read-model-cache';
import { READ_MODEL_VIEWS, type ReadModelViews, type ReservationStatusRow } from '../ports/read-model-views';
import { reservationStatusKey } from '../projections/reservation-projector';

export class GetReservationStatusQuery {
  constructor(readonly reservationId: string) {}
}

// Short TTL plus projector invalidation keeps the waiting page within FR-012's 3 s budget
export const RESERVATION_STATUS_TTL_SECONDS = 5;

@QueryHandler(GetReservationStatusQuery)
export class GetReservationStatusHandler implements IQueryHandler<
  GetReservationStatusQuery,
  ReservationStatusRow
> {
  constructor(
    @Inject(READ_MODEL_VIEWS) private readonly views: ReadModelViews,
    @Inject(READ_MODEL_CACHE) private readonly cache: ReadModelCache,
  ) {}

  execute(query: GetReservationStatusQuery): Promise<ReservationStatusRow> {
    return this.cache.getOrLoad(
      reservationStatusKey(query.reservationId),
      RESERVATION_STATUS_TTL_SECONDS,
      async () => {
        const row = await this.views.reservationStatus(query.reservationId);
        if (!row) throw new NotFoundError('Reservation');
        return row;
      },
    );
  }
}
