# ADR-002: Event sourcing with an own MariaDB event store

Date: 2026-11-01
Status: Accepted

## Context

The constitution (principle III) demands real event sourcing: a reservation's state must be
rebuilt from its events only, and every read model must be rebuildable from the event store.
The owner rejected "event sourcing for show". The project runs locally on MariaDB and must stay
small: a reservation stream holds at most two events (requested, then one of confirmed, rejected,
expired) plus an optional cancellation.

## Decision

- Events live in one append-only table `events` with `position` (global order),
  `stream_id`, `stream_version`, `event_type`, JSON `payload` and `metadata`, and `occurred_at`.
- `MariaDbEventStore.append(streamId, expectedVersion, events, tx)` inserts versions
  `expectedVersion + 1…` inside the caller's transaction. The unique key
  `(stream_id, stream_version)` turns a lost update into `ConcurrencyError` (HTTP 409).
- `load(streamId)` returns a stream in version order; `readAll(fromPosition, batchSize)` feeds
  projections and the rebuild in global order.
- No snapshots: streams are tiny, so replaying them is cheaper than maintaining snapshot code.
- No event-sourcing library (EventStoreDB, Marten-like frameworks): the store is about one hundred
  lines and makes the mechanism visible, which is the point of the project.
- Event versioning: a change in a payload's shape is a new event type (for example
  `ReservationRequestedV2`) handled by an upcaster at load time. The MVP defines no such change.
- Secrets never enter an event in clear text; the secure code is stored only as a hash.

## Consequences

- The aggregate repository is a thin adapter over `append`/`load`; every state change is an event.
- `room_night_locks` is not part of the event store: it guards an invariant across aggregates in
  the same transaction (ADR-003) and is not rebuilt during projection replay.
- Timestamps are written as UTC `DATETIME(3)`; sessions pin `time_zone = '+00:00'`.

## Alternatives considered

- EventStoreDB or Kafka: another service to run locally for no benefit at this scale.
- A JSON column per aggregate ("current state" table) with an audit log: that would make the
  table, not the events, the source of truth and violate principle III.
- Snapshots every N events: unnecessary with streams of two or three events.
