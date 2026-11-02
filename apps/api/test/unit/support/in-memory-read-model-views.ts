import type {
  BlockedNight,
  ReadModelViews,
  ReservationRow,
  ReservationStatusRow,
  RoomCard,
  TimelineItem,
} from '../../../src/booking/application/ports/read-model-views';

export interface RoomNightRow {
  roomId: number;
  night: string;
  reservationId: string;
  status: 'held' | 'confirmed';
}

export function roomCardFixture(id: number, overrides: Partial<RoomCard> = {}): RoomCard {
  return {
    id,
    name: `Pokój ${id}`,
    description: 'Opis',
    features: ['wifi'],
    pricePerNight: 32000,
    currency: 'PLN',
    checkInTime: '15:00',
    checkOutTime: '11:00',
    imageUrl: null,
    ...overrides,
  };
}

export class InMemoryReadModelViews implements ReadModelViews {
  readonly rooms: RoomCard[] = [];
  readonly roomNights: RoomNightRow[] = [];
  readonly reservations: ReservationRow[] = [];
  readonly timeline: Array<TimelineItem & { reservationId: string }> = [];

  async roomCards(): Promise<RoomCard[]> {
    return [...this.rooms].sort((a, b) => a.id - b.id);
  }

  async roomCard(roomId: number): Promise<RoomCard | null> {
    return this.rooms.find((r) => r.id === roomId) ?? null;
  }

  async blockedNights(roomId: number, from: string, to: string): Promise<BlockedNight[]> {
    return this.roomNights
      .filter((n) => n.roomId === roomId && n.night >= from && n.night <= to)
      .sort((a, b) => a.night.localeCompare(b.night))
      .map((n) => ({ night: n.night, status: n.status }));
  }

  async reservationStatus(reservationId: string): Promise<ReservationStatusRow | null> {
    const row = this.reservations.find((r) => r.id === reservationId);
    return row ? { reservationId: row.id, status: row.status, reason: row.rejectionReason } : null;
  }

  async reservationDetails(reservationId: string): Promise<ReservationRow | null> {
    return this.reservations.find((r) => r.id === reservationId) ?? null;
  }

  async reservationTimeline(reservationId: string): Promise<TimelineItem[]> {
    return this.timeline
      .filter((t) => t.reservationId === reservationId)
      .sort((a, b) => a.position - b.position)
      .map(({ reservationId: _ignored, ...item }) => item);
  }

  async reservationByPaymentId(paymentId: string): Promise<ReservationRow | null> {
    return this.reservations.find((r) => r.paymentId === paymentId) ?? null;
  }

  async pendingReservationsCreatedBefore(cutoffIso: string): Promise<string[]> {
    return this.reservations
      .filter((r) => r.status === 'PendingPayment' && r.createdAt < cutoffIso)
      .map((r) => r.id);
  }
}
