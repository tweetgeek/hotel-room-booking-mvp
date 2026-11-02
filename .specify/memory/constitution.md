# Constitution of the "Room Booking" project (hotel-booking-mvp)

## Core Principles

### I. Clean Architecture and the dependency rule
Code is divided into the layers `domain`, `application`, `infrastructure` and `presentation`.
Dependencies point inwards only: `domain` imports nothing from outside itself, `application`
imports neither `infrastructure` nor `presentation`. Every violation MUST be caught by lint
(an import rule) and blocks the merge. Rationale: the project is an example of this
architecture, so its readability is the product, not a cost.

### II. DDD: ubiquitous language and aggregates
Names in code MUST match the ubiquitous language recorded in the specification
(Room, Reservation, Stay, Night, Money, SecureCode, ReservationStatus). Business rules live in
aggregates and value objects, never in controllers or handlers. An aggregate is a consistency
boundary; an invariant spanning several aggregates MUST have an explicitly described mechanism
(for example a lock table written in the same transaction) and its own ADR.

### III. Real event sourcing (NON-NEGOTIABLE)
The state of the `Reservation` aggregate MUST be rebuilt exclusively from events stored in the
event store. No table may be a parallel source of truth about a reservation. Every read model
MUST be rebuildable from scratch from the event store with a single command, and an integration
test MUST prove that the rebuilt state is identical to the state built incrementally.
Events are immutable, named in the past tense, with a minimal payload; secrets (for example the
secure code) enter an event only as a hash. Rationale: the owner explicitly named
"event sourcing for show" a failure of the project.

### IV. CQRS: separate write and read paths
Commands go through the aggregate and the event store; queries read only read models through
SQL views, never write tables or the event store. Reads are cached with a TTL, and a cache miss
MUST be protected by a lock so that concurrent requests after a key expires perform exactly one
database query. The projector invalidates keys after every event.

### V. Minimum abstraction (YAGNI)
An interface (port) is introduced only when at least two implementations exist (production and
test/in-memory) or when it separates the domain from infrastructure. Forbidden: generic
repositories, "just in case" interfaces, factories of factories, a home-made DI framework, layers
that pass data through without logic. Every new abstraction in a change MUST have a one-sentence
justification in the change description. Rationale: the owner explicitly named excess
abstraction a failure of the project.

### VI. Tests as proof (NON-NEGOTIABLE)
Domain logic and command handlers MUST have unit tests written before the implementation
(given events / when command / then events or error), with no mocks in the domain.
Infrastructure (event store, projections, cache, secure-code access) MUST have integration tests
on real MariaDB and Redis started from Docker Compose. At least one E2E test MUST walk the full
guest journey. Frontend Pinia stores MUST have tests of the optimistic paths and their rollbacks.
A task is not finished until the tests pass locally.

### VII. Architecture decisions recorded as ADRs
Every decision that changes the structure, the data model, a consistency mechanism, the cache
strategy or an integration MUST have an ADR in `docs/adr` (context, decision, consequences,
alternatives considered). The ADR is written in the same task as the implementation of the
decision.

### VIII. Language of code, documentation and comments
Code MUST be entirely in English: identifiers, file and directory names, test names, commit
messages, technical logs. Code documentation MUST be in English: README, ADRs, code comments,
docstrings, descriptions in `package.json` and `.env.example`. Spec Kit artefacts (this
constitution, `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`,
`tasks.md`, checklists) and the glossary MUST be in English as well. Only the user interface and
guest-facing data (room names and descriptions, UI texts in `apps/web/src/i18n/pl.ts`) are in
Polish; such texts may be quoted verbatim in documentation.
A comment that describes WHAT the code does violates Clean Code and MUST be removed; the code
expresses the intent through a name or an extracted function instead. Only comments explaining
WHY are allowed: a significant business decision, a guideline, a non-obvious constraint or a
reference to an ADR. Code review MUST reject descriptive comments.
Rationale: the project is a reference; a foreign reader and AI tools are to read it without
translation, and comments are to carry knowledge the code itself cannot convey.

## Technology constraints

- Backend: NestJS + TypeScript; `@nestjs/cqrs` buses; database access through Knex (migrations,
  raw SQL for views), no ORM.
- Frontend: Vue 3 + Pinia + Vite + TypeScript + Vue Router; Polish UI, mobile-first.
- Data: MariaDB (event store, read tables, SQL views), Redis (cache with TTL, locks, tokens).
- Runs locally only, through Docker Compose (MariaDB, Redis) and npm workspaces. The project is
  not meant for production; no CI, deployment or monitoring is added.
- No user accounts or login: a reservation is reached through a permanent link and a
  six-character secure code (`SecureCode`, letters and digits).
- Payments are simulated; the simulator is a module treated as an external system and talks to
  the domain only through a webhook.

## Development process

- The project follows Spec-Driven Development with Spec Kit: `constitution` → `specify` →
  `clarify` → `plan` → `tasks` → `implement`. No code is written without an approved
  specification and plan.
- The specification (`spec.md`) describes WHAT and WHY without technology; the plan (`plan.md`)
  describes HOW and MUST contain a completed "Constitution Check" against principles I–VIII.
- Every task from `tasks.md` ends with passing tests and, where applicable, an ADR.
- Languages: Spec Kit artefacts, the glossary, code and code documentation in English according
  to principle VIII; the user interface in Polish.
- Screens are implemented according to the approved mockups; a deviation requires the owner's
  consent.

## Governance

The constitution takes precedence over other practices and templates in the repository.
Amending the constitution requires: a description of the change, a version bump according to
semver (MAJOR: removal or redefinition of a principle; MINOR: a new principle or a material
extension; PATCH: clarification) and a review of plans and tasks in progress for compliance.
Every plan and every code review MUST contain an explicit check of compliance with principles
I–VIII; complexity that conflicts with principle V MUST be justified in the plan's
"Complexity Tracking" section.

**Version**: 2.0.0 | **Ratified**: 2026-10-31 | **Last Amended**: 2026-11-02
