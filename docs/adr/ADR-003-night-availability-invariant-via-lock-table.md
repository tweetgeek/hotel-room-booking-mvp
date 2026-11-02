# ADR-003: Night availability guarded by a lock table in the event transaction

Date: 2026-11-01
Status: Accepted

## Context

"Two active reservations never share a night of the same room" is an invariant that spans
aggregates: each reservation is its own event stream, so the aggregate alone cannot see the
others. The owner's success criterion is strict: in 100 concurrent pairs booking the same nights,
exactly one of each pair succeeds (SC-003), and the check must hold under real concurrency, not
only in a single-threaded test.

## Decision

- The table `room_night_locks (room_id, night, reservation_id)` with primary key `(room_id, night)`
  is written in the same database transaction that appends `ReservationRequested`.
- A duplicate-key failure on insert is translated into `RoomNotAvailableError` (HTTP 409) and the
  whole transaction rolls back, so no event is stored for the losing request.
- The rows of a reservation are deleted in the same transaction as `PaymentRejected`,
  `ReservationExpired` or `ReservationCancelled`.
- The table is part of the write path, not a read model: it is never truncated or rebuilt by the
  projection rebuild, and query handlers never read it. The calendar shown to guests comes from the
  `rm_room_nights` projection.
- The port `RoomNightLocks` (`acquire`, `release`) hides the mechanism from command handlers; an
  in-memory adapter mirrors the check for unit tests.

## Consequences

- Availability is enforced by the database's uniqueness guarantee, which is the only component that
  sees all concurrent transactions.
- The event store remains the single source of truth for reservation *state*; the lock table only
  answers "is this night taken right now" and can be derived again from the events if ever lost
  (replay `ReservationRequested` minus the releasing events).
- A second room-related invariant (for example a maximum number of guests) would need its own
  mechanism; the lock table is specific to nights.
- Under heavy concurrency InnoDB occasionally picks one of several inserters of neighbouring keys
  as a deadlock victim (`ER_LOCK_DEADLOCK`) even though no two of them target the same night. The
  unit of work therefore runs the whole transaction again, up to three times; the aggregate marks
  its events committed only after the transaction succeeded, so a retry appends the same events.
  The SC-003 test (100 concurrent pairs) exercises this path.

## Alternatives considered

- A `RoomCalendar` aggregate owning all nights of a room: correct, but every booking would contend
  on one stream per room, and the aggregate would grow without bound; too heavy for the MVP.
- Checking the read model before appending: a race window between check and append; fails SC-003.
- A process-wide mutex: works for one instance only and gives no guarantee at the database level.
