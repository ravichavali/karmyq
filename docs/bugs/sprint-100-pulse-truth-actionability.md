# Sprint 100 — Pulse Truth + Feed Actionability — Live Audit Log

**Date:** 2026-06-15
**Branch:** `feature/sprint-100-pulse-truth-actionability`
**Method:** Read-only probes against the live demo DB (`karmyq-postgres` container on karmyq.com).

> This log freezes the fix list (exact files, exact decisions) confirmed against live data. All
> probes were read-only (or rolled back). See the plan/spec for the sprint framing.

---

## Communities under investigation (live state)

| ID | Name | type | status | active members |
|----|------|------|--------|----------------|
| `308f7192…ba52` | Excelsior Mutual Aid | mutual_aid | active | — |
| `eb32c151…20f4` | South San Francisco | mutual_aid | active | — |
| `446c2c65…39a4da` | Marin Mutual Aid | mutual_aid | **merged** | 144 |

---

## F1 — pulse "neighbours helped" raw vs distinct

Current 7-day, member-scoped window:

| community | raw match rows (`COUNT(*)`) | `COUNT(DISTINCT responder_id)` | named helpers (LIMIT 3) |
|-----------|------|------|------|
| `308f7192…` | 3 | 3 | 3 |
| `eb32c151…` | 1 | 1 | 1 |

**Finding:** No divergence *in the current 7-day window*, but [`requests.ts:1071`](../../services/request-service/src/routes/requests.ts) computes `exchanges_completed_week` as `COUNT(*)` over `requests.matches` — wrong **by construction**: a single responder with multiple completed matches in the window inflates the headline above the named-helper list. **Fix is correctness/preventive** (the maintainer's report captured a window where it diverged).
**Decision:** `COUNT(*)` → `COUNT(DISTINCT m.responder_id)` over the identical member-scoped, completed-in-7-days subset that feeds `recentHelpers`.

**Other surfaces traced (multi-surface discipline):** `respondCommunityFeed` (the in-feed `ActivityCard`) already reuses `fetchCommunityPulse` → single fix covers both surfaces. `services/request-service/src/services/feed/feedComposer.ts:175` (`FeedComposer.exchanges_week`) has the same raw-rows shape (`COUNT(DISTINCT m.id)`) **but is dead code**: it is imported only by its own regression test (live feed routes use `SocialKarmaFeedComposer`), and its stats query joins on `r.community_id` — a column that does not exist on `requests.help_requests` — so it could never run. Left untouched (out of scope; pre-existing broken legacy path).

---

## F1 (connection half) / ADR-078 — counted exchanges show no connection

All-time completed matches vs. recorded relationships:

| community | completed matches | with `social_graph.connections` row | with per-community `trust_edges` row |
|-----------|------|------|------|
| `308f7192…` | 9 | 7 (**2 missing**) | **0** |
| `eb32c151…` | 9 | 6 (**3 missing**) | **0** |

Global: `social_graph.trust_edges` = **776 rows total**, but **0** for either of these communities. `social_graph.connections` = 346 rows total.

**Root cause:** [`subscriber.ts:45-50`](../../services/social-graph-service/src/events/subscriber.ts) only creates a per-community trust edge when the `match_completed` **payload** carries `community_id` — and the publisher ([`matches.ts:616`](../../services/request-service/src/routes/matches.ts)) **does not** include `community_id` in the payload. So the community trust edge essentially never forms. The `connections` upsert runs unconditionally, but a handful are still missing (early/failed events).

**Decisions (ADR-078):**
1. In the subscriber, derive the request's communities from `requests.request_communities` (the payload **does** carry `request_id`) and call `processMatchCompleted` for **each** community — independent of the payload's `community_id`.
2. Backfill historical gaps with an **idempotent script** (`scripts/backfill-community-connections.sql`): per completed match, ensure the `connections` row + a per-community `trust_edges` row for each `request_communities` community. Print BEFORE/AFTER counts.

**Backfill dry-run (2026-06-15, rolled back against live data):**

| metric | BEFORE | AFTER (dry-run) | delta |
|--------|--------|-----------------|-------|
| `social_graph.connections` | 346 | 603 | **+257** |
| `social_graph.trust_edges` | 776 | 1404 | **+628** |

Sanity: there are 603 distinct completed (requester,responder) pairs → connections lands at exactly 603 (every completed pair now has a connection). Expected per-community edges = 692; 628 inserted (64 already existed). Second run inserts 0 (idempotent). Run **post-deploy** (Task 15), recording the real committed deltas.

---

## F2 — "N open asks" reachability

`308f7192…` has exactly **1** open + unexpired ask: "Need a quiet place to study for my GED…" by requester `94b90c35…`, **0 pending offers** (genuinely fillable, not the member's own, not already-offered). The maintainer's feed still didn't surface it (feed applies viewer-specific filters).

**Decision:** Keep the community-wide count; soften copy to "**N open asks across the community**"; make the pulse open-asks row navigate to a **reachable read-only** community-wide open-asks view (own + offered rendered read-only, no Offer button). Backend: add an `includeAll` read-only mode to the **`/requests/curated`** path (the one `UnifiedFeed` calls via `getCuratedRequests`), not `/requests/feed`. Trace `queryBuilder.ts` + the curated handler.

---

## G1 — proposed matches never surface on Home

Maria Elena Reyes (`c5b0ba91…`, `maria.reyes@test.karmyq.com`) responder-match counts:

| status | count |
|--------|------|
| **proposed** | **336** |
| rejected | 80 |
| completed | 19 |

**330 of the 336 proposed** matches are on requests that are still `open` + unexpired → **actionable but invisible**. This is why established members' Home reads empty.

**Decision (contained):** Surface a responder's outstanding `proposed` matches as actionable items on Home/Helping (a "you offered to help" band). Trace ALL feed/query surfaces before patching. If full surfacing exceeds contained scope, ship the contained band + document the remainder as an S101 follow-up.

---

## G2 / BUG-010 — community split fails on `446c2c65…`

**Reproduced (root-caused, not blind).** Live state: community 446c2c65 has **two** historical proposals — one `executed` (2026-06-01) and one `approved` (2026-06-08, never executed). Schema has `UNIQUE INDEX split_proposals_community_id_status_key ON (community_id, status)`.

- A *new* proposal insert (default `status='discussion'`) **succeeds** (rolled-back repro confirmed) — creation is not the failure.
- The failure is **execute**: [`fissionService.ts:261-266`](../../services/community-service/src/services/fissionService.ts) sets the proposal `status='executed'`. Because an `executed` row **already exists** for this community (from the 06-01 split), this creates a second `(446c2c65, 'executed')` row → **`23505` unique-constraint violation** → `ROLLBACK` → route returns **500 "Failed to execute split."** A community can therefore only ever be split **once**.

**Decision:** Replace the over-strict full unique index with a **partial** unique index that guards only *active* proposals: `UNIQUE (community_id) WHERE status NOT IN ('executed','rejected')`. This still prevents two concurrent in-flight proposals (preserves the create 409) and aligns with `getActiveSplitProposal`'s existing `status NOT IN ('executed','rejected')` predicate, while allowing a community to split again after a prior split/merge. **Schema change → migration** (`infrastructure/postgres/migrations/20260615-split-proposal-active-unique.sql`) + DB-backed regression test reproducing the second-execute collision (`services/community-service/tests/tdd/sprint-100-split-reexecute.test.ts`).

**Migration dry-run (2026-06-15, rolled back against live data):** `DROP CONSTRAINT` + `CREATE UNIQUE INDEX … WHERE status NOT IN ('executed','rejected')` both apply cleanly. Pre-check confirmed **0 communities have 2+ active proposals**, so the partial index builds without violation. After deploy, the stuck `approved` proposal on 446c2c65 (06-08) becomes executable again.

---

## G3 — simulation pace / liveliness

Config: [`services/simulation-service/src/config/default.json`](../../services/simulation-service/src/config/default.json).

Knobs identified:
- `workers.count` = 10 → raise for more concurrent activity.
- `workers.delayMs` = `{min:5000, max:30000}` → lower to quicken pace.
- `growth.newUsersPerDay` = 5; `users.total`/`growth.maxUsers` = 500.
- Spread of *who* creates requests is governed by the worker→user assignment in the orchestrator + `request-workflow.ts` (not a single config field).

**Finding:** `getRandomUser()` already selects `ORDER BY RANDOM()` over the **full** actor pool (`SIM_ACTOR_POOL_FILTER` = every `@test.karmyq.com` user, ~500) — so actor selection is already uniform; the historical clustering on early users was a pre-S87 data artifact, not a current selection bias. The actionable lever is therefore **pace**, not spread.

**Decision (applied):** Bounded pace tuning in `default.json`: `workers.count` 10 → **16**, `workers.delayMs` `{5000,30000}` → **`{2500,12000}`** (≈3–4× more actions/min; still ≥ `rateLimit.minDelayMs` 2000). No schema change; growth/maxUsers left at 500. Post-deploy: sample 3+ accounts to confirm distributed activity.

---

## Frozen fix list

| # | Layer / file | Change | Task |
|---|------|--------|------|
| F1a | `request-service/src/routes/requests.ts` | `exchanges_completed_week` → `COUNT(DISTINCT m.responder_id)` | 3 |
| F1b | `social-graph-service/src/events/subscriber.ts` | Derive communities from `request_communities`; per-community `processMatchCompleted` (ADR-078) | 4 |
| F1c | `scripts/backfill-community-connections.sql` | Idempotent backfill, before/after counts (NOT a migration) | 5 |
| F2 | `request-service` curated path + `queryBuilder.ts`; `CommunityPulse.tsx`; `UnifiedFeed.tsx` | `includeAll` read-only open-asks mode; pulse row → link; "across the community" copy | 6 |
| F3 | `UnifiedFeed.tsx`; `workflows.ts` | Collapse empty state to single "You're caught up"; drop Show-more | 7 |
| F4 | `RequestCard.tsx` | Clickable body → `/requests/[id]`; stopPropagation on Offer + inner links | 7 |
| F5 | `RequestCard.tsx` | Asker avatar `aria-label`/`title` "Asked by {name}" | 7 |
| G1 | feed/Home surface (request-service decisions + `Feed/*`) | Surface outstanding `proposed` matches as actionable Home/Helping band | 8 |
| G2 | **migration** + `fissionService`/`splits` regression test | Partial unique index `(community_id) WHERE status NOT IN ('executed','rejected')` | 9 |
| G3 | `simulation-service` config + workflows | Raise pace, spread requests across users | 10 |

**Out of scope (confirmed):** Withdraw-Offer (already fixed); broad UI facelift; karma/trust unification; governance/fission redesign.

---

## Test coverage note (Task 12)

The end-to-end "completed match → distinct pulse count + visible connection" flow is covered by the
two **service-level** DB-backed tests rather than a single cross-service root test:
- `services/request-service/tests/tdd/sprint-100-pulse-truth.test.ts` — distinct-helper count + open-asks reachability.
- `services/social-graph-service/tests/tdd/sprint-100-connection-reconcile.test.ts` — completed match → connection + per-community trust edge (no payload `community_id`).
- `services/community-service/tests/tdd/sprint-100-split-reexecute.test.ts` — BUG-010 active-only uniqueness.
- Frontend: `sprint-100-empty-state`, `sprint-100-request-card-clickable`, `sprint-100-g1-offered-band` (all green locally).

A single cross-workspace root `tests/tdd/` test was deliberately **not** added: per
[[feedback_turbo_cache_cross_workspace_test]], cross-workspace tests read files in other workspaces
that turbo doesn't track, causing stale local cache passes while CI fails — and they break on file
moves. Keeping each invariant in its owning workspace is the more robust coverage. The live audit +
rolled-back dry-runs validated the end-to-end behaviour on real data.
