# Domain event contract

Events are immutable, named in the past tense, with a minimal payload (constitution III).
The type name is also the version: a change in the payload shape = a new type (e.g. `ReservationRequestedV2`)
plus an upcaster at load time; no changes are foreseen in the MVP.

## Envelope (row in `events`)

```json
{
  "position": 42,
  "streamId": "RES-7F3K2A",
  "streamVersion": 1,
  "eventType": "ReservationRequested",
  "payload": { "...": "..." },
  "metadata": {
    "correlationId": "uuid v4 of the HTTP request or the job",
    "causationId": "command name, e.g. CreateReservation",
    "occurredAt": "2026-11-02T10:15:30.123Z"
  },
  "occurredAt": "2026-11-02T10:15:30.123Z"
}
```

`occurredAt` comes from the `Clock` port (ISO 8601 UTC with milliseconds). `position` is assigned by the database.

## Types

### `ReservationRequested` (stream version 1)

```json
{
  "reservationId": "RES-7F3K2A",
  "roomId": 1,
  "checkIn": "2026-11-10",
  "checkOut": "2026-11-13",
  "nights": 3,
  "guestName": "Anna Kowalska",
  "guestEmail": "anna@example.com",
  "totalAmount": 96000,
  "currency": "PLN",
  "secureCodeHash": "scrypt$<salt-hex>$<hash-hex>",
  "paymentId": "PAY-9Q2M4H7ZXT"
}
```

`totalAmount = nights × price_per_night` at command time (FR-008). `secureCodeHash` is never
returned by the API. The nights `checkIn … checkOut-1` are blocked in `room_night_locks` in the same
transaction.

### `PaymentConfirmed`

```json
{ "reservationId": "RES-7F3K2A", "paymentId": "PAY-9Q2M4H7ZXT" }
```

### `PaymentRejected`

```json
{ "reservationId": "RES-7F3K2A", "paymentId": "PAY-9Q2M4H7ZXT", "reason": "rejected_by_operator" }
```

`reason ∈ { rejected_by_operator, abandoned_by_guest }`. Nights released in the same transaction.

### `ReservationExpired`

```json
{ "reservationId": "RES-7F3K2A" }
```

Emitted by `ExpireReservation` from the job when `created_at + 15 min < now`. Nights released.

### `ReservationCancelled`

```json
{ "reservationId": "RES-7F3K2A", "refundAmount": 96000, "currency": "PLN" }
```

`refundAmount = totalAmount` (simulated refund, no events on the payment side). Nights released.

## Idempotency rules

| Command in a state other than the allowed one | Behaviour |
|---|---|
| `ConfirmPayment`, `RejectPayment`, `ExpireReservation` outside `PendingPayment` | no event, no error; the handler logs `warn`; the webhook answers `200 { applied: false }` |
| `CancelReservation` outside `Confirmed` or `checkIn ≤ today` | `ReservationNotCancellableError` → 422 |

## History (projection `rm_reservation_timeline`)

The read model stores only `event_type`, `occurred_at` and (for `PaymentRejected`) `reason`.
Polish labels are assigned by the frontend from `src/i18n/pl.ts` (constitution VIII, research R-14).

## Publication after the transaction commits

1. The command handler runs `UnitOfWork.run(tx => repository.save(aggregate, tx))`.
2. After `COMMIT` the handler publishes the events on the `EventBus` (`@nestjs/cqrs`).
3. `ProjectionRunner` (an `EventBus` subscriber) processes the events in `position` order,
   updates `rm_*`, saves the checkpoint and invalidates cache keys.
4. Rebuild: `ProjectionRunner.rebuild()` bypasses the `EventBus` and reads `EventStore.readAll`.
