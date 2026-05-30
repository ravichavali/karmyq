# Sprint 74: Trust Graph Foundation — Ready to Execute

## Handoff Document

**Date**: 2026-05-29
**Current Version**: v10.2.0 (on master)
**Target Version**: v10.3.0
**Status**: Sprint 74 spec + plan written. Ready to execute.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-74-trust-graph-foundation`
3. Open plan: `docs/superpowers/plans/2026-05-29-sprint-74-trust-graph-foundation.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

---

## Sprint Goal

Make trust graphs actually useful: replace the click-heavy ego-network with a **full community graph** (all members + edges, visible at once) and a smarter ego-view that pre-loads 2 degrees without clicking. Edge thickness and opacity encode connection strength. Amber highlights show the current user's connections in the community network.

---

## Multi-Sprint Trust Graph + Governance Arc

| Sprint | Focus | Status |
|--------|-------|--------|
| **72** | Simulation Engine | ✅ Complete + deployed |
| **73** | Request Service | ✅ Complete + deployed |
| **74** | Trust Graph Foundation | ⬅ This sprint |
| **75** | Trust Graph Depth (inter-community zoom, fission edge differentiation) | Upcoming |
| **76** | Community / Governance Polish | Upcoming |

---

## Spec + Plan

- **Design spec**: `docs/superpowers/specs/2026-05-29-sprint-74-trust-graph-foundation-design.md`
- **Implementation plan**: `docs/superpowers/plans/2026-05-29-sprint-74-trust-graph-foundation.md`

---

## What This Sprint Ships

### Backend (social-graph-service)
- New function `getFullCommunityGraph(communityId, callingUserId)` in `trustEdgeDb.ts`
  - Top 149 members by trust score + calling user always included (UNION)
  - All edges between those members from `trust_edges_live`
- New route `GET /trust/graph/:communityId/full` (registered BEFORE `/:communityId` — see gotcha #1)

### Frontend
- `TrustGraph.tsx`: new `'community'` mode, edge width/opacity driven by `effective_weight`, amber highlight for edges touching current user, node sizing by trust score, 600px+ container height
- `TrustGraphTab.tsx`: two sub-tabs — **Community** (full graph, no clicking) and **My Network** (ego, 2-degree pre-load)
- `NetworkGraph.tsx`: screen space improvements

### Docs
- Trust graph user guide (landing)
- Trust graph concept page update (landing)
- social-graph-service CONTEXT.md + registry.json

### Version
- 10.2.0 → 10.3.0

---

## ⚠️ Critical Implementation Notes

1. **Route order matters**: Register `GET /trust/graph/:communityId/full` BEFORE `GET /trust/graph/:communityId`. Express matches params greedily — "full" will be treated as a communityId if registered second. **This will silently break both routes.**

2. **trust_edges_live is a VIEW**: Never INSERT or UPDATE it. Write to `trust_edges`, read from `trust_edges_live` (which applies time decay via `current_weight`).

3. **Calling user always included**: The 150-node cap is `top 149 by trust_score UNION calling_user_uuid`. Do not drop the UNION.

4. **Edge weight normalization is client-side**: `maxEffectiveWeight = Math.max(...links.map(l => l.effective_weight))`. Compute from response payload, not a fixed constant.

5. **react-force-graph-2d APIs**: `linkColor`, `linkWidth`, `nodeVal`, `nodeColor` are all function props. When checking source/target IDs from links, after simulation runs they become objects — always extract: `typeof link.source === 'object' ? link.source.id : link.source`.

6. **Landing docs gitignored**: `apps/landing/src/data/docs/` — always `git add -f` those files.

7. **nav.json revert bug**: New guide slugs must be added to `GUIDE_ORDER`, `GUIDE_LABELS`, `GUIDE_SLUGS` in `scripts/generate-docs.ts`. Run `npm run generate-docs` from `apps/landing/`, not root. Grep-verify after running.

---

## Pre-Existing TDD Failures (do NOT fix)

These were failing before Sprint 73 and should remain untouched:
- `sprint-39-provider-ux` (7 fail)
- `sprint-43-feed-ranking` (crashes)
- `admin-schemas-api.test.ts` (request-service)
- `sprint-68-halflife` (6 DB connection tests)
- `sprint-67-governance` (DB connection tests)
- `social-graph-service/tests/tdd/sprint-66-trust-graph-visualization.test.ts`
- `social-graph-service/tests/tdd/sprint-67-ego-network.test.ts`
- `social-graph-service/tests/tdd/sprint-68-halflife.test.ts`

---

## Architecture Gotchas (Persistent)

- **Landing page docs**: `apps/landing/src/data/docs/` is in `.gitignore` — always `git add -f`
- **ADR numbering**: Next ADR is **059**
- **ADR-057 and ADR-058**: Already `implemented` in both source `.md` and landing `.json`
- **TDD test placement**: Social graph service tests in `services/social-graph-service/tests/tdd/`
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`
- **`git add` on CLAUDE.md**: Tracked as lowercase `claude.md` — always `git add claude.md`
- **Solo dev — no worktrees**: Work directly on feature branches
- **nav.json revert bug**: `generate-docs.ts` regenerates nav.json — always add new slugs to GUIDE_ORDER + GUIDE_LABELS + GUIDE_SLUGS in `scripts/generate-docs.ts`; run generate-docs from `apps/landing/` (`npm run generate-docs`), not root
- **trust_edges_live is a VIEW**: Never INSERT/UPDATE it. Use `trust_edges` for writes, `trust_edges_live` for reads
- **API response unwrap**: `createApiClient` interceptor already unwraps envelope — use `res.data`, not `res.data.data`
- **trust_edges normalized constraint**: `social_graph.trust_edges` requires `user_id_a::text < user_id_b::text` — always sort
- **community_links UNIQUE**: fusion_origin links must be (merged↔A) and (merged↔B), NOT (A↔B)
- **Root package.json version**: 10.2.0 (→ 10.3.0 this sprint)
