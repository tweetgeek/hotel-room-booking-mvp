# ADR-005: SQL views as the read contract and cache-aside with a stampede lock

Date: 2026-11-01
Status: Accepted

## Context

CQRS (constitution IV) separates writes (aggregate + event store) from reads. Reads must be
served from read models through SQL views, cached in Redis with a TTL, and a cache miss must not
let hundreds of concurrent requests hit the database at once: the owner's success criterion is
500 concurrent calendar refreshes after expiry producing exactly one database read (SC-005).

## Decision

### Read contract

- Query handlers read only the views `v_room_card`, `v_room_blocked_nights`,
  `v_reservation_status`, `v_reservation_details` and `v_reservation_timeline`, through the
  `ReadModelViews` port. They never read `rm_*` tables or the event store.
- Views are created in Knex migrations with raw `CREATE OR REPLACE VIEW` SQL.

### Cache

- `ReadModelCache.getOrLoad(key, ttlSeconds, loader)` implemented by `RedisReadModelCache`:
  1. `GET key`; on a hit return the parsed JSON.
  2. `SET key:lock <token> NX PX 3000`.
  3. If the lock was acquired: run the loader, `SET key <json> EX ttl`, then release the lock
     with a Lua script that deletes it only if the token still matches.
  4. Otherwise poll `GET key` every 50 ms for up to 3 s; when the value appears return it; if it
     never appears, run the loader without writing (the owner may have crashed).
- Keys and TTLs: `rooms:list` 600 s, `room:{id}:card` 600 s, `room:{id}:nights:{from}:{to}` 60 s,
  `reservation:{id}:details` 300 s, `reservation:{id}:status` 5 s.
- Invalidation is done by the projector after each committed event: `DEL` for reservation keys and
  `SCAN MATCH room:{id}:nights:*` + `DEL` for the calendar of that room.
- The cache uses its own Redis logical database so a projection rebuild can `FLUSHDB` it without
  touching access tokens or attempt counters.

## Consequences

- One loader per key per expiry window, proven by the integration test with 500 parallel calls.
- A reservation's status is visible to the waiting page within the 2 s polling interval because
  the projector deletes the status key right after the event is committed.
- Only one Redis instance is assumed; the lock is not a distributed lock across Redis nodes.

## Alternatives considered

- NestJS `CacheModule` with the Redis store: no lock, no explicit control over keys.
- `redlock`: multi-node locking the project does not need; one more dependency.
- Reading from `rm_*` tables directly: works, but the views are the contract that lets the tables
  change shape without touching handlers, and they document what each screen reads.
