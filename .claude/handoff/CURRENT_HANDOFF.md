# Sprint 67: Ego-Network + Governance | SHIPPED ✅

## Handoff Document

**Date**: 2026-05-26
**Current Version**: v9.70.0 (Sprint 67 shipped)
**Status**: All tasks complete. All tests pass. Deployed to master.

---

## Quick Start

1. Read this handoff (especially the Critical Notes below)
2. Check out branch: `git checkout -b feature/sprint-67-governance`
3. Open plan: `docs/superpowers/plans/2026-05-26-sprint-67-governance.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

---

## Sprint 67 Goal

**Ego-Network + Governance** — Replace the full-community trust graph with a permanently ego-centric model, unify the dashboard "Your Network" panel with trust data, and implement trust-gated governance end-to-end: schema, three new endpoints, and a full nomination/ratification UI on the community page.

---

## What Gets Built

### 1. Ego-network rewrite (social-graph-service)
- `getTrustGraph(communityId, callingUserId)` — returns calling user + direct neighbors + edges among them only
- `getTrustGraphAggregate(callingUserId)` — ego-network across all user's communities (for dashboard)
- `GET /trust/graph/:communityId` — now requires auth, returns ego-network
- `GET /trust/graph` (no communityId) — new aggregate endpoint

### 2. Graph unification (frontend)
- Dashboard "Your Network" (`NetworkGraph.tsx`) → calls `GET /trust/graph` (trust data, not old `/network`)
- Old `/network` endpoint retired

### 3. Governance (community-service + frontend)
- DB: `community.governance_settings` column + `governance_nominations` + `governance_ratifications` tables
- `GET /communities/:id/governance` — maturity state, eligible members, pending nominations, role holders
- `POST /communities/:id/governance/nominate` — nominate eligible member; validates trust threshold
- `POST /communities/:id/governance/ratify/:nominationId` — ratify; auto-grants role at quorum
- `GovernanceTab.tsx` — full UI: maturity banner, eligible members with nominate flow, nominations with ratification progress, current role holders
- Community page `[id].tsx` — new "governance" tab (all isMember)

---

## Design Reference

- **Spec**: `docs/superpowers/specs/2026-05-26-sprint-67-governance-design.md`
- **Plan**: `docs/superpowers/plans/2026-05-26-sprint-67-governance.md`
- **ADR-055**: `docs/adr/ADR-055-trust-governance-architecture.md` (the governance design rationale)

---

## ⚠️ Critical Implementation Notes

1. **Ego-network requires callingUserId from JWT.** Add `verifyToken` middleware to `GET /trust/graph/:communityId` if not present. Pass `req.user.userId` to `getTrustGraph`.

2. **Cross-schema SQL is fine.** `governanceDb.ts` in community-service can query `social_graph.trust_edges` — same PostgreSQL instance.

3. **Auto-ratify is a single transaction.** When `ratification_count >= required_ratifications`: update `community.members.role` AND set nomination status = 'ratified' in one transaction.

4. **`'governance'` must be in BOTH `ValidTab` type AND `VALID_TABS` array** in `[id].tsx`.

5. **Governance tab visibility**: all `isMember` — not admin-gated.

6. **nav.json revert bug**: Add `governance` slug to `scripts/generate-docs.ts` hardcoded concept list.

7. **Landing docs in .gitignore**: `git add -f apps/landing/src/data/docs/`.

8. **JWT field is `communities`** not `communityMemberships`.

9. **Aggregate route ordering**: `GET /trust/graph` must be declared BEFORE `GET /trust/graph/:communityId` in the Express router.

10. **No "show full graph" mode.** Ego-network only, forever.

11. **Nomination idempotency**: 409 if pending nomination already exists for same community + user + role.

12. **TDD test placement**: ego-network → `services/social-graph-service/tests/tdd/`, governance → `services/community-service/tests/tdd/`.

13. **Migration must be applied manually on demo server** during deploy (deploy.sh doesn't auto-apply migrations). Migration file: `infrastructure/postgres/migrations/009-governance-schema.sql`.

---

## Testing Standard (Sprint 65+)

- No stubs for logic under test. DB tests hit the real DB.
- Assert specific values, not just truthiness.
- Test idempotency and boundary conditions.
- Nomination idempotency is a required test case.

---

## v10.0 Trust Network Arc

| Sprint | Theme | Target | Status |
|--------|-------|--------|--------|
| **65** | Trust Graph Foundation | May 25 | ✅ Shipped v9.50.0 |
| **66** | Trust Graph Visualization + Governance ADR | June 5 | ✅ Shipped v9.60.0 |
| **67** | Ego-Network + Governance | ~June 10 | 🚀 Executing |
| 68 | Data Half-life + Demo Cleanup | ~June 15 | 🔲 Planned |
| 69 | Fission Mechanism | ~June 25 | 🔲 Planned |
| 70 | Fusion Mechanism | ~July 2 | 🔲 Planned |
| 71 | v10.0 Polish + karmyq.org update | ~July 8 | 🔲 Planned |

**June 19th LinkedIn share target**: Sprints 65–68 complete.

---

## Sprint 66 — What Was Shipped

- `TrustGraph.tsx` — force-directed graph, SSR-safe, click-to-highlight, detail panel
- `TrustGraphTab.tsx` — data-fetching wrapper, loading/empty/error states
- Community page — "trust graph" tab (isMember-gated, URL-routable)
- `socialGraphService.getTrustGraph(communityId)` in api.ts
- ADR-055: Trust-Based Governance Architecture (doc-only — Sprint 67 implements)
- Landing: trust-graph user guide + ADR-055 concept page
- TDD: sprint-66 integration tests (DB schema invariants)
- Bug fixes: nginx `/api/trust/` route, `res.data.data` unwrap, active-member filter, generate-docs pipeline

---

## Architecture Gotchas (Persistent)

- **Landing page docs**: `apps/landing/src/data/docs/` is in `.gitignore` — always `git add -f`.
- **ADR numbering**: Next ADR after Sprint 67 is **056** (if Sprint 67 creates one, it's 056).
- **TDD test placement**: Social-graph sprint tests go in `services/social-graph-service/tests/tdd/`. Community tests in `services/community-service/tests/tdd/`.
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`.
- **`git add` on CLAUDE.md**: Tracked as lowercase `claude.md` — always `git add claude.md`.
- **Pre-existing TDD failures**: `sprint-39-provider-ux` (7 fail), `sprint-43-feed-ranking` (crashes). Do NOT fix.
- **Solo dev — no worktrees**: Work directly on feature branches.
- **nav.json revert bug**: `generate-docs.ts` regenerates nav.json on every build. Always add new slugs to the hardcoded list in `scripts/generate-docs.ts`.
- **Demo DB credentials**: `docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod` — postgres not running as local socket.
- **Sprint 65 migration applied**: 670 trust_edges rows, 4 interaction_weights backfilled on demo server.
