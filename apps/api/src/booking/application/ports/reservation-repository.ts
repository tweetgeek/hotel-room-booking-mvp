import type { StoredEvent } from '../../../shared/domain/domain-event';
import type { ReservationId } from '../../../shared/domain/ids';
import type { Tx } from '../../../shared/application/ports/unit-of-work';
import type { Reservation } from '../../domain/reservation';

export const RESERVATION_REPOSITORY = Symbol('ReservationRepository');

export interface ReservationRepository {
  load(id: ReservationId): Promise<Reservation | null>;
  /** Appends the uncommitted events with the aggregate's version as the concurrency token; the caller marks them committed after the transaction. */
  save(reservation: Reservation, tx: Tx): Promise<StoredEvent[]>;
}
