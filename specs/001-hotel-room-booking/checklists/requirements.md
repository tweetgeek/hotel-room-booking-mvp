# Specification Quality Checklist: Hotel Room Booking (MVP)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-10-31
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Iteration 1 (2026-10-31): all items satisfied. Doubts were resolved earlier
  in conversation with the owner (screen order per the mockups, behaviour on a late operator
  decision, „Anuluj i wróć" releases the nights, history solely from events).
- One assumption to be confirmed by the owner: a 15-minute night hold during payment
  (FR-011). Does not block proceeding to `/speckit-plan`.
- FR-020 and SC-004/SC-005 describe the owner's requirements (rebuildability from the event history,
  one database read under many concurrent requests) in terms of outcome, not mechanism.
- Iteration 2 (2026-10-31): after the owner's comments in the design document: three rooms
  with a list on the home page (US1, FR-001, entities, assumptions), the term "secure code"
  (SecureCode) instead of "PIN" throughout the text. The checklist is still satisfied.

## SC-006 verification at 390 px width (T071, 2026-11-01)

Method: Google Chrome in headless mode driven over the DevTools protocol (`Emulation.setDeviceMetricsOverride`
390 × 844, `deviceScaleFactor` 2); a script walks the whole guest journey against the running API and Vite, measuring
`document.documentElement.scrollWidth` and the minimum height of visible buttons, and the screenshots were reviewed.

| Screen | `scrollWidth` | min. button height | Notes |
|---|---|---|---|
| `/` room list | 390 | 44 px | |
| `/rooms/1` room | 390 | 44 px | |
| `/rooms/1/book` calendar | 390 | 44 px | 92 controls (days) |
| `/rooms/1/book` with the form | 390 | 44 px | |
| `/payment` operator | 390 | 44 px | radio buttons 13 px inside 44 px labels; enlarged to 22 px |
| `/reservations/:id` waiting + „Zapisz te dane" | 390 | 44 px | duplicated waiting text removed |
| `/reservations/:id` confirmed | 390 | 44 px | |
| `/reservations/:id` code gate | 390 | 44 px | also after a wrong code |
| `/reservations/:id` unlocked and cancelled | 390 | 44 px | |
| `/reservations/RES-ZZZZZZ` not found | 390 | 44 px | |

Result: no horizontal scrolling on any screen (SC-006 satisfied). Access from a phone on the local network
requires `npm run dev -- --host` and `VITE_API_URL=http://<ip>:3100` (described in the README); it was not checked
on a physical device.
