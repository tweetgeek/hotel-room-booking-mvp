# Booking

A small property lets a guest reserve one of its rooms for a stay, pay through a (simulated)
payment operator, and return to the reservation through a permanent link protected by a secure
code. The UI speaks Polish; the Polish label of each term is given in parentheses.

## Language

**Room** (Pokój):
A bookable unit of the property with a name, description, features and a nightly price.
_Avoid_: unit, accommodation, apartment (except as a room's name)

**Guest** (Gość):
The person who makes a reservation, identified only by a name and an e-mail address.
_Avoid_: user, customer, client, account

**Stay** (Pobyt):
A check-in date and a check-out date for one room; covers the nights from check-in inclusive
to check-out exclusive, between 1 and 30 nights.
_Avoid_: booking period, date range, term

**Night** (Noc):
A single calendar date on which a room is occupied. A stay of 10–13 covers the nights 10, 11 and 12.
_Avoid_: day, date

**Blocked Night** (Zajęta noc):
A night of a room that belongs to an active reservation (pending payment or confirmed) and
therefore cannot be part of another stay.
_Avoid_: occupied, taken, locked, unavailable

**Reservation** (Rezerwacja):
A guest's claim on a room for a stay, with a price, a status and a history of what happened to it.
_Avoid_: booking, order

**Reservation Status** (Status rezerwacji):
Where a reservation is in its life: Pending Payment (oczekuje na płatność), Confirmed
(potwierdzona), Rejected (płatność odrzucona), Expired (wygasła) or Cancelled (anulowana).
Rejected, Expired and Cancelled are final. A Rejected reservation carries the reason: rejected by
the payment operator, or abandoned by the guest (shown as „płatność przerwana").
_Avoid_: state, phase

**Pending Payment** (Oczekuje na płatność):
A reservation whose nights are blocked while the payment operator's decision is awaited;
it expires if no decision arrives within the hold period.

**Hold Period** (Czas blokady):
How long a reservation may stay Pending Payment before it expires and its nights are released:
15 minutes.

**Secure Code** (Kod bezpieczeństwa):
A six-character, case-sensitive code of letters and digits (never 0, O, 1, l or I) given to the
guest once, right after reserving, which unlocks the reservation page under its permanent link.
It replaces a login.
_Avoid_: PIN, password, access code

**Access Token** (Token dostępu):
A short-lived proof (15 minutes) that the guest has shown the secure code or has just reserved,
letting the browser open the reservation page without asking for the code again.
_Avoid_: session, login, cookie

**Permanent Link** (Stały link):
The fixed address of one reservation, usable later on any device together with the secure code.
_Avoid_: deep link, URL

**Payment Operator** (Operator płatności):
The external party that collects the payment for a reservation; simulated in this project.
_Avoid_: gateway, bank, provider, bramka

**Payment Decision** (Decyzja operatora):
The payment operator's answer about a reservation's payment: paid, rejected, or abandoned by the guest.
_Avoid_: webhook, callback, payment result

**Abandoned** (Przerwana przez gościa):
A payment decision meaning the guest left the payment operator without paying; the reservation
becomes Rejected with this reason.
_Avoid_: aborted, withdrawn, cancelled (reserved for a confirmed reservation)

**Total Amount** (Kwota):
The price of a reservation: nights × the room's nightly price at the moment of reserving.
_Avoid_: cost, total, price (for the reservation)

**Refund** (Zwrot):
The full total amount noted as returned when a confirmed reservation is cancelled; simulated only.

**Event** (Zdarzenie):
An immutable fact in a reservation's history: requested, payment confirmed, payment rejected,
expired, cancelled.
_Avoid_: log entry, change, update
