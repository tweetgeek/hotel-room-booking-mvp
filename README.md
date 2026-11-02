# Hotel Room Booking MVP

This is only for an experiment to check how old project (Laravel) can be redesigned to use CQRS and SQL Views in NestJS with GitHub Spec Kit.

A small property's room booking system built as a worked example of Clean Architecture, DDD,
real event sourcing, CQRS with SQL views and a Redis cache, and an optimistic UI. Backend: NestJS
12; frontend: Vue 3 + Pinia. It runs locally only and is not meant for production.

The specification, plan and task list live in `specs/001-hotel-room-booking/` (Spec Kit).
Architecture decisions are recorded in [`docs/adr/`](docs/adr/README.md). Domain vocabulary is in
[`GLOSSARY.md`](GLOSSARY.md).

## Architecture in three paragraphs

**Write side.** A reservation is an event stream: `ReservationRequested`, then `PaymentConfirmed`,
`PaymentRejected` or `ReservationExpired`, and possibly `ReservationCancelled`. The `Reservation`
aggregate is rebuilt from those events on every command (`apps/api/src/booking/domain`), the events
are appended to one MariaDB table with optimistic concurrency (ADR-002), and the invariant "one
active reservation per room night" is guarded by `room_night_locks`, written in the same
transaction (ADR-003). Commands go through the NestJS `CommandBus`.

**Read side.** A pure projector turns each stored event into idempotent changes of the `rm_*`
tables; a runner applies them right after the command commits and invalidates the Redis cache
(ADR-004). Query handlers read only SQL views through the `ReadModelViews` port and cache results
with a stampede lock, so 500 concurrent misses cause exactly one database read (ADR-005). The read
models can be dropped and rebuilt from the event store at any time (`npm run projections:rebuild`).

**Edges.** The payment operator simulator is a separate module that only talks to the booking
context through the `QueryBus` and a signed, delayed webhook (ADR-007). Guests return to a
reservation through a permanent link and a six-character secure code stored as a scrypt hash
(ADR-006). The API returns codes only; every Polish text lives in `apps/web/src/i18n/pl.ts`
(ADR-009), and the Pinia stores apply explicit optimistic-UI rules with visible rollbacks (ADR-008).
Layer boundaries are enforced by ESLint (ADR-001).

## Prerequisites

- Node.js 22 or newer and npm 10 or newer
- Docker Desktop (MariaDB 11 and Redis 7 run from `docker-compose.yml`)
- Free ports: 3100 (API), 5173 (web), 3307 (MariaDB), 6380 (Redis); the non-default ports avoid
  clashing with other local Docker projects

## Run

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://localhost:5173/. The API answers on http://localhost:3100/rooms.

To open the app on a phone in the same network, run `npm run dev -- --host` and set
`VITE_API_URL=http://<your-computer-ip>:3100` in `.env`.

## Tests

| Command | Scope |
|---|---|
| `npm test` | unit tests for the API (domain, handlers, projector, simulator) and the web app (stores, components, helpers); no Docker |
| `npm run test:integration` | event store, projections and rebuild, cache stampede, secure-code access, reservation creation under concurrency (SC-003); needs Docker |
| `npm run test:e2e` | the full guest journey and payment edge cases over HTTP with real webhooks; needs Docker |
| `npm run lint` | ESLint (including layer boundaries) and Prettier |

Integration and E2E tests use the `hotel_test` database and Redis databases 2 and 3, so the data
you created through the UI stays untouched.

## Rebuild read models

```bash
npm run projections:rebuild
```

Truncates every `rm_*` table, resets the projection checkpoint, replays the event store in batches
and flushes the read-model cache. `room_night_locks` is part of the write path and is left alone.

## Expiry

A reservation waiting for payment longer than `PENDING_PAYMENT_TTL_MINUTES` (default 15) expires
within the next minute and its nights return to the pool. Set the variable to `1` to try it quickly.

## Known limitations of the MVP

- One API instance: projections run in-process; several instances would need an outbox (ADR-004).
- Webhooks scheduled by the simulator live in memory and are lost on restart; the reservation then
  simply expires (ADR-007).
- A payment that arrives after the reservation expired is neither refunded nor recorded (ADR-007).
- No e-mail or SMS: the permanent link and the secure code are shown once, on screen.
- Rooms have generated placeholder images instead of photos.
