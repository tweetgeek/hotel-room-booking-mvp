import { Inject } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { CLOCK, type Clock } from '../../../shared/application/ports/clock';
import { CalendarDate } from '../../../shared/domain/calendar-date';
import { NotFoundError } from '../../../shared/domain/errors/not-found.error';
import { READ_MODEL_CACHE, type ReadModelCache } from '../ports/read-model-cache';
import {
  READ_MODEL_VIEWS,
  type ReadModelViews,
  type RejectionReasonValue,
  type ReservationRow,
  type ReservationStatusValue,
  type TimelineItem,
} from '../ports/read-model-views';
import { reservationDetailsKey } from '../projections/reservation-projector';

export class GetReservationDetailsQuery {
  constructor(readonly reservationId: string) {}
}

export interface ReservationDetails {
  reservationId: string;
  status: ReservationStatusValue;
  room: { id: number; name: string; checkInTime: string; checkOutTime: string };
  checkIn: string;
  checkOut: string;
  nights: number;
  guestName: string;
  guestEmail: string;
  totalAmount: number;
  currency: string;
  reason: RejectionReasonValue | null;
  refundAmount: number | null;
  cancellable: boolean;
  timeline: Array<Pick<TimelineItem, 'eventType' | 'occurredAt' | 'reason'>>;
}

export const RESERVATION_DETAILS_TTL_SECONDS = 300;

@QueryHandler(GetReservationDetailsQuery)
export class GetReservationDetailsHandler implements IQueryHandler<
  GetReservationDetailsQuery,
  ReservationDetails
> {
  constructor(
    @Inject(READ_MODEL_VIEWS) private readonly views: ReadModelViews,
    @Inject(READ_MODEL_CACHE) private readonly cache: ReadModelCache,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(query: GetReservationDetailsQuery): Promise<ReservationDetails> {
    const cached = await this.cache.getOrLoad(
      reservationDetailsKey(query.reservationId),
      RESERVATION_DETAILS_TTL_SECONDS,
      async () => {
        const row = await this.views.reservationDetails(query.reservationId);
        if (!row) throw new NotFoundError('Reservation');
        return { row, timeline: await this.views.reservationTimeline(query.reservationId) };
      },
    );
    return toDetails(cached.row, cached.timeline, this.clock.today());
  }
}

// `cancellable` depends on today, so it is computed after the cache, never stored in it
function toDetails(row: ReservationRow, timeline: TimelineItem[], today: CalendarDate): ReservationDetails {
  return {
    reservationId: row.id,
    status: row.status,
    room: {
      id: row.roomId,
      name: row.roomName,
      checkInTime: row.checkInTime,
      checkOutTime: row.checkOutTime,
    },
    checkIn: row.checkIn,
    checkOut: row.checkOut,
    nights: row.nights,
    guestName: row.guestName,
    guestEmail: row.guestEmail,
    totalAmount: row.totalAmount,
    currency: row.currency,
    reason: row.rejectionReason,
    refundAmount: row.refundAmount,
    cancellable: row.status === 'Confirmed' && today.isBefore(CalendarDate.parse(row.checkIn)),
    timeline: timeline.map(({ eventType, occurredAt, reason }) => ({ eventType, occurredAt, reason })),
  };
}
