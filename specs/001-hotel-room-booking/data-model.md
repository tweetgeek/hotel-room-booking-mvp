# Data Model: Hotel room booking (MVP)

Source: `spec.md` (entities, FRs), design document sections 4–5, `research.md`.
Identifiers in code and in the database are English (constitution VIII).

## 1. `Reservation` aggregate (event-sourced)

One reservation = one event stream (`stream_id = reservationId`). State is rebuilt
exclusively by `Reservation.fromHistory(events)`; no table is a parallel source of truth.

### State rebuilt from events

| Field | Type | Source |
|---|---|---|
| `id` | `ReservationId` (`RES-` + 6 Crockford base32 characters) | `ReservationRequested` |
| `roomId` | `RoomId` (int) | `ReservationRequested` |
| `stay` | `Stay` | `ReservationRequested` |
| `guest` | `{ name: string; email: string }` | `ReservationRequested` |
| `totalAmount` | `Money` | `ReservationRequested` |
| `secureCodeHash` | string (scrypt, format `scrypt$<salt>$<hash>`) | `ReservationRequested` |
| `paymentId` | `PaymentId` (`PAY-` + 10 characters) | `ReservationRequested` |
| `status` | `ReservationStatus` | all events |
| `version` | int (number of applied events) | event store |

### State machine

```text
PendingPayment --PaymentConfirmed-->   Confirmed --ReservationCancelled--> Cancelled
PendingPayment --PaymentRejected-->    Rejected   (final)
PendingPayment --ReservationExpired--> Expired    (final)
```

| Command | Allowed state | Result outside that state |
|---|---|---|
| `CreateReservation` | none (new stream) | – |
| `ConfirmPayment` | `PendingPayment` | no event, no error (idempotent, FR-010) |
| `RejectPayment` | `PendingPayment` | no event, no error |
| `ExpireReservation` | `PendingPayment` | no event, no error |
| `CancelReservation` | `Confirmed` and `today < stay.checkIn` | `ReservationNotCancellableError` → 422 (FR-018) |

### Value objects

| VO | Rules | FR |
|---|---|---|
| `Stay { checkIn, checkOut }` | `YYYY-MM-DD` dates without time; `checkOut > checkIn`; `1 ≤ nights ≤ 30`; `checkIn ≥ today` (today in `Europe/Warsaw` from the `Clock` port); `nights()` returns the list of `Night` from `checkIn` inclusive to `checkOut` exclusive. | FR-003 |
| `Night` | a single `YYYY-MM-DD` date. | FR-007 |
| `Money { amount: int (grosze), currency: 'PLN' }` | non-negative only; `multiply(n)`; `format()` only in the UI. | FR-008 |
| `SecureCode` | exactly 6 characters; generated from the alphabet `A-Za-z0-9` without `0 O 1 l I` (57 characters); input accepts `A-Za-z0-9` and ignores hyphens; case-sensitive comparison; `generate(random)`; `hash()` → scrypt; `matches(hash)`. The aggregate stores only the hash. | FR-013, FR-019 |
| `GuestDetails { name, email }` | `name` 1–100 characters after trimming; `email` per `class-validator` `isEmail`. | FR-005 |
| `ReservationStatus` | enum: `PendingPayment`, `Confirmed`, `Rejected`, `Expired`, `Cancelled`. | – |

HTTP input validation (DTO) repeats the `Stay` and `GuestDetails` rules so that format errors come back
as 422 with `details[{ field, code }]` codes (research R-14) before the command reaches the domain; the domain validates again, because it is
the only source of the rules.

## 2. Domain events

Full contract in [contracts/events.md](contracts/events.md). Summary:

| Event | Payload | Effect on nights |
|---|---|---|
| `ReservationRequested` | reservationId, roomId, checkIn, checkOut, nights, guestName, guestEmail, totalAmount, currency, secureCodeHash, paymentId | nights blocked (`held`) |
| `PaymentConfirmed` | reservationId, paymentId | nights `confirmed` |
| `PaymentRejected` | reservationId, paymentId, reason (`rejected_by_operator` \| `abandoned_by_guest`) | nights released |
| `ReservationExpired` | reservationId | nights released |
| `ReservationCancelled` | reservationId, refundAmount, currency | nights released |

## 3. Write tables (MariaDB)

### `events` (event store)

```sql
CREATE TABLE events (
  position       BIGINT AUTO_INCREMENT PRIMARY KEY,
  stream_id      VARCHAR(40)  NOT NULL,
  stream_version INT          NOT NULL,
  event_type     VARCHAR(100) NOT NULL,
  payload        JSON         NOT NULL,
  metadata       JSON         NOT NULL,
  occurred_at    DATETIME(3)  NOT NULL,
  UNIQUE KEY uq_stream (stream_id, stream_version),
  KEY idx_position (position)
);
```

- `append(streamId, expectedVersion, events[])`: inserts versions `expectedVersion+1…` in a transaction;
  a `uq_stream` violation → `ConcurrencyError` (409).
- `load(streamId)`: events ordered by `stream_version`.
- `readAll(fromPosition, batchSize)`: events ordered by `position` for projections and rebuild.
- No snapshots (a stream has at most 2 events).

### `room_night_locks` (invariant guard, ADR-003)

```sql
CREATE TABLE room_night_locks (
  room_id        INT         NOT NULL,
  night          DATE        NOT NULL,
  reservation_id VARCHAR(40) NOT NULL,
  PRIMARY KEY (room_id, night),
  KEY idx_reservation (reservation_id)
);
```

Rows are inserted in the same transaction as `ReservationRequested`; a key conflict →
`RoomNotAvailableError` (409). Deleted in the same transaction as `PaymentRejected`,
`ReservationExpired`, `ReservationCancelled`. The table is not a read model and is not
rebuilt from events during `projections:rebuild` (it is part of the write path).

### `rooms` (reference data, seed)

```sql
CREATE TABLE rooms (
  id               INT PRIMARY KEY,
  name             VARCHAR(100) NOT NULL,
  description      TEXT         NOT NULL,
  features         JSON         NOT NULL,          -- ["balcony", "wifi", ...] keys; labels in pl.ts
  price_per_night  INT          NOT NULL,          -- grosze
  currency         CHAR(3)      NOT NULL DEFAULT 'PLN',
  check_in_time    CHAR(5)      NOT NULL DEFAULT '15:00',
  check_out_time   CHAR(5)      NOT NULL DEFAULT '11:00',
  image_url        VARCHAR(255) NULL                -- placeholder in the MVP
);
```

Seed (three rooms, times 15:00 / 11:00 for all):

| id | name | price_per_night | features |
|---|---|---|---|
| 1 | Pokój dwuosobowy z balkonem | 32000 | balcony, wifi, tv |
| 2 | Pokój rodzinny | 45000 | wifi, tv, crib, kettle |
| 3 | Apartament z tarasem | 62000 | terrace, wifi, tv, kitchenette, air_conditioning |

`name` and `description` are Polish data (not code); `features` are keys translated in `pl.ts`.

## 4. Read tables (`rm_*`, fed exclusively by `ReservationProjector`)

| Table | Columns | Key | Feeding |
|---|---|---|---|
| `rm_reservations` | id, room_id, check_in, check_out, nights, guest_name, guest_email, total_amount, currency, status, rejection_reason (NULL except Rejected), refund_amount (NULL except Cancelled), payment_id, created_at, updated_at | PK `id`, UNIQUE `payment_id` | upsert by `id` from every event |
| `rm_reservation_timeline` | reservation_id, position (BIGINT from the event store), event_type, occurred_at, reason (NULL except PaymentRejected) | PK `(reservation_id, position)` | insert-ignore from every event; no Polish texts, labels are assigned by the frontend (R-14) |
| `rm_room_nights` | room_id, night, reservation_id, status (`held` \| `confirmed`) | PK `(room_id, night)` | insert from `ReservationRequested`; update to `confirmed` from `PaymentConfirmed`; delete from `PaymentRejected`/`ReservationExpired`/`ReservationCancelled` |
| `projection_checkpoints` | name, last_position | PK `name` | after every event |

All projection handlers are idempotent (upsert / insert-ignore / delete-if-exists), so
reprocessing an event does not change the result. `projections:rebuild` = `TRUNCATE rm_*`,
`last_position = 0`, `readAll` from 1 to the end, `DEL` of all cache keys.

## 5. SQL views (the only source for query handlers)

| View | Definition (summary) | Consumer |
|---|---|---|
| `v_room_card` | `rooms` with `price_per_night`, `currency`, `check_in_time`, `check_out_time`, `features` | `ListRooms` (no filter), `GetRoomCard` (`WHERE id = ?`) |
| `v_room_blocked_nights` | `rm_room_nights` (room_id, night, status) | `GetBlockedNights` (`WHERE room_id = ? AND night BETWEEN ? AND ?`) |
| `v_reservation_details` | `rm_reservations` (all columns, including `created_at`) JOIN `rooms` (room_name, check_in_time, check_out_time) + `cancellable` computed in the handler, not in the view | `GetReservationDetails`, `GetPaymentView` (`WHERE payment_id = ?`), `ExpirePendingReservationsJob` (`WHERE status = 'PendingPayment' AND created_at < ?`) |
| `v_reservation_timeline` | `rm_reservation_timeline ORDER BY position` | `GetReservationDetails` |
| `v_reservation_status` | `rm_reservations` (id, status, rejection_reason) | `GetReservationStatus` |

Views are created in Knex migrations with raw SQL (`CREATE OR REPLACE VIEW`).

## 6. Redis

| Key | Value | TTL | Invalidation |
|---|---|---|---|
| `rooms:list` | JSON list of cards | 600 s | TTL only |
| `room:{id}:card` | JSON card | 600 s | TTL only |
| `room:{id}:nights:{from}:{to}` | JSON nights | 60 s | projector: `SCAN` + `DEL room:{id}:nights:*` after an event of that room |
| `reservation:{id}:details` | JSON details + history | 300 s | projector after an event of that reservation |
| `reservation:{id}:status` | status string | 5 s | as above |
| `{key}:lock` | rebuild token | 3000 ms | released by a Lua script after the value is written |
| `access:{token}` | reservationId | 900 s | TTL |
| `secure-code-attempts:{reservationId}` | counter | 900 s from the first attempt | TTL |

The `getOrLoad` algorithm is in `research.md` (decision R-07).

## 7. Requirement-to-model mapping

| FR | Model element |
|---|---|
| FR-001 | `rooms`, `v_room_card`, `ListRooms`, `GetRoomCard` |
| FR-002, FR-004 | `v_room_blocked_nights`, local computations in `useRoomStore` |
| FR-003, FR-005 | `Stay`, `GuestDetails`, DTO `CreateReservationDto` |
| FR-006, FR-007 | `room_night_locks` + `ReservationRequested` in one transaction |
| FR-008 | `totalAmount` in the event, price from `RoomCatalog` at command time |
| FR-009, FR-010 | `payment-operator-simulator` module, webhook → `ConfirmPayment`/`RejectPayment`, aggregate idempotency |
| FR-011 | `ExpirePendingReservationsJob` every 60 s, `created_at < now - 15 min` from `v_reservation_details` via `ReadModelViews` |
| FR-012 | `v_reservation_status` + 5 s cache + `DEL` after the event |
| FR-013, FR-019 | `ReservationId`, `SecureCode`, `secureCodeHash` |
| FR-014, FR-015, FR-016 | `RedisReservationAccess`: 15-minute token, attempt counter 5/15 min |
| FR-017 | `v_reservation_details`, `v_reservation_timeline` |
| FR-018 | `Reservation.cancel(today)`, `ReservationCancelled` |
| FR-020 | `events`, `ProjectionRunner.rebuild()` |
| FR-021 | `contracts/frontend.md` (Optimistic UI) |
