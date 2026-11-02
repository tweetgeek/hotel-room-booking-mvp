# Architecture decision records

Format: Context, Decision, Consequences, Alternatives considered. Written in English
(constitution VIII), one record per decision, created in the task that implemented it.

| ADR | Decision |
|---|---|
| [ADR-001](ADR-001-clean-architecture-layers.md) | Clean Architecture layers, the dependency rule enforced by ESLint, when a port is created |
| [ADR-002](ADR-002-event-sourcing-with-own-mariadb-event-store.md) | Event sourcing with an own MariaDB event store, no snapshots, no library |
| [ADR-003](ADR-003-night-availability-invariant-via-lock-table.md) | Night availability guarded by a lock table in the event transaction; deadlock retries |
| [ADR-004](ADR-004-synchronous-in-process-projections.md) | Synchronous in-process projections, checkpoints, rebuild; outbox as the multi-instance path |
| [ADR-005](ADR-005-sql-views-and-cache-aside-with-stampede-lock.md) | SQL views as the read contract and Redis cache-aside with a stampede lock |
| [ADR-006](ADR-006-secure-code-access-instead-of-login.md) | Permanent link plus secure code (scrypt, attempt limit, access token) instead of accounts |
| [ADR-007](ADR-007-payment-operator-simulator-as-external-system.md) | The payment operator simulator as an external system with a signed asynchronous webhook |
| [ADR-008](ADR-008-optimistic-ui-rules-in-pinia.md) | Optimistic UI rules and rollbacks in the Pinia stores |
| [ADR-009](ADR-009-api-returns-codes-ui-owns-polish-text.md) | The API returns codes; the UI owns every Polish text |
