# Sprint 66: Trust Graph Visualization + Governance ADR | READY TO PLAN 🔲

## Handoff Document

**Date**: 2026-05-25
**Current Version**: v9.50.0 (Sprint 65 complete) → v9.60.0 (this sprint)
**Status**: Sprint 65 complete and deployed. Sprint 66 scope defined below. Ready to write plan.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-66-trust-graph-visualization`
3. Write spec + plan for Sprint 66 (see scope below)
4. Run: `/execute-plan`

---

## Sprint 65 — COMPLETE ✅

**Shipped v9.50.0**: Trust Graph Foundation deployed to karmyq.com.

- `social_graph.trust_edges` table (670 rows backfilled from historical matches)
- `social_graph.interaction_weights` (4 platform defaults: match_completed=10, endorsement=5, karma_given=3, event=2)
- `social_graph.community_trust_edges` (0 rows, fills as cross-community matches occur)
- Bull queue subscriber: `match_completed` → `upsertTrustEdge` (with community-community edge)
- `GET /trust/graph/:communityId` and `GET /trust/edge` API routes live
- `pathComputation.ts` updated to use edge weights instead of karma sums
- ADR-054: Trust Graph Architecture (docs + landing site)
- `generate-docs.ts` fixed: ADR-053 + ADR-054 added to hardcoded nav list
- 12 unit tests + TDD integration tests passing

---

## Sprint 66 Goal

**Trust Graph Visualization** — make the trust graph user-visible for the first time.

Sprint 66 is the first user-facing output of the v10.0 arc. The `GET /trust/graph/:communityId` endpoint built in Sprint 65 has data (670 backfilled edges). Now visualize it.

---

## Testing Standard (set in Sprint 65, applies to all arc sprints)

- **No stubs for logic under test.** DB tests hit the real DB. Queue tests fire the real queue.
- **Assert specific values, not just truthiness.** `expect(weight).toBe(10.0)` not `expect(weight).toBeDefined()`.
- **Prove mathematical invariants with exact numbers.** At exactly 6 months, `effective_weight = raw_weight × 0.5`. Test this.
- **Test idempotency.** Two calls = one row with count 2, not two rows.
- **Test boundary conditions.** Reversed pair, empty community, zero-weight edge, non-existent pair.

## Sprint 66 — What to Build

**Frontend visualization** of the community trust graph using the data from Sprint 65.

Key decisions to make when writing the plan:
1. **Library**: vis-network (force-directed), D3 force simulation, or a lighter custom SVG approach?
2. **Location in UI**: New tab on community detail page (`/communities/[id]`) or standalone `/trust` route?
3. **Data**: Use `GET /trust/graph/:communityId` which returns `{ nodes: [...], edges: [...] }` — Sprint 65 built this
4. **Visual encoding**: Node size = trust score? Edge thickness = effective_weight? Color = community?
5. **Interaction**: Click node → highlight connections? Hover edge → show weight?
6. **ADR-055**: Trust Graph Visualization decisions (library choice, layout algorithm, UX interaction model)

**Minimum deliverable**: Community trust graph visible on the community admin page. Nodes = members, edges = trust bonds, thickness = effective_weight. Clicking a node shows their trust connections.

**What Sprint 66 unlocks**: Sprint 67 (governance) needs members to see who has high trust — the visualizer makes that tangible.

---

## v10.0 Trust Network Arc

| Sprint | Theme | Target | Status |
|--------|-------|--------|--------|
| **65** | Trust Graph Foundation | May 25 | ✅ Shipped v9.50.0 |
| **66** | Trust Graph Visualization + Governance ADR | ~June 5 | 🔲 Ready to plan |
| 67 | Governance Implementation | ~June 10 | 🔲 Planned |
| 68 | Data Half-life + Demo Cleanup | ~June 15 | 🔲 Planned |
| 69 | Fission Mechanism | ~June 25 | 🔲 Planned |
| 70 | Fusion Mechanism | ~July 2 | 🔲 Planned |
| 71 | v10.0 Polish + karmyq.org update | ~July 8 | 🔲 Planned |

**June 19th LinkedIn share target**: Sprints 65–68 complete. The story: trust graph visible, communities self-governing, data has a half-life, v10.0 underway, looking for contributors.

---

## Sprint 65 — What's Being Built

**The gap in the codebase**: `social_graph.connections` exists but is thin (no weights, no counts, no community scope). `pathComputation.ts` queries raw `requests.matches` live and uses karma as a trust proxy. There is no persistent weighted edge table.

**What Sprint 65 adds:**
- `social_graph.trust_edges` — bidirectional, community-scoped, weighted interaction history
- `social_graph.interaction_weights` — modular per-type weights (the extensibility hook)
- `social_graph.community_trust_edges` — fractal level 2: community↔community bonds
- Bull queue subscriber: `match_completed` → `upsertTrustEdge`
- `GET /trust/graph/:communityId` — graph data endpoint for Sprint 66 visualizer
- ADR-054: Trust Graph Architecture
- **Mandatory backfill** from existing `requests.matches` (empty graph = useless Sprint 66)
- Robust unit + integration test suite

---

## Design Reference

- **Spec**: `docs/superpowers/specs/2026-05-25-sprint-65-trust-graph-foundation-design.md`
- **Plan**: `docs/superpowers/plans/2026-05-25-sprint-65-trust-graph-foundation.md`
- **ADR to create**: ADR-054 (next ADR number is 054)

---

## ⚠️ Critical Implementation Notes

1. **Normalized pair**: Always store `user_id_a < user_id_b` (UUID string comparison). Normalize before every write. Violation = silent duplicate edges that break idempotency.

2. **`effective_weight` computed at read time, not stored**: `raw_weight` = sum of (count × type_weight). Apply half-life decay only in API responses. Formula: `raw_weight × 0.5^(age_ms / HALF_LIFE_MS)` where `HALF_LIFE_MS = 6 × 30 × 24 × 60 × 60 × 1000`.

3. **Backfill is mandatory**: Migration must populate `trust_edges` from existing `requests.matches WHERE status = 'completed'`. Without this, Sprint 66 visualization shows an empty graph on demo server.

4. **Community-community edges**: On `match_completed`, if requester and responder have different primary community memberships, also increment `community_trust_edges` for that pair.

5. **Do NOT remove `social_graph.connections`**: Leave as-is. Add `trust_edges` alongside it. Deprecation is Sprint 71.

6. **Interaction weight fallback**: Read community-specific override first, fall back to `NULL community_id` platform default. Default = 1.0 if no row found for type.

7. **nav.json revert bug**: After editing `apps/landing/src/data/docs/nav.json`, verify with `grep "adr-054" apps/landing/src/data/docs/nav.json` before committing.

8. **Landing page docs in .gitignore**: Use `git add -f` for all files under `apps/landing/src/data/docs/`.

---

## Governance Arc Context (for Sprint 67 plan-writing)

Key decisions from planning conversation:

- **Founder group**: 5–6 members, initialized at community creation, handles admin/mod/governance
- **No permanent roles**: Roles reflect current trust, not past contributions. Anti-oligarchy by design.
- **Role eligibility**: Gated by trust score threshold + community ratification
- **Rotation trigger**: Trust score drop makes a role eligible for reassignment (not time-based)
- **Governance templates**: Questionnaire matching suggests governance models from similar communities
- **Trust-gated authority**: New communities have constrained governance rights that expand as trust matures

---

## v10.0 Conceptual Framework (for Sprint 71 landing page)

Not yet on karmyq.org. Weave in at Sprint 71:

1. **Trust ≠ Karma**: Karma measures what you've done. Trust measures the bond between two people.
2. **Fractal property**: Same edge structure at user↔user and community↔community. User behavior cascades upward.
3. **Interaction hierarchy**: `match_completed` (10) > `endorsement` (5) > `karma_given` (3) > `event` (2)
4. **Fission**: Communities divide at natural interaction-density seams (~Dunbar ±10). Daughters inherit trust.
5. **Fusion**: Communities with high cross-community trust edges can merge.
6. **Anti-oligarchy**: Non-permanent roles. Eligibility gated by current trust, not past status.
7. **Data half-life**: `effective_weight = raw_weight × 0.5^(age/half-life)`. Ephemeral by design.
8. **Carrying capacity of change**: Rate of change must match trust infrastructure. Fission is a pressure relief valve.
9. **Banality of goodness**: Platform builds conditions where ordinary unremarkable help is the default.
10. **Scaffolding, not dependency**: Platform meant to be outgrown. Karmyq-coordinated ride → phone call.

---

## Architecture Gotchas (Persistent)

- **Landing page docs**: `apps/landing/src/data/docs/` is in `.gitignore` — always `git add -f`.
- **ADR numbering**: Next ADR is **055**.
- **TDD test placement**: Social-graph sprint tests go in `services/social-graph-service/tests/tdd/`.
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`.
- **`git add` on CLAUDE.md**: Tracked as lowercase `claude.md` — always `git add claude.md`.
- **Pre-existing TDD failures**: `sprint-39-provider-ux` (7 fail), `sprint-43-feed-ranking` (crashes). Do NOT fix.
- **Solo dev — no worktrees**: Work directly on feature branches.
- **nav.json revert bug**: `generate-docs.ts` regenerates nav.json on every build. Always add new ADR slugs to the hardcoded list in `scripts/generate-docs.ts` before committing.
- **Sprint 65 migration**: Successfully applied to demo server on 2026-05-25. 670 trust_edges rows, 4 interaction_weights, 0 community_trust_edges.
- **Demo DB credentials**: `docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod` — postgres not running as local socket, must use docker exec.

---

---

## Sprint 65 — Post-Deploy Validation (Human Checklist)

After deploy completes, manually verify these things from the UI/API:

### 1. API smoke test (2 min)
```bash
# Get a token from a logged-in session (copy from browser DevTools → Application → localStorage → token)
TOKEN="<paste token here>"
COMMUNITY_ID="<paste any community ID>"

# Should return graph with nodes and edges (670 backfilled rows)
curl -H "Authorization: Bearer $TOKEN" https://karmyq.com/api/social/trust/graph/$COMMUNITY_ID | jq '.data.edges | length'

# Should return a specific edge or null (test with two real user IDs)
curl -H "Authorization: Bearer $TOKEN" "https://karmyq.com/api/social/trust/edge?userA=<uid1>&userB=<uid2>&communityId=$COMMUNITY_ID" | jq '.data'
```

### 2. DB verification (1 min)
```bash
ssh ubuntu@karmyq.com
docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod -c "
  SELECT 'trust_edges' AS tbl, COUNT(*) FROM social_graph.trust_edges
  UNION ALL SELECT 'interaction_weights', COUNT(*) FROM social_graph.interaction_weights
  UNION ALL SELECT 'community_trust_edges', COUNT(*) FROM social_graph.community_trust_edges;"
# Expected: 670 / 4 / 0
```

### 3. Trust edge capture (after any help request)
- Complete any request (requester marks helper "done")
- Wait a few seconds for queue processing
- Re-run `trust_edges` count — should be 671+
- Sprint 65 is fully working if count increments

### 4. Landing site (30 sec)
- Visit https://karmyq.com/docs/concepts/adr-054-trust-graph-architecture
- Should render the Trust Graph Architecture ADR

---

## Previous Sprint (64) — Complete ✅

Sprint 64 shipped v9.40.0: Community Pick badge, mod permissions fix, ADR-053 Feed Design Philosophy. All tests passing (27/27 + 4/4 TDD).
