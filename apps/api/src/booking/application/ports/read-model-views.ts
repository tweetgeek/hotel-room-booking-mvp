export const READ_MODEL_VIEWS = Symbol('ReadModelViews');

export interface RoomCard {
  id: number;
  name: string;
  description: string;
  features: string[];
  pricePerNight: number;
  currency: string;
  checkInTime: string;
  checkOutTime: string;
  imageUrl: string | null;
}

export type BlockedNightStatus = 'held' | 'confirmed';

export interface BlockedNight {
  night: string;
  status: BlockedNightStatus;
}

export type ReservationStatusValue = 'PendingPayment' | 'Confirmed' | 'Rejected' | 'Expired' | 'Cancelled';
export type RejectionReasonValue = 'rejected_by_operator' | 'abandoned_by_guest';

export interface ReservationStatusRow {
  reservationId: string;
  status: ReservationStatusValue;
  reason: RejectionReasonValue | null;
}

export interface ReservationRow {
  id: string;
  roomId: number;
  roomName: string;
  checkInTime: string;
  checkOutTime: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guestName: string;
  guestEmail: string;
  totalAmount: number;
  currency: string;
  status: ReservationStatusValue;
  rejectionReason: RejectionReasonValue | null;
  refundAmount: number | null;
  paymentId: string;
  /** ISO 8601 UTC */
  createdAt: string;
  updatedAt: string;
}

export interface TimelineItem {
  position: number;
  eventType: string;
  /** ISO 8601 UTC */
  occurredAt: string;
  reason: RejectionReasonValue | null;
}

/**
 * Read side of CQRS: every method maps to one SQL view (ADR-005).
 * Query handlers depend on this port so the application layer never imports Knex (ADR-001).
 */
export interface ReadModelViews {
  roomCards(): Promise<RoomCard[]>;
  roomCard(roomId: number): Promise<RoomCard | null>;
  /** Nights of one room with `from <= night <= to`, ordered by night. */
  blockedNights(roomId: number, from: string, to: string): Promise<BlockedNight[]>;
  reservationStatus(reservationId: string): Promise<ReservationStatusRow | null>;
  reservationDetails(reservationId: string): Promise<ReservationRow | null>;
  reservationTimeline(reservationId: string): Promise<TimelineItem[]>;
  reservationByPaymentId(paymentId: string): Promise<ReservationRow | null>;
  /** Ids of reservations still PendingPayment whose `created_at` is before `cutoffIso`. */
  pendingReservationsCreatedBefore(cutoffIso: string): Promise<string[]>;
}
