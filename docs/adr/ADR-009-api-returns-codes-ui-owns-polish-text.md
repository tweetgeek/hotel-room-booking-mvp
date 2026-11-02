# ADR-009: The API returns codes; the UI owns every Polish text

Date: 2026-11-01
Status: Accepted

## Context

The constitution (principle VIII) requires code, logs and code documentation in English, while the
guest-facing UI is Polish. The design document originally stored Polish timeline labels in the
`rm_reservation_timeline` read model and let DTO validation return Polish messages. That would put
UI text in the database and in the API, in two places, in two languages.

## Decision

- The API never returns user-facing text. Every error is `{ code, message, ...extras }` where
  `code` is a stable identifier (`ROOM_NOT_AVAILABLE`, `INVALID_SECURE_CODE`, …) and `message` is an
  English sentence for developers.
- Validation failures are `422 VALIDATION_FAILED` with `details: [{ field, code }]`; DTO decorators
  carry the field code as their message (`REQUIRED`, `TOO_LONG`, `INVALID_EMAIL`, `INVALID_DATE`,
  `CHECK_OUT_NOT_AFTER_CHECK_IN`, `TOO_MANY_NIGHTS`, `CHECK_IN_IN_PAST`, `INVALID_FORMAT`).
- Read models and responses carry only identifiers: `status`, `eventType`, `reason`, feature keys.
- `apps/web/src/i18n/pl.ts` is the single place with Polish text: error codes, field codes,
  statuses, timeline labels, feature labels and screen copy. No i18n library is used because the
  UI has one language.
- Every `DomainError` carries its HTTP status; one global `DomainErrorFilter` (registered with
  `APP_FILTER`) renders it, so the booking context and the payment operator simulator share one
  error shape.

## Consequences

- Adding an error code or event type requires a `pl.ts` entry; the TypeScript maps make a missing
  label a visible fallback, not a crash.
- The read model stays rebuildable from events alone and free of presentation concerns.
- Error responses are usable by any client, not only the Polish UI.

## Alternatives considered

- Polish labels stored in `rm_reservation_timeline`: text in the database, impossible to change
  without a rebuild, violates principle VIII.
- `vue-i18n`: a dependency and message format for a single language (YAGNI).
- Returning both code and Polish text from the API: two sources of truth for every message.
