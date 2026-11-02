# Implementation Plan: Hotel Room Booking (MVP)

**Branch**: `001-hotel-room-booking` | **Date**: 2026-10-31 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-hotel-room-booking/spec.md`

**Sources of technical decisions**: the design document
`docs/superpowers/specs/2026-10-31-hotel-booking-mvp-design.md` (approved by the owner,
updated after the comments of 2026-10-31) and constitution v1.1.1. Where the plan departs from
the design document, the deviation is named in `research.md` with a rationale.

## Summary

A guest picks one of three rooms, marks the stay in a calendar, enters a name and an e-mail, pays
at a simulated payment operator and receives a permanent link with a six-character secure code
under which they can view and cancel the reservation. The backend is a single NestJS application
laid out as Clean Architecture, with the `Reservation` aggregate rebuilt solely from an own event
store in MariaDB, synchronous projections into `rm_*` tables, SQL views as the only read contract
and a Redis cache with a stampede lock. The frontend is Vue 3 + Pinia with an optimistic UI for
date selection, reservation creation and cancellation. The payment simulator is a separate module
that returns to the domain only through a signed webhook.

## Technical Context

**Language/Version**: TypeScript 5.x; Node.js 26 (locally v26.12.1; `engines.node >= 22`)

**Primary Dependencies**:
- API: NestJS 12 (`@nestjs/core`, `@nestjs/cqrs`, `@nestjs/schedule`, `@nestjs/config`),
  Knex 3.3 + `mysql2`, `ioredis` 6, `class-validator` + `class-transformer`, Node `crypto`
  (scrypt for the code hash, HMAC for the webhook).
- Web: Vue 3.5, Pinia 4, Vue Router 5, Vite 8.
- Versions and rationale in [research.md](research.md).

**Storage**: MariaDB 11 (tables `events`, `room_night_locks`, `rooms`, `rm_*`,
`projection_checkpoints`; views `v_*`), Redis 7 (read cache with TTL, cache-rebuild locks,
access tokens, code attempt counters). Docker Compose for both.

**Testing**: API: Jest + `ts-jest`, `@nestjs/testing`, `supertest`; integration and E2E tests on
real MariaDB/Redis from Docker Compose (separate `hotel_test` database). Web: Vitest +
`@vue/test-utils` + `@pinia/testing`.

**Target Platform**: local run on macOS (Docker Desktop); desktop browser and a phone on the
local network (390 px width as the minimum).

**Project Type**: web application: npm workspaces monorepo with `apps/api` (NestJS) and `apps/web`
(Vue 3).

**Performance Goals**: reservation status visible < 6 s after the operator's decision with a 3 s
delay (SC-002; polling every 2 s, status cache of 5 s invalidated after the event); 500 concurrent
calendar reads after cache expiry → exactly one database query (SC-005); expiry of a pending
reservation within 60 s after the 15 minutes pass (FR-011).

**Constraints**: local environment only, no CI and no deployment; a single API instance
(synchronous in-process projections, webhook scheduled with `setTimeout`); reads only through SQL
views; code and code documentation in English, UI and Spec Kit artifacts in Polish
(constitution VIII); no ORM; no login.

**Scale/Scope**: 3 rooms, 6 screens (room list + 5 mockups), 11 HTTP endpoints, 6 commands
(including `VerifySecureCode`), 6 queries (including `GetPaymentView` for the simulator), 5 event
types, 5 SQL views, 9 ADRs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How the plan satisfies it | Status |
|---|---|---|
| I. Clean Architecture and the dependency rule | Directories `domain/`, `application/`, `infrastructure/`, `presentation/` in `apps/api/src/booking` and `shared`; the import rule is enforced by `eslint-plugin-boundaries` (`domain` → nothing; `application` → `domain`; `infrastructure`/`presentation` → `application`, `domain`). `payment-operator-simulator` imports nothing from `booking`. | PASS |
| II. DDD: ubiquitous language and aggregates | Class names = the ubiquitous language table from the spec/design doc (`Room`, `Reservation`, `Stay`, `Night`, `Money`, `SecureCode`, `ReservationStatus`). Rules live in the aggregate and VOs. The cross-aggregate invariant (room nights) has the `room_night_locks` mechanism in the same transaction as the events, and ADR-003. | PASS |
| III. Real event sourcing (non-negotiable) | `MariaDbEventStore` (`append` with `expectedVersion`, `load`, `readAll`); `Reservation.fromHistory(events)`; `rm_*` fed only by the projector; `projections:rebuild` clears and replays; an integration test compares the live state with the rebuilt one (US5, SC-004). The secure code enters the event only as a hash. | PASS |
| IV. CQRS with cache and lock | `CommandBus` → aggregate + event store; `QueryBus` → handlers reading only `v_*` views through `ReadModelCache.getOrLoad`; `RedisReadModelCache` with `SET NX PX` and waiting; the projector issues `DEL` after each event; a test with 500 concurrent reads → one `loader`. | PASS |
| V. Minimum abstraction (YAGNI) | Ports only where there are two implementations or an infrastructure boundary: `EventStore`, `ReservationRepository`, `RoomNightLocks`, `ReadModelCache`, `ReadModelViews`, `ReservationAccess`, `RoomCatalog`, `EventPublisher`, `Clock`, `IdGenerator`, `UnitOfWork`, `AppLogger`. No generic repository, no port to the payment operator. Every port has a production and an in-memory/test implementation. | PASS |
| VI. Tests as proof (non-negotiable) | Domain and handlers: Jest, TDD, no mocks in the domain. Integration: event store, projections (rebuild), cache, code access on Docker Compose. E2E: supertest full journey (SC-007). Web: Vitest for the stores (optimistic paths and rollbacks) and the calendar. Scripts `test` (unit) and `test:integration`. | PASS |
| VII. ADRs | 9 ADRs (8 from the design document + ADR-009 on codes instead of texts in the API) are created in the tasks implementing each decision; format context/decision/consequences/alternatives; in English (VIII). | PASS |
| VIII. Code language and comments | Code, file names, commits, README, ADRs, comments, docstrings in English. Comments only "why" (business decision, ADR reference). Lint: no automatic rule, enforced in review; `tasks.md` contains a comment review task. UI and Spec Kit artifacts in Polish. | PASS |

Gate before Phase 0: **PASS**, with no violations requiring an entry in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-hotel-room-booking/
├── plan.md              # this file
├── research.md          # Phase 0: versions, decisions, deviations from the design doc
├── data-model.md        # Phase 1: aggregate, events, tables, views, Redis keys
├── quickstart.md        # Phase 1: running and verification scenarios
├── contracts/
│   ├── openapi.yaml     # HTTP contract (API + simulator + webhook)
│   ├── events.md        # contract of domain events and metadata
│   └── frontend.md      # routes, Pinia stores, Optimistic UI rules
└── tasks.md             # Phase 2: /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
package.json                 # npm workspaces: apps/*; scripts dev, test, test:integration, lint,
                             # db:migrate, db:seed, projections:rebuild
docker-compose.yml           # mariadb:11, redis:7 (+ databases hotel and hotel_test)
.env.example
README.md                    # English (constitution VIII)
docs/adr/                    # ADR-001 … ADR-009, English
docs/superpowers/specs/      # design doc (Polish)

apps/api/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── shared/
│   │   ├── domain/           # AggregateRoot, DomainEvent, DomainError, Money, ids
│   │   ├── application/      # ports: Clock, IdGenerator, UnitOfWork, EventStore
│   │   └── infrastructure/   # KnexModule, RedisModule, ConfigModule, SystemClock, CryptoIdGenerator
│   ├── booking/
│   │   ├── domain/           # Reservation, Stay, Night, SecureCode, ReservationStatus, events/, errors/
│   │   ├── application/
│   │   │   ├── commands/     # CreateReservation, ConfirmPayment, RejectPayment,
│   │   │   │                 # ExpireReservation, CancelReservation, VerifySecureCode (+ handlers)
│   │   │   ├── queries/      # ListRooms, GetRoomCard, GetBlockedNights,
│   │   │   │                 # GetReservationDetails, GetReservationStatus,
│   │   │   │                 # GetPaymentView handler (query class lives in shared/contracts)
│   │   │   ├── ports/        # ReservationRepository, RoomNightLocks, ReadModelCache,
│   │   │   │                 # ReservationAccess, RoomCatalog, ReadModelViews (reads v_* only)
│   │   │   └── projections/  # ReservationProjector (pure event → read-model changes)
│   │   ├── infrastructure/
│   │   │   ├── persistence/  # MariaDbEventStore, MariaDbReservationRepository,
│   │   │   │                 # MariaDbRoomNightLocks, KnexRoomCatalog, migrations/, seeds/
│   │   │   ├── cache/        # RedisReadModelCache (cache-aside + lock)
│   │   │   ├── projections/  # ProjectionRunner, checkpoints, rebuild command (CLI entry)
│   │   │   ├── access/       # RedisReservationAccess (tokens, attempt limiter)
│   │   │   └── scheduling/   # ExpirePendingReservationsJob
│   │   └── presentation/     # RoomsController, ReservationsController, WebhooksController,
│   │                         # DTOs (class-validator), DomainErrorFilter
│   └── payment-operator-simulator/
│       ├── application/      # WebhookScheduler (setTimeout + HMAC signing)
│       └── presentation/     # PaymentOperatorController
├── test/
│   ├── unit/                 # domain, handlers, projector (pure), in-memory adapters
│   ├── integration/          # event-store, projections-rebuild, cache-stampede, access
│   └── e2e/                  # guest-journey.e2e-spec.ts (supertest)
├── jest.config.ts, jest.integration.config.ts
└── knexfile.ts

apps/web/
├── src/
│   ├── main.ts, App.vue, router.ts
│   ├── api/                  # typed HTTP client (fetch), error mapping
│   ├── stores/               # useRoomStore, useReservationStore
│   ├── views/                # RoomListView, RoomView, BookView, PaymentView, ReservationView
│   ├── components/           # StayCalendar, GuestForm, SecureCodeGate, ReservationTimeline,
│   │                         # StatusBanner, SaveDetailsCard
│   └── lib/                  # dates (Europe/Warsaw), money formatting, session storage
├── tests/                    # Vitest: stores, StayCalendar
└── vite.config.ts
```

**Structure Decision**: an npm workspaces monorepo with two applications (`apps/api`, `apps/web`),
as in section 7 of the design document. The Clean Architecture layers are directories inside the
`booking` context; `shared` holds only elements used by more than one context.
`payment-operator-simulator` is a separate Nest module in the same process, with no imports from `booking`.

## Phase 0: Research (done)

Result in [research.md](research.md): pinned library versions (npm state as of 2026-10-31),
consequences of NestJS 12 / Pinia 4 / Vue Router 5 / ioredis 6, the decision CommonJS + Jest for the
API and ESM + Vitest for the web, the code hash via `crypto.scrypt` instead of `bcrypt` (deviation
from the design doc), date and time-zone representation, identifier format, webhook signature,
integration test strategy on Docker Compose. No remaining NEEDS CLARIFICATION.

## Phase 1: Design (done)

- [data-model.md](data-model.md): the `Reservation` aggregate and state machine, value objects,
  events, write and read tables, SQL views, Redis keys, validation rules mapped to FRs.
- [contracts/openapi.yaml](contracts/openapi.yaml): 11 endpoints with error codes.
- [contracts/events.md](contracts/events.md): payload and metadata of every event, versioning rules.
- [contracts/frontend.md](contracts/frontend.md): routes, store contract, Optimistic UI rules.
- [quickstart.md](quickstart.md): running, guest journey, tests, projection rebuild.

### Constitution Check after Phase 1

Re-evaluation against the designed artifacts:

- I: `contracts/frontend.md` and the source tree introduce no reverse dependencies; the simulator
  module reads `v_reservation_details` through its own query handler, not through `booking` classes
  (access via `QueryBus`, which is the public contract of the context). PASS.
- II: `data-model.md` uses only names from the ubiquitous language. PASS.
- III: `events.md` defines minimal payloads, past-tense names, `secureCodeHash` instead of the
  code; `rm_*` have no columns that cannot be derived from the events + `rooms`. PASS.
- IV: every query in `openapi.yaml` marked `cache: yes` has a key and TTL in `data-model.md`;
  no query handler reads the `rm_*` tables directly. PASS.
- V: 12 ports; the added `RoomCatalog`, `ReadModelViews`, `EventPublisher` (publication after commit, awaiting the projections; a recording double in tests) and `AppLogger` (Nest `Logger` / a stub in tests) each have two implementations;
  `ReadModelViews` separates the query handlers from Knex; without it the `application` layer would
  import infrastructure (rule I). `RoomCatalog`
  replaces the direct room-price read in the command handler. PASS.
- VI: `quickstart.md` lists the test commands and expected results for every layer. PASS.
- VII: ADR-006 covers the scrypt decision; ADR-009 added (the API returns codes, texts in the UI). PASS.
- VIII: all identifiers in the contracts are in English; the backend returns only codes
  (errors, event types, reasons), and Polish texts live only in the frontend in `src/i18n/pl.ts`
  (decision from the review of 2026-10-31, research R-14). PASS.

## Complexity Tracking

No Constitution Check violations; the table is not required.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| – | – | – |
