import { Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import type {
  BlockedNight,
  ReadModelViews,
  ReservationRow,
  ReservationStatusRow,
  RoomCard,
  TimelineItem,
} from '../../application/ports/read-model-views';
import { fromSqlDateTime, toSqlDateTime } from '../../../shared/domain/time-format';
import { KNEX } from '../../../shared/infrastructure/persistence/knex.token';

interface RoomCardRow {
  id: number;
  name: string;
  description: string;
  features: string | string[];
  price_per_night: number;
  currency: string;
  check_in_time: string;
  check_out_time: string;
  image_url: string | null;
}

interface ReservationDetailsRow {
  id: string;
  room_id: number;
  room_name: string;
  check_in_time: string;
  check_out_time: string;
  check_in: string;
  check_out: string;
  nights: number;
  guest_name: string;
  guest_email: string;
  total_amount: number;
  currency: string;
  status: ReservationRow['status'];
  rejection_reason: ReservationRow['rejectionReason'];
  refund_amount: number | null;
  payment_id: string;
  created_at: string;
  updated_at: string;
}

interface TimelineRow {
  reservation_id: string;
  position: number | string;
  event_type: string;
  occurred_at: string;
  reason: TimelineItem['reason'];
}

function toReservationRow(row: ReservationDetailsRow): ReservationRow {
  return {
    id: row.id,
    roomId: row.room_id,
    roomName: row.room_name,
    checkInTime: row.check_in_time,
    checkOutTime: row.check_out_time,
    checkIn: row.check_in,
    checkOut: row.check_out,
    nights: row.nights,
    guestName: row.guest_name,
    guestEmail: row.guest_email,
    totalAmount: row.total_amount,
    currency: row.currency,
    status: row.status,
    rejectionReason: row.rejection_reason,
    refundAmount: row.refund_amount,
    paymentId: row.payment_id,
    createdAt: fromSqlDateTime(row.created_at),
    updatedAt: fromSqlDateTime(row.updated_at),
  };
}

interface BlockedNightRow {
  room_id: number;
  night: string;
  status: 'held' | 'confirmed';
}

function toRoomCard(row: RoomCardRow): RoomCard {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    features: typeof row.features === 'string' ? (JSON.parse(row.features) as string[]) : row.features,
    pricePerNight: row.price_per_night,
    currency: row.currency,
    checkInTime: row.check_in_time,
    checkOutTime: row.check_out_time,
    imageUrl: row.image_url,
  };
}

@Injectable()
export class KnexReadModelViews implements ReadModelViews {
  constructor(@Inject(KNEX) private readonly db: Knex) {}

  async roomCards(): Promise<RoomCard[]> {
    const rows = await this.db<RoomCardRow>('v_room_card').orderBy('id');
    return rows.map(toRoomCard);
  }

  async roomCard(roomId: number): Promise<RoomCard | null> {
    const row = await this.db<RoomCardRow>('v_room_card').where({ id: roomId }).first();
    return row ? toRoomCard(row) : null;
  }

  async blockedNights(roomId: number, from: string, to: string): Promise<BlockedNight[]> {
    const rows = await this.db<BlockedNightRow>('v_room_blocked_nights')
      .select('night', 'status')
      .where({ room_id: roomId })
      .andWhereBetween('night', [from, to])
      .orderBy('night');
    return rows.map((row) => ({ night: row.night, status: row.status }));
  }

  async reservationStatus(reservationId: string): Promise<ReservationStatusRow | null> {
    const row = await this.db('v_reservation_status').where({ id: reservationId }).first();
    return row ? { reservationId: row.id, status: row.status, reason: row.rejection_reason } : null;
  }

  async reservationDetails(reservationId: string): Promise<ReservationRow | null> {
    const row = await this.db<ReservationDetailsRow>('v_reservation_details')
      .where({ id: reservationId })
      .first();
    return row ? toReservationRow(row) : null;
  }

  async reservationTimeline(reservationId: string): Promise<TimelineItem[]> {
    const rows = await this.db<TimelineRow>('v_reservation_timeline')
      .where({ reservation_id: reservationId })
      .orderBy('position');
    return rows.map((row) => ({
      position: Number(row.position),
      eventType: row.event_type,
      occurredAt: fromSqlDateTime(row.occurred_at),
      reason: row.reason,
    }));
  }

  async reservationByPaymentId(paymentId: string): Promise<ReservationRow | null> {
    const row = await this.db<ReservationDetailsRow>('v_reservation_details')
      .where({ payment_id: paymentId })
      .first();
    return row ? toReservationRow(row) : null;
  }

  async pendingReservationsCreatedBefore(cutoffIso: string): Promise<string[]> {
    const rows = await this.db<ReservationDetailsRow>('v_reservation_details')
      .select('id')
      .where({ status: 'PendingPayment' })
      .andWhere('created_at', '<', toSqlDateTime(cutoffIso))
      .orderBy('created_at');
    return rows.map((row) => row.id);
  }
}
