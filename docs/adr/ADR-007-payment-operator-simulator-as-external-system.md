# ADR-007: The payment operator simulator is treated as an external system

Date: 2026-11-01
Status: Accepted

## Context

Payments are simulated (no real money), yet the flow must look like a real integration: the guest
pays on the operator's screen, the decision arrives later and asynchronously, and the booking
context must cope with late, repeated or missing decisions.

## Decision

- `payment-operator-simulator` is a separate NestJS module in the same process. ESLint forbids it
  from importing anything from `booking`; it may import only `shared`.
- It reads reservation data through the `QueryBus` with `GetPaymentViewQuery`, a public contract
  class placed in `shared/contracts`; the handler lives in the booking context.
- The guest's decision (`paid`, `rejected`, `abandoned`, with a delay of 0, 3 or 10 s) is accepted
  with HTTP 202 and delivered later as `POST /webhooks/payments`, signed with
  `hex(HMAC_SHA256(secret, paymentId.outcome.sentAt))`. Delivery is retried up to 3 times every
  second on transport errors; an HTTP rejection by the API is not retried.
- The booking webhook endpoint verifies the signature with a constant-time comparison, maps
  `paid` to `ConfirmPayment` and `rejected`/`abandoned` to `RejectPayment` with a reason, and always
  answers 200 for a well-signed request; `applied: false` means the reservation was no longer
  pending (repeated or late decision).
- A decision for a reservation that is no longer pending (for example expired after 15 minutes on
  the operator's screen) is refused with 409 `RESERVATION_NOT_PENDING`, and the UI explains it.

## Consequences

- The booking context never calls the simulator; the dependency direction is operator → booking,
  like a real gateway's webhook.
- Scheduled deliveries live in memory: restarting the API loses them, and the reservation then
  expires after the hold period. Accepted for a local MVP.
- A payment received after expiry is not refunded or recorded as an event: a documented MVP
  limitation.
- No replay protection beyond idempotency of the aggregate; a replayed webhook changes nothing.

## Alternatives considered

- Calling the command handlers directly from the simulator: simpler, but it would hide exactly the
  asynchrony and failure modes the project wants to demonstrate.
- A separate process for the simulator: more realistic, but one more thing to run locally.
