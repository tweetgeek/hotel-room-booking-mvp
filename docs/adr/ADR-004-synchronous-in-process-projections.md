# ADR-004: Synchronous in-process projections with checkpoints and rebuild

Date: 2026-11-01
Status: Accepted

## Context

CQRS (constitution IV) needs read models fed from events, rebuildable from scratch (constitution
III, US5). The project runs as a single API process on one machine, and guests expect to see their
own reservation's status right after their command (FR-012: within 3 s of the operator's decision).

## Decision

- `ReservationProjector` is a pure function from one stored event to a `ProjectionPlan`: a list of
  idempotent read-model changes (upsert, insert-ignore, update, delete) and the cache keys to
  invalidate. It has no I/O, so it is unit tested without a database.
- `ProjectionRunner` applies one plan per event in its own transaction and raises the
  `projection_checkpoints` row (`name = 'reservations'`) to `GREATEST(last_position, position)`
  inside that transaction. Concurrent commands deliver events of different streams out of global
  order, which is harmless because every change is idempotent and events of one stream are always
  sequential. Cache keys are invalidated after the commit.
- Command handlers publish through the `EventPublisher` port after their own transaction committed.
  `SynchronousEventPublisher` awaits the runner before emitting an `EventCommitted` envelope on the
  Nest `EventBus`, so the HTTP response returns only after the read model is up to date.
- Rebuild (`npm run projections:rebuild`): truncate `rm_*`, reset the checkpoint to 0, replay
  `EventStore.readAll` in batches of 500 through the same runner, then flush the cache database.
  `room_night_locks` is untouched (ADR-003).
- Read-model timestamps are UTC `DATETIME(3)`; the cache uses its own Redis logical database so the
  rebuild can `FLUSHDB` it without dropping access tokens (research R-08).

## Consequences

- A guest polling the status endpoint sees the new status within one polling interval.
- The command path is slightly slower (projection in the request), acceptable at this scale.
- With more than one API instance, in-process publication would be insufficient: events committed
  by one instance would not reach the other's runner. The known upgrade path is an outbox table
  polled by one projection worker; the pure projector and the checkpoint logic stay the same.
- A failing projection fails the command's response after the events were committed; the next
  command or a rebuild repairs the read model because every change is idempotent.

## Alternatives considered

- Fire-and-forget `EventBus` subscribers: simpler wiring, but the response could race the
  projection and the tests would need sleeps.
- Asynchronous worker with an outbox from day one: correct for multiple instances, but more moving
  parts than a single-process MVP needs; kept as the documented next step.
- Reading the status from the event store directly: bypasses CQRS and the cache; rejected.
