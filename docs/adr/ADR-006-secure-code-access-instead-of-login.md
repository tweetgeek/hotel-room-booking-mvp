# ADR-006: Permanent link plus secure code instead of accounts

Date: 2026-11-01
Status: Accepted

## Context

Guests must find their reservation later, on any device, without creating an account (owner's
requirement). The page shows personal data (name, e-mail, stay), so the link alone is not enough.
The owner chose a six-character code of letters and digits (review 2026-10-31, Q3 and Q18–Q20).

## Decision

- Each reservation has a permanent link `/reservations/{reservationId}` and a `SecureCode`:
  six characters generated from `A-Za-z0-9` minus the look-alikes `0 O 1 l I` (57 symbols, about
  34 billion combinations). Comparison is case-sensitive; hyphens typed by the guest are ignored.
- The code is shown exactly once, right after the reservation is created, as `abc-xyz` with a copy
  button, together with the link. It is never persisted on the client beyond memory.
- The event `ReservationRequested` stores only `secureCodeHash`, computed with Node's
  `crypto.scrypt` (N=16384, r=8, p=1, 16-byte salt, 32-byte key) in the format
  `scrypt$<salt-hex>$<hash-hex>`; verification uses `timingSafeEqual`.
- A correct code (or the creation itself) issues an access token: 32 random bytes as hex, stored in
  Redis as `access:{token} -> reservationId` for 15 minutes, sent as the `X-Reservation-Access`
  header. The token is kept in `sessionStorage` so a page refresh in the same tab needs no code.
- Attempts are limited to 5 per 15 minutes per reservation (`secure-code-attempts:{id}` counter in
  Redis); after that the endpoint answers 429 with `Retry-After`. The public status endpoint stays
  open because the waiting screen needs it before the guest has typed anything.

## Consequences

- No user table, no passwords, no e-mail delivery.
- Losing the code means losing access: acceptable for the MVP, documented on the save screen.
- scrypt instead of bcrypt (the design document's first choice): no native module to build on
  Node 26/macOS, and the rate limit, not the hash cost, is the main defence (research R-03).

## Alternatives considered

- bcrypt (native) or argon2 (native): stronger defaults, but build friction for a local project.
- Four-digit PIN: too small a space once a link is known; rejected by the owner.
- Magic links by e-mail: requires sending e-mail; out of scope.
