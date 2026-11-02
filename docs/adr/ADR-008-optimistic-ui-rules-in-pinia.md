# ADR-008: Optimistic UI rules and rollbacks in the Pinia stores

Date: 2026-11-01
Status: Accepted

## Context

The owner asked for an optimistic UI (FR-021): creating and cancelling a reservation must be
reflected immediately, and any rollback must be visible, never silent. Date selection must show the
number of nights and the total without a round trip (FR-004).

## Decision

Which actions are optimistic:

1. Date selection: nights and total are computed locally from the room's nightly price; blocked
   nights are checked locally. No request.
2. Reservation creation: the store sets `current = { id: null, status: 'PendingPayment',
   optimistic: true }`, marks the nights as held in the room store, and the router moves to the
   payment screen before `POST /reservations` answers. On success the id, paymentId, secure code and
   access token are filled in and the session is saved (without the secure code). On failure
   (409, 422, network) the nights are released, `current` is cleared, the guest is sent back to the
   calendar and a banner shows the message for the server's error code.
3. Operator decision clicked before the paymentId arrived: queued as `pendingDecision` and sent as
   soon as creation succeeds; dropped with a visible error if creation fails.
4. Cancellation: details switch to `Cancelled` with a local timeline entry and `cancellable =
   false`, the nights are released locally, then `POST /reservations/{id}/cancel` runs. On
   `CONCURRENCY_CONFLICT` the request is retried once; any other failure restores the previous
   details and shows a banner.

What is not optimistic: the operator's decision itself (the page polls the status every 2 s until it
leaves `PendingPayment`) and unlocking with the secure code.

Error texts come from `pl.ts` keyed by the API's error code (ADR-009).

## Consequences

- The guest sees the payment screen instantly and the calendar reflects the hold at once.
- Rollbacks are explicit state transitions in the store and are covered by unit tests
  (`reservation.store.spec.ts`), including the queued decision path.
- The store keeps a little more state (`optimistic`, `pendingDecision`) than a request/response UI.

## Alternatives considered

- Waiting for the server before navigating: simpler, visibly slower, and not what the owner asked.
- Optimistic status after "Pay": tempting, but the operator may reject; the status must come from
  the event, so the page waits.
