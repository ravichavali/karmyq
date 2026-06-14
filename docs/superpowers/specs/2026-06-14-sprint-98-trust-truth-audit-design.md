# Sprint 98: Trust Truth Audit + Functional Repairs - Design Spec

**Date**: 2026-06-14
**Status**: Approved
**Version**: v11.6.0 -> v11.7.0
**Sprint Branch**: `feature/sprint-98-trust-truth-audit`

---

## Overview

Sprint 97 made the release demo path more truthful by repairing membership drift, dashboard
bootstrap timing, community pulse helper membership, and the widened feed terminal state. Sprint
98 continues that same reliability arc, but focuses on the platform's most important product
promise: trust paths and relationship graphs must be accurate enough that members can rely on
them.

The current suspicion is not one isolated rendering bug. Karmyq has several relationship surfaces:
the dashboard "Your Trust Network" widget, the community "How we're connected" tab, trust path
badges on request/provider/offer surfaces, dibs relationship reasons, social-graph path APIs,
request-service feed scoring, and older connection endpoints. These surfaces currently draw from
overlapping but not obviously identical data sources: `social_graph.trust_edges_live`,
`social_graph.connections`, `auth.social_distances`, community membership rows, completed matches,
shared provider communities, and invitation lineage.

This sprint is audit-first and functionality-first. It starts by proving where DB truth, API
responses, and UI claims agree or disagree on live/demo data. It then fixes the highest-risk
semantic and functional inconsistencies, with tests that assert exact relationship meaning. UI
polish is included only where the interface contradicts the data or makes normal flows look broken,
including the dashboard state that says "You're caught up" while also showing "Show more open
requests."

### Core Principle: Trust surfaces must not imply relationships the system cannot prove

Every graph, path badge, provider label, and dibs reason should be traceable to one explicit
relationship source and should carry the right community context.

---

## Multi-Sprint Arc

### Sprint 97 - Release Readiness Data Quality + Functional Bug Bash (complete, v11.6.0)
Fixed high-risk first-run demo bugs, repaired membership drift, and validated the rich tester path.

### Sprint 98 - Trust Truth Audit + Functional Repairs (this sprint, v11.7.0)
Audit live/demo trust data and reconcile trust paths, graphs, connection labels, and normal flows.

### Sprint 99+ - Relationship UX Polish or Founding-Circle Review (upcoming)
Depending on Sprint 98 findings: polish graph readability, add deeper relationship explanations, or
return to founding-circle notification/review tooling.

---

## Trust Surfaces In Scope

1. Dashboard "Your Trust Network" people graph.
2. Dashboard "Your Trust Network" communities graph.
3. Community "How we're connected" Community and My Network subtabs.
4. Trust path badges on feed request cards, offers, provider pages, and trust cards.
5. Dibs candidate reason copy and relationship context.
6. Request/feed relationship scoring inputs where visible copy depends on social proximity.
7. Provider directory shared-community labels.
8. Legacy `/network` and `socialGraphService.getNetwork()` usage audit.
9. Live demo data quality for trust edges, connections, path cache, membership, and completed
   matches.

---

## Named Bugs / Acceptance Items

### BUG-098-001 - Trust path community context can drift from the visible surface

**Observed risk:** `useTrustPath()` calls `socialGraphService.getTrustPath(targetUserId)` without a
community header. The social-graph route then falls back to `req.user.currentCommunityId` or
`platform`, while the UI may be rendering a specific community, provider page, feed scope, or offer.

**Why it matters:** A badge can say "connected through" based on a platform-wide or default
community context even when the visible surface is scoped to a different community.

**Acceptance:** Every visible trust path fetch either passes the active community context or
intentionally asks for a platform-wide path and labels it as such. Tests cover at least one
community-scoped feed/request surface and one provider/dibs surface.

### BUG-098-002 - Missing path community context can 500 before semantics are even reached

**Observed risk:** `/paths/:targetUserId` and `/paths/batch` fall back to the literal string
`platform` when neither `X-Community-ID` nor `req.user.currentCommunityId` exists. The cache query
then compares that value to `auth.social_distances.community_id`, a UUID column, which can throw a
UUID cast error and return 500 before path semantics are reached. Separately, once a valid
community ID exists, `computeShortestPath(source, target, communityId)` currently builds its
adjacency list from all completed matches, but later uses `communityId` for edge scoring and cache
keying.

**Why it matters:** A caller without explicit community context can fail outright. A caller with
context can still receive a platform-wide exchange path whose score/cache key appears
community-specific.

**Acceptance:** The sprint explicitly chooses and documents the path semantics:

- Missing community context never produces a UUID cast 500. The endpoint either uses a valid
  community context, returns a clear validation response, or deliberately runs a labeled
  platform-wide path that does not query UUID columns with the string `platform`.
- **Preferred:** exchange paths are community-scoped when a real community ID is supplied, with a
  labeled platform-wide fallback only when no community context exists.
- **Allowed only if deliberate:** platform-wide exchange paths remain valid, but API responses and
  UI copy label them as platform-wide, not community-local.

The chosen behavior has DB-backed tests with exact path assertions.

### BUG-098-003 - Graph APIs and UI claims may disagree about active membership

**Observed risk:** community full graphs read active members for nodes, while ego and aggregate graph
queries derive neighbors from trust edges and may not prove active membership on every endpoint. The
UI copy says "your first-degree network in this community" or "people you've built trust with across
your communities," which should match active membership and edge truth.

**Acceptance:** Audit proves whether graph nodes and edges are active members of the relevant
community context. If drift exists, graph endpoints filter or label it correctly. Tests assert node
and edge membership invariants for community ego, full community, and aggregate graphs.

### BUG-098-004 - Relationship labels use multiple sources of truth

**Observed risk:** provider shared-community labels, dibs reasons, trust badges, trust-card paths,
feed scoring, and graph widgets can all describe "connection" differently.

**Acceptance:** The sprint creates a concise relationship semantics table and updates code/docs so
visible labels use the correct term:

| Label | Meaning |
|---|---|
| Direct exchange connection | A completed help exchange path of degree 1. |
| Indirect exchange path | A completed help exchange path of degree 2 or 3. |
| Fellow community member | Shared active community membership without exchange proof. |
| Invitation connection | Accepted invitation lineage. |
| Shared provider/community context | Provider and viewer share active community membership. |

At least the highest-traffic UI surfaces use these terms consistently.

### BUG-098-005 - Dashboard caught-up state conflicts with "Show more open requests"

**Observed:** Dashboard Home can show "You're caught up" while also showing "Show more open
requests." The two states visually contradict each other and make the feed feel broken.

**Acceptance:** The feed chooses one coherent state:

- If lower-ranked open asks can be revealed, show "Show more open requests" without saying the user
  is fully caught up.
- If the user is genuinely caught up, do not show the "Show more open requests" affordance.
- After the user expands the feed, show one finite terminal state.

### BUG-098-006 - Legacy relationship endpoints may still be reachable but no longer authoritative

**Observed risk:** `/network` and `socialGraphService.getNetwork()` still exist even though dashboard
trust graph surfaces now use `/trust/graph`. Stale endpoints can confuse future contributors or
accidentally power new UI.

**Acceptance:** Audit all frontend/service references. Either confirm the endpoint is intentionally
legacy and document it, or retire unused frontend methods/routes in a safe follow-up if no active
consumer exists.

---

## Data Quality Audit

Sprint 98 begins with a repeatable trust audit script and bug log. The audit must answer:

- Are `social_graph.trust_edges` endpoints active members of the edge community?
- Are `social_graph.connections` rows consistent with completed matches?
- Are trust graph nodes and links returned by the APIs active members where the API claims community
  scope?
- Are cached `auth.social_distances` rows stale, malformed, expired, or missing community context?
- What do `/paths/:targetUserId` and `/paths/batch` do when no community context is supplied?
- Do platform-wide paths differ from community-scoped paths for rich tester flows?
- Do provider shared-community labels only name active shared communities?
- Do dibs candidates with `community_connection` truly share active community membership?
- Does the dashboard feed expose caught-up and "show more" at the same time?

Findings go in `docs/bugs/sprint-98-trust-truth-audit.md`. If data repair is required, the repair
must be idempotent and separately documented. Do not manually patch live data without a script.

---

## Data Model

No new product table is planned.

Potential repair scripts only:

```sql
-- Example invariant check: trust edges whose endpoints are not active members of their community.
SELECT te.community_id, te.user_id_a, te.user_id_b
FROM social_graph.trust_edges te
LEFT JOIN communities.members ma
  ON ma.community_id = te.community_id
 AND ma.user_id = te.user_id_a
 AND ma.status = 'active'
LEFT JOIN communities.members mb
  ON mb.community_id = te.community_id
 AND mb.user_id = te.user_id_b
 AND mb.status = 'active'
WHERE ma.id IS NULL OR mb.id IS NULL;
```

If the audit finds drift that should be repaired on demo data, create an idempotent SQL script under
`infrastructure/postgres/migrations/` or `scripts/` depending on whether it must run in deploy or is
demo-only. Schema changes are out of scope unless root-cause analysis proves the schema cannot
enforce the needed invariant.

---

## API Endpoints

No new endpoint is required by default. Modified or clarified behavior may touch:

| Method | Path | Service | Planned change |
|---|---|---|---|
| GET | `/paths/:targetUserId` | social-graph-service | Avoid UUID cast failures when context is absent; honor explicit `X-Community-ID` for community-scoped path semantics; clarify platform fallback. |
| POST | `/paths/batch` | social-graph-service | Match single-path semantics for missing context, community scope, and cache keying. |
| GET | `/trust-card/:targetUserId` | social-graph-service | Pass through or label the same path semantics used by `/paths`. |
| GET | `/trust/graph` | social-graph-service | Verify aggregate graph membership and decayed-weight invariants. |
| GET | `/trust/graph/:communityId` | social-graph-service | Verify ego graph returns active community members only, or labels intentional historical relationships. |
| GET | `/trust/graph/:communityId/full` | social-graph-service | Verify full community graph node/link invariants and decay metadata. |
| GET | `/requests/curated` | request-service | Ensure visible relationship/trust labels are consistent with the path semantics used by the frontend. |
| GET | `/requests/:id/dibs-candidate` | request-service | Ensure `reason` and `relationshipContext` labels match actual prior exchange or active shared-community truth. |
| GET | `/providers` | request-service | Ensure `shared_communities` only includes active shared communities. |

---

## Frontend Changes

- `apps/frontend/src/hooks/useTrustPath.ts`
  - Accept an optional `communityId` and pass it to social-graph requests as `X-Community-ID`.
  - Guard localStorage parsing so a corrupt user object cannot break relationship rendering.

- `apps/frontend/src/lib/api.ts`
  - Extend `socialGraphService.getTrustPath`, `getBatchTrustPaths`, and trust-card callers if
    needed to accept community context.

- `apps/frontend/src/components/Feed/RequestCard.tsx`
  - Pass the active community context to trust path fetches where available.
  - Use the approved relationship labels.

- `apps/frontend/src/components/requests/DibsPrompt.tsx`
  - Keep copy aligned with server reasons. "Community connection" must mean active shared community
    membership, not prior work.

- `apps/frontend/src/components/providers/ProviderCard.tsx` and provider detail pages
  - Ensure shared-community labels are not confused with exchange trust.

- `apps/frontend/src/components/Feed/UnifiedFeed.tsx`
  - Fix the caught-up/show-more contradiction and preserve the Sprint 97 widened-feed terminal
    state.

- `apps/frontend/src/components/dashboard/TrustNetworkWidget.tsx`,
  `apps/frontend/src/components/NetworkGraph.tsx`, `apps/frontend/src/components/community/tabs/TrustGraphTab.tsx`
  - Update copy only where endpoint semantics change or audit finds misleading text.

---

## User Guide & Doc Updates

Docs are mandatory this sprint.

- `docs/guides/trust-connections.md`
  - Define direct exchange, indirect exchange, fellow member, invitation connection, and provider
    shared-community context.

- `docs/guides/trust-graph.md`
  - Explain what the dashboard aggregate graph and community graph include and exclude.

- `docs/guides/dashboard-home.md`
  - Document coherent caught-up/show-more behavior.

- `docs/guides/demo-data.md`
  - Add Sprint 98 trust audit checks and how to run the audit script.

- `docs/features/SOCIAL_GRAPH_TRUST_PATHS.md`
  - Update if path semantics change or if platform-wide fallback is clarified.

- `services/social-graph-service/CONTEXT.md`
  - Record endpoint semantics and recent fixes.

- `services/request-service/CONTEXT.md`
  - Record any feed/dibs/provider relationship behavior changes.

- `apps/frontend/CONTEXT.md`
  - Record frontend trust path context and feed-state fixes.

- Generated landing docs under `apps/landing/src/data/docs/`
  - Regenerate from source docs and force-add changed generated JSON.

No ADR is required unless the sprint changes the canonical relationship architecture. If needed,
the next ADR number is 077.

---

## Critical Implementation Notes

1. **Audit first.** Do not fix individual trust surfaces before running the DB/API/UI trust audit.
   The likely problem is semantic drift across layers, not one component typo.
2. **Find the root cause before fixing.** Use systematic debugging for each confirmed issue:
   reproduce, trace source data, compare working surfaces, then write the failing test.
3. **Community context is the main suspect.** Every path/badge/graph fix must answer whether the
   relationship is community-scoped or platform-wide and label it accordingly.
4. **Do not make client-side filters hide server truth.** If an API returns misleading relationship
   data, fix the API or explicitly document the historical/platform meaning.
5. **Use decayed trust consistently.** Graph node/edge trust metrics should read from
   `social_graph.trust_edges_live` unless a test proves a different metric is intentional.
6. **Active membership matters.** Any UI phrase that says "in this community" or "fellow member"
   must be backed by active `communities.members` rows.
7. **Cache invalidation matters.** `auth.social_distances` can preserve old path meaning. Include
   cache rows in the audit and clear/recompute only with an idempotent script if needed.
8. **Provider labels are not exchange trust.** Shared provider/community labels should not imply a
   completed help exchange unless the exchange path exists.
9. **Dashboard feed state must be coherent.** "You're caught up" and "Show more open requests"
   should not appear together as competing terminal states.
10. **Robust tests are required.** Prefer DB-backed tests for path and graph invariants. Mock only
   browser rendering and external services.
11. **Live demo validation is required.** Use `maria.reyes@test.karmyq.com` / `password123` as the
   rich tester unless the audit finds a better account.
12. **Version bump:** root `package.json` and `package-lock.json` move `11.6.0` -> `11.7.0`.

---

## Success Criteria

- A repeatable Sprint 98 trust audit exists and has been run against demo data.
- Confirmed relationship drift is fixed or explicitly documented as deferred with rationale.
- Trust path APIs, batch paths, trust-card paths, graph APIs, provider shared communities, and dibs
  relationship reasons agree with the relationship semantics table.
- Dashboard Home no longer shows "You're caught up" and "Show more open requests" together.
- Frontend trust path calls pass active community context where the UI is community-scoped.
- Robust tests cover the fixed DB/API/frontend invariants.
- Required docs, landing generated docs, contexts, and handoff are updated.
- `npm test`, `npm run test:tdd`, `npm run feedback:check`, type checks, audit, `/simplify`,
  `/code-review`, and `/security-review` complete before merge.
