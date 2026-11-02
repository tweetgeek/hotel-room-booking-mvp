import type { StoredEvent } from '../domain/domain-event';

/** Envelope published on the Nest EventBus once projections have processed the event. */
export class EventCommitted {
  constructor(readonly stored: StoredEvent) {}
}
