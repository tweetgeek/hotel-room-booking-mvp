import { Inject, Injectable } from '@nestjs/common';
import { EVENT_STORE, type EventStore } from '../../../shared/application/ports/event-store';
import type { Tx } from '../../../shared/application/ports/unit-of-work';
import type { StoredEvent } from '../../../shared/domain/domain-event';
import type { ReservationId } from '../../../shared/domain/ids';
import { rehydrateReservationEvent } from '../../domain/events';
import { Reservation } from '../../domain/reservation';
import type { ReservationRepository } from '../../application/ports/reservation-repository';

/** Works with any EventStore (MariaDB in production, in-memory in tests). */
@Injectable()
export class EventStoreReservationRepository implements ReservationRepository {
  constructor(@Inject(EVENT_STORE) private readonly eventStore: EventStore) {}

  async load(id: ReservationId): Promise<Reservation | null> {
    const stored = await this.eventStore.load(id.value);
    if (stored.length === 0) return null;
    return Reservation.fromHistory(stored.map((s) => rehydrateReservationEvent(s.event)));
  }

  // Events stay "uncommitted" on the aggregate until the unit of work really committed,
  // so a transaction retried after a deadlock appends the same events again
  save(reservation: Reservation, tx: Tx): Promise<StoredEvent[]> {
    return this.eventStore.append(
      reservation.id.value,
      reservation.version,
      reservation.uncommittedEvents,
      tx,
    );
  }
}
