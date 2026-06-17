# Karmyq Bug Log

A running list of bugs captured mid-session. Use `/bug <description>` to add entries.
Status is `open` at capture; planning sessions hand-edit to `planned` or `fixed`.

---

## BUG-001 · [2026-06-07] · fixed

https://karmyq.com/communities/ec1b8b22-c0f3-43ce-a13e-ada6b76a0553 doesn't have an admin.

**Fixed (Sprint 92, branch `feature/sprint-92-matching-repair`):** idempotent data-repair migration
`infrastructure/postgres/migrations/20260608-backfill-community-admins.sql` promotes an admin for
every adminless community (creator_id if active, else earliest-joined active member); plus a
last-admin guard on `PUT /communities/:id/members/:userId` blocking demotion/deactivation of the
sole active admin. Test: `services/community-service/tests/tdd/sprint-92-last-admin-guard.test.ts`.

---

## BUG-002 · [2026-06-07] · fixed

Feed: when there are no more open requests, a reload seems to show already-offered requests.

**Fixed (Sprint 92, branch `feature/sprint-92-matching-repair`):** every browsable open-request query
(GET /requests, curated feed, sister-community feed) now excludes requests where the viewer already
has a live (proposed/matched) match as responder. Server-side only. Test:
`services/request-service/tests/regression/sprint-92-feed-exclusion.test.ts`.

---

## BUG-003 · [2026-06-07] · fixed

Providers say "Offer help" — probably should say "Offer service".

**Fixed (Sprint 92, branch `feature/sprint-92-matching-repair`):** the shared RequestCard offer
button reads "Offer service" for a service (provider-context) request and keeps "Offer to Help" for
mutual-aid — branched on `request_type === 'service'`, not a blanket replace. Test:
`apps/frontend/tests/tdd/sprint-92-provider-copy.test.tsx`.

---

## BUG-004 · [2026-06-07] · cannot-reproduce (Sprint 92)

Karmyq logo turned into a green dot (the "Karmyq" wordmark text appears to be missing next to the seed dot).

**Investigation (Sprint 92, reproduce-first):** the in-app wordmark is the only surface that
renders the seed, and it always renders the "Karmyq" text beside it —
[Layout.tsx:116-118](../apps/frontend/src/components/Layout.tsx) (`.kq-wordmark` → `.kq-wordmark-seed`
span + the literal text "Karmyq"). The CSS gives the text high contrast — `text-primary-dark`
(#245621 dark green) on a `bg-surface-raised` (#fdfcf9 warm-white) topbar — with a `Georgia, serif`
fallback if the Fraunces webfont fails, so the text is never invisible. There is no standalone
"seed-only" logo component anywhere in `apps/frontend/src`, and there is no dark theme that could
collapse the text colour into the background. Auth pages (`/`, `/login`, `/register`) suppress the
whole topbar, so they show no wordmark at all — not "just a dot." The browser-tab favicon
(`public/favicon.svg`) is intentionally a mark-only constellation of green circles (a favicon can't
legibly carry a wordmark; the full wordmark lives in `public/brand/karmyq-wordmark.svg`) — the most
likely source of "the logo is a green dot." No reproducible defect in the app wordmark; marking
`cannot-reproduce` rather than blind-editing a correct component (per the sprint plan).

---

## BUG-005 · [2026-06-07] · fixed

"Mark as done" isn't triggering the ability to rate (completing an exchange should unlock the rating flow, but doesn't).

**Fixed (Sprint 92, branch `feature/sprint-92-matching-repair`):** both the Dashboard DecisionBand
and the CommitmentsTab now fire the rating prompt on the same signal — the completeMatch transition
to `fully_completed` — via a shared `utils/completion.ts` + shared `RatingPrompt`. A one-sided done
no longer prompts; the Dashboard unlocks rating in place on full completion. Test:
`apps/frontend/tests/tdd/sprint-92-completion-rating.test.tsx`.

---

## BUG-006 · [2026-06-08] · fixed

Request creation fails with "Request type 'generic' is not enabled in this community" when `community_configs.enabled_request_types` holds legacy type names (childcare/meal_share/tool_borrow from init.sql + migrations 011/012). Backend (request-service `requests.ts:1439`) enforces against raw legacy names while the frontend `CommunityConfigEditor` normalizes them to the 5 built-ins — so the admin UI shows all types enabled but creation 400s. Pre-existing (not Sprint 91). Proper fix: backend should ignore legacy names when enforcing — only restrict against known built-in request types, and treat all-legacy/empty as unrestricted.

**Fixed (2026-06-08, branch `fix/request-type-legacy-names`):** `requests.ts` enforcement filters `enabled_request_types` to known built-in names (`BUILTIN_REQUEST_TYPES`) before gating; all-legacy/empty ⇒ unrestricted. Covered by `tests/regression/bug-006-legacy-request-type-names.test.ts`.

---

## BUG-007 · [2026-06-08] · fixed

Dibs shows up a provider when it is a request for a neighbor. I think this is the wrong behavior.

**Fixed (Sprint 92, branch `feature/sprint-92-matching-repair`, ADR-072 Option A reframe):** dibs
candidates carry a `kind: 'neighbor' | 'provider'` discriminator; the submit path validates a
non-service nominee via the mutual-aid pool (no more spurious `NO_PRIOR_INTERACTION`); DibsPrompt
shows neighbour-framed copy + warm visual for neighbours. Tests:
`services/request-service/tests/unit/dibs-candidate-kind.test.ts`,
`services/request-service/tests/tdd/sprint-92-matching.test.ts` (submit path),
`apps/frontend/tests/tdd/sprint-92-dibs-prompt.test.tsx`.

---

## BUG-008 · [2026-06-08] · fixed

Request matching logic seems broken. — **fixed** (Sprint 92, branch `feature/sprint-92-matching-repair`).

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

## BUG-009 · [2026-06-08] · planned (Sprint 100)

In the community https://karmyq.com/communities/eb32c151-9953-409f-87ad-9abed720e4f4 the pulse shows This week, "4 neighbours helped each other thanks to Andre Chen, David Park, Maria Elena Reyes". However, when I go to "How we are connected", it shows no relationships. What's going on? (Pulse reports completed help / connections but the trust graph renders empty.)

**Planned (Sprint 100, finding F1):** two root causes — (1) `helpedThisWeek` counts completed `matches`
rows, not distinct responders (`requests.ts:1070-1077`) → "4 neighbours" with only 3 named; (2) a
community trust edge is only created when the `match_completed` event payload carries `community_id`
(`subscriber.ts:45-50`), so counted exchanges produce no visible connection. S100 counts distinct
responders AND reconciles connections from `request_communities` at completion (ADR-078), plus a
backfill script for historical matches. See
`docs/superpowers/plans/2026-06-15-sprint-100-pulse-truth-actionability.md`.

---

## BUG-010 · [2026-06-14] · planned (Sprint 100)

Failed to execute split on this page: https://karmyq.com/communities/446c2c65-64e1-4e8e-9d87-54671939a4da

**Planned (Sprint 100, fold-in G2):** reproduce-first against the live community + server logs, fix at
the correct layer, add a regression test (or document if not reproducible). See
`docs/superpowers/plans/2026-06-15-sprint-100-pulse-truth-actionability.md` Task 9.

---

## BUG-011 · [2026-06-16] · fixed

When a community split happens, I think the admin of the parent group is assigned to both the groups. I am not sure if that is correct. We need to keep the relation between the communities, but having the same admin might defeat the purpose.

**Fixed (Sprint 103, merged `124caea3`):** `executeSplit` in
`services/community-service/src/services/fissionService.ts` no longer promotes the executing parent
admin into both children. Each child admin is selected from that child's assigned members; if a child
has no assigned parent admin, the strongest assigned member by within-child trust degree is promoted
(deterministic tie-breaks). The `split_origin` link between siblings is preserved via
`communities.community_links`, not shared admin authority.

---

## BUG-012 · [2026-06-16] · fixed

We had a regression between offer help and offer service distinction.

**Fixed (Sprint 103, merged `124caea3`):** offer action copy is centralized in
`apps/frontend/src/lib/requestActionCopy.ts` — service asks say "Offer service", mutual-aid asks say
"Offer to Help" on both cards and detail pages. No more inline `request_type === 'service'` label
checks scattered across components.

---
