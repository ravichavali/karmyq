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

## BUG-009 · [2026-06-08] · fixed (verified live Sprint 108)

In the community https://karmyq.com/communities/eb32c151-9953-409f-87ad-9abed720e4f4 the pulse shows This week, "4 neighbours helped each other thanks to Andre Chen, David Park, Maria Elena Reyes". However, when I go to "How we are connected", it shows no relationships. What's going on? (Pulse reports completed help / connections but the trust graph renders empty.)

**Planned (Sprint 100, finding F1):** two root causes — (1) `helpedThisWeek` counts completed `matches`
rows, not distinct responders (`requests.ts:1070-1077`) → "4 neighbours" with only 3 named; (2) a
community trust edge is only created when the `match_completed` event payload carries `community_id`
(`subscriber.ts:45-50`), so counted exchanges produce no visible connection. S100 counts distinct
responders AND reconciles connections from `request_communities` at completion (ADR-078), plus a
backfill script for historical matches. See
`docs/superpowers/plans/2026-06-15-sprint-100-pulse-truth-actionability.md`.

**Fixed — verified live against the named community (Sprint 108, reproduce-first):** both root causes
resolved. (1) Headline now counts `COUNT(DISTINCT m.responder_id)`
([requests.ts:1251](../services/request-service/src/routes/requests.ts)); live query scoped to
community `eb32c151…` returns **3 distinct responders / 4 completed-rows this week** — the headline now
reads 3, matching the 3 named helpers (the old `COUNT(*)=4` overcount is gone). (2) The community trust
graph (`/trust/graph/:communityId/full` → `social_graph.trust_edges_live`, ADR-078 reconciliation +
`backfill-community-connections.sql`) now has **13 live edges for the community, 7 renderable among
active members** (weights 5.9–9.9, well above any decay threshold) — "How we're connected" renders
connections, not empty. No further code change needed.

---

## BUG-010 · [2026-06-14] · cannot-reproduce (verified live Sprint 108)

Failed to execute split on this page: https://karmyq.com/communities/446c2c65-64e1-4e8e-9d87-54671939a4da

**Planned (Sprint 100, fold-in G2):** reproduce-first against the live community + server logs, fix at
the correct layer, add a regression test (or document if not reproducible). See
`docs/superpowers/plans/2026-06-15-sprint-100-pulse-truth-actionability.md` Task 9.

**Cannot reproduce — verified live (Sprint 108, reproduce-first):** splits on this community
(`446c2c65…` "Marin Mutual Aid") now succeed. Live DB shows two split proposals, **both
`status='executed'`** (none stuck/failed), and the executions produced child communities — "Marin
Mutual Aid — Group A/B" created **2026-06-13** and named children ("Marin Helping Hands", "We are
Marin Aid") created **2026-06-16**, i.e. straddling and after the 06-14 report. Two weeks of
`karmyq-community-service` logs show **zero** split/fission execution errors. The 06-14 failure was
most likely a transient/pre-fix state in the split-admin selection path that BUG-011 (Sprint 103,
`fissionService.selectChildAdmin`) subsequently hardened; the 06-16 successful splits post-date that
fix. No current defect to fix; no regression test added (nothing reproduces). Reopen if a fresh
execution failure surfaces.

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

## BUG-013 · [2026-06-18] · fixed (Sprint 106)

**Fixed (v11.14.0):** `fetchDecisions` now surfaces a durable `rate` decision for both parties of a
`status='completed'` match the viewer hasn't rated (`NOT EXISTS` against `feedback.feedback`);
DecisionBand renders it as a first-class Rate action; `POST /reputation/feedback` hardened with
participant + completed + counterparty + match-community validation (cross-agent review caught the
body-supplied `community_id` attribution gap). Tests: `sprint-106-rating-decision.test.ts`,
`sprint-106-feedback-constraints.test.ts`, `sprint-106-decision-band-rating.test.tsx`.


Both requester and helper/service provider should be able to rate tasks on completion. I see some items in "Needs your response" section ask for rating some don't.

**Planned (Sprint 106, investigate-first):** diagnosed root cause — `DecisionBand.tsx:88` only unlocks
the rating prompt for whoever clicks the final `mark_done`; the other party gets no `rate` affordance.
S106 Task 1 confirms the rating lifecycle end-to-end (incl. whether the write path already accepts both
roles), then surfaces a durable `rate` decision for BOTH parties on `fully_completed`-unrated matches.
See `docs/superpowers/plans/2026-06-18-sprint-106-correctness-linkup.md`.

---

## BUG-014 · [2026-06-18] · fixed (Sprint 106)

**Fixed (v11.14.0):** `basicFeedRanker.ts` now selects and carries the persisted `hr.request_type`
enum (falling back to `'generic'`), not the mixed-vocab `category`, so service asks read as
`'service'` and the card shows "Offer service". Test: `sprint-106-feed-request-type.test.ts`.


Did we regress? Now I don't see the provider feed show "Offer service" — it says "Offer help". Didn't we say it should be "Offer service"? (See BUG-003 and BUG-012.)

**Planned (Sprint 106):** diagnosed root cause — the copy helper `getOfferActionLabel` is correct;
the regression is upstream in the Dashboard feed ranker `basicFeedRanker.ts:131`, which projects the
mixed-vocab `category` column in as `request_type`, so a service ask whose `category` holds a skill
token never reads as `'service'` → card falls back to "Offer to Help". Fix is backend: carry the
persisted `request_type` enum, grep all feed/projection sites. See
`docs/superpowers/plans/2026-06-18-sprint-106-correctness-linkup.md`.

---

## BUG-015 · [2026-06-18] · fixed (Sprint 106)

**Fixed (v11.14.0):** DecisionBand removed from Browse `UnifiedFeed` and mounted at the top of the
Helping tab (`CommitmentsTab`), sourced from the same server-ranked decisions feed. Test:
`sprint-106-band-placement.test.tsx`.


"Needs your response" — should it live in the Browse or the Helping tab?

**Planned (Sprint 106), resolved as Helping:** the DecisionBand currently mounts inside `UnifiedFeed`
in the Browse tab (`dashboard.tsx:216-232`). Decisions you owe (accept/decline offers, mark done,
rate, dibs) are commitment work, not new asks to browse → move the band to the top of the Helping
tab and remove it from Browse. See `docs/superpowers/plans/2026-06-18-sprint-106-correctness-linkup.md`.

---

## BUG-016 · [2026-06-18] · fixed (Sprint 106)

**Fixed (v11.14.0):** chrome-only breathing-room pass on `kq-topbar` — responsive nav/action gap
(`gap-3 md:gap-5`) and the user name defers to `lg` so the busy provider row no longer crowds at md
widths. No nav-information change. Test: `sprint-106-header-and-linkup.test.tsx`.


The header seems to be too squished.

**Planned (Sprint 106):** `kq-topbar` packs wordmark + four nav links + notification bell +
availability toggle + avatar on a single row (`Layout.tsx:115-164`), which crowds at narrower desktop
widths. S106 ships a chrome-only breathing-room pass within the existing A-plus tokens — no
nav-information change. See `docs/superpowers/plans/2026-06-18-sprint-106-correctness-linkup.md`.

---

## BUG-017 · [2026-06-19] · fixed (S106 follow-up)

Header still congested after S106; tabs left-justified while header content is centered; Home nav
link and the wordmark both go to /dashboard (redundant).

**Fixed:** removed the redundant "Home" nav link (the `kq-wordmark` already links Home) from the
desktop topnav and the hamburger; aligned the desktop tab row to the central column (`.tab-bar` is
now a full-width divider with an inner `.kq-page .tab-bar-row`, mirroring the topbar). Nav is
"Communities" + "Service Providers". Tests: `sprint-106-chrome-followup.test.tsx`,
`sprint-88-shell-fidelity.test.tsx`.

---

## BUG-018 · [2026-06-19] · fixed (S106 follow-up)

Provider notifications appear to have vanished — a provider has no surface for provider-specific
alerts (request matched, review received, preferred-provider selected).

**Fixed:** the standalone `ProviderNotificationBell` lost its mount in the S105 facelift (it's no
longer rendered anywhere — the component itself, including its styled-jsx CSS, still exists), so
provider alerts had no surface and the main bell showed community notifications only. Rather than
re-mount a second bell (which re-congests the header), `NotificationBell` now folds the provider
stream into the single bell for providers — merged + date-sorted list, combined unread dot.
Non-providers are unchanged. Test: `sprint-106-chrome-followup.test.tsx`.

---

## BUG-019 · [2026-06-19] · fixed (S106 follow-up)

The on-duty pill is redundant (especially on web) and the mobile on-duty control isn't clickable.

**Fixed:** removed the read-only "On duty" status pill from the dashboard community row and the
duplicate availability button from the hamburger menu. The single source of truth is the topbar
toggle, relabeled **On duty / Off duty**, now shown and clickable on every viewport (was
`hidden md:flex`). Test: `sprint-106-chrome-followup.test.tsx`,
`sprint-105-profile-chrome-facelift.test.tsx`.

**Follow-up (cross-agent MEDIUM):** the always-visible full-text pill risked overflowing the provider
topbar at 320–375px. Compacted to **dot-only below `md`** (full label returns at `md+`, `aria-label`
unchanged) and hid the topbar divider on mobile, so the provider row fits on common phones.

---

## BUG-020 · [2026-06-19] · fixed (S106 follow-up)

karmyq.org landing — the hero CTAs ("Join the founding circle" / "Read the thinking →") read as
misaligned; the justification looks wrong.

**Fixed:** the hero CTA rows were `flex flex-col sm:flex-row` with no `align-items`, so the default
`stretch` blew the CTAs to full width on the column axis (the "Read the thinking" underline spanned
the row). Added `items-start sm:items-center` to both hero CTA rows so each CTA hugs its content.
(`apps/landing/src/app/page.tsx`.)

---

## BUG-021 · [2026-06-19] · fixed (S106 follow-up)

The karmyq.com `/` index splash is outdated — pre-facelift styling (gradient/bold) and stale copy
("No money, just karma") that ignores the service-provider layer.

**Fixed:** rebuilt the splash on the A-plus design tokens (`kq-wordmark`, `kq-headline`, `kq-lede`,
`kq-card`, `btn-primary/secondary`, warm `bg-surface`) and refreshed the three value props to the
current two-layer framing — trust-not-money (platform never touches money; service arrangements stay
between people), Dunbar-150 communities, and mutual aid + trusted local service providers side by
side. Auth-aware CTAs kept (logged-in → dashboard). (`apps/frontend/src/pages/index.tsx`.)

---

## BUG-022 · [2026-06-19] · fixed (Sprint 107)

**Fixed:** Helping now uses `DecisionBand` as the canonical pending-dibs action surface. The separate
`DibsCard` list and `getPendingDibsForProvider()` fetch were removed from `CommitmentsTab`, so a
pending dibs cannot render with two Accept buttons on the same page. The Helping badge count is derived
from freshly mapped decision rows, not stale React state. Test:
`apps/frontend/tests/tdd/sprint-107-dibs-single-surface.test.tsx`.

An already-accepted dibs shows up in 2 places on the same page. Accepting it in one place causes the
other button to throw an error message.

---

## BUG-023 · [2026-06-19] · fixed (Sprint 107)

**Fixed:** request-service now exposes `GET /requests/offered-awaiting`, backed by the same
`fetchOfferedAwaiting()` predicate that powers Home's `offeredAwaiting` count and preview. Helping
loads that endpoint and renders an explicit **Offers awaiting requester** section, so Home's
**View all in Helping** link points to rows the user can find. Tests:
`services/request-service/tests/tdd/sprint-107-offered-awaiting-truth.test.ts` (DB-backed; local run
blocked without PostgreSQL) and
`apps/frontend/tests/tdd/sprint-107-offered-awaiting-helping.test.tsx`.

The "You've offered to help" section seems to have wrong info — I couldn't find these asks in Helping.

> You've offered to help on 3 open asks.
> Waiting for the requester to respond.
> - Need to borrow camping gear for weekend trip — Bay Area Mutual Aid Network
> - Carpool to Saturday Market — Portland Tool Library & Share
> - Carpool to Blazers game — PDX Home Repair & Trades
> View all in Helping →

---

## BUG-024 · [2026-06-24] · fixed (Sprint 113 PR A, validated 2026-06-25)

Trust/karma data discrepancy for the same user+community across surfaces. As Maria (logged in), community page `/communities/dd910075-313f-40e4-b302-bd596c84770d` shows "Maria Elena Reyes trust 120 · 40 karma", but Maria's profile page for the SAME community shows Karma Points 0, Trust Score 27 (out of 100), Recent Helps 0, Recent Requests 20. Numbers don't reconcile (trust 120 vs 27/100; karma 40 vs 0). Likely different metric sources/scales: community trust graph = decayed sum of edge weights (~120, unbounded) vs profile "Trust Score out of 100" = a normalized reputation metric; karma 40 (community-scoped, from the graph node) vs 0 (profile, possibly global or a different query). Needs reconciliation or clear labeling so the same concept reads consistently.

ALSO a privacy sub-question raised: on the community/governance nominee view, are OTHER nominees' trust/karma shown? The S111 privacy fix only covered the trust-graph API; governance/nominee lists may still expose member reputation numbers and should be checked against the same "only your own metrics" rule.

**Fixed (S113 PR A):** `profile.tsx` `fetchKarmaData` now reads the single canonical `GET /reputation/me/community-summary` (ADR-082) instead of recombining `getMyKarma` + `getTrustScore`; copy standardized on **Current Karma** / **Reputation Score**. Cross-user governance/nominee reads are identity-only (no other member's trust/karma). **Two-user validation 2026-06-25 (Playwright, live demo): PASS** — Maria 27/20, Aisha 0/27; each self-only and reconciled, no NaN.

---

## BUG-025 · [2026-06-25] · fixed (Sprint 113 PR A, validated 2026-06-25)

Stewardship section renders "trust NaN · NaN karma". Reputation values come through as NaN in the stewardship/governance UI — likely a frontend regression after S112 PR A (ADR-082) removed exact member reputation from outward contracts: a component still reads now-absent numeric fields and computes NaN instead of omitting them or showing a coarse label. Should render nothing / a qualitative label, never "NaN".

**Fixed (S113 PR A):** `GovernanceTab.tsx` (and all other readers grepped) no longer `Math.round(undefined)` now-omitted ADR-082 fields — eligible-members show a coarse qualitative label, role-holders show identity + role only, no `|| 0` fake zeros. **Validation 2026-06-25: PASS** — "Maria Elena Reyes · admin" renders with no trailing "trust NaN", no NaN anywhere.

---

## BUG-026 · [2026-06-25] · fixed (Sprint 113 PR A, validated 2026-06-25)

Cannot confirm BUG-024 is actually fixed — after the S112 PR A deploy, the profile page still appears to show the old reputation numbers for a community. The ADR-082 boundary (exact reputation self-only; surfaces reconciled) may not be fully wired on the profile frontend, or the demo is serving stale assets. Needs the two-user validation step: confirm a member's exact karma/trust is self-only AND that profile vs community surfaces reconcile (the original BUG-024 discrepancy). Until verified, do NOT mark BUG-024 fixed. Related: [[BUG-024]], BUG-025.

**Verified (S113 PR A):** the two-user Playwright validation against the live demo (2026-06-25) confirmed each user sees their OWN distinct reconciled numbers from the canonical self-summary (Maria 27/20, Aisha 0/27 — the exact ADR-082 example), canonical labels present, no NaN, no stale cross-user numbers. BUG-024 confirmed fixed. Related: [[BUG-024]], [[BUG-025]].

---

## BUG-027 · [2026-06-25] · fixed (Sprint 113 PR A, validated 2026-06-25)

Network/belonging maps have no zoom in/out controls. None of the network map surfaces (trust graph / belonging graph / community network views) expose zoom (or pinch/scroll-zoom) — the D3 HEB renderer seeds `__zoom` but zoom controls/affordances appear missing or non-functional in the deployed UI. Add visible zoom-in/out controls + wheel/pinch zoom across all network-map surfaces.

**Fixed (S113 PR A):** `GraphZoomControls` (in/out/reset) mount inside the single renderer `TrustGraphHEB`, gated by `enableZoom` (now default-on in the `BelongingGraph` wrapper) so every surface gets one control cluster, none double-mount. **Validation 2026-06-25: PASS** — clicking zoom-in drove `__zoom` scale 1 → 1.2, reset returned to 1.

---
## BUG-028 · [2026-07-03] · fixed (Sprint 118, ADR-085)

Offer-as-response relationship: the offer/context says two people are "connected" but the network graph can't find a direct path between them — the "connected" badge and the graph disagree. Looks off; likely a data/derivation mismatch between the relationship-context connection signal and the trust-graph path query (possibly surfaced by the Sprint 117 curated baseline). Investigate whether the connection shown for an offer response is backed by an actual trust-graph edge/path.

**Root cause (verified on the live curated demo, 2026-07-08):** the badge and the graph read
**different edge sources**. The badge path (`GET /paths/:targetUserId` → `computeTrustPath` →
`computeShortestPath`, `pathComputation.ts`) BFS-walks **all-time completed `requests.matches`**
(no decay, no liveness, no membership filter), then falls back to shared-community and
invitation-chain paths; results are cached 7 days in `auth.social_distances`. The graph
(`/trust/neighborhood` → `getTrustNeighborhood`, `trustEdgeDb.ts`) discloses only
`social_graph.trust_edges_live` (decay-adjusted view) with active-membership joins on both
endpoints. Demo evidence: **742 of 2103 completed-match pairs have NO trust-edge row at all**
(seeded matches bypassed the `match_completed` → `upsertTrustEdge` event flow), including
`maria.reyes ↔ priya.sharma` (1 completed match, no live edge) — badge says "Direct connection",
ego graph shows nothing. All 61 live cache rows are `community_member` fallbacks (2° "via admin"
paths with no trust edge behind them).

**Chosen fix layer — server, `computeShortestPath` (social-graph-service):** rebuild the exchange
BFS adjacency from `social_graph.trust_edges_live` (union across communities = still
platform-wide topology, ADR-077 preserved) with the same active-membership join the neighborhood
links query uses — the path derivation and the graph then substantiate "connected" from the same
edge set with the same liveness filter. Community/invitation fallbacks stay (they're worded
truthfully in `TrustPathBadge`: "Fellow member…" / "Joined through…"); the exchange trustScore
is still cached internally, but cached `exchange` rows are revalidated against the same live,
active-membership edge set before they can be returned; stale pre-fix rows are deleted and
recomputed, so the old completed-match derivation cannot survive behind the cache. `ConnectionBadge.tsx` (which mislabels every path type as
"Direct connection/Connected through…") is dead production code — only its own test imports it —
and is removed. Consumers inheriting the fix via `/paths/*`: OfferItem→TrustPathBadge,
RequestCard, providers/[id] (frontend `useTrustPath`); request-service feed ranker + dibs
(`/paths/batch`, `/paths/:id`); trust card (`computeTrustPath`).

---

## BUG-029 · [2026-07-09] · open

Request tile claims a person-to-person connection that is only shared community membership. On
`/requests/707137aa-f783-49b3-95ef-a4c8e30da831` the tile says "connected via Nadia Ito" while the
graph correctly shows no path between the viewer and the requester.

**Diagnosis (verified read-only on the live demo, 2026-07-09):** NOT a BUG-028 regression — the
S118 exchange derivation + cache revalidation are working. This is the **`community_member`
fallback** that S118 deliberately preserved: `computeCommunityPath` (`pathComputation.ts`)
**manufactures a 2° path through the community's earliest-joined admin**. Viewer Maria Reyes and
requester Destiny Baptiste share **Southeast PDX Helpers**, whose first admin is **Nadia Ito** →
cached row `community_member / 2°` → `TrustPathBadge` renders "Fellow member via Nadia Ito" (full)
and just "**via Nadia Ito**" (feed-compact) — which reads as a real person route. Nadia is not an
intermediary of anything; she was drafted into an invented path. This violates the ADR-083/085
principle the rest of S118 enforced: surfaces must not claim structure the data doesn't contain.

**Proposed fix layer — both ends, presentation-truthful:** (1) server `computeCommunityPath` stops
inserting the admin as a path node — return the two endpoints + `community_name` only (keep
`connection_type: 'community_member'`; decide whether `degrees` stays 2 for feed-ranking proximity
or becomes null — ranking impact); (2) frontend `TrustPathBadge` renders community_member as
"Fellow member of {community}" / "in {community}" with NO "via {person}" and no person-chain row.
Existing cached community_member rows become harmless once the renderer stops naming the admin.
Same review question applies to `computeInvitationPath` wording ("Joined through {inviter}" is
factual provenance — likely fine).

---
