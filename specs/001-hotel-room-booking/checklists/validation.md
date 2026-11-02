# Final validation (T075)

Date: 2026-11-01. Environment: macOS, Node 26.12.1, npm 11.20, Docker Desktop (Docker 29.8.2, Compose 5.6),
MariaDB 11.8.9, Redis 7; ports 3100 (API), 5173 (web), 3307 (MariaDB), 6380 (Redis).

## Commands from quickstart.md

| Command | Result |
|---|---|
| `docker compose up -d --wait` | both containers `Healthy`; databases `hotel` and `hotel_test` from `init.sql` |
| `npm run db:migrate` | 6 migrations on both databases (`Batch 1: 5`, `Batch 2: 1`) |
| `npm run db:seed` | 3 rooms on both databases |
| `npm run lint` | ESLint 0 errors (layer rule `eslint-plugin-boundaries`), Prettier "All matched files use Prettier code style" |
| `npm test` | API: 23 suites, 109 tests; web: 8 files, 42 tests; no Docker |
| `npm run test:integration` | 9 suites, 22 tests: event store (concurrency), cache (500 concurrent reads → `loader` ×1, SC-005), room views and HTTP `/rooms`, reservation creation with locks (100 concurrent pairs → 100 successes and 100 × 409, SC-003), projections and cache invalidation, access by code (Redis), cancellation over HTTP, projection rebuild identical to the current state (SC-004) |
| `npm run test:e2e` | 2 suites, 4 tests: full guest journey with a real webhook (SC-007) plus repeated webhook, bad signature, decision after expiry, unknown identifiers |
| `npm run projections:rebuild` | `rebuilt 6 events, checkpoint=6`; statuses in `v_reservation_status` unchanged |
| `vue-tsc --noEmit`, `vite build` | no errors; build 87 ms |

## Guest journey in the browser (quickstart steps 1–8)

Executed automatically in headless Chrome at 390 px (details in `requirements.md`, section SC-006):

1. `/` → „Zobacz pokój" (view room) → `/rooms/1`.
2. „Wybierz termin" (choose dates) → three-month calendar; selecting 21–24 November 2026 → „3 noce · 960,00 zł" immediately.
3. Name and e-mail → „Przejdź do płatności" (proceed to payment) → `/payment` rendered with the amount at once (optimistically), identifier `RES-TJGF7Z` filled in after the response.
4. Delay 3 s → „Zapłać" (pay) → reservation page with the banner „Oczekuje na płatność" (pending payment) and the card „Zapisz te dane" (save these details) (link + code `rs5-aYK`); status „Potwierdzona" (confirmed) without a refresh after about 3 s (SC-002).
5. New "tab" (cleared `sessionStorage`) → permanent link → code gate; wrong code → „Błędny kod. Pozostałe próby: 4." (wrong code, 4 attempts left); correct code → details and history with two entries.
6. „Anuluj rezerwację" (cancel reservation) → status „Anulowana" (cancelled) immediately, third history entry, nights free (confirmed by E2E and the cancellation test).
7. „Odrzuć płatność" (reject payment) and 8. „Anuluj i wróć" (cancel and go back): covered by the E2E and store unit tests (`rejected` → „Płatność odrzucona", `abandoned` → back to the calendar with the nights refreshed).

## Expiry (FR-011)

API started with `PENDING_PAYMENT_TTL_MINUTES=1`; reservation `RES-JGTN4E` created at 12:22:18 UTC,
the job (`@Interval` 60 s) expired it at 12:24:12 UTC (log: "Expired 1 pending reservation(s) created before
2026-11-01T12:23:12Z"); `GET /reservations/RES-JGTN4E/status` → `Expired` 120 s after creation,
`GET /rooms/2/blocked-nights` → nights free. With the default TTL of 15 min, expiry happens within 16 minutes.

## Known limitations confirmed by tests

- A late operator decision after expiry → 409 `RESERVATION_NOT_PENDING`, the payment is not refunded (ADR-007).
- A repeated webhook → `200 { applied: false }`, no new event.
