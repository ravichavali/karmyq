# Sprint 79: Trust Graph Viz Polish + Depth — ✅ COMPLETE (v10.7.0), deploying

## Update — 2026-06-01 (Codex follow-up, ready for Claude PR review)

Implemented a focused frontend reliability/UX hardening pass (post-Sprint-79) with no backend/schema changes:

- `apps/frontend/src/pages/dashboard.tsx`
  - Fixed auth bootstrap edge case that could cause infinite loading when `token` exists but `user` storage is missing/corrupt.
  - Added guarded parse + missing-id handling; clears stale auth storage and redirects to `/login`.
- `apps/frontend/src/components/Layout.tsx`
  - Guarded `localStorage.user` parsing with try/catch to avoid runtime crashes on malformed storage.
- `apps/frontend/src/components/RequestWizard.tsx`
  - Added draft-protection on backdrop/X close via confirm dialog to prevent accidental data loss.
- `apps/frontend/src/components/TabBar.tsx`
  - Normalized label from `Active` → `Helping` (desktop + mobile) for taxonomy consistency.
- `apps/frontend/CONTEXT.md`
  - Updated with Sprint 80 reliability hardening notes.

Validation run:
- `apps/frontend`: `npx tsc --noEmit` ✅
- `apps/frontend`: `npm run test:unit` ✅ (46 tests passed)

No commits made in this session; changes are working-tree only for Claude-led PR review.

## Sprint 81 — SSE auth hardening (PR #42) ✅ merged to master (2026-06-01)

PR #42 (`codex/step1-sse-auth-hardening`) closed the unauthenticated notification SSE
hole: `/notifications/stream` now requires a JWT (header **or** `access_token` query
param for browser `EventSource`), identity is derived from the token, and the legacy
`/notifications/stream/:userId` route 403s on path/token mismatch. Reviewed over three
rounds; backend (5) + frontend (2) tests pass; merged.

Final polish added before merge (strict checklist alignment):
- Backend: deduped verifier logic by exporting/reusing `verifyTokenWithRotation` from shared middleware.
- Backend: removed redundant router-level `/stream/:userId` registration.
- Backend tests: `services/notification-service/tests/tdd/sprint-81-sse-auth.test.ts` (5 passing).
- Frontend test: `apps/frontend/tests/unit/sprint-81-notification-sse-wiring.test.tsx` (2 passing) covering:
  - token-present path opens EventSource using token-based stream URL
  - token-missing path does not attempt SSE connect

**Residual risk to carry forward (not a blocker, do NOT lose this):**
- **JWT-in-URL exposure.** Because browser `EventSource` can't set headers, the access
  token rides in the query string and therefore lands in **nginx access logs**, proxy
  logs, and `Referer` headers. Two follow-ups:
  1. **Scrub `access_token` from nginx access logs** for the `/notifications/stream`
     location (e.g. `map`/`set` to mask the query arg before `log_format`). Coordinate
     with the nginx deploy step ([infrastructure/nginx/nginx.conf](infrastructure/nginx/nginx.conf)) — changes only take effect on deploy.
  2. **Keep access tokens short-lived** so a leaked URL token has a small blast radius.
- Backend SSE auth tests currently sit in `tdd/` — promote to a blocking tier
  (`regression/`) once they've ridden a few green runs, since they lock a security contract.

## Sprint 82 — Product taxonomy consistency (PR #43) ✅ merged to master (2026-06-01)

Completed label/deep-link consistency pass across web + mobile nav surfaces:

- Web
  - `Track in Active tab` → `Track in Helping tab` in `BrowseFeed`.
  - `My Requests` heading/button language → `Asks` / `+ New Ask` in `MyRequestsTab`.
  - Dibs completion CTA `View My Requests` → `View My Asks`.
  - Updated related TDD assertion wording (`sprint-63-ux-coherence`).
- Mobile
  - Tab titles updated in `apps/mobile/app/(tabs)/_layout.tsx`:
    - `Feed` → `Browse`
    - `Requests` → `Asks`
    - `Profile` → `Me`
- Docs
  - Updated `apps/frontend/CONTEXT.md` tab taxonomy and architecture notes to match current IDs/labels.

Validation:
- `apps/frontend`: `npx tsc --noEmit` ✅
- `apps/frontend`: `npm run test:unit` ✅ (60 passing)

### PR #43 polish follow-up (included before merge, 2026-06-01)
- Fixed a stale docs string in `apps/frontend/CONTEXT.md`:
  - `Browse + Commitments only` → `Browse + Helping only`
- Aligned mobile filter copy in `apps/mobile/app/(tabs)/requests.tsx`:
  - `My Requests` → `My Asks`
- Re-ran frontend gates:
  - `npx tsc --noEmit` ✅
  - `npm run test:unit` ✅ (60 passing)

## Next Sprint Recommendation — Step 3 UX expert pass

Goal: run a focused usability sprint across the primary dashboard flow and ship small, high-impact UX improvements with tests/docs.

Scope:
- Audit: `Dashboard` → `Browse` → `Helping`/`Asks` → `RequestWizard`.
- Fix 2-3 low-risk UX issues (copy clarity, empty/loading/error states, mobile spacing/tap targets).
- Add/adjust unit tests for any new conditional UX behavior.
- Update `apps/frontend/CONTEXT.md` and this handoff with outcomes.

Acceptance checks:
- `apps/frontend`: `npx tsc --noEmit` passes.
- `apps/frontend`: `npm run test:unit` passes.
- UX changes verified on desktop and mobile viewport in local run.

## Step 3 UX pass — in progress (2026-06-01)

Implemented (web frontend):
- `dashboard.tsx`: community fetch failures now show an inline actionable banner with `Retry` instead of console-only feedback.
- `RequestWizard.tsx`: improved control accessibility and usability:
  - `type="button"` on non-submit controls
  - `aria-pressed` on urgency chips
  - `aria-expanded` + `aria-controls` on community scope toggle
  - added helper copy under Description for better request quality

Test coverage added:
- `apps/frontend/tests/unit/sprint-80-dashboard-bootstrap.test.tsx`
  - failed community load shows retry banner; retry re-calls API
- `apps/frontend/tests/unit/sprint-80-request-wizard-draft.test.tsx`
  - urgency/community controls expose expected accessibility state

## Handoff Document

**Date**: 2026-05-31
**Current Version**: **v10.7.0 — Sprint 79 complete**, merging to master + deploying via CI/CD.
**Status**: ✅ All 13 plan tasks done. Backend decayed-metric swap (3 fns) + new `GET /trust/communities` depth endpoint; frontend unified on D3 HEB with `ego` mode + uniform node sizing; radial (Cytoscape) + force-graph (react-force-graph) retired and deps removed; dashboard "Your Network" now People/Communities toggle (`TrustNetworkWidget`). Shared `useLazyGraphData` hook extracted. ADR-063 + user guide + concept page + landing docs shipped. All gates green: tsc (FE+BE), `npm test` 27/27, sprint-79 TDD 6/6, `npm audit` 0 vulns, feedback:check clean; /simplify, /code-review, /security-review run (no high/medium findings).

### Verified this session
- Decayed node metric: `SUM(current_weight)` from `trust_edges_live` in getTrustGraph / getTrustGraphAggregate / getTrustGraphAggregateForCenter (matches getFullCommunityGraph).
- `getCommunityDepthGraph(callingUserId)`: seed = caller's active communities; reachable = seed ∪ organic-edge neighbors ∪ fission parents/children; organic + fission link queries parallelized; scoped (no global enumeration).
- Deps removed from apps/frontend/package.json: cytoscape, cytoscape-cola, react-cytoscapejs, react-force-graph-2d.

### Deferred (noted by /simplify, not blocking)
- `getTrustGraphAggregateForCenter` + the `center?` param chain are now orphaned (click-to-recenter/expand removed). Safe to delete in a follow-up cleanup; left in place this sprint (named metric-fix target + has a passing test).
- `TrustGraph.tsx` dispatcher is now a thin pass-through to HEB; could be inlined at its callers later.

---

## Quick Start (next sprint)

1. Read this handoff — Sprint 79 is shipped; pick the next sprint or the deferred cleanup above.
2. Plan/spec for this sprint: `docs/superpowers/plans/2026-05-31-sprint-79-trust-graph-viz-polish.md`

---

## Sprint Goal

Unify all trust-graph relationship views onto one clustered, structure-revealing HEB style with **uniform node sizing**, make the trust metric **consistently decayed** (`current_weight`) platform-wide, and add an **inter-community depth view** (communities as nodes, fission lineage differentiated from organic ties) — shipping **v10.7.0**.

---

## Spec + Plan

- **Design spec**: `docs/superpowers/specs/2026-05-31-sprint-79-trust-graph-viz-polish-design.md`
- **Implementation plan**: `docs/superpowers/plans/2026-05-31-sprint-79-trust-graph-viz-polish.md`

---

## The three phases (confirmed scope)

1. **Phase 1 — Ego-view rework (primary).** Retire the radial (Cytoscape `TrustGraphRadial`, "My Network") and force-directed (`NetworkGraph`, dashboard "Your Network") views; render both via the existing D3 HEB component with a new `ego` mode. **Uniform node sizing applied to ALL views** (Community + Split too) — only the current user is enlarged + white-ringed. Cluster color + amber-your-edges.
2. **Phase 2 — Metric consistency (folded in).** `getTrustGraph`, `getTrustGraphAggregate`, `getTrustGraphAggregateForCenter` node `trust_score` → `SUM(current_weight)` from `trust_edges_live` (decayed). `getFullCommunityGraph` already does this — match it.
3. **Phase 3 — Inter-community depth (full).** New `GET /trust/communities` + `CommunityDepthGraph.tsx`: communities as nodes, **organic** edges (from `community_trust_edges`, solid) vs **fission** edges (parent→child from executed `split_proposals`, dashed/differentiated). People/Communities toggle on the dashboard.

### Confirmed planning decisions
- **Uniform sizing**: ALL HEB views (global), not just ego.
- **Dashboard "Your Network"**: drop click-to-expand; static clustered view.
- **Phase 3**: full — view + fission-edge differentiation.
- **No schema changes** — every input table already exists.
- **Version**: 10.6.2 → 10.7.0.

---

## Current code map (verified this session)

| View | Component | Today | Target |
|------|-----------|-------|--------|
| Community | `TrustGraphHEB` mode=community | HEB clustered, decayed metric, size=trust | uniform size |
| Split/Fission | `TrustGraphHEB` mode=fission | HEB clustered | uniform size |
| My Network | `TrustGraphRadial` (Cytoscape concentric) | undecayed, double-encoded | **→ HEB ego** |
| Your Network | `NetworkGraph` (react-force-graph) | undecayed, hairball, expandable | **→ static HEB ego** |
| Communities (new) | — | — | **CommunityDepthGraph** |

- Backend graph fns: `services/social-graph-service/src/database/trustEdgeDb.ts`
- Routes: `services/social-graph-service/src/routes/trustGraph.ts`
- Fission lineage: `communities.split_proposals` (`child_community_a_id`, `child_community_b_id`, `status='executed'`)
- Organic inter-community: `social_graph.community_trust_edges` (upserted by `processMatchCompleted`)

---

## ⚠️ Critical Implementation Notes (copied from spec)

1. **Metric fix is decayed, everywhere.** Swap node `trust_score` from `SUM(raw_weight)` on `trust_edges` to `SUM(current_weight)` on `trust_edges_live` in the three ego fns. Only the **node** aggregate is wrong; edges already use `current_weight`.
2. **Uniform sizing is global** — Community + Split too. `nodeRadius` → constant; current user `+N` and white-ringed. Verify the "land well" views don't regress.
3. **HEB ego mode ≈ community mode visually** — reuse the community palette (`#818cf8`/slate clusters, `#fb923c` your edges, emerald current-user + white ring). No new palette.
4. **Dashboard "Your Network" loses expansion** — remove `handleExpandNode`, `expandedNodes`, `mergeGraphData`, center-expansion. Keep IntersectionObserver lazy-load.
5. **No schema changes.** Fission edges from `split_proposals` (executed); organic from `community_trust_edges`.
6. **`community_trust_edges` may be sparse** — few organic edges is expected; fission is the denser signal.
7. **`community_trust_normalized` CHECK** (`a::text < b::text`) — organic pairs undirected; fission edges directed (parent→child). Keep separate, tag `type`.
8. **trust_edges_live is a VIEW** — read-only.
9. **JWT field is `communities`**, never `communityMemberships`.
10. **Schema is `communities.communities` / `communities.split_proposals`** (plural).
11. **Landing docs gitignored** — `git add -f`; run `generate-docs` from `apps/landing/`; nav.json reverts — grep-verify + re-apply.
12. **Version 10.6.2 → 10.7.0** — update the `v10-polish` version-invariant test if it pins the number (broke before, commit `d8342be`).
13. **`react-cytoscapejs`/`react-force-graph` removal is conditional** — grep for other importers before dropping deps.

---

## Multi-Sprint Arc

| Sprint | Focus | Status |
|--------|-------|--------|
| **74** | Trust Graph Foundation (HEB + radial) | ✅ Complete + deployed |
| **77** | Community De-duplication (ADR-062) | ✅ Complete + deployed (v10.6.0) |
| **78** | Autonomous Fission (propose→vote→execute) | ✅ Complete + deployed (v10.6.2) |
| **79** | **Trust Graph Viz Polish + Depth** | 📋 Ready to execute (v10.7.0) |
| **TBD** | Supply-Chain Hardening remainder (ADR-061 items 4–5; Socket App; log sanitization) | Backlog |
| **TBD** | **Express 4 → 5 migration** (all 11 services) | Backlog — do as a deliberate sprint, NOT a Dependabot auto-merge |

> **Express 5 upgrade (why it's its own sprint):** On 2026-06-01, Dependabot's grouped
> `production-deps` PR (#26) silently bundled a major Express `4.22.2 → 5.2.1` bump (+ `@types/express`
> 4→5, `express-rate-limit` 7→8). It passed PR CI on Turbo's build cache but broke the backend build
> on master (cache-cold) — `notification-service` alone threw 8× `TS2345` where `req.params`/`req.query`
> are now `string | string[]`. Reverted in `ebf67b5`. Express 5 is a real migration: stricter request
> typing (coerce params to `string`), changed route-matching syntax (`:param`/`*`/optional `?`),
> immutable `req.query`, removed methods (`res.json(obj,status)`, `app.del`, `req.param()`). Plan it as
> a dedicated sprint across all 11 services with full integration testing. Dependabot is now configured
> (PR #29) to keep majors out of groups so this surfaces as its own labeled PR next time.

---

## Carry-forward from Sprint 78 (context, not this sprint's work)

- **Fission strands activity (decided: let the sim repopulate)**: `executeSplit` copies members into children but does NOT migrate community-scoped activity (requests, trust edges, karma) — those stay on the `status='split'` parent. Decision (2026-05-31): do NOT migrate; the sim repopulates organic children. *Relevance to Sprint 79:* the depth view's fission edges come from `split_proposals` lineage, not from migrated activity — unaffected.
- **Autonomous fission loop** is live end-to-end (propose at `current_members>=140` → vote → execute). Future over-cap communities self-split.

---

## Pre-Existing TDD Failures (do NOT fix)

Untouched, pre-date this sprint:
- `sprint-39-provider-ux` (7 fail)
- `sprint-43-feed-ranking` (crashes)
- `admin-schemas-api.test.ts` (request-service)
- `sprint-68-halflife` (6 DB connection tests)
- `sprint-67-governance` (DB connection tests)
- `social-graph-service/tests/tdd/sprint-66-trust-graph-visualization.test.ts`
- `social-graph-service/tests/tdd/sprint-67-ego-network.test.ts`
- `social-graph-service/tests/tdd/sprint-68-halflife.test.ts`

A NEW failure during this sprint is a real regression — resolve it, don't wave it off as pre-existing.

---

## Architecture Gotchas (Persistent)

- **Landing page docs**: `apps/landing/src/data/docs/` is in `.gitignore` — always `git add -f`
- **nav.json revert bug**: `generate-docs.ts` regenerates nav.json — run from `apps/landing/` (`npm run generate-docs`), not root; grep-verify after; re-apply if reverted
- **ADR numbering**: 059 = dependency gate, 060 = code-scanning gate, 061 = supply-chain hardening, 062 = community identity/idempotent creation. **063 = canonical trust metric + unified graph visualization (this sprint).**
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`
- **Schema is `communities.communities`** (plural schema name) — older comments saying `community.*` are stale
- **`git add` on CLAUDE.md**: tracked as lowercase `claude.md` — always `git add claude.md`
- **Solo dev — no worktrees**: work directly on feature branches
- **API response unwrap**: `createApiClient` interceptor already unwraps envelope — use `res.data`, not `res.data.data`
- **trust_edges_live is a VIEW**: never INSERT/UPDATE it. Write `trust_edges`, read `trust_edges_live`
- **Root package.json version**: 10.6.2 (→ 10.7.0 this sprint)
- **Migration-validator agent** exists — N/A this sprint (no migration)
- **CI security gates**: dependency audit (ADR-059, blocking `--audit-level=high`) + CodeQL code-scanning gate (ADR-060) run automatically on push
