# Karmyq Bug Log

A running list of bugs captured mid-session. Use `/bug <description>` to add entries.
Status is `open` at capture; planning sessions hand-edit to `planned` or `fixed`.

---

## BUG-001 · [2026-06-07] · open

https://karmyq.com/communities/ec1b8b22-c0f3-43ce-a13e-ada6b76a0553 doesn't have an admin.

---

## BUG-002 · [2026-06-07] · open

Feed: when there are no more open requests, a reload seems to show already-offered requests.

---

## BUG-003 · [2026-06-07] · open

Providers say "Offer help" — probably should say "Offer service".

---

## BUG-004 · [2026-06-07] · open

Karmyq logo turned into a green dot (the "Karmyq" wordmark text appears to be missing next to the seed dot).

---

## BUG-005 · [2026-06-07] · open

"Mark as done" isn't triggering the ability to rate (completing an exchange should unlock the rating flow, but doesn't).

---

## BUG-006 · [2026-06-08] · fixed

Request creation fails with "Request type 'generic' is not enabled in this community" when `community_configs.enabled_request_types` holds legacy type names (childcare/meal_share/tool_borrow from init.sql + migrations 011/012). Backend (request-service `requests.ts:1439`) enforces against raw legacy names while the frontend `CommunityConfigEditor` normalizes them to the 5 built-ins — so the admin UI shows all types enabled but creation 400s. Pre-existing (not Sprint 91). Proper fix: backend should ignore legacy names when enforcing — only restrict against known built-in request types, and treat all-legacy/empty as unrestricted.

**Fixed (2026-06-08, branch `fix/request-type-legacy-names`):** `requests.ts` enforcement filters `enabled_request_types` to known built-in names (`BUILTIN_REQUEST_TYPES`) before gating; all-legacy/empty ⇒ unrestricted. Covered by `tests/regression/bug-006-legacy-request-type-names.test.ts`.

---
