# Sprint 69: Fission Mechanism | READY TO EXECUTE 🔲

## Handoff Document

**Date**: 2026-05-27
**Current Version**: v9.80.0 (Sprint 68 shipped) → v9.90.0 (Sprint 69 target)
**Status**: Sprint 69 fully planned. Design spec + implementation plan written. Ready to execute.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-69-fission`
3. Open plan: `docs/superpowers/plans/2026-05-27-sprint-69-fission.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

---

## Sprint 69 Goal

Build the complete community fission lifecycle: size-triggered auto-suggest → admin split proposal with trust-graph-driven member clustering → prestige-weighted community vote → executed split that creates two child communities.

This is **ADR-018 Phase 2** — the structural mechanics that turn the `community_links` schema (Phase 1, Sprint 15) into the output of a governed split process.

---

## v10.0 Trust Network Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| **65** | Trust Graph Foundation | ✅ Shipped v9.50.0 |
| **66** | Trust Graph Visualization + Governance ADR | ✅ Shipped v9.60.0 |
| **67** | Ego-Network + Governance | ✅ Shipped v9.70.0 |
| **68** | Interaction Half-Life (Ebbinghaus decay) | ✅ Shipped v9.80.0 |
| **69** | Fission Mechanism | 🔲 Ready to execute |
| **70** | Fusion Mechanism | 🔲 Planned |
| **71** | v10.0 Polish + karmyq.org update | 🔲 Planned |

---

## Sprint 69 Context

### What's being built

**4-stage lifecycle:**
1. **Size alert**: `GET /communities/:id` returns `size_alert: null | 'approaching' | 'recommend_split' | 'urgent_split'` computed from `current_members` (120/130/140 thresholds). No background job.
2. **Propose**: Admin creates a `split_proposal`. Community-service runs greedy bisection on `social_graph.trust_edges_live` (cross-schema query — same DB) to seed `split_member_assignments`. Admin reviews/adjusts the assignment table.
3. **Vote**: Admin opens voting. Community votes prestige-weighted (same pattern as Sprint 67 governance). Quorum + approval threshold required.
4. **Execute**: Atomic transaction — creates two child communities, moves members, creates `split_origin` community_link, marks parent `status='split'`.

### New DB tables (community schema)
- `community.split_proposals` — proposal lifecycle
- `community.split_votes` — prestige-weighted member votes
- `community.split_member_assignments` — per-member group assignment (with cluster_suggestion vs admin override)

### New files
- `infrastructure/postgres/migrations/20260527-fission.sql`
- `services/community-service/src/routes/splits.ts`
- `services/community-service/src/database/splitsDb.ts`
- `services/community-service/src/services/fissionService.ts`
- `apps/frontend/src/components/community/tabs/FissionTab.tsx`
- `apps/frontend/src/components/FissionProposalModal.tsx`
- `apps/frontend/src/components/FissionAssignmentView.tsx`
- `docs/adr/ADR-057-fission-mechanism.md`

### Key references
- **Design spec**: `docs/superpowers/specs/2026-05-27-sprint-69-fission-design.md`
- **Implementation plan**: `docs/superpowers/plans/2026-05-27-sprint-69-fission.md`
- `docs/adr/ADR-018-community-splitting-mechanics.md` — Phase 2 being implemented this sprint
- `docs/adr/ADR-047-community-evolution-engine.md` — arc context
- `services/community-service/src/routes/governance.ts` — copy auth pattern + prestige-weight pattern from here
- `services/community-service/CONTEXT.md` — service overview

---

## ⚠️ Critical Implementation Notes (Persistent)

1. **`trust_edges_live` is read-only VIEW** — clustering reads from it; never write to it; writes go to `trust_edges`.
2. **JWT field is `communities`, not `communityMemberships`** — always `user.communities ?? []`.
3. **Parent community is NOT deleted on execute** — set `status='split'`; karma records + history reference the parent ID.
4. **`UNIQUE (community_id, status)` caveat** — prevents second proposal after execution (two `executed` rows). Demo-scope acceptable; document it.
5. **Landing page docs are in `.gitignore`** — always `git add -f apps/landing/src/data/docs/`.
6. **nav.json silently reverts** — add new slugs to hardcoded list in `scripts/generate-docs.ts`.
7. **TDD tests go in `services/community-service/tests/tdd/`** — not root `tests/tdd/`.
8. **ADR-057 is next** — verify with `ls docs/adr/ | sort | tail -5`.
9. **Clustering runs at proposal creation time only** — stored in `split_member_assignments`; does not re-run on admin adjustments.
10. **Unassigned members at execute time** — auto-assign to the smaller group before transaction proceeds.

---

## Architecture Gotchas (Persistent)

- **Landing page docs**: `apps/landing/src/data/docs/` is in `.gitignore` — always `git add -f`.
- **ADR numbering**: Next ADR is **057**.
- **TDD test placement**: Community tests in `services/community-service/tests/tdd/`. Social-graph tests in `services/social-graph-service/tests/tdd/`.
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`.
- **`git add` on CLAUDE.md**: Tracked as lowercase `claude.md` — always `git add claude.md`.
- **Pre-existing TDD failures**: `sprint-39-provider-ux` (7 fail), `sprint-43-feed-ranking` (crashes), `sprint-68-halflife` (6 DB connection tests, no local migration). Do NOT fix.
- **Solo dev — no worktrees**: Work directly on feature branches.
- **nav.json revert bug**: `generate-docs.ts` regenerates nav.json on every build. Always add new slugs to the hardcoded list in `scripts/generate-docs.ts`.
- **Demo DB credentials**: Use `./scripts/deploy.sh` for deploys — never manual `docker compose up` with the compose file's hardcoded dev credentials against the prod volume.
- **trust_edges_live is a view**: Never INSERT or UPDATE it. Use `trust_edges` for writes, `trust_edges_live` for reads.
- **CommitmentsTab renders its own cards**: Does not use `OfferItem`. Any new card-level behavior must be applied in `renderHelpingCard` and `renderRequestedCard` directly.
- **Demo server note**: If the demo server is unresponsive, run `./scripts/deploy.sh` via SSH — not manual `docker compose up`.
