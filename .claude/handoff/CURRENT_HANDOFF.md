# Sprint 79: Trust Graph Viz Polish + Depth — ✅ COMPLETE (v10.7.0), deploying

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
