# Research: technical decisions and versions (Phase 0)

Date: 2026-10-31. Versions checked in the npm registry (`npm view <pkg> version`) on that day.
The design document left "library versions (current stable)" to the builder; here they are pinned.
Deviations from the design document are marked **[deviation]**.

## R-01. Library versions

| Package | Version | Notes |
|---|---|---|
| Node.js | 26.12.1 locally; `engines.node >= 22` | NestJS 12 requires ≥ 20, ioredis 6 ≥ 20 |
| typescript | 5.9.3 (latest 5.x line) | **not 7.0.2**: `ts-jest` 29.4 requires `typescript <7`; TS 7 is the new native compiler with no guarantee for `emitDecoratorMetadata`, which NestJS depends on. Revisit at TS 7.1. |
| @nestjs/core, common, platform-express | 12.3.2 | ESM-only packages; the API is still compiled to CommonJS, and Jest needs `NODE_OPTIONS=--experimental-vm-modules` for `require(esm)` to work (R-02) |
| @nestjs/cqrs | 12.1.2 | only `CommandBus`, `QueryBus`, `EventBus`; own `AggregateRoot` |
| @nestjs/schedule | 12.0.2 | `@Interval(60_000)` for the expiry job |
| @nestjs/config | 12.0.1 | `.env` validation through Standard Schema (zod) |
| knex | 3.3.0 | migrations, raw SQL for views |
| mysql2 | 3.24.6 | MariaDB driver |
| ioredis | 6.0.0 | RESP3 by default; we use only `GET/SET NX PX/DEL/SCAN/INCR/EXPIRE/EVAL`, no impact |
| class-validator / class-transformer | 0.15.1 / 0.5.1 | DTOs returning field codes (R-14), no UI texts |
| zod | latest 3.x/4.x | configuration validation only (`@nestjs/config`) |
| jest / ts-jest | 30.5.2 / 29.4.15 | `ts-jest` supports jest 30 |
| @nestjs/testing, supertest | 12.3.2 / 7.3.1 | E2E |
| vue | 3.5.44 | |
| pinia | 4.1.0 | ESM-only; requires `@vue/devtools-api` as a direct dependency |
| vue-router | 5.4.0 | no breaking changes versus 4 without unplugin-vue-router; guards return a result instead of `next()` |
| vite / @vitejs/plugin-vue | 8.3.5 / 6.0.10 | |
| vitest / @vue/test-utils / @pinia/testing | 5.0.5 / 2.5.1 / 2.0.2 | |
| eslint / prettier | 10.14.0 / 3.9.10 | + `eslint-plugin-boundaries` for the layer rule |
| mariadb (Docker) / redis (Docker) | `mariadb:11` / `redis:7` | |

Sources: [NestJS v12.0.0](https://github.com/nestjs/nest/releases/tag/v12.0.0),
[Pinia v4.0.0](https://github.com/vuejs/pinia/releases/tag/v4.0.0),
[Vue Router v4→v5](https://router.vuejs.org/guide/migration/v4-to-v5),
[ioredis v6.0.0](https://github.com/redis/ioredis/releases/tag/v6.0.0).

## R-02. Module format: API CommonJS + Jest, web ESM + Vitest

- Decision: `apps/api` compiled to CommonJS (`module: nodenext` is not required by Nest 12,
  which publishes dual packages); `apps/web` is ESM (Vite, Pinia 4 ESM-only).
- Rationale: Jest + `ts-jest` + Nest decorators is the best-documented path in CJS.
  Implementation outcome (2026-11-01): NestJS 12 publishes ESM only, so Jest 30 needs
  `NODE_OPTIONS=--experimental-vm-modules` (which exposes `vm.SourceTextModule`) to synchronously
  `require()` Nest modules; the `test*` scripts in `apps/api/package.json` set this flag.
  In addition, MariaDB 11.8 with `innodb_snapshot_isolation` forced `READ COMMITTED` sessions
  and retrying transactions after `ER_LOCK_DEADLOCK`/`ER_CHECKREAD` (ADR-003, ADR-004).
- Alternatives: Vitest for the API as well (rejected: the design document names Jest, and SWC/Vitest
  with `emitDecoratorMetadata` requires an extra plugin); full ESM API (rejected: cost without benefit in the MVP).

## R-03. Secure code hash: `crypto.scrypt` **[deviation]**

- Decision: Node `crypto.scrypt` (N=16384, r=8, p=1, 16 B salt, 32 B output), format
  `scrypt$<salt-hex>$<hash-hex>`, comparison with `timingSafeEqual`.
- Rationale: the design document said "bcrypt, 10 rounds"; `bcrypt` 6 is a native module
  (prebuilds for Node 26 on macOS may not exist); security is decided by the attempt limit
  (5/15 min) and the code length (6 characters, R-15), not the hash cost. Zero native dependencies.
- Alternatives: `bcrypt` (native), `bcryptjs` (pure JS, slower), argon2 (native). ADR-006 will describe this decision.

## R-04. Identifiers

- `reservationId`: `RES-` + 6 Crockford base32 characters from `crypto.randomBytes` (~1.07 billion combinations,
  readable, without 0/O and 1/I/L). `paymentId`: `PAY-` + 10 characters. Access token: 32 bytes hex.
- `IdGenerator` port with the `CryptoIdGenerator` and `SequentialIdGenerator` (tests) implementations.
- The UUID alternative was rejected: the link must be readable for the guest (FR-013).

## R-05. Dates and time zone

- Stay dates are `YYYY-MM-DD` strings, `DATE` type in the database, no conversion to `Date` in the domain
  (own `CalendarDate` VO with day arithmetic).
- "Today" = `Clock.today()` computed in `Europe/Warsaw` via `Intl.DateTimeFormat('sv-SE', { timeZone })`;
  `SystemClock` and `FixedClock` (tests). MariaDB sessions set `time_zone = '+00:00'`, `occurred_at` in UTC.
- The frontend counts nights locally on the same strings; the calendar generates the current + 2 months.

## R-06. Money

- `Money { amount: int grosze, currency: 'PLN' }`; `price_per_night INT`; formatting only in the UI
  (`Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })`).

## R-07. Cache-aside with a stampede lock

- `getOrLoad(key, ttl, loader)`:
  1. `GET key` → hit: return.
  2. `SET key:lock <token> NX PX 3000`.
  3. Acquired: `loader()` → `SET key <json> EX ttl` → Lua: `if GET lock == token then DEL lock` → return.
  4. Taken: `GET key` every 50 ms for up to 3 s; value → return; none → `loader()` without writing.
- Invalidation: `DEL` for reservation keys; `SCAN MATCH room:{id}:nights:*` + `DEL` for the calendar.
- Test: 500 concurrent `getOrLoad` with a call-counting loader → 1.
- Alternatives: `redis-lock`/`redlock` (rejected: a single Redis instance, unnecessary dependency);
  Nest `CacheModule` (rejected: no lock and no explicit key control).

## R-08. Synchronous projections and rebuild

- `ProjectionRunner` subscribes to the `EventBus`; it processes every event in a transaction: `rm_*` changes +
  `projection_checkpoints` + a list of keys to `DEL` (executed after commit).
- Rebuild: a separate CLI entry point `src/cli/rebuild-projections.ts` (Nest context bootstrap without HTTP),
  `TRUNCATE rm_*`, checkpoint 0, `readAll` in batches of 500, `FLUSHDB` on the Redis cache (a separate
  Redis database `db=0` for the cache, `db=1` for tokens and counters, so the rebuild does not wipe guest sessions).
- Multiple API instances would require an outbox; described in ADR-004 as a known limitation.

## R-09. Simulator webhook

- Signature: `hex(HMAC_SHA256(WEBHOOK_SECRET, `${paymentId}.${outcome}.${sentAt}`))`; comparison with
  `timingSafeEqual`. No replay protection, because the command is idempotent.
- Scheduling: `setTimeout` in `WebhookScheduler`; delivery via `fetch` to `API_BASE_URL/webhooks/payments`;
  3 retries every 1 s on a network error; a process restart loses scheduled webhooks (accepted, expiry after 15 min).

## R-10. Layer rule in lint

- `eslint-plugin-boundaries`: elements `domain`, `application`, `infrastructure`, `presentation`,
  `payment-operator-simulator`; allowed: application→domain; infrastructure→application,domain;
  presentation→application,domain; payment-operator-simulator→shared only. A violation = a lint error.

## R-11. Integration tests on Docker Compose

- `docker-compose.yml` creates the `hotel` and `hotel_test` databases (init script); integration and E2E tests
  use `hotel_test` and Redis `db=2/3`, and clear the tables before every test with `TRUNCATE`.
- No Testcontainers (unnecessary dependency; Compose is already required).

## R-12. Room list (screen without a mockup)

- `RoomListView`: a column of three cards (placeholder image, name, price per night, the
  „Zobacz pokój" ("View room") button), the same style tokens as the „Pokój" (Room) mockup. The owner may provide a mockup later.

## R-13. Expiry: configuration parameter

- `PENDING_PAYMENT_TTL_MINUTES` (default 15) in `.env`, read by the job and passed to
  `Reservation` as an argument of the `ExpireReservation` command (the aggregate does not read configuration).
  The value of 15 minutes was confirmed by the owner on 2026-10-31 (R-16, Q1).

## R-14. Backend without Polish texts **[deviation]**

- Decision (review with the owner on 2026-10-31, Q5): the API returns only codes (error `code`,
  validation `field` + `code`, `eventType`, `reason`, feature keys) and an English `message` for
  developers. All Polish texts live in `apps/web/src/i18n/pl.ts`.
- Rationale: constitution VIII (code in English); a read model without UI texts; a single place
  for translations. The design document planned Polish labels in `rm_reservation_timeline`.
- Alternatives: vue-i18n (rejected: one language, YAGNI); labels in the SQL view (rejected: UI text in the database).

## R-15. Secure code: 6 characters `A-Za-z0-9`

- Owner's decision (Q3): 6 characters of letters and digits instead of 4 digits.
- Round 2 (Q18–Q20): generated from 57 characters (`A-Za-z0-9` without `0 O 1 l I`, ~34 billion combinations),
  case-sensitive comparison, input field with `autocapitalize="off"`; displayed as `abc-xyz`
  in a monospace font with a „Kopiuj" ("Copy") button; a hyphen in the input is ignored.

## R-16. Decisions from the "grill" review of 2026-10-31 (round 1)

| # | Decision |
|---|---|
| Q1 | Hold period 15 min, parameter `PENDING_PAYMENT_TTL_MINUTES` |
| Q2 | Abandonment = `PaymentRejected` with `reason = abandoned_by_guest`; the UI shows „Płatność przerwana" ("Payment interrupted") |
| Q4 | scrypt instead of bcrypt (R-03) |
| Q5 | Backend codes only, Polish text in `pl.ts` (R-14) |
| Q6 | Cancellation only for Confirmed and `today < checkIn`, full simulated refund |
| Q7 | `checkIn ≥ today` in Europe/Warsaw, a reservation for tonight is allowed |
| Q8 | No reservation limit per e-mail |
| Q9, Q10 | Room list without a mockup; images as a generated SVG placeholder |
| Q11, Q12 | Jest + ts-jest (CJS) in the API; TypeScript 5.9.3 |
| Q13, Q14 | git init, branch `001-hotel-room-booking`, Conventional Commits in English, a commit per task |
| Q15 | Simulator as a module in the API process, lint forbids imports from `booking` |
| Q16 | `decide` after expiry → 409 `RESERVATION_NOT_PENDING`, the simulator shows a message; the payment is not refunded (ADR-007) |
| Q17 | Calendar: current + 2 months |

## R-17. Decisions from the "grill" review of 2026-10-31 (round 2)

| # | Decision |
|---|---|
| Q18–Q20 | Alphabet, letter case and presentation of the code (R-15) |
| Q21 | One term "payment operator": module `payment-operator-simulator`, path `/payment-operator/payments/:paymentId`, `PaymentOperatorController` |
| Q22 | The public `status` also returns `reason` |
| Q23 | Validation codes per field according to `openapi.yaml` |
| Q24, Q25, Q27 | Seed: features as keys, times 15:00/11:00, names and descriptions in Polish as data |
| Q26 | Simulator after 409: an expiry message and a „Wróć do pokoju" ("Back to the room") button → `/rooms/:roomId` |
| Q28 | ADR-006 will cover scrypt; new ADR-009 "API returns codes, UI owns Polish text"; both are created in tasks |

## Remaining NEEDS CLARIFICATION

None.
