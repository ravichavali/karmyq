# Sprint 65: Trust Graph Foundation | READY TO EXECUTE 🔲

## Handoff Document

**Date**: 2026-05-25
**Current Version**: v9.40.0 → v9.50.0 (this sprint)
**Status**: Spec + plan written. Branch not yet created. Ready to execute.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-65-trust-graph-foundation`
3. Open plan: `docs/superpowers/plans/2026-05-25-sprint-65-trust-graph-foundation.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

---

## Sprint 65 Goal

Add weighted, decaying, community-scoped trust edges to the social-graph service — the data foundation that Sprint 66 (visualization), Sprint 67 (governance), and Sprints 69–70 (fission/fusion) all depend on.

**Nothing is user-visible this sprint.** Output is architectural: new schema, capture pipeline, graph API endpoint, and a robust test suite.

---

## Testing Standard (this sprint sets the bar for the full arc)

Recent sprints have had shallow or stubbed TDD tests. Sprint 65 changes that. The rule:

- **No stubs for logic under test.** DB tests hit the real DB. Queue tests fire the real queue.
- **Assert specific values, not just truthiness.** `expect(weight).toBe(10.0)` not `expect(weight).toBeDefined()`.
- **Prove mathematical invariants with exact numbers.** At exactly 6 months, `effective_weight = raw_weight × 0.5`. Test this.
- **Test idempotency.** Two `upsertTrustEdge` calls = one row with count 2, not two rows.
- **Test boundary conditions.** Reversed pair, empty community, zero-weight edge, non-existent pair.
- **Test the event pipeline end-to-end.** Fire `match_completed` on the queue → query DB → assert row created.

Full test specification is in the plan (Task 8) and the spec (Testing Strategy section).

**Minimum tests required before merge:**
- Unit: pair normalization, decay at 0/6/12 months (exact values), raw weight computation
- TDD integration: first upsert, idempotency, reversed pair, cross-community edge, API auth, API response shape, null edge case, pathComputation regression

---

## v10.0 Trust Network Arc

| Sprint | Theme | Target | Status |
|--------|-------|--------|--------|
| **65** | Trust Graph Foundation | ~May 30 | 🔲 Ready |
| 66 | Trust Graph Visualization + Governance ADR | ~June 5 | 🔲 Planned |
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
- **ADR numbering**: Next ADR is **054**.
- **TDD test placement**: Social-graph sprint tests go in `services/social-graph-service/tests/tdd/`.
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`.
- **`git add` on CLAUDE.md**: Tracked as lowercase `claude.md` — always `git add claude.md`.
- **Pre-existing TDD failures**: `sprint-39-provider-ux` (7 fail), `sprint-43-feed-ranking` (crashes). Do NOT fix.
- **Solo dev — no worktrees**: Work directly on feature branches.
- **nav.json linter revert**: Always grep-verify after editing nav.json before committing.
- **Sprint 54 migration still needed on demo server** (if not yet run):
  ```bash
  ssh ubuntu@karmyq.com
  psql -U postgres -d karmyq < ~/karmyq/infrastructure/postgres/migrations/20260510-refresh-tokens.sql
  ```

---

## Previous Sprint (64) — Complete ✅

Sprint 64 shipped v9.40.0: Community Pick badge, mod permissions fix, ADR-053 Feed Design Philosophy. All tests passing (27/27 + 4/4 TDD).
