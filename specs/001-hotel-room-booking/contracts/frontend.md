# Frontend contract: routes, stores, Optimistic UI

Source: design document section 6 and the mockups (Design artifact). The UI is in Polish,
route addresses and identifiers are in English.

## Routes (Vue Router 5)

| Route | View | Mockup screen | Data |
|---|---|---|---|
| `/` | `RoomListView` | no mockup: a column of three cards from the header of the „Pokój" (Room) mockup (photo, name, price per night, „Zobacz pokój" (View room)) | `GET /rooms` |
| `/rooms/:roomId` | `RoomView` | 1. Room | `GET /rooms/:roomId` |
| `/rooms/:roomId/book` | `BookView` | 2. Dates and details | `GET /rooms/:roomId/blocked-nights?from&to` (current + 2 months), `POST /reservations` |
| `/payment` | `PaymentView` | 3. Payment simulator | from the store; `GET /payment-operator/payments/:paymentId` only on refresh; `POST .../decide` |
| `/reservations/:reservationId` | `ReservationView` | 4. Waiting / 5. Reservation | `status` (poll every 2 s while PendingPayment), `access`, `GET /reservations/:id`, `cancel` |

Guards:

- `/payment` without a current reservation in `useReservationStore` → redirect to `/`.
- `/reservations/:id` without a token in the store/`sessionStorage` → the `SecureCodeGate` component
  (no redirect: the address stays a permanent link).
- Unknown `reservationId` (404 from `status`) → the „Nie znaleziono rezerwacji" (Reservation not found) view.

## `useRoomStore`

```ts
state: {
  rooms: RoomCard[];                       // GET /rooms
  current: RoomCard | null;                // GET /rooms/:id
  blockedNights: Record<string /* roomId */, Record<string /* YYYY-MM-DD */, 'held' | 'confirmed' | 'optimistic'>>;
  loading: boolean; error: string | null;
}
actions: loadRooms(); loadRoom(roomId); loadBlockedNights(roomId, from, to);
         holdNightsLocally(roomId, nights[]); releaseNightsLocally(roomId, nights[]);
getters: isNightBlocked(roomId, night); nightsBetween(checkIn, checkOut);
```

## `useReservationStore`

```ts
state: {
  draft: { roomId, checkIn, checkOut, nights, totalAmount, guestName, guestEmail } | null;
  current: {
    id: string | null;              // null until POST /reservations returns
    paymentId: string | null;
    status: ReservationStatus;
    optimistic: boolean;
    accessToken: string | null;
    secureCode: string | null;      // cleared after leaving ReservationView
    details: ReservationDetails | null;
  } | null;
  pendingDecision: { outcome, delaySeconds } | null;   // decision queued before paymentId
  error: string | null;
}
actions: create(draft); decide(outcome, delaySeconds); unlock(secureCode);
         loadDetails(); pollStatus(); stopPolling(); cancel(); forgetSecureCode(); restoreFromSession();
```

`accessToken` and `id` are also kept in `sessionStorage` (`booking.session`) so that a page refresh does not
require the code (FR-016). `secureCode` never goes into `sessionStorage`.

## Optimistic UI rules (ADR-008, FR-021)

1. **Date selection**: `nights` and `totalAmount` are computed locally from `pricePerNight`; blocked nights
   block the range locally; no request to the server.
2. **Reservation creation** (`create`):
   1. the store sets `current = { id: null, status: 'PendingPayment', optimistic: true, ... }`,
      calls `holdNightsLocally`, the router moves to `/payment`;
   2. `POST /reservations` in the background; success → `id`, `paymentId`, `secureCode`, `accessToken`,
      `optimistic = false`, session saved;
   3. `decide` clicked before `paymentId` → `pendingDecision`; sent immediately after success;
   4. error (409/422/network) → `releaseNightsLocally`, `current = null`, `pendingDecision = null`,
      `loadBlockedNights` for the visible range, return to `/rooms/:roomId/book`, message
      from the server's `message` (409: „Wybrane noce są już zajęte." (The selected nights are already taken.)).
3. **Operator decision** (`decide`): `409 RESERVATION_NOT_PENDING` → `PaymentView` shows
   „Rezerwacja wygasła, płatność nie została przyjęta” (The reservation has expired, the payment was not accepted) and the „Wróć do pokoju” (Back to the room) button → `/rooms/:roomId`;
   after `202` the router moves to `/reservations/:id`;
   `ReservationView` starts `pollStatus` every 2 s until status ≠ `PendingPayment`; after the change
   `loadDetails`. `abandoned` → `/rooms/:roomId/book` after `202`, with a refresh of blocked nights.
4. **Cancellation** (`cancel`): `details.status = 'Cancelled'`, `cancellable = false`, the entry
   „Anulowana przez gościa" (Cancelled by the guest) added locally; `POST .../cancel`; success → `details` from the server;
   error → previous `details` restored, message. 409 (ConcurrencyError) → one retry
   before rolling back.
5. Every rollback shows a message in `StatusBanner`; never silent.

## Components

| Component | Responsibility |
|---|---|
| `StayCalendar` | 3 months (current + 2), check-in/check-out click, past and blocked nights greyed out, rejects a range spanning a blocked night (new start = clicked day), 30-night limit |
| `GuestForm` | full name (1–100), e-mail; local validation with Polish messages |
| `SecureCodeGate` | a single 6-character field (`autocapitalize="off"`, `autocomplete="one-time-code"`), error message with `attemptsLeft`, lock with `Retry-After` |
| `ReservationTimeline` | list of `timeline` entries with the date and the label from `pl.ts` by `eventType` (+ `reason` for PaymentRejected) |
| `StatusBanner` | banners: pending / rejected / expired / cancelled / rollback error |
| `SaveDetailsCard` | link + secure code as `abc-xyz` in a monospace font, „Kopiuj” (Copy) button; only on the first visit after reserving |

## Polish texts: `src/i18n/pl.ts`

The backend returns no Polish texts (constitution VIII, research R-14). One `pl.ts` file
with typed maps:

- `errors[code]` → message for the guest (e.g. `ROOM_NOT_AVAILABLE` → „Wybrane noce są już zajęte.");
- `fields[field][code]` → validation messages (e.g. `guestName.TOO_LONG`);
- `status[status]` → status chip; `Rejected` with `reason = abandoned_by_guest` → „Płatność przerwana";
- `timeline[eventType]` → „Rezerwacja utworzona", „Płatność potwierdzona", „Płatność odrzucona"
  (or „Płatność przerwana" for the reason `abandoned_by_guest`), „Rezerwacja wygasła",
  „Anulowana przez gościa";
- `features[key]` → feature labels (keys from the seed: `balcony`, `wifi`, …).

No vue-i18n library: one language, a plain TypeScript object.

## Look and feel

As in the mockups: white background, accent `#0F6E63`, system font, buttons ≥ 44 px,
mobile-first, column max. 480 px on desktop, no horizontal scrolling at 390 px (SC-006).
