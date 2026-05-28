# Sprint 70: Fusion Mechanism 🔲

## Handoff Document

**Date**: 2026-05-27
**Current Version**: v9.90.0 → v9.95.0 (target)
**Status**: Sprint 70 planned and ready to execute. Sprint 69 fully complete and deployed.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-70-fusion`
3. Open plan: `docs/superpowers/plans/2026-05-27-sprint-70-fusion.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

---

## Sprint 70 Goal

Build the fusion mechanism — two community admins bilaterally propose a merger, each community's members vote independently (parallel trust-weighted votes), and on approval a new merged community is created inheriting all members, trust edges (×0.70), and karma from both originals.

---

## Design Summary

| Decision | Choice |
|---|---|
| Proposal | Admin A creates (names merged community) → Admin B accepts/rejects |
| Output | New merged community C; A and B get `status='merged'`; `fusion_origin` links |
| Voting | Parallel — each community votes independently; both must pass |
| Trust edges | Copied into merged with 0.70 carry factor |
| Karma | Records from both communities copied into merged |
| Status lifecycle | `pending_acceptance → discussion → voting → approved → executed` |

---

## Artifacts

- **Design spec**: `docs/superpowers/specs/2026-05-27-sprint-70-fusion-design.md`
- **Implementation plan**: `docs/superpowers/plans/2026-05-27-sprint-70-fusion.md`
- **ADR to create**: `docs/adr/ADR-058-fusion-mechanism.md` (ADR-057 is fission)

---

## ⚠️ Critical Implementation Notes

1. **trust_edges normalized constraint**: `social_graph.trust_edges` requires `user_id_a::text < user_id_b::text`. When copying edges in executeFusion, always sort: `const [a, b] = [uid1, uid2].sort()`.

2. **community_links UNIQUE constraint**: Existing UNIQUE(community_a_id, community_b_id) — fusion_origin links must be (merged, A) and (merged, B), NOT (A, B).

3. **No UNIQUE constraint on fusion_proposals**: Guard "active proposal" via query, not DB constraint. A community can be party to multiple proposals simultaneously.

4. **trust_carry_factor 0.70**: Applied to `raw_weight` when copying trust edges. Higher than fission's 0.40 because fusion is consensual.

5. **nav.json revert bug**: `scripts/generate-docs.ts` regenerates nav.json on build. Add new slugs (`fusion`, `adr-058-fusion-mechanism`) to the hardcoded slug list in that script.

6. **Landing page docs gitignore**: Always `git add -f apps/landing/src/data/docs/` when staging.

7. **Admin A or B can start-vote / execute**: `isAdmin(req, communityAId) || isAdmin(req, communityBId)`.

8. **`active_fusion_proposal`**: Community GET endpoint needs this field so the Fusion tab badge works.

9. **JWT field**: `user.communities ?? []` — never `communityMemberships`.

10. **Migration ALTER constraint**: The `community_links.link_type` CHECK constraint needs `'fusion_origin'` added. The migration drops and recreates the constraint with `IF EXISTS`.

11. **`communities.status`**: No CHECK constraint — `status='merged'` can be set directly without schema change.

---

## v10.0 Trust Network Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| **65** | Trust Graph Foundation | ✅ Shipped v9.50.0 |
| **66** | Trust Graph Visualization + Governance ADR | ✅ Shipped v9.60.0 |
| **67** | Ego-Network + Governance | ✅ Shipped v9.70.0 |
| **68** | Interaction Half-Life (Ebbinghaus decay) | ✅ Shipped v9.80.0 |
| **69** | Fission Mechanism | ✅ Shipped v9.90.0 |
| **70** | Fusion Mechanism | 🔲 This sprint |
| **71** | v10.0 Polish + karmyq.org update | 🔲 Planned |

---

## Pre-existing TDD Failures (do NOT fix)

- `sprint-39-provider-ux` (7 fail)
- `sprint-43-feed-ranking` (crashes)
- `sprint-68-halflife` (6 DB connection tests)

---

## Architecture Gotchas (Persistent)

- **Landing page docs**: `apps/landing/src/data/docs/` is in `.gitignore` — always `git add -f`
- **ADR numbering**: Next ADR is **058** (ADR-057 is fission)
- **TDD test placement**: Community tests in `services/community-service/tests/tdd/`
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`
- **`git add` on CLAUDE.md**: Tracked as lowercase `claude.md` — always `git add claude.md`
- **Solo dev — no worktrees**: Work directly on feature branches
- **nav.json revert bug**: `generate-docs.ts` regenerates nav.json on every build — always add new slugs to the hardcoded list in `scripts/generate-docs.ts`
- **trust_edges_live is a VIEW**: Never INSERT/UPDATE it. Use `trust_edges` for writes, `trust_edges_live` for reads
- **`trust_edges_live` column**: exposes `current_weight` (not `effective_weight`) — use `current_weight AS effective_weight` alias when querying
- **API response unwrap**: `createApiClient` interceptor already unwraps envelope — use `res.data`, not `res.data.data`
- **Fission reference**: `services/community-service/src/routes/splits.ts` and `src/services/fissionService.ts` — fusion mirrors these patterns exactly
