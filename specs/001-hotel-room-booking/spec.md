# Feature Specification: Hotel Room Booking (MVP)

**Feature Branch**: `001-hotel-room-booking`

**Created**: 2026-10-31

**Status**: Implemented (2026-11-01, validation in `checklists/validation.md`)

**Input**: User description: "MVP systemu rezerwacji pokoi hotelowych dla małego obiektu: wyświetlanie szczegółów pokoju, wybór daty w kalendarzu, rezerwacja terminu, symulacja bramki płatności, podgląd rezerwacji pod stałym linkiem z potwierdzeniem PIN-em nadanym przy rezerwacji, bez logowania. Projekt testowy i pokazowy, nie na produkcję." (An MVP room booking system for a small property: room details, date selection in a calendar, reserving a stay, a simulated payment gateway, viewing the reservation under a permanent link confirmed with a PIN assigned at reservation time, no login. A test and showcase project, not for production.)

**Screen mockups**: https://claude.ai/artifact/QY6SwKuMx17mVW7mYmFWkS (approved by the owner)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - I choose a room and a stay (Priority: P1)

The guest opens the property's site and sees a list of three rooms: a photo, the name and the nightly price of each.
They click a room and see its page: photo, name, description, features and nightly price. They click „Wybierz termin" (choose dates), see a month calendar with taken nights greyed out,
click the check-in day and the check-out day, and the app immediately shows the number of nights and the total amount.

**Why this priority**: Without this screen there is no product; it is the first thing the end user sees
and the only entry point to a reservation.

**Independent Test**: Can be tested on its own by opening the site, choosing a room from the list, checking its data,
choosing a date range that avoids taken nights and reading the amount. Delivers value: the guest knows whether
the stay is available and how much they will pay.

**Acceptance Scenarios**:

1. **Given** the guest opens the home page, **When** the page loads, **Then** they see three rooms,
   each with a name, a photo and a nightly price.
2. **Given** the guest clicks a room on the list, **When** the room page opens, **Then** they see the room's
   name, description, features, nightly price and a button leading to date selection.
3. **Given** the guest is in the calendar and the nights of 5–7 November are taken in this room, **When** they look at the calendar,
   **Then** the nights 5, 6 and 7 are greyed out and cannot be clicked.
4. **Given** the guest clicked 10 November as check-in, **When** they click 13 November as check-out,
   **Then** they see „3 noce" (3 nights) and an amount equal to 3 × the nightly price.
5. **Given** the guest clicked 3 November as check-in, **When** they click 9 November as check-out
   (the range covers the taken nights 5–7), **Then** the range is not accepted and 3 November
   stays selected as the new start of the selection.
6. **Given** the guest chose a check-out earlier than the check-in, **When** they click, **Then** the app treats
   the clicked day as the new check-in day.

---

### User Story 2 - I reserve and pay at the simulated payment operator (Priority: P1)

After choosing the stay, the guest enters their full name and e-mail and proceeds to payment. They see
a screen imitating the payment operator with the amount and the stay. They can choose the delay of the operator's response
and click „Zapłać" (pay), „Odrzuć płatność" (reject payment) or „Anuluj i wróć" (cancel and go back). After the decision they land on their
reservation page, which shows the state "pending payment" and, once the operator's response arrives, changes
to "confirmed" or "payment rejected". On the first visit after reserving they see the permanent link
and the secure code with a request to save them.

**Why this priority**: This is the actual transaction; without it P1 is only a catalogue.

**Independent Test**: Can be tested by choosing a stay, entering the details, clicking „Zapłać"
with a 3 s delay and watching the reservation state change from "pending" to "confirmed";
a second run with „Odrzuć płatność" ends in the "rejected" state with the nights released.

**Acceptance Scenarios**:

1. **Given** the guest chose the stay 10–13 November, **When** they enter their full name and a valid e-mail
   and click „Przejdź do płatności" (proceed to payment), **Then** they immediately see the operator screen with the amount 3 × price
   and that stay, and the nights 10–12 are from that moment unavailable to other guests.
2. **Given** the guest is on the operator screen, **When** they click „Zapłać" with a 3 s delay,
   **Then** they immediately see the reservation page in the "pending payment" state, and after about 3 s the state
   changes to "confirmed" without a page refresh.
3. **Given** the guest is on the operator screen, **When** they click „Odrzuć płatność", **Then** the reservation
   page shows "payment rejected", the nights return to the free pool, and the guest can go back
   to the room page and reserve again.
4. **Given** the guest is on the operator screen, **When** they click „Anuluj i wróć", **Then** they return
   to the calendar, and the nights they just chose are free again.
5. **Given** the guest has just paid, **When** the reservation page opens, **Then** they see the permanent
   link, the six-character secure code and a message that these details are shown only once.
6. **Given** the guest did not enter an e-mail or entered an invalid one, **When** they click „Przejdź do płatności",
   **Then** they see a message next to the field and stay in the form.
7. **Given** two guests reserve the same stay at the same time, **When** both click
   „Przejdź do płatności", **Then** only the first proceeds, and the second sees a message
   that the stay has just been taken, and a refreshed calendar.
8. **Given** a reservation waits for payment longer than 15 minutes without an operator decision,
   **When** that time passes, **Then** the reservation moves to the "expired" state and the nights return to the pool.

---

### User Story 3 - I return to the reservation through the permanent link and the secure code (Priority: P2)

The guest comes back later (another device, a new tab) to the saved link. They see a request for the secure code. After
entering the correct code they see the reservation details: room, dates, number of nights, guest details,
amount, status and event history. After several wrong attempts the link is temporarily locked.

**Why this priority**: The permanent link with the secure code replaces a login and is a precondition for cancelling;
without it the reservation "disappears" once the tab is closed.

**Independent Test**: Can be tested by opening the reservation link in a private window,
entering the code and comparing the displayed data with what was entered at reservation time.

**Acceptance Scenarios**:

1. **Given** the guest opens the reservation link without prior access, **When** the page loads,
   **Then** they see only the secure code field and no reservation data.
2. **Given** the guest entered the correct code, **When** they submit, **Then** they see the full details
   and the event history (creation, payment decision, cancellation if any).
3. **Given** the guest entered a wrong code, **When** they submit, **Then** they see a wrong-code message
   and the number of remaining attempts.
4. **Given** the guest entered a wrong code 5 times within 15 minutes, **When** they try a sixth time,
   **Then** they see information about the lock and when it ends, and further attempts are refused.
5. **Given** the guest unlocked the reservation with the code, **When** they refresh the page in the same tab,
   **Then** they do not have to enter the code again for at least 15 minutes.

---

### User Story 4 - I cancel the reservation (Priority: P2)

After unlocking a confirmed reservation the guest clicks „Anuluj rezerwację" (cancel reservation). The status changes
immediately to "cancelled", the button disappears, an entry appears in the history, and the nights return to the pool.
They see information about a full (simulated) refund.

**Why this priority**: It closes the reservation's life cycle and is the only state-changing action after
payment; required by the owner, but the product works without it.

**Independent Test**: Can be tested by cancelling a confirmed reservation and checking
in the calendar that its nights are free again.

**Acceptance Scenarios**:

1. **Given** the reservation is confirmed and the check-in day is in the future, **When** the guest
   clicks „Anuluj rezerwację", **Then** the status changes to "cancelled" at once, the button disappears,
   the history gets an entry, and the nights are free in the calendar.
2. **Given** the reservation is in the state "pending payment", "rejected", "expired" or
   "cancelled", **When** the guest views the reservation page, **Then** the cancel button is not
   available.
3. **Given** the check-in day is today or earlier, **When** the guest views a confirmed reservation,
   **Then** the cancel button is not available and the page explains why.
4. **Given** the cancellation failed on the system side, **When** the response comes back with an error,
   **Then** the status returns to "confirmed" and the guest sees a failure message.

---

### User Story 5 - I rebuild the read models from the event history (Priority: P3)

The project owner (as the operator) runs one command that clears all read
views and rebuilds them solely from the stored event history. After the rebuild the calendar,
reservation pages and histories look identical to before it.

**Why this priority**: Proof that the event history is the only source of truth, which the owner
named as a condition of a successful project. It is not a guest-facing function.

**Independent Test**: Can be tested by making several reservations in different states,
running the rebuild and comparing snapshots of the views before and after.

**Acceptance Scenarios**:

1. **Given** the system holds reservations in the states confirmed, rejected, expired and cancelled,
   **When** the operator runs the rebuild, **Then** once it finishes all read views
   are identical to the state before the rebuild.
2. **Given** a rebuild is in progress, **When** a guest refreshes the page, **Then** once the rebuild finishes
   they see correct data (temporary unavailability is acceptable).

---

### Edge Cases

- The guest chooses a check-in in the past: days earlier than today are unavailable in the calendar.
- The guest chooses a stay longer than 30 nights: the app refuses and explains the limit.
- The payment operator answers after the reservation expired (the guest sat on the operator screen
  for more than 15 minutes): the answer is ignored, the reservation stays "expired", the guest sees
  an explanation and a „Zarezerwuj ponownie" (reserve again) button. Any payment made is not refunded (an MVP
  limitation, explicitly documented).
- The operator sends the same answer twice: the second one changes nothing.
- The guest refreshes the operator screen before deciding: they see the same screen with the same amount.
- The guest opens the operator screen directly by address, without a reservation in progress: they land
  on the room list.
- Many concurrent calendar refreshes (e.g. 500 in the same second after the cache
  expired): everyone gets a correct answer and the database is queried once.
- A reservation link with a non-existent identifier: a "reservation not found" page, without
  revealing whether the identifier ever existed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST show on the home page a list of three rooms (name, photo or
  placeholder, nightly price) and, after a room is chosen, its page: name, description, list of features,
  photo and nightly price.
- **FR-002**: The system MUST present a calendar of at least the current and the two following months
  marking taken nights (reservations pending payment and confirmed) and past nights
  as unavailable.
- **FR-003**: The guest MUST be able to choose a stay with two clicks (check-in, check-out), where
  the check-out must be later than the check-in, the stay covers 1 to 30 nights and no night
  of the stay may be taken.
- **FR-004**: The system MUST show the number of nights and the total amount immediately after the dates are chosen, without
  waiting for a server response.
- **FR-005**: The system MUST require a full name (1–100 characters) and an e-mail in a valid
  format before proceeding to payment.
- **FR-006**: The system MUST create the reservation in the "pending payment" state and block its
  nights for other guests at the moment of proceeding to payment.
- **FR-007**: The system MUST guarantee that two reservations that are not cancelled, not expired
  and not rejected never share the same night of the same room, also under concurrent
  attempts.
- **FR-008**: The reservation amount MUST equal the number of nights × the nightly price in force at the moment
  of reserving, and must not change after a later change of the room price.
- **FR-009**: The system MUST provide a payment operator simulator screen with the amount, the stay,
  the reservation identifier, a choice of response delay (0, 3, 10 s) and the actions „Zapłać",
  „Odrzuć płatność", „Anuluj i wróć".
- **FR-010**: The operator's answer MUST reach the system asynchronously, after the chosen
  delay, and move the reservation to the state "confirmed" (payment) or "rejected"
  (rejection, abandonment). A repeated or late answer MUST be ignored without an error.
- **FR-011**: A reservation pending payment for longer than 15 minutes MUST automatically move
  to the "expired" state and release its nights within the following minute.
- **FR-012**: The reservation page in the "pending payment" state MUST update the status without
  a refresh by the guest, with a delay of no more than 3 s from the operator's decision.
- **FR-013**: The system MUST give every reservation a readable, permanent identifier (e.g. `RES-7F3K2A`)
  and a six-character secure code (letters and digits), shown to the guest exactly once, right after reserving.
- **FR-014**: The reservation page under the permanent link MUST hide all data until the correct
  secure code is entered; the only exception is the reservation status itself together with the rejection reason,
  needed for the waiting screen.
- **FR-015**: The system MUST limit secure code attempts to 5 per 15 minutes for a given reservation and, once
  exceeded, block further attempts for 15 minutes with a readable message.
- **FR-016**: After a correct secure code, access MUST last at least 15 minutes in the same
  tab, also after a page refresh; a guest who has just made the reservation does not enter the code
  in the same session.
- **FR-017**: The reservation page MUST show: room name, check-in and check-out dates with the check-in
  and check-out times, number of nights, full name, e-mail, amount, status and the event history
  in chronological order.
- **FR-018**: The guest MUST be able to cancel only a confirmed reservation whose check-in day
  is later than today; cancelling releases the nights and records a full (simulated) refund.
- **FR-019**: The secure code MUST be stored only in an irreversible form; nobody but the guest
  can read it from the system after creation.
- **FR-020**: Every reservation state change MUST be stored as an immutable event,
  and all views (calendar, reservation page, history) MUST be rebuildable from scratch
  from those events with one operator command.
- **FR-021**: The actions "create reservation" and "cancel" MUST be reflected in the interface
  immediately after the click and, on failure, rolled back with a visible message; no
  rollback may be silent.
- **FR-022**: The interface MUST be in Polish and fully usable on a phone screen
  (390 px wide) and on a desktop.

### Key Entities

- **Room (Pokój)**: the property's reference data: name, description, features, nightly price, check-in
  and check-out times. In the MVP three rooms are visible in the app.
- **Reservation (Rezerwacja)**: a guest's stay in a room; has an identifier, a stay, guest details,
  an amount, a secure code (irreversibly), a status and an event history. Statuses: pending payment,
  confirmed, rejected, expired, cancelled.
- **Stay (Pobyt)**: check-in day, check-out day, the resulting nights (check-in inclusive, check-out
  exclusive).
- **Night (Noc)**: a single date of room occupancy; belongs to at most one active
  reservation.
- **Secure code (SecureCode)**: a six-character code (letters and digits) assigned at reservation time, known only
  to the guest; replaces a login when opening the permanent link.
- **Payment decision (Decyzja operatora)**: the simulated operator's answer about the payment outcome
  (payment, rejection, abandonment), linked to the reservation by the payment identifier.
- **Event (Zdarzenie)**: an immutable fact from the reservation history: created, payment
  confirmed, payment rejected, expired, cancelled.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The guest gets from the room page to the payment operator screen in under
  2 minutes and in no more than 6 clicks (choose dates, check-in, check-out, 2 fields, proceed).
- **SC-002**: After an operator decision with a 3 s delay, the reservation page shows the new status
  in under 6 s from clicking „Zapłać", without a refresh.
- **SC-003**: In 100 attempts of two guests reserving the same stay concurrently,
  exactly one of each pair succeeds, with zero cases of double booking.
- **SC-004**: After rebuilding the views from the event history, 100% of reservations have the same status,
  dates, amount and history as before the rebuild.
- **SC-005**: 500 concurrent calendar refreshes after the cache expired end with
  500 correct responses and exactly one database read.
- **SC-006**: Each of the six screens (five mockups and the room list) is fully usable at 390 px width without
  horizontal scrolling.
- **SC-007**: The full guest journey (reservation → payment → viewing via the secure code → cancellation →
  reserving the same nights again) passes as one automated end-to-end
  test.

## Assumptions

- The end user is the property's guest; reception and the administrator have no screens of their own
  in the MVP (apart from the view rebuild command for the technical operator).
- Three rooms are visible in the app on the home page list; there is no search or
  filters, and the room data comes from the seed data.
- Stay dates are calendar dates without times, in the Europe/Warsaw zone; "today" is counted
  in that zone.
- The price is expressed in złoty and is the same for all dates; no seasons, discounts, taxes
  or surcharges.
- Payment is entirely simulated; no real operator or real money is
  involved, and the "refund" on cancellation is only a message and a history entry.
- The night hold during payment lasts 15 minutes (confirmed by the owner on 2026-10-31).
- The guest receives no e-mail or SMS; the link and the secure code are shown only on screen.
- The project runs only locally on the owner's computer; there are no high-availability,
  backup or legal compliance (GDPR) requirements beyond not storing the secure code in clear text.
- The mockups from the artifact are the source of the screen layouts; deviations require the owner's consent.
