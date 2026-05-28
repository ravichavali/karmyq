# Sprint 71: v10.0 Polish + karmyq.org Update

## Handoff Document

**Date**: 2026-05-28
**Current Version**: v9.95.0 → v10.0.0 (target)
**Status**: Sprint 71 planned, ready to execute.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-71-v10-polish`
3. Open plan: `docs/superpowers/plans/2026-05-28-sprint-71-v10-polish.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

---

## Sprint 71 Goal

**Polish the ego-network and fission graph UX, update karmyq.org with community lifecycle narrative, ship v10.0.**

Trust Network Arc (Sprints 65–70) is complete. Sprint 71 is the capstone — no new features, targeted fixes and messaging.

---

## What Sprint 70 Built (complete ✅)

- Bilateral community merger: Admin A proposes → Admin B accepts/rejects → discussion → parallel vote → execution
- DB: `communities.fusion_proposals` + `communities.fusion_votes` tables; `community_links.link_type` extended with `'fusion_origin'`
- 7 API routes on community-service (`/communities/:id/fusion/*`)
- `FusionTab` component wired into community page (`?tab=fusion`)
- `FusionProposalModal` for admin proposals
- `fusion_vote_started` notification type + subscriber handler
- ADR-058 (implemented), user guide, landing page docs
- 19 regression tests pass (sprint-70-fusion.test.ts)
- Migration applied on demo server: `20260527-fusion.sql`

---

## Sprint 71 Scope

### P1: Ego-network layout (TrustGraph.tsx)
Current user node drifts wherever d3 settles it. Fix: pin it at the origin (`fx: 0, fy: 0` in fgData useMemo). Neighbors will orbit naturally. Also add `warmupTicks={120}` for better initial layout.

### P2: Fission bipartite layout (TrustGraph.tsx)
Force simulation clusters by trust weight, not group assignment — Group A/B distinction is hard to read. Fix: add a custom d3 x-force (when `groupMap` is defined) that attracts Group A nodes to `graphWidth * 0.28` and Group B nodes to `graphWidth * 0.72`. Applied via `fgRef.current.d3Force(...)` + `fgRef.current.d3ReheatSimulation()`.

### P3: Landing page — community lifecycle
"How communities govern themselves" section in `HowItWorks.tsx` mentions the 150-member limit but not fission/fusion. Add 3 paragraphs: size alert → governed fission → voluntary fusion.

### P4: Version bump
Root `package.json`: `9.50.0` → `10.0.0`.

### P5: User guide update
`docs/guides/trust-graph.md` + `apps/landing/src/data/docs/guides/trust-graph.json`: Add ego-network anchor note + fission group assignment view section.

---

## v10.0 Trust Network Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| **65** | Trust Graph Foundation | ✅ Shipped v9.50.0 |
| **66** | Trust Graph Visualization + Governance ADR | ✅ Shipped v9.60.0 |
| **67** | Ego-Network + Governance | ✅ Shipped v9.70.0 |
| **68** | Interaction Half-Life (Ebbinghaus decay) | ✅ Shipped v9.80.0 |
| **69** | Fission Mechanism | ✅ Shipped v9.90.0 |
| **70** | Fusion Mechanism | ✅ Shipped v9.95.0 |
| **71** | v10.0 Polish + karmyq.org update | 🔲 This sprint |

---

## Pre-existing TDD Failures (do NOT fix)

- `sprint-39-provider-ux` (7 fail)
- `sprint-43-feed-ranking` (crashes)
- `sprint-68-halflife` (6 DB connection tests)

---

## Architecture Gotchas (Persistent)

- **Landing page docs**: `apps/landing/src/data/docs/` is in `.gitignore` — always `git add -f`
- **ADR numbering**: Next ADR is **059** (none needed this sprint)
- **ADR-057 and ADR-058**: Already `implemented` in both source `.md` and landing `.json` — no updates needed
- **TDD test placement**: Community tests in `services/community-service/tests/tdd/`
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`
- **`git add` on CLAUDE.md**: Tracked as lowercase `claude.md` — always `git add claude.md`
- **Solo dev — no worktrees**: Work directly on feature branches
- **nav.json revert bug**: `generate-docs.ts` regenerates nav.json on every build — always add new slugs to the hardcoded list in `scripts/generate-docs.ts`
- **trust_edges_live is a VIEW**: Never INSERT/UPDATE it. Use `trust_edges` for writes, `trust_edges_live` for reads
- **`trust_edges_live` column**: exposes `current_weight` (not `effective_weight`) — use `current_weight AS effective_weight` alias when querying
- **API response unwrap**: `createApiClient` interceptor already unwraps envelope — use `res.data`, not `res.data.data`
- **Fission reference**: `services/community-service/src/routes/splits.ts` and `src/services/fissionService.ts`
- **Fusion reference**: `services/community-service/src/routes/fusions.ts` and `src/services/fusionService.ts`
- **trust_edges normalized constraint**: `social_graph.trust_edges` requires `user_id_a::text < user_id_b::text` — always sort: `const [a, b] = [uid1, uid2].sort()`
- **community_links UNIQUE**: fusion_origin links must be (merged↔A) and (merged↔B), NOT (A↔B)
- **TrustGraph fission mode ref**: `fgRef.current.d3Force(...)` is only callable after mount — always guard with `if (!fgRef.current) return`
- **Root package.json version**: Was stuck at `9.50.0` since Sprint 65. Sprint 71 bumps it to `10.0.0`.
- **Version note**: `package.json` at root only tracks version (services don't mirror it). Handoff is the source of truth for sprint versioning between root updates.
