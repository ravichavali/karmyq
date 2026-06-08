# Karmyq Bug Log

A running list of bugs captured mid-session. Use `/bug <description>` to add entries.
Status is `open` at capture; planning sessions hand-edit to `planned` or `fixed`.

---

## BUG-001 · [2026-06-07] · planned (Sprint 92)

https://karmyq.com/communities/ec1b8b22-c0f3-43ce-a13e-ada6b76a0553 doesn't have an admin.

---

## BUG-002 · [2026-06-07] · planned (Sprint 92)

Feed: when there are no more open requests, a reload seems to show already-offered requests.

---

## BUG-003 · [2026-06-07] · planned (Sprint 92)

Providers say "Offer help" — probably should say "Offer service".

---

## BUG-004 · [2026-06-07] · planned (Sprint 92)

Karmyq logo turned into a green dot (the "Karmyq" wordmark text appears to be missing next to the seed dot).

---

## BUG-005 · [2026-06-07] · planned (Sprint 92)

"Mark as done" isn't triggering the ability to rate (completing an exchange should unlock the rating flow, but doesn't).

---

## BUG-006 · [2026-06-08] · fixed

Request creation fails with "Request type 'generic' is not enabled in this community" when `community_configs.enabled_request_types` holds legacy type names (childcare/meal_share/tool_borrow from init.sql + migrations 011/012). Backend (request-service `requests.ts:1439`) enforces against raw legacy names while the frontend `CommunityConfigEditor` normalizes them to the 5 built-ins — so the admin UI shows all types enabled but creation 400s. Pre-existing (not Sprint 91). Proper fix: backend should ignore legacy names when enforcing — only restrict against known built-in request types, and treat all-legacy/empty as unrestricted.

**Fixed (2026-06-08, branch `fix/request-type-legacy-names`):** `requests.ts` enforcement filters `enabled_request_types` to known built-in names (`BUILTIN_REQUEST_TYPES`) before gating; all-legacy/empty ⇒ unrestricted. Covered by `tests/regression/bug-006-legacy-request-type-names.test.ts`.

---

## BUG-007 · [2026-06-08] · planned (Sprint 92)

Dibs shows up a provider when it is a request for a neighbor. I think this is the wrong behavior.

---

## BUG-008 · [2026-06-08] · planned (Sprint 92)

Request matching logic seems broken.

**Root cause (Sprint 92 diagnosis, systematic-debugging):** the match lifecycle strands
`requests.help_offers` rows in `'matched'` state. Creating a match sets the linked offer to
`'matched'` (`matches.ts` POST `/`), but only DELETE/cancel ever restores it to `'active'`. The two
other transitions that take a match out of play do not: `PUT /matches/:id/reject` reopens the
request (when no proposed siblings remain) but never frees the offer — its `matchCheck` SELECT
doesn't even read `offer_id`; and `PUT /matches/:id/accept` bulk-rejects sibling proposed matches
(`matches.ts` ~L340) without freeing their offers. Net effect: after a requester rejects a match, or
accepts one helper and thereby rejects the others, the affected helpers' offers remain `'matched'`
forever — they disappear from the active-offer pool (`GET /offers` defaults to `status='active'`)
and the reopened request can never be re-matched through them. Repro test:
`services/request-service/tests/tdd/sprint-92-matching.test.ts` (RED before fix). Fix: reset the
linked offer(s) to `'active'` in both the reject path and the accept path's sibling rejection,
mirroring cancel.

---
