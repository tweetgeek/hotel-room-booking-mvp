import { EventStoreReservationRepository } from '../../../src/booking/infrastructure/persistence/event-store-reservation-repository';
import type { InMemoryEventStore } from './in-memory-event-store';

/** The production repository over the in-memory event store; no separate persistence logic to drift. */
export class InMemoryReservationRepository extends EventStoreReservationRepository {
  constructor(readonly store: InMemoryEventStore) {
    super(store);
  }
}
