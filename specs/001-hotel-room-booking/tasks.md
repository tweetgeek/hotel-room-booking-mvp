# Tasks: Hotel Room Booking (MVP)

**Input**: Design documents from `/specs/001-hotel-room-booking/`

**Prerequisites**: plan.md, spec.md, research.md (R-01…R-17), data-model.md, contracts/ (openapi.yaml,
events.md, frontend.md), quickstart.md, `GLOSSARY.md`, constitution v1.1.1.

**Tests**: required by constitution VI (tests as proof, TDD). Every story has test tasks written BEFORE
the implementation; a test must fail first.

**Organization**: tasks are grouped by the user stories from `spec.md`, so that each story can be
implemented and tested on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: user story (US1…US5)
- Every task names exact file paths

## Rules for every task

- Code, file names, tests, comments, ADRs and commits in English; only "why" comments
  (constitution VIII). The Polish UI exclusively through `apps/web/src/i18n/pl.ts`.
- One Conventional Commits commit in English after every task, e.g.
  `feat(api): add MariaDB event store with optimistic concurrency`, `test(web): cover optimistic
  reservation rollback`, `docs(adr): record night locks decision`. Scopes: `api`, `web`, `adr`, `repo`.
- A task is done when its tests pass locally (`npm test`, and for infrastructure
  `npm run test:integration -w apps/api` on Docker Compose) and `npm run lint` reports no errors.
- The ADR is written in the task where the decision is made (format: Context / Decision / Consequences /
  Alternatives considered; file `docs/adr/ADR-00N-<slug>.md`, in English).
- Class and field names come from `GLOSSARY.md`; a new term = a glossary update in the same task.

## Path Conventions

npm workspaces monorepo (plan.md, Project Structure section): `apps/api/src/{shared,booking,
payment-operator-simulator}`, `apps/api/test/{unit,integration,e2e}`, `apps/web/src/{api,stores,
views,components,lib,i18n}`, `apps/web/tests`, `docs/adr`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: monorepo skeleton, both applications, Docker Compose, lint with the layer rule.

- [X] T001 Create the monorepo root: `package.json` (npm workspaces `apps/*`, `engines.node >= 22`, scripts `dev` (api + web in parallel), `test`, `test:integration`, `test:e2e`, `lint`, `db:migrate`, `db:seed`, `projections:rebuild` delegating through `-w`), `.env.example` (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME=hotel, DB_TEST_NAME=hotel_test, REDIS_URL, REDIS_CACHE_DB=0, REDIS_ACCESS_DB=1, WEBHOOK_SECRET, API_BASE_URL=http://localhost:3100, PORT=3000, PENDING_PAYMENT_TTL_MINUTES=15, VITE_API_URL; descriptions in English), `docker-compose.yml` (`mariadb:11` with `docker/mariadb/init.sql` creating the `hotel` and `hotel_test` databases, `redis:7`, ports 3306/6379) and `README.md` in English with the run summary from `quickstart.md`.
- [X] T002 Initialize `apps/api`: `apps/api/package.json` with the versions from research R-01 (NestJS 12.3.2, @nestjs/cqrs 12.1.2, @nestjs/schedule 12.0.2, @nestjs/config 12.0.1, knex 3.3.0, mysql2 3.24.6, ioredis 6.0.0, class-validator 0.15.1, class-transformer 0.5.1, zod, jest 30.5.2, ts-jest 29.4.15, @nestjs/testing 12.3.2, supertest 7.3.1, typescript 5.9.3), `apps/api/tsconfig.json` (CommonJS, `emitDecoratorMetadata`, `experimentalDecorators`, `target ES2022`, `strict`), `apps/api/nest-cli.json`, `apps/api/src/main.ts` (bootstrap on `PORT`, CORS for the local network), an empty `apps/api/src/app.module.ts`, `apps/api/jest.config.ts` (directory `test/unit`), `apps/api/jest.integration.config.ts` (`test/integration`, `*.integration-spec.ts`), `apps/api/jest.e2e.config.ts` (`test/e2e`, `*.e2e-spec.ts`), `apps/api/knexfile.ts` reading `.env` with the `migrations/` and `seeds/` directories; scripts `start:dev`, `build`, `test`, `test:integration`, `test:e2e`, `db:migrate`, `db:seed`, `projections:rebuild`.
- [X] T003 [P] Initialize `apps/web`: `apps/web/package.json` (vue 3.5.44, pinia 4.1.0 + `@vue/devtools-api`, vue-router 5.4.0, vite 8.3.5, @vitejs/plugin-vue 6.0.10, vitest 5.0.5, @vue/test-utils 2.5.1, @pinia/testing 2.0.2, typescript 5.9.3), `apps/web/vite.config.ts` (Vue plugin, `server.host` controlled by the `--host` flag, Vitest configuration with `environment: 'jsdom'`), `apps/web/index.html` (`lang="pl"`, viewport), `apps/web/src/main.ts` (Pinia + Router), `apps/web/src/App.vue` (`<RouterView>`), `apps/web/src/router.ts` with the five routes from contracts/frontend.md pointing to temporary empty views, `apps/web/tsconfig.json`, `apps/web/src/env.d.ts` (`VITE_API_URL`).
- [X] T004 [P] Configure lint and formatting and write ADR-001: `eslint.config.js` at the root (eslint 10.14.0, typescript-eslint, eslint-plugin-vue, prettier 3.9.10, `eslint-plugin-boundaries` with the elements `domain`, `application`, `infrastructure`, `presentation`, `payment-operator-simulator`, `shared` and the rules from research R-10: `domain` → nothing; `application` → `domain`; `infrastructure`/`presentation` → `application`, `domain`; `payment-operator-simulator` → `shared` only), `.prettierrc`, `.editorconfig`; `docs/adr/ADR-001-clean-architecture-layers.md` (layer layout, dependency rule enforced by lint, when a port is created: two implementations or an infrastructure boundary; constitution I and V).

**Checkpoint**: `npm install`, `docker compose up -d`, `npm run lint` and `npm run dev` work (the api answers 404 on `/`, the web app shows an empty page).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: shared domain elements, ports, configuration, database schema, event store, cache,
error filter and frontend libraries, without which no story can start.

**⚠️ CRITICAL**: no user story starts before this phase is complete.

- [X] T005 [P] Write unit tests for the shared value objects in `apps/api/test/unit/shared/domain/money.spec.ts` (`Money` only non-negative grosze, `currency 'PLN'`, `multiply(n)`, equality), `apps/api/test/unit/shared/domain/calendar-date.spec.ts` (`CalendarDate` from `YYYY-MM-DD`, `addDays`, `isBefore`, `daysBetween`, rejection of `2026-02-30`) and `apps/api/test/unit/shared/domain/ids.spec.ts` (`ReservationId` matches `^RES-[0-9A-HJKMNP-TV-Z]{6}$`, `PaymentId` matches `^PAY-[0-9A-HJKMNP-TV-Z]{10}$`, `RoomId` is a positive integer).
- [X] T006 Implement `apps/api/src/shared/domain/money.ts`, `apps/api/src/shared/domain/calendar-date.ts`, `apps/api/src/shared/domain/ids.ts`, `apps/api/src/shared/domain/aggregate-root.ts` (list of unpublished events, `version`), `apps/api/src/shared/domain/domain-event.ts` (envelope type: `eventType`, `payload`, `metadata { correlationId, causationId, occurredAt }`, `occurredAt`), `apps/api/src/shared/domain/domain-error.ts` (base class with a `code` field), so that the tests from T005 pass.
- [X] T007 [P] Write tests for and implement the shared ports: `apps/api/src/shared/application/ports/clock.ts` (`today(): CalendarDate` in `Europe/Warsaw`, `now(): Date`), `apps/api/src/shared/application/ports/id-generator.ts` (`reservationId()`, `paymentId()`, `accessToken()` 32 bytes hex), `apps/api/src/shared/application/ports/unit-of-work.ts` (`run(fn(tx))`), `apps/api/src/shared/application/ports/event-store.ts` (`append(streamId, expectedVersion, events)`, `load(streamId)`, `readAll(fromPosition, batchSize)`, class `ConcurrencyError`); implementations `apps/api/src/shared/infrastructure/time/system-clock.ts` (`Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' })`), `apps/api/test/unit/support/fixed-clock.ts`, `apps/api/src/shared/infrastructure/ids/crypto-id-generator.ts` (Crockford base32 from `crypto.randomBytes`), `apps/api/test/unit/support/sequential-id-generator.ts`, `apps/api/test/unit/support/in-memory-event-store.ts`; tests `apps/api/test/unit/shared/infrastructure/system-clock.spec.ts` (day change in Warsaw at 22:30 UTC) and `apps/api/test/unit/shared/infrastructure/crypto-id-generator.spec.ts` (alphabet, lengths).
- [X] T008 Configure the infrastructure modules: `apps/api/src/shared/infrastructure/config/env.schema.ts` (zod for every variable from `.env.example`), `apps/api/src/shared/infrastructure/config/config.module.ts` (`@nestjs/config` with validation), `apps/api/src/shared/infrastructure/persistence/knex.module.ts` (`mysql2` pool, `SET time_zone = '+00:00'` per session), `apps/api/src/shared/infrastructure/persistence/knex-unit-of-work.ts` (Knex transaction as `UnitOfWork`), `apps/api/src/shared/infrastructure/redis/redis.module.ts` (two ioredis clients: cache `db` from `REDIS_CACHE_DB`, access from `REDIS_ACCESS_DB`), registration in `apps/api/src/app.module.ts` together with `CqrsModule.forRoot()`, `ScheduleModule.forRoot()` and the global error filter from T017 via `APP_FILTER`; `apps/api/src/main.ts` with a global `ValidationPipe({ whitelist: true, transform: true })`.
- [X] T009 Create the write-side migrations according to data-model.md section 3: `apps/api/src/booking/infrastructure/persistence/migrations/20261101000100_create_events.ts` (columns `position BIGINT AUTO_INCREMENT PK`, `stream_id VARCHAR(40)`, `stream_version INT`, `event_type VARCHAR(100)`, `payload JSON`, `metadata JSON`, `occurred_at DATETIME(3)`, `UNIQUE (stream_id, stream_version)`), `.../20261101000200_create_room_night_locks.ts` (`room_id INT`, `night DATE`, `reservation_id VARCHAR(40)`, `PRIMARY KEY (room_id, night)`, `KEY idx_reservation`), `.../20261101000300_create_rooms.ts` (`id INT PK`, `name VARCHAR(100)`, `description TEXT`, `features JSON`, `price_per_night INT` in grosze, `currency CHAR(3) DEFAULT 'PLN'`, `check_in_time CHAR(5) DEFAULT '15:00'`, `check_out_time CHAR(5) DEFAULT '11:00'`, `image_url VARCHAR(255) NULL`); `npm run db:migrate -w apps/api` passes on `hotel` and `hotel_test`.
- [X] T010 Create the read-side and view migrations according to data-model.md sections 4–5: `apps/api/src/booking/infrastructure/persistence/migrations/20261101000400_create_read_models.ts` (`rm_reservations`: id, room_id, check_in, check_out, nights, guest_name, guest_email, total_amount, currency, status, rejection_reason NULL, refund_amount NULL, payment_id UNIQUE, created_at, updated_at; `rm_reservation_timeline`: reservation_id, position BIGINT, event_type, occurred_at, reason NULL, PK (reservation_id, position); `rm_room_nights`: room_id, night, reservation_id, status ENUM('held','confirmed'), PK (room_id, night); `projection_checkpoints`: name PK, last_position) and `.../20261101000500_create_views.ts` with raw `CREATE OR REPLACE VIEW` SQL for `v_room_card`, `v_room_blocked_nights`, `v_reservation_status` (id, status, rejection_reason), `v_reservation_details` (all `rm_reservations` columns, including `created_at`, JOIN `rooms`: room_name, check_in_time, check_out_time), `v_reservation_timeline` (ORDER BY position); `down` drops the views and tables.
- [X] T011 Create the seed of the three rooms `apps/api/src/booking/infrastructure/persistence/seeds/001_rooms.ts` exactly as in data-model.md (1 „Pokój dwuosobowy z balkonem" 32000 `["balcony","wifi","tv"]`; 2 „Pokój rodzinny" 45000 `["wifi","tv","crib","kettle"]`; 3 „Apartament z tarasem" 62000 `["terrace","wifi","tv","kitchenette","air_conditioning"]`; Polish descriptions as data; `image_url NULL`); idempotent seed (upsert by `id`); `npm run db:seed -w apps/api`.
- [X] T012 Prepare the integration and E2E test support: `apps/api/test/integration/support/test-database.ts` (Knex to `hotel_test`, `truncateAll()` for `events`, `room_night_locks`, `rm_*`, `projection_checkpoints`, re-seeding the rooms), `apps/api/test/integration/support/test-redis.ts` (ioredis `db=2` cache and `db=3` access, `flushdb()`), `apps/api/test/integration/support/create-test-app.ts` (`Test.createTestingModule` with `AppModule` and overridden variables `DB_NAME=hotel_test`, `REDIS_CACHE_DB=2`, `REDIS_ACCESS_DB=3`), `apps/api/test/e2e/support/create-e2e-app.ts` (full HTTP application on a random port, `API_BASE_URL` pointing at it for the webhook); the `test:integration` and `test:e2e` scripts run these configurations.
- [X] T013 [P] Write the event store integration test `apps/api/test/integration/event-store.integration-spec.ts`: `append` assigns `stream_version` from `expectedVersion+1`, `load` returns events by version with `metadata` and `occurredAt` restored, `readAll(fromPosition, batchSize)` returns batches by `position`, two parallel `append` calls with the same `expectedVersion` → exactly one success and one `ConcurrencyError`, `append` inside a `UnitOfWork` transaction rolls back together with it.
- [X] T014 Implement `apps/api/src/booking/infrastructure/persistence/mariadb-event-store.ts` (multi-row INSERT in one transaction, mapping a `uq_stream` violation to `ConcurrencyError`, event type registry for deserialization in `apps/api/src/booking/infrastructure/persistence/event-type-registry.ts`), so that T013 passes; write `docs/adr/ADR-002-event-sourcing-with-own-mariadb-event-store.md` (own `events` table instead of a library/EventStoreDB, no snapshots because a stream has ≤ 2 events, versioning through a new event type).
- [X] T015 [P] Write the cache integration test `apps/api/test/integration/cache-stampede.integration-spec.ts`: 500 parallel `getOrLoad('room:1:nights:a:b', 60, loader)` calls on an empty Redis → `loader` called exactly once and 500 identical results (SC-005); an acquired lock is released only by its owner (Lua script with a token); when the lock is taken and the value does not appear within 3 s, the caller runs `loader` without writing; `invalidate(key)` and `invalidatePattern('room:1:nights:*')` remove the keys.
- [X] T016 Implement the port `apps/api/src/booking/application/ports/read-model-cache.ts` (`getOrLoad<T>(key, ttlSeconds, loader)`, `invalidate(keys[])`, `invalidatePattern(pattern)`), `apps/api/src/booking/infrastructure/cache/redis-read-model-cache.ts` exactly per the research R-07 algorithm (`GET`; `SET key:lock token NX PX 3000`; `loader` → `SET key json EX ttl` → Lua `if GET lock == token then DEL`; otherwise polling `GET` every 50 ms for up to 3 s; `SCAN MATCH` + `DEL` for patterns) and `apps/api/test/unit/support/in-memory-read-model-cache.ts` (hit counter for handler tests); write `docs/adr/ADR-005-sql-views-and-cache-aside-with-stampede-lock.md` (views as the only read contract, cache-aside with a lock instead of `CacheModule`/redlock, keys and TTLs from data-model.md section 6).
- [X] T017 Implement the mapping of errors to HTTP codes and write ADR-009: base `DomainError { code, httpStatus, extras? }` in `apps/api/src/shared/domain/domain-error.ts` (from T006) plus `NotFoundError` 404 `NOT_FOUND` and `UnauthorizedError` 401 `UNAUTHORIZED` in `apps/api/src/shared/domain/errors/`; booking context errors in `apps/api/src/booking/domain/errors/` (`InvalidStayError` 422 `INVALID_STAY`, `RoomNotAvailableError` 409 `ROOM_NOT_AVAILABLE`, `ReservationNotCancellableError` 422 `RESERVATION_NOT_CANCELLABLE`, `InvalidSecureCodeError` 401 `INVALID_SECURE_CODE` with `attemptsLeft`, `TooManyAttemptsError` 429 `TOO_MANY_ATTEMPTS` with `retryAfterSeconds`, `InvalidSignatureError` 401 `INVALID_SIGNATURE`; `ConcurrencyError` 409 `CONCURRENCY_CONFLICT` in `shared/application/ports/event-store.ts`); `ReservationNotPendingError` 409 `RESERVATION_NOT_PENDING` is created in T049 inside the simulator module, because only it throws it; the global `apps/api/src/shared/presentation/filters/domain-error.filter.ts` (maps every `DomainError` by `httpStatus` to `{ code, message, ...extras }` with an English `message`, `Retry-After` header for 429; registered via `APP_FILTER` in `app.module.ts`, so it also covers the simulator controller), `apps/api/src/shared/presentation/filters/validation-exception.factory.ts` (422 `VALIDATION_FAILED` with `details[{ field, code }]`, codes `REQUIRED | TOO_LONG | INVALID_EMAIL | INVALID_DATE | CHECK_OUT_NOT_AFTER_CHECK_IN | TOO_MANY_NIGHTS | CHECK_IN_IN_PAST | INVALID_FORMAT`), test `apps/api/test/unit/shared/presentation/domain-error.filter.spec.ts`; `docs/adr/ADR-009-api-returns-codes-ui-owns-polish-text.md`.
- [X] T018 [P] Write the frontend library tests `apps/web/tests/lib/dates.spec.ts` (`todayInWarsaw()`, `addDays`, `nightsBetween('2026-11-10','2026-11-13') = ['2026-11-10','2026-11-11','2026-11-12']`, `monthGrid(year, month)` with empty leading cells from Monday, `threeMonthsFrom(today)`) and `apps/web/tests/lib/money.spec.ts` (`formatMoney(96000, 'PLN') = '960,00 zł'` per `Intl.NumberFormat('pl-PL')`).
- [X] T019 Implement `apps/web/src/lib/dates.ts`, `apps/web/src/lib/money.ts`, `apps/web/src/lib/session.ts` (`sessionStorage` key `booking.session` with `{ reservationId, accessToken, roomId }`, never `secureCode`), `apps/web/src/api/client.ts` (`fetch` with `VITE_API_URL`, the `X-Reservation-Access` header, class `ApiError { status, code, message, details?, attemptsLeft?, retryAfterSeconds? }`, network failure handled as `NETWORK_ERROR`) and `apps/web/src/i18n/pl.ts` with the typed maps from contracts/frontend.md: `errors[code]` (among others `ROOM_NOT_AVAILABLE` → „Wybrane noce są już zajęte.", `NETWORK_ERROR`, `RESERVATION_NOT_PENDING` → „Rezerwacja wygasła, płatność nie została przyjęta."), `fields[field][code]`, `status[status]` (+ `Rejected` with `abandoned_by_guest` → „Płatność przerwana"), `timeline[eventType]`, `features[key]` for every key from the seed, and the button and heading texts of the five screens.

**Checkpoint**: migrations and seed pass on both databases; `npm test` and `npm run test:integration -w apps/api` are green (event store, cache).

---

## Phase 3: User Story 1 - I choose a room and dates (Priority: P1) 🎯 MVP

**Goal**: list of three rooms, room page, three-month calendar with blocked nights, immediate
number of nights and total after choosing the dates.

**Independent Test**: open `/`, pick a room, room page with the price, calendar with nights inserted
into `rm_room_nights` as blocked, pick a range that avoids the blocked nights and read the total; scenarios 1–6 of US1.

### Tests for User Story 1

- [X] T020 [P] [US1] Write unit tests for the query handlers with `InMemoryReadModelViews` and `InMemoryReadModelCache` in `apps/api/test/unit/booking/queries/list-rooms.handler.spec.ts` (key `rooms:list`, TTL 600, three cards), `apps/api/test/unit/booking/queries/get-room-card.handler.spec.ts` (key `room:{id}:card`, TTL 600, unknown room → `NotFoundError`) and `apps/api/test/unit/booking/queries/get-blocked-nights.handler.spec.ts` (key `room:{id}:nights:{from}:{to}`, TTL 60, returns only the nights in the range with status `held | confirmed`).
- [X] T021 [P] [US1] Write the room views integration test `apps/api/test/integration/room-views.integration-spec.ts`: `v_room_card` returns the three seeded rooms with `features` as an array and the times `15:00`/`11:00`; after inserting rows into `rm_room_nights`, `v_room_blocked_nights` filters by `room_id` and the range `night BETWEEN from AND to`.
- [X] T022 [P] [US1] Write the component tests `apps/web/tests/components/StayCalendar.spec.ts`: renders the current + 2 months; days before today and blocked nights have the `disabled` attribute and do not react to a click (scenario 3); click check-in, click check-out → emits `{ checkIn, checkOut, nights: 3 }` (scenario 4); a range covering a blocked night is not accepted, the clicked day becomes the new check-in (scenario 5); a check-out earlier than the check-in = new check-in (scenario 6); a range > 30 nights is rejected with a message from `pl.ts`.
- [X] T023 [P] [US1] Write the store tests `apps/web/tests/stores/room.store.spec.ts` with `@pinia/testing`: `loadRooms`, `loadRoom`, `loadBlockedNights` map the API responses; `isNightBlocked` recognizes `held`, `confirmed` and `optimistic`; `holdNightsLocally`/`releaseNightsLocally` change only the given nights; `nightsBetween` counts the nights without the check-out.

### Implementation for User Story 1

- [X] T024 [US1] Implement the read views port `apps/api/src/booking/application/ports/read-model-views.ts` (methods `roomCards()`, `roomCard(roomId)`, `blockedNights(roomId, from, to)`; the remaining methods are added by US2–US4), `apps/api/src/booking/infrastructure/read-models/knex-read-model-views.ts` (only `SELECT` from the `v_*` views) and `apps/api/test/unit/support/in-memory-read-model-views.ts` (the port is already on the list in `plan.md`, Constitution Check V).
- [X] T025 [US1] Implement the queries and handlers in `apps/api/src/booking/application/queries/list-rooms.query.ts`, `get-room-card.query.ts`, `get-blocked-nights.query.ts` (query classes + `@QueryHandler`, reads through `ReadModelCache.getOrLoad` with the keys and TTLs from data-model.md section 6), so that T020 passes.
- [X] T026 [US1] Implement `apps/api/src/booking/presentation/rooms.controller.ts` (`GET /rooms`, `GET /rooms/:roomId`, `GET /rooms/:roomId/blocked-nights?from&to`), `apps/api/src/booking/presentation/dto/blocked-nights-query.dto.ts` (`from`/`to` as `YYYY-MM-DD` → `INVALID_DATE`, `to ≥ from`, at most 93 days → `INVALID_FORMAT`), `apps/api/src/booking/booking.module.ts` registering the handlers, ports and controller (the error filter is global, T008/T017); import in `app.module.ts`; T021 passes; a manual `GET /rooms` returns three cards.
- [X] T027 [P] [US1] Implement `apps/web/src/api/rooms.ts` (types `RoomCard`, `BlockedNight`, functions `fetchRooms`, `fetchRoom`, `fetchBlockedNights`) and `apps/web/src/stores/room.store.ts` per the `useRoomStore` contract from contracts/frontend.md, so that T023 passes.
- [X] T028 [US1] Implement `apps/web/src/components/StayCalendar.vue` (props `blockedNights`, `pricePerNight`; 3 months; day states: past, blocked, selected, in range; buttons ≥ 44 px) and `apps/web/src/components/RoomImagePlaceholder.vue` (generated SVG with the name's initial and the accent colour `#0F6E63`), so that T022 passes.
- [X] T029 [US1] Implement the views `apps/web/src/views/RoomListView.vue` (column of three cards: placeholder, name, price per night, „Zobacz pokój" (View room)), `apps/web/src/views/RoomView.vue` (mockup 1: image, name, description, features from `pl.features`, price, „Wybierz termin" (Choose dates)), `apps/web/src/views/BookView.vue` (mockup 2 without the guest form: calendar + summary "N nights" and the total computed locally from `pricePerNight`), the routes `/`, `/rooms/:roomId`, `/rooms/:roomId/book` in `apps/web/src/router.ts`, global styles `apps/web/src/styles.css` (white ground, accent `#0F6E63`, system font, column max 480 px, no horizontal scrolling at 390 px).

**Checkpoint**: US1 works on its own: list → room → calendar with blocked nights (inserted manually into `rm_room_nights`) → total; US1 tests green.

---

## Phase 4: User Story 2 - I reserve and pay at the simulated payment operator (Priority: P1)

**Goal**: reservation creation with night locks, operator simulator with a delayed HMAC webhook,
reservation page refreshing the status without a reload, expiry after 15 minutes, the „Zapisz te dane" (Save these details) card.

**Independent Test**: scenarios 1–8 of US2: pick dates → details → „Zapłać" (Pay) with a 3 s delay → the status
"pending" changes to "confirmed" in < 6 s; „Odrzuć płatność" (Reject payment) → "rejected" and the nights free;
two parallel `POST /reservations` for the same nights → one 201 and one 409.

### Tests for User Story 2

- [X] T030 [P] [US2] Write unit tests for the value objects in `apps/api/test/unit/booking/domain/stay.spec.ts` (`checkOut > checkIn`, `1 ≤ nights ≤ 30`, `checkIn ≥ today` with `FixedClock`, `nights()` from check-in inclusive to check-out exclusive, a reservation for tonight allowed), `apps/api/test/unit/booking/domain/secure-code.spec.ts` (`generate` yields exactly 6 characters from the alphabet `A-Za-z0-9` without `0 O 1 l I`; `hash()` returns `scrypt$<salt-hex>$<hash-hex>`; `matches` is case-sensitive; `fromInput` ignores hyphens and rejects other characters) and `apps/api/test/unit/booking/domain/guest-details.spec.ts` (`name` 1–100 characters after trimming, `email` per `isEmail`).
- [X] T031 [P] [US2] Write the aggregate tests `apps/api/test/unit/booking/domain/reservation.spec.ts` in the given events / when command / then events style: `Reservation.request(...)` → `ReservationRequested` with `totalAmount = nights × pricePerNight`, `secureCodeHash`, `paymentId`, status `PendingPayment`; `confirmPayment` → `PaymentConfirmed` and `Confirmed`; `rejectPayment(reason)` → `PaymentRejected` with `reason ∈ { rejected_by_operator, abandoned_by_guest }`; `expire` → `ReservationExpired`; each of these three outside `PendingPayment` → no event and no error; `fromHistory(events)` restores the state and `version`.
- [X] T032 [P] [US2] Write the command handler tests with in-memory adapters in `apps/api/test/unit/booking/commands/create-reservation.handler.spec.ts` (price taken from `RoomCatalog` at command time, events + night locks in one `UnitOfWork`, night conflict → `RoomNotAvailableError` without a stored event, unknown room → `NotFoundError`, the result contains `secureCode` in clear text only once and `accessToken` from `ReservationAccess.issueToken`), `.../confirm-payment.handler.spec.ts`, `.../reject-payment.handler.spec.ts`, `.../expire-reservation.handler.spec.ts` (loading through `fromHistory`, saving with `expectedVersion`, lock release in the same transaction, result `{ applied: false }` and a `warn` log outside `PendingPayment`, publication on the `EventBus` only after `commit`).
- [X] T033 [P] [US2] Write the pure projector tests `apps/api/test/unit/booking/projections/reservation-projector.spec.ts`: for each of the five events the expected list of changes (`upsert rm_reservations` with `status`, `rejection_reason`, `refund_amount`; `insert-ignore rm_reservation_timeline` with `event_type`, `occurred_at`, `reason`; `insert`/`update status=confirmed`/`delete` in `rm_room_nights`) and the list of cache keys to invalidate (`reservation:{id}:details`, `reservation:{id}:status`, pattern `room:{roomId}:nights:*`); applying the same event twice yields the same result.
- [X] T034 [P] [US2] Write the simulator and signature tests in `apps/api/test/unit/payment-operator-simulator/webhook-scheduler.spec.ts` (`signature = hex(HMAC_SHA256(secret, `${paymentId}.${outcome}.${sentAt}`))`; delays 0/3/10 s with fake timers; `abandoned` sends `reason = abandoned_by_guest`, `rejected` → `rejected_by_operator`; 3 retries every 1 s after a network error) and `apps/api/test/unit/booking/presentation/webhook-signature.spec.ts` (`verify` with `timingSafeEqual`, a signature of a different length → `false`).
- [X] T035 [P] [US2] Write the reservation store tests `apps/web/tests/stores/reservation.store.spec.ts` for the creation and decision path: `create(draft)` immediately sets `current = { id: null, status: 'PendingPayment', optimistic: true }` and holds the nights locally; a successful `POST` fills in `id`, `paymentId`, `secureCode`, `accessToken`, `optimistic = false` and saves the session without `secureCode`; `decide` before `paymentId` goes to `pendingDecision` and is sent after success; error 409/422/network → nights released, `current = null`, `pendingDecision = null`, message from `pl.errors`; `decide` with 409 `RESERVATION_NOT_PENDING` sets the error without navigating; `pollStatus` stops when the status ≠ `PendingPayment` and calls `loadDetails`; `restoreFromSession` restores `id` and `accessToken`; `forgetSecureCode` clears the code.
- [X] T036 [P] [US2] Write the form tests `apps/web/tests/components/GuestForm.spec.ts`: empty name → `pl.fields.guestName.REQUIRED`, 101 characters → `TOO_LONG`, bad e-mail → `INVALID_EMAIL`, valid data → emits `submit` with `{ guestName, guestEmail }`; server messages (`details[]`) shown next to the fields.
- [X] T037 [P] [US2] Write the integration tests `apps/api/test/integration/create-reservation.integration-spec.ts` (handler on `hotel_test`: `events` and `room_night_locks` written in one transaction; a night conflict rolls back both writes; 100 parallel pairs of `CreateReservation` for the same nights → exactly 100 successes and 100 `RoomNotAvailableError`, SC-003) and `apps/api/test/integration/projections.integration-spec.ts` (`ProjectionRunner` after an event updates `rm_reservations`, `rm_reservation_timeline`, `rm_room_nights`, `projection_checkpoints.last_position` and removes the cache keys in Redis `db=2`; `v_reservation_status` and `v_reservation_details` return consistent data).

### Implementation for User Story 2

- [X] T038 [US2] Implement the value objects `apps/api/src/booking/domain/stay.ts` (with `Night`), `apps/api/src/booking/domain/secure-code.ts` (57-character alphabet, `crypto.scrypt` N=16384 r=8 p=1, 16 B salt, 32 B output, `timingSafeEqual`), `apps/api/src/booking/domain/guest-details.ts`, `apps/api/src/booking/domain/reservation-status.ts` (enum `PendingPayment | Confirmed | Rejected | Expired | Cancelled`), `apps/api/src/booking/domain/rejection-reason.ts`, so that T030 passes; write `docs/adr/ADR-006-secure-code-access-instead-of-login.md` (permanent link + six-character code instead of an account, scrypt instead of bcrypt per research R-03, 15-minute access token in Redis, limit of 5 attempts/15 min, code shown once).
- [X] T039 [P] [US2] Implement the event classes in `apps/api/src/booking/domain/events/reservation-requested.ts`, `payment-confirmed.ts`, `payment-rejected.ts`, `reservation-expired.ts`, `reservation-cancelled.ts` with payloads exactly per contracts/events.md (past-tense names, `secureCodeHash` instead of the code) and register them in `apps/api/src/booking/infrastructure/persistence/event-type-registry.ts`.
- [X] T040 [US2] Implement the aggregate `apps/api/src/booking/domain/reservation.ts` (`static request(...)`, `confirmPayment(paymentId)`, `rejectPayment(paymentId, reason)`, `expire()`, `static fromHistory(events)`, `apply(event)`; the `cancel(today)` method is added in US4), so that T031 passes; comments only about decisions (idempotency per design doc section 4, FR-010).
- [X] T041 [P] [US2] Implement the ports `apps/api/src/booking/application/ports/reservation-repository.ts` (`load(id)`, `save(reservation, tx)` through `EventStore` with `expectedVersion`), `apps/api/src/booking/application/ports/room-night-locks.ts` (`acquire(roomId, nights, reservationId, tx)` throwing `RoomNotAvailableError`, `release(reservationId, tx)`), `apps/api/src/booking/application/ports/reservation-access.ts` (`issueToken(reservationId)`, `resolveToken(token)`; `registerFailedAttempt`/`attemptsLeft` added in US3) and the test adapters `apps/api/test/unit/support/in-memory-reservation-repository.ts`, `in-memory-room-night-locks.ts`, `in-memory-reservation-access.ts`.
- [X] T042 [US2] Implement the commands and handlers in `apps/api/src/booking/application/commands/create-reservation.command.ts`, `confirm-payment.command.ts`, `reject-payment.command.ts`, `expire-reservation.command.ts` (file = command + `@CommandHandler`; `UnitOfWork.run` covers `repository.save` and the night locks; events published on the `EventBus` after `commit`; `CreateReservationResult { reservationId, paymentId, secureCode, accessToken, status, totalAmount, currency, nights }`), so that T032 passes.
- [X] T043 [US2] Implement `apps/api/src/booking/infrastructure/persistence/mariadb-reservation-repository.ts` and `apps/api/src/booking/infrastructure/persistence/mariadb-room-night-locks.ts` (INSERT of `(room_id, night, reservation_id)` rows in the same Knex transaction as `append`; `ER_DUP_ENTRY` → `RoomNotAvailableError`; `DELETE WHERE reservation_id`), so that the `create-reservation.integration-spec.ts` test from T037 passes; write `docs/adr/ADR-003-night-availability-invariant-via-lock-table.md` (lock table in the transaction with the events instead of a `RoomCalendar` aggregate; the table is not a read model and is not rebuilt).
- [X] T044 [US2] Implement the pure projector `apps/api/src/booking/application/projections/reservation-projector.ts` (event → `ReadModelChange[]` + `cacheKeysToInvalidate`) and `apps/api/src/booking/infrastructure/projections/projection-runner.ts` (`EventBus` subscription, processing in `position` order, one transaction per event: `rm_*` changes + `projection_checkpoints`, cache invalidation after `commit`; `rebuild()` added in US5), registration in `booking.module.ts`, so that T033 and `projections.integration-spec.ts` pass; write `docs/adr/ADR-004-synchronous-in-process-projections.md` (synchronous projections after commit, checkpoints, rebuild; outbox as the change required with multiple instances).
- [X] T045 [US2] Implement `apps/api/src/booking/infrastructure/access/redis-reservation-access.ts` (`issueToken`: `SET access:{token} reservationId EX 900` on the access client; `resolveToken`) and `apps/api/src/booking/presentation/guards/reservation-access.guard.ts` (the `X-Reservation-Access` header, the token must point to the `reservationId` from the route, otherwise `UnauthorizedError`); test `apps/api/test/unit/booking/presentation/reservation-access.guard.spec.ts`.
- [X] T046 [US2] Extend `ReadModelViews` (port, Knex, in-memory from T024) with `reservationStatus(id)`, `reservationDetails(id)`, `reservationTimeline(id)`, `reservationByPaymentId(paymentId)` (from `v_reservation_details WHERE payment_id = ?`), `pendingReservationsCreatedBefore(cutoff)` (from `v_reservation_details WHERE status = 'PendingPayment' AND created_at < ?`, without reading the `rm_*` tables) and implement the queries `apps/api/src/booking/application/queries/get-reservation-status.query.ts` (key `reservation:{id}:status`, TTL 5, response `{ reservationId, status, reason }`) and `get-reservation-details.query.ts` (key `reservation:{id}:details`, TTL 300, `cancellable = status === Confirmed && today < checkIn` from `Clock`, `timeline` without Polish texts); tests `apps/api/test/unit/booking/queries/get-reservation-status.handler.spec.ts` and `get-reservation-details.handler.spec.ts`.
- [X] T047 [US2] Implement `apps/api/src/booking/presentation/reservations.controller.ts` (`POST /reservations` → 201 with `CreateReservationResult`; `GET /reservations/:reservationId/status`; `GET /reservations/:reservationId` behind `ReservationAccessGuard`) and `apps/api/src/booking/presentation/dto/create-reservation.dto.ts` (`roomId` integer ≥ 1, `checkIn`/`checkOut` `YYYY-MM-DD` → `INVALID_DATE`, `guestName` 1–100 → `REQUIRED`/`TOO_LONG`, `guestEmail` → `INVALID_EMAIL`; stay rules returned from the domain as `INVALID_STAY` with `details` `CHECK_OUT_NOT_AFTER_CHECK_IN | TOO_MANY_NIGHTS | CHECK_IN_IN_PAST`), the path parameter validated with the pattern `^RES-[0-9A-HJKMNP-TV-Z]{6}$`.
- [X] T048 [US2] Implement `apps/api/src/booking/presentation/webhooks.controller.ts` (`POST /webhooks/payments`: signature verification with `WEBHOOK_SECRET` through `apps/api/src/booking/presentation/webhook-signature.ts`, bad signature → 401 `INVALID_SIGNATURE`, unknown `paymentId` → 404, `paid` → `ConfirmPayment`, `rejected`/`abandoned` → `RejectPayment` with `reason`, always `200 { received: true, applied }`) and `apps/api/src/booking/presentation/dto/payment-webhook.dto.ts`.
- [X] T049 [US2] Implement the simulator module `apps/api/src/payment-operator-simulator/payment-operator.module.ts`, `apps/api/src/payment-operator-simulator/application/webhook-scheduler.ts` (`setTimeout`, `fetch` to `${API_BASE_URL}/webhooks/payments`, HMAC signature, 3 retries every 1 s), `apps/api/src/payment-operator-simulator/presentation/payment-operator.controller.ts` (`GET /payment-operator/payments/:paymentId` sending the `GetPaymentViewQuery` query class from `apps/api/src/shared/contracts/get-payment-view.query.ts` through the `QueryBus` (the only place of this class; the handler `apps/api/src/booking/application/queries/get-payment-view.handler.ts` reads `ReadModelViews.reservationByPaymentId`) and returning `{ paymentId, reservationId, amount, currency, checkIn, checkOut, roomName, status }`; `POST .../decide { outcome: paid|rejected|abandoned, delaySeconds: 0|3|10 }` → 202 `{ paymentId, outcome, scheduledInSeconds }` or 409 `RESERVATION_NOT_PENDING` through `apps/api/src/payment-operator-simulator/domain/reservation-not-pending.error.ts` extending `DomainError` from `shared`, when status ≠ `PendingPayment`), `apps/api/src/payment-operator-simulator/presentation/dto/decide.dto.ts`; lint confirms the module imports only from `shared`; write `docs/adr/ADR-007-payment-operator-simulator-as-external-system.md` (in-process module treated as an external system, asynchronous HMAC webhook, no refund of a late payment after expiry as an explicit MVP limitation, loss of scheduled webhooks on restart).
- [X] T050 [US2] Write the test `apps/api/test/unit/booking/scheduling/expire-pending-reservations.job.spec.ts` (with `FixedClock` and `InMemoryReadModelViews`: reservations created earlier than `now - PENDING_PAYMENT_TTL_MINUTES` receive `ExpireReservation`, newer ones do not) and implement `apps/api/src/booking/infrastructure/scheduling/expire-pending-reservations.job.ts` (`@Interval(60_000)`, cutoff from the configuration, commands through the `CommandBus`, a failure of one reservation does not stop the others).
- [X] T051 [P] [US2] Implement the HTTP client `apps/web/src/api/reservations.ts` (`createReservation`, `fetchReservationStatus`, `fetchReservationDetails`, types `ReservationStatus`, `ReservationDetails`, `TimelineItem`) and `apps/web/src/api/payment-operator.ts` (`fetchPayment`, `decidePayment`).
- [X] T052 [US2] Implement `apps/web/src/stores/reservation.store.ts` per the `useReservationStore` contract and Optimistic UI rules 2–3 from contracts/frontend.md (`create`, `decide`, `pollStatus` every 2 s, `stopPolling`, `loadDetails`, `restoreFromSession`, `forgetSecureCode`; `secureCode` never in `sessionStorage`), so that T035 passes; write `docs/adr/ADR-008-optimistic-ui-rules-in-pinia.md` (which actions are optimistic, what is rolled back, the "no rollback is silent" rule, queuing the decision before `paymentId`).
- [X] T053 [US2] Implement `apps/web/src/components/GuestForm.vue` (name 1–100, e-mail, messages from `pl.fields`, the „Przejdź do płatności" (Proceed to payment) button active after the dates are chosen) and extend `apps/web/src/views/BookView.vue` with the form: submit → `reservationStore.create(draft)` → `router.push('/payment')`; a creation error → back to `/rooms/:roomId/book`, refresh of the blocked nights and a banner with the message (scenario 7).
- [X] T054 [US2] Implement `apps/web/src/views/PaymentView.vue` (mockup 3: amount, dates, reservation id or „trwa tworzenie…" (creating…) when `id === null`; delay choice 0/3/10 s; „Zapłać" → `decide('paid')`, „Odrzuć płatność" → `decide('rejected')`, „Anuluj i wróć" (Cancel and go back) → `decide('abandoned')` and back to `/rooms/:roomId/book` with a refresh of the nights; after 202 for `paid`/`rejected` navigate to `/reservations/:id`; 409 → the `pl.errors.RESERVATION_NOT_PENDING` text and a „Wróć do pokoju" (Back to the room) button → `/rooms/:roomId`; a page refresh with `paymentId` in the session → `GET /payment-operator/payments/:paymentId`) and the `/payment` route guard in `apps/web/src/router.ts` (no `current` and no session → redirect to `/`).
- [X] T055 [US2] Implement `apps/web/src/views/ReservationView.vue` (mockups 4 and 5: in `PendingPayment` the „Oczekuje na płatność" (Pending payment) banner and polling; after the status changes the details: room, dates with the times 15:00/11:00, number of nights, name, e-mail, amount, status, history; the „Nie znaleziono rezerwacji" (Reservation not found) view on 404; access without the code when the token is in the store or session; the code gate is added in US3), the components `apps/web/src/components/StatusBanner.vue` (pending / rejected / abandoned / expired / cancelled / rollback error), `apps/web/src/components/SaveDetailsCard.vue` (permanent link, the code as `abc-xyz` in a monospace font, the „Kopiuj" (Copy) button through `navigator.clipboard`, the message that the details are shown only once; visible only when `secureCode` is in the store; `forgetSecureCode` on leaving the view), `apps/web/src/components/ReservationTimeline.vue` (labels from `pl.timeline[eventType]`, „Płatność przerwana" for `abandoned_by_guest`) and the test `apps/web/tests/components/SaveDetailsCard.spec.ts` (`abc-xyz` format, copying without the hyphen).

**Checkpoint**: the full US1 + US2 path in the browser per quickstart.md steps 1–4, 7, 8; `npm test`,
`npm run test:integration -w apps/api` green (including SC-003 and SC-005); expiry with
`PENDING_PAYMENT_TTL_MINUTES=1` ends in the `Expired` status.

---

## Phase 5: User Story 3 - I return to the reservation through the permanent link and secure code (Priority: P2)

**Goal**: code gate under the permanent link, hash verification, limit of 5 attempts per 15 minutes, access
token valid for 15 minutes also after a refresh.

**Independent Test**: scenarios 1–5 of US3: the link in a new tab shows only the code field; a correct code
shows the details and history; a wrong code shows the number of remaining attempts; the sixth attempt → a lock
with a time; a refresh in the same tab does not require the code.

### Tests for User Story 3

- [X] T056 [P] [US3] Write the tests `apps/api/test/unit/booking/commands/verify-secure-code.handler.spec.ts` with `InMemoryReservationRepository`, `InMemoryReservationAccess` and `FixedClock`: correct code → `{ accessToken, expiresInSeconds: 900 }` and the counter reset; wrong code → `InvalidSecureCodeError` with `attemptsLeft` (4, 3, …, 0); the sixth attempt in the 15-minute window → `TooManyAttemptsError` with `retryAfterSeconds`; case-sensitive comparison; unknown reservation → `NotFoundError` without revealing whether it existed.
- [X] T057 [P] [US3] Write the integration test `apps/api/test/integration/reservation-access.integration-spec.ts` on Redis `db=3`: `registerFailedAttempt` increments `secure-code-attempts:{reservationId}` with a TTL of 900 s counted from the first attempt; `attemptsLeft` after five attempts is 0 and `retryAfterSeconds` ≤ 900; `issueToken` creates `access:{token}` with a TTL of 900 s; `resolveToken` returns the `reservationId`; `clearAttempts` removes the counter.
- [X] T058 [P] [US3] Write the tests `apps/web/tests/components/SecureCodeGate.spec.ts` (a single field with `autocapitalize="off"` and `autocomplete="one-time-code"`, accepts `abc-xyz` and sends `abcxyz`, rejects other characters locally, the "wrong code, N attempts left" message with `attemptsLeft`, the lock message with the time from `retryAfterSeconds`) and extend `apps/web/tests/stores/reservation.store.spec.ts` with `unlock(secureCode)` (success stores the token in the store and session; 401/429 set the error without a token).

### Implementation for User Story 3

- [X] T059 [US3] Extend the `ReservationAccess` port and `RedisReservationAccess` with `registerFailedAttempt(reservationId)`, `attemptsLeft(reservationId)`, `clearAttempts(reservationId)` (INCR + EXPIRE 900 on the first attempt, limit 5) and implement `apps/api/src/booking/application/commands/verify-secure-code.command.ts` (`repository.load` → `Reservation.secureCodeHash` → `SecureCode.matches`; order: check the lock → compare → register the failed attempt or clear and issue a token), so that T056 and T057 pass.
- [X] T060 [US3] Add `POST /reservations/:reservationId/access` to `apps/api/src/booking/presentation/reservations.controller.ts` with `apps/api/src/booking/presentation/dto/verify-secure-code.dto.ts` (strips hyphens, then `^[A-Za-z0-9]{6}$` → `INVALID_FORMAT`): 200 `{ accessToken, expiresInSeconds }`, 401 `{ code: INVALID_SECURE_CODE, message, attemptsLeft }`, 429 with the `Retry-After` header, 404 for an unknown reservation.
- [X] T061 [US3] Implement `apps/web/src/components/SecureCodeGate.vue`, `apps/web/src/api/reservations.ts#verifySecureCode`, the `unlock` action in `apps/web/src/stores/reservation.store.ts` and the gate logic in `apps/web/src/views/ReservationView.vue` (no token in the store and session → only the gate, no data beyond the status needed for the waiting screen; after success `loadDetails`; 404 from `status` → the „Nie znaleziono rezerwacji" view), so that T058 passes.

**Checkpoint**: quickstart.md step 5 works on a second device in the local network; US3 tests green.

---

## Phase 6: User Story 4 - I cancel the reservation (Priority: P2)

**Goal**: cancellation of a confirmed reservation before the check-in day, optimistic in the UI, with a full
simulated refund and release of the nights.

**Independent Test**: scenarios 1–4 of US4: „Anuluj rezerwację" (Cancel reservation) changes the status immediately, the button
disappears, a history entry appears, the nights are free in the calendar; no button outside `Confirmed` or when
check-in ≤ today, with an explanation; a server error reverts the status with a message.

### Tests for User Story 4

- [X] T062 [P] [US4] Extend `apps/api/test/unit/booking/domain/reservation.spec.ts` with `cancel(today)`: `Confirmed` and `today < checkIn` → `ReservationCancelled { refundAmount = totalAmount, currency }` and status `Cancelled`; `PendingPayment`/`Rejected`/`Expired`/`Cancelled` → `ReservationNotCancellableError`; `Confirmed` with `checkIn ≤ today` → `ReservationNotCancellableError`; write `apps/api/test/unit/booking/commands/cancel-reservation.handler.spec.ts` (`today` from `Clock`, lock release in the same transaction, `ConcurrencyError` propagated).
- [X] T063 [P] [US4] Extend `apps/web/tests/stores/reservation.store.spec.ts` with `cancel()`: immediately `details.status = 'Cancelled'`, `cancellable = false`, a local `ReservationCancelled` entry in `timeline`; success → `details` from the server; error 422/network → the previous `details` restored and a message; 409 → exactly one retry before rolling back.

### Implementation for User Story 4

- [X] T064 [US4] Add `cancel(today: CalendarDate)` to `apps/api/src/booking/domain/reservation.ts` and implement `apps/api/src/booking/application/commands/cancel-reservation.command.ts` (loading, `cancel(clock.today())`, `save` with `expectedVersion`, `locks.release` in the same transaction, publication after `commit`), so that T062 passes; `ReservationProjector` already handles `ReservationCancelled` (T044), add `refund_amount` if missing.
- [X] T065 [US4] Add `POST /reservations/:reservationId/cancel` to `apps/api/src/booking/presentation/reservations.controller.ts` behind `ReservationAccessGuard`: 200 with the details after cancellation (from `GetReservationDetails`), 422 `RESERVATION_NOT_CANCELLABLE`, 409 `CONCURRENCY_CONFLICT`; integration test `apps/api/test/integration/cancel-reservation.integration-spec.ts` (after cancellation `v_room_blocked_nights` does not contain the reservation's nights, `v_reservation_timeline` has a third entry).
- [X] T066 [US4] Implement the `cancel` action in `apps/web/src/stores/reservation.store.ts` (Optimistic UI rule 4, one retry on 409), `apps/web/src/api/reservations.ts#cancelReservation` and the „Anuluj rezerwację" button in `apps/web/src/views/ReservationView.vue` (visible only when `details.cancellable`; for `Confirmed` with check-in ≤ today the explanation text from `pl.ts`; after cancellation the full refund information from `refundAmount`; rollback with a message in `StatusBanner`), so that T063 passes.

**Checkpoint**: quickstart.md step 6 works; after cancellation the calendar shows the nights as free; US4 tests green.

---

## Phase 7: User Story 5 - I rebuild the read models from the event history (Priority: P3)

**Goal**: one command clears `rm_*`, resets the checkpoint, replays everything from `events` and clears the cache;
the result is identical to the state before the rebuild.

**Independent Test**: scenarios 1–2 of US5: reservations in the four final states, a snapshot of the views,
`npm run projections:rebuild -w apps/api`, the snapshot after the rebuild identical (SC-004).

### Tests for User Story 5

- [X] T067 [P] [US5] Write the integration test `apps/api/test/integration/projections-rebuild.integration-spec.ts`: create, through the command handlers, reservations in the states `Confirmed`, `Rejected` (`rejected_by_operator` and `abandoned_by_guest`), `Expired` (with `FixedClock` moved forward by 16 minutes) and `Cancelled`; take a snapshot of `v_reservation_details`, `v_reservation_timeline`, `v_room_blocked_nights`; put the key `reservation:{id}:details` into Redis `db=2`; run `ProjectionRunner.rebuild()`; snapshots identical, `projection_checkpoints.last_position` equal to the last `position`, cache empty, `room_night_locks` untouched.

### Implementation for User Story 5

- [X] T068 [US5] Implement `rebuild()` in `apps/api/src/booking/infrastructure/projections/projection-runner.ts` (`TRUNCATE` of the `rm_*` tables, `last_position = 0`, `EventStore.readAll` in batches of 500, processing through `ReservationProjector`, `FLUSHDB` on the cache client `db` from the configuration) and the CLI entry point `apps/api/src/cli/rebuild-projections.ts` (`NestFactory.createApplicationContext(AppModule)` without HTTP, log `rebuilt N events, checkpoint=<last position>`, exit code ≠ 0 on error), the `projections:rebuild` script in `apps/api/package.json`, so that T067 passes; extend `docs/adr/ADR-004-synchronous-in-process-projections.md` with a section about the rebuild and the separate Redis database for the cache (research R-08).

**Checkpoint**: `npm run projections:rebuild -w apps/api` on the data from the manual guest path yields identical views; US5 test green.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: end-to-end proof, edge behaviours, phone, documentation, comment review.

- [X] T069 Write the E2E test `apps/api/test/e2e/guest-journey.e2e-spec.ts` (supertest, SC-007): `GET /rooms` → `POST /reservations` 201 → `GET /payment-operator/payments/:paymentId` → `POST .../decide { paid, 0 }` 202 → waiting for the webhook (poll `status` until `Confirmed`, max 5 s) → `POST /reservations/:id/access` with the code from the 201 response → `GET /reservations/:id` with the token → `POST /reservations/:id/cancel` 200 → `POST /reservations` for the same nights 201.
- [X] T070 [P] Write the edge-case E2E test `apps/api/test/e2e/payment-edge-cases.e2e-spec.ts`: a repeated webhook → `200 { applied: false }` and no new event; a webhook with a bad signature → 401; `decide` for a reservation after `ExpireReservation` → 409 `RESERVATION_NOT_PENDING`; `GET /reservations/RES-ZZZZZZ/status` → 404 with the same message as for an existing but inaccessible one.
- [X] T071 [P] Check the six screens (room list and the five mockups) at a width of 390 px (SC-006) and access from a phone (`npm run dev -- --host`, `VITE_API_URL=http://<ip>:3100`); adjust `apps/web/src/styles.css` and the views in `apps/web/src/views/` so that there is no horizontal scrolling and buttons are ≥ 44 px; completion criterion: for every screen in a browser 390 px wide `document.documentElement.scrollWidth <= 390` and every button has `offsetHeight >= 44`; record the screen → result table in `specs/001-hotel-room-booking/checklists/requirements.md`.
- [X] T072 [P] Complete the documentation in English: `README.md` (architecture in three paragraphs, running, tests, projection rebuild, access from the local network, known MVP limitations: no refund of a late payment, loss of webhooks on restart, single instance) and `docs/adr/README.md` with the ADR-001…ADR-009 index.
- [X] T073 Review the comments per constitution VIII in `apps/api/src/` and `apps/web/src/` (`grep -rn "//\|/\*" --include=*.ts --include=*.vue`): remove comments describing WHAT the code does; keep only the "why" with references to ADRs; check that no Polish text appears outside `apps/web/src/i18n/pl.ts`, the room seed and the Spec Kit artifacts (`grep -rn "[ąćęłńóśźż]" apps/api/src apps/web/src --exclude=pl.ts`).
- [X] T074 Align the artifacts with the code: `specs/001-hotel-room-booking/plan.md` (port list with `ReadModelViews`, ADR count 9), `docs/superpowers/specs/2026-10-31-hotel-booking-mvp-design.md` (the "Język interfejsu i dokumentacji" (interface and documentation language) line → UI in Polish, code and code documentation in English per constitution VIII), `GLOSSARY.md` (new terms, if any appeared in the code).
- [X] T075 Run the full validation from `specs/001-hotel-room-booking/quickstart.md`: environment reset, `npm run lint`, `npm test`, `npm run test:integration -w apps/api`, `npm run test:e2e -w apps/api`, the manual guest path (steps 1–8), projection rebuild, expiry with `PENDING_PAYMENT_TTL_MINUTES=1`; record the results (command → result) in `specs/001-hotel-room-booking/checklists/validation.md` and set the status `Implemented` in `spec.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: after Setup; blocks all stories.
- **US1 (Phase 3)**: after Foundational; no dependencies on other stories.
- **US2 (Phase 4)**: after Foundational; uses `ReadModelViews` and the views from US1 (T024–T026) and
  `BookView` (T029). In practice: after US1.
- **US3 (Phase 5)**: after US2 (code hash, token, `ReservationView`).
- **US4 (Phase 6)**: after US2 (aggregate, projector, `ReservationView`); independent of US3 in the API, in the UI it needs
  a token (from reservation creation or from US3).
- **US5 (Phase 7)**: after US2 (projector and runner); the test needs US4 for the `Cancelled` state.
- **Polish (Phase 8)**: after all stories.

### Within Each User Story

- Tests written and red before the implementation (constitution VI).
- Domain → ports and adapters → handlers → controllers → frontend (API client → store → components → views).
- ADR in the task where the decision is made: ADR-001 T004, ADR-002 T014, ADR-005 T016, ADR-009 T017,
  ADR-006 T038, ADR-003 T043, ADR-004 T044 (+T068), ADR-007 T049, ADR-008 T052.

### Parallel Opportunities

- Setup: T003 and T004 in parallel with T002.
- Foundational: T005, T007 in parallel; T013 and T015 in parallel (different tests), then T014 and T016; T018 in parallel
  with the API tasks.
- US1: T020–T023 in parallel; T027 in parallel with T024–T026.
- US2: T030–T037 in parallel (eight test files); T039 and T041 in parallel with T038; T051 in parallel with T042–T050.
- US3: T056–T058 in parallel. US4: T062–T063 in parallel. Polish: T070–T072 in parallel.

---

## Parallel Example: User Story 2

```bash
# US2 tests together (different files, all red before the implementation):
Task: "T030 Stay/SecureCode/GuestDetails tests in apps/api/test/unit/booking/domain/"
Task: "T031 aggregate tests in apps/api/test/unit/booking/domain/reservation.spec.ts"
Task: "T032 handler tests in apps/api/test/unit/booking/commands/"
Task: "T033 projector tests in apps/api/test/unit/booking/projections/reservation-projector.spec.ts"
Task: "T034 simulator and signature tests"
Task: "T035 reservation.store tests in apps/web/tests/stores/"
Task: "T036 GuestForm tests in apps/web/tests/components/"
Task: "T037 create-reservation and projections integration tests"

# Then the domain and ports in parallel:
Task: "T039 event classes in apps/api/src/booking/domain/events/"
Task: "T041 ports and in-memory adapters"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Phase 1 and 2 (skeleton, schema, event store, cache, error filter, web libraries).
2. Phase 3 (US1): catalogue and calendar. Stop and check in the browser.
3. Phase 4 (US2): reservation, simulator, webhook, expiry. This is the actual MVP: the guest reserves and pays.
4. Validation of steps 1–4, 7, 8 from quickstart.md.

### Incremental Delivery

1. US3 adds the return through the link and code (quickstart step 5).
2. US4 adds cancellation (step 6).
3. US5 adds the Event Sourcing proof (rebuild, SC-004).
4. Polish: E2E (SC-007), phone (SC-006), documentation, comment review, final validation.

---

## Notes

- [P] tasks touch different files and do not depend on unfinished tasks.
- Tasks within one story that extend the same file (e.g. `reservations.controller.ts`,
  `reservation.store.ts`) are executed sequentially.
- Commit after every task; the task id in the commit message (e.g. `feat(api): add reservation
  aggregate (T040)`).
- Do not add abstractions beyond the port list (constitution V); justify a new abstraction in one sentence
  in the commit description and add it to `plan.md`.
- No Polish text in the API; every new error code or event type requires an entry in `pl.ts`.
