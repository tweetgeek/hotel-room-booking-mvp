import { Injectable } from '@nestjs/common';
import type { StoredEvent } from '../../../shared/domain/domain-event';
import { toSqlDateTime } from '../../../shared/domain/time-format';
import { CalendarDate } from '../../../shared/domain/calendar-date';
import type {
  PaymentRejectedPayload,
  ReservationCancelledPayload,
  ReservationExpiredPayload,
  ReservationRequestedPayload,
  PaymentConfirmedPayload,
} from '../../domain/events';

export type ReadModelChange =
  | { kind: 'upsert'; table: 'rm_reservations'; row: Record<string, unknown> }
  | {
      kind: 'insert-ignore';
      table: 'rm_reservation_timeline' | 'rm_room_nights';
      rows: Record<string, unknown>[];
    }
  | {
      kind: 'update';
      table: 'rm_reservations' | 'rm_room_nights';
      where: Record<string, unknown>;
      set: Record<string, unknown>;
    }
  | { kind: 'delete'; table: 'rm_room_nights'; where: Record<string, unknown> };

export interface ProjectionPlan {
  changes: ReadModelChange[];
  cacheKeys: string[];
  /** Set when the room calendar cache of this reservation's room must be invalidated. */
  roomNightsOfReservation?: string;
}

export const reservationDetailsKey = (id: string): string => `reservation:${id}:details`;
export const reservationStatusKey = (id: string): string => `reservation:${id}:status`;

/**
 * Pure function from one stored event to the read-model changes it implies (ADR-004).
 * Every change is idempotent (upsert, insert-ignore, update, delete), so replaying is safe.
 */
@Injectable()
export class ReservationProjector {
  project(stored: StoredEvent): ProjectionPlan {
    const { event } = stored;
    const occurredAt = toSqlDateTime(event.metadata.occurredAt);
    const timeline = (reservationId: string, reason: string | null = null): ReadModelChange => ({
      kind: 'insert-ignore',
      table: 'rm_reservation_timeline',
      rows: [
        {
          reservation_id: reservationId,
          position: stored.position,
          event_type: event.eventType,
          occurred_at: occurredAt,
          reason,
        },
      ],
    });
    const statusUpdate = (reservationId: string, set: Record<string, unknown>): ReadModelChange => ({
      kind: 'update',
      table: 'rm_reservations',
      where: { id: reservationId },
      set: { ...set, updated_at: occurredAt },
    });
    const freeNights = (reservationId: string): ReadModelChange => ({
      kind: 'delete',
      table: 'rm_room_nights',
      where: { reservation_id: reservationId },
    });
    const plan = (reservationId: string, changes: ReadModelChange[]): ProjectionPlan => ({
      changes,
      cacheKeys: [reservationDetailsKey(reservationId), reservationStatusKey(reservationId)],
      roomNightsOfReservation: reservationId,
    });

    switch (event.eventType) {
      case 'ReservationRequested': {
        const p = event.payload as ReservationRequestedPayload;
        const checkIn = CalendarDate.parse(p.checkIn);
        const nights = Array.from({ length: p.nights }, (_, i) => checkIn.addDays(i).value);
        return plan(p.reservationId, [
          {
            kind: 'upsert',
            table: 'rm_reservations',
            row: {
              id: p.reservationId,
              room_id: p.roomId,
              check_in: p.checkIn,
              check_out: p.checkOut,
              nights: p.nights,
              guest_name: p.guestName,
              guest_email: p.guestEmail,
              total_amount: p.totalAmount,
              currency: p.currency,
              status: 'PendingPayment',
              rejection_reason: null,
              refund_amount: null,
              payment_id: p.paymentId,
              created_at: occurredAt,
              updated_at: occurredAt,
            },
          },
          timeline(p.reservationId),
          {
            kind: 'insert-ignore',
            table: 'rm_room_nights',
            rows: nights.map((night) => ({
              room_id: p.roomId,
              night,
              reservation_id: p.reservationId,
              status: 'held',
            })),
          },
        ]);
      }
      case 'PaymentConfirmed': {
        const p = event.payload as PaymentConfirmedPayload;
        return plan(p.reservationId, [
          statusUpdate(p.reservationId, { status: 'Confirmed' }),
          timeline(p.reservationId),
          {
            kind: 'update',
            table: 'rm_room_nights',
            where: { reservation_id: p.reservationId },
            set: { status: 'confirmed' },
          },
        ]);
      }
      case 'PaymentRejected': {
        const p = event.payload as PaymentRejectedPayload;
        return plan(p.reservationId, [
          statusUpdate(p.reservationId, { status: 'Rejected', rejection_reason: p.reason }),
          timeline(p.reservationId, p.reason),
          freeNights(p.reservationId),
        ]);
      }
      case 'ReservationExpired': {
        const p = event.payload as ReservationExpiredPayload;
        return plan(p.reservationId, [
          statusUpdate(p.reservationId, { status: 'Expired' }),
          timeline(p.reservationId),
          freeNights(p.reservationId),
        ]);
      }
      case 'ReservationCancelled': {
        const p = event.payload as ReservationCancelledPayload;
        return plan(p.reservationId, [
          statusUpdate(p.reservationId, { status: 'Cancelled', refund_amount: p.refundAmount }),
          timeline(p.reservationId),
          freeNights(p.reservationId),
        ]);
      }
      default:
        return { changes: [], cacheKeys: [] };
    }
  }
}
