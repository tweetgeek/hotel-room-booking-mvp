export interface EventMetadata {
  /** Groups every event caused by one HTTP request or one job run. */
  readonly correlationId: string;
  /** Name of the command that produced the event. */
  readonly causationId: string;
  /** ISO 8601 UTC with milliseconds, taken from the `Clock` port. */
  readonly occurredAt: string;
}

export interface DomainEvent<TType extends string = string, TPayload = unknown> {
  readonly eventType: TType;
  readonly payload: TPayload;
  readonly metadata: EventMetadata;
}

export interface StoredEvent<E extends DomainEvent = DomainEvent> {
  readonly position: number;
  readonly streamId: string;
  readonly streamVersion: number;
  readonly event: E;
}
