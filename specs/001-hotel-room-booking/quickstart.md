# Quickstart: running and verification

This guide proves that the feature works end to end. Contract details are
in [contracts/](contracts/), the data model in [data-model.md](data-model.md).

## Prerequisites

- Node.js ≥ 22 (locally 26.12.1), npm ≥ 10
- Docker Desktop (MariaDB 11 and Redis 7 from `docker-compose.yml`)
- Free ports: 3100 (API), 5173 (web), 3307 (MariaDB), 6380 (Redis)

## Running

```bash
cp .env.example .env               # WEBHOOK_SECRET, DB_*, REDIS_URL, API_BASE_URL, VITE_API_URL
docker compose up -d               # mariadb (databases hotel and hotel_test) + redis
npm install
npm run db:migrate -w apps/api     # tables, views
npm run db:seed -w apps/api        # three rooms
npm run dev                        # api on :3100 and web on :5173 in parallel
```

Expected result: `http://localhost:5173/` shows three room cards; `GET http://localhost:3100/rooms`
returns an array of three `RoomCard`.

Access from a phone on the home network: `npm run dev -- --host` and `VITE_API_URL=http://<computer-ip>:3100`.

## Guest journey (manual, about 3 minutes)

1. `/` → click „Zobacz pokój" ("View room") next to „Pokój dwuosobowy z balkonem" → `/rooms/1`.
2. „Wybierz termin" ("Choose dates") → `/rooms/1/book`; click check-in and check-out (3 nights) → immediately „3 noce" and the amount
   `3 × 320 zł = 960 zł`.
3. Name and e-mail → „Przejdź do płatności" ("Proceed to payment") → `/payment` renders right away with the amount (optimistically).
4. Delay „3 s" → „Zapłać" ("Pay") → `/reservations/RES-…` with the „Oczekuje na płatność" ("Pending payment") banner and the
   „Zapisz te dane" ("Save these details") card (link + code). After ≤ 6 s the status „Potwierdzona" ("Confirmed") without refreshing (SC-002).
5. New browser tab (or a phone) → the same link → code gate; 6 characters → details and history
   with two entries.
6. „Anuluj rezerwację" ("Cancel reservation") → status „Anulowana" ("Cancelled") immediately, an entry in the history; `/rooms/1/book` shows
   the nights free again.
7. Second run: „Odrzuć płatność" ("Reject payment") → status „Płatność odrzucona" ("Payment rejected"), nights free.
8. Third run: „Anuluj i wróć" ("Cancel and go back") → return to the calendar, nights free.

## Tests

| Command | Scope | Expected result |
|---|---|---|
| `npm test` | unit tests for the api (domain, handlers, projector) + web (stores, calendar) | green, without Docker, < 30 s |
| `npm run test:integration -w apps/api` | event store, projections + rebuild, cache stampede, code access (MariaDB/Redis from Compose, `hotel_test` database) | green; the cache test reports `loader calls: 1` for 500 concurrent reads (SC-005) |
| `npm run test:e2e -w apps/api` | `guest-journey.e2e-spec.ts`: creation → decision → webhook → details after the code → cancellation → re-reservation of the same nights | green (SC-007) |
| `npm run lint` | ESLint (import rules between layers) + Prettier | 0 errors |

The concurrency test (SC-003) is part of `test:integration`: 100 concurrent pairs of `POST /reservations`
for the same nights → exactly 100 successes and 100 responses of 409.

## Rebuilding the read models (US5, SC-004)

```bash
npm run projections:rebuild -w apps/api
```

Expected result: the log `rebuilt N events, checkpoint=<last position>`; a dump of `SELECT * FROM v_reservation_details`
and `v_reservation_timeline` before and after the rebuild is identical (the test `projections-rebuild.integration-spec.ts`
performs this comparison automatically).

## Expiry (FR-011)

Create a reservation and take no decision; after ≤ 16 minutes `GET /reservations/:id/status` returns
`Expired`, and the nights are free. For a quick test set `PENDING_PAYMENT_TTL_MINUTES=1` in `.env`.

## Environment reset

```bash
docker compose down -v && docker compose up -d && npm run db:migrate -w apps/api && npm run db:seed -w apps/api
```
