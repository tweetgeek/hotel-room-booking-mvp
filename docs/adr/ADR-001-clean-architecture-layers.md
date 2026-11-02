# ADR-001: Clean Architecture layers and the dependency rule

Date: 2026-11-01
Status: Accepted

## Context

The project exists to show how a small booking system looks when built with Clean Architecture,
DDD, event sourcing and CQRS. The owner named "too much abstraction" and "event sourcing for show"
as failure conditions, so the layering has to be visible and enforced, yet stay minimal.

## Decision

Inside the `booking` bounded context (`apps/api/src/booking`) code is split into four directories:

- `domain`: aggregates, value objects, domain events, domain errors. Imports nothing outside
  `domain` and `shared/domain`.
- `application`: commands, queries, their handlers, ports and the pure projector. Imports `domain`
  and `shared`.
- `infrastructure`: adapters for MariaDB, Redis, scheduling, projections runner. Imports
  `application` and `domain`.
- `presentation`: HTTP controllers, DTOs, guards. Imports `application` and `domain`.

`shared` holds only elements used by more than one context (base aggregate, `Money`, calendar
dates, ids, ports for clock/ids/unit of work/event store, config and connection modules, the global
error filter). The `payment-operator-simulator` module is a separate context in the same process and
may import only `shared`; it talks to `booking` through the `QueryBus` (a public query class placed
in `shared/contracts`) and through the signed HTTP webhook.

The rule is enforced by `eslint-plugin-boundaries` in `eslint.config.js`; a violation fails
`npm run lint`.

A port (interface in `application/ports` or `shared/application/ports`) is introduced only when
one of two conditions holds: there are two implementations (production and in-memory for tests), or
it separates the domain/application code from infrastructure. Generic repositories, speculative
interfaces and pass-through layers are not allowed.

## Consequences

- Query handlers cannot touch Knex directly; they go through the `ReadModelViews` port, which has
  a Knex and an in-memory implementation.
- Every port has an in-memory adapter under `apps/api/test/unit/support`, so domain and application
  tests run without Docker.
- Adding a new abstraction requires a one-sentence justification in the commit message.

## Alternatives considered

- Folder-per-feature without layers: simpler, but the dependency rule would be a convention only.
- Separate npm packages per layer: stronger isolation, but far more build wiring than an MVP needs.
- Hexagonal naming (`ports`/`adapters` at the top level): equivalent; the four-layer naming matches
  the constitution and the design document.
