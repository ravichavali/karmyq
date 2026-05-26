# Sprint 66: Trust Graph Visualization + Governance ADR | COMPLETE ✅

## Handoff Document

**Date**: 2026-05-26
**Current Version**: v9.60.0 (Sprint 66 shipped)
**Status**: Implementation complete. Merged to master and deploying.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-66-trust-graph-visualization`
3. Open plan: `docs/superpowers/plans/2026-05-25-sprint-66-trust-graph-visualization.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

---

## Sprint 66 Goal

**Trust Graph Visualization + Governance ADR** — make the trust graph user-visible for the first time, and publish ADR-055 (governance architecture doc) so Sprint 67 can execute against a ratified spec.

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
- 12 unit tests + TDD integration tests passing

---

## Sprint 66 — What to Build

### Deliverables
1. **`TrustGraph.tsx`** — force-directed graph component using `react-force-graph-2d` (already installed). SSR-safe dynamic import following `NetworkGraph.tsx` pattern.
2. **`TrustGraphTab.tsx`** — wrapper component; handles data fetching, loading/empty/error states.
3. **"trust graph" tab** on `/communities/[id]` — visible to all active members (`isMember`), not admin-gated.
4. **API client method** — `socialGraphService.getTrustGraph(communityId)` in `apps/frontend/src/lib/api.ts`.
5. **ADR-055** — Trust-Based Governance Architecture (doc only, no code). Published to landing site.
6. **User guide** — "Understanding Your Community's Trust Graph" on landing site.

### Visual Encoding
- Node size = `Math.max(5, trust_score / 10)`
- Node color: current user = emerald `#10b981`, others = indigo `#6366f1`
- Edge thickness = `Math.max(1, effective_weight / 5)`
- Click node → highlight connections, show detail panel

---

## Design Reference

- **Spec**: `docs/superpowers/specs/2026-05-25-sprint-66-trust-graph-visualization-design.md`
- **Plan**: `docs/superpowers/plans/2026-05-25-sprint-66-trust-graph-visualization.md`
- **Sprint 65 spec** (reference): `docs/superpowers/specs/2026-05-25-sprint-65-trust-graph-foundation-design.md`

---

## ⚠️ Critical Implementation Notes

1. **`react-force-graph-2d` is already installed** (`^1.29.1` in `apps/frontend/package.json`). Do NOT add it. Follow `NetworkGraph.tsx` — dynamic import inside `useCallback`, never at module level.

2. **SSR will crash without dynamic import.** Next.js 14 runs components server-side. `react-force-graph-2d` accesses `window`. Must be imported dynamically.

3. **`'trust'` must be added to BOTH `ValidTab` type AND `VALID_TABS` array** in `[id].tsx`. Missing either breaks URL tab routing.

4. **Tab visibility**: show to all `isMember` — not admin-gated.

5. **`linkWidth` is a function**, not a number: `linkWidth={(link: any) => Math.max(1, link.effective_weight / 5)}`.

6. **nav.json revert bug**: After editing, verify with `grep "adr-055" apps/landing/src/data/docs/nav.json`. Re-apply if missing.

7. **Landing page docs in .gitignore**: Always `git add -f apps/landing/src/data/docs/`.

8. **ADR-055 is doc-only this sprint.** Sprint 67 implements it.

9. **TrustGraphTab handles its own data fetching.** Do not add trust graph state to `useCommunityData`.

10. **`generate-docs.ts` must have `'adr-055-trust-governance-architecture'`** in the hardcoded slug list or nav.json will be overwritten on build.

---

## Testing Standard (Sprint 65+, applies to all arc sprints)

- **No stubs for logic under test.** DB tests hit the real DB.
- **Assert specific values, not just truthiness.** `expect(weight).toBe(10.0)` not `expect(weight).toBeDefined()`.
- **Prove mathematical invariants with exact numbers.**
- **Test idempotency** and **boundary conditions**.

---

## v10.0 Trust Network Arc

| Sprint | Theme | Target | Status |
|--------|-------|--------|--------|
| **65** | Trust Graph Foundation | May 25 | ✅ Shipped v9.50.0 |
| **66** | Trust Graph Visualization + Governance ADR | ~June 5 | 🔲 Ready to execute |
| 67 | Governance Implementation | ~June 10 | 🔲 Planned |
| 68 | Data Half-life + Demo Cleanup | ~June 15 | 🔲 Planned |
| 69 | Fission Mechanism | ~June 25 | 🔲 Planned |
| 70 | Fusion Mechanism | ~July 2 | 🔲 Planned |
| 71 | v10.0 Polish + karmyq.org update | ~July 8 | 🔲 Planned |

**June 19th LinkedIn share target**: Sprints 65–68 complete.

---

## Governance Arc Context (for Sprint 67)

From ADR-055 (written this sprint):
- **Founder group**: 5–6 members, full governance rights until trust matures
- **No permanent roles**: eligibility gated by trust score ≥ threshold (default 50), ratified by quorum
- **Rotation trigger**: trust score drop → role eligible for reassignment
- **Trust-gated authority**: new communities constrained; expands as avg trust ≥ threshold
- **Templates**: small-collective (3-member quorum), council (5-member), open-delegation (trust-weighted voting)

Sprint 67 schema additions to `community_settings`:
```json
{ "governance": { "eligibility_threshold": 50, "quorum_size": 3, "template": "small-collective" } }
```

Sprint 67 new endpoints: `GET /communities/:id/governance`, `POST /communities/:id/governance/nominate`, `POST /communities/:id/governance/ratify/:nominationId`

---

## v10.0 Conceptual Framework (for Sprint 71 landing page)

1. **Trust ≠ Karma**: Karma measures what you've done. Trust measures the bond between two people.
2. **Fractal property**: Same edge structure at user↔user and community↔community.
3. **Interaction hierarchy**: `match_completed` (10) > `endorsement` (5) > `karma_given` (3) > `event` (2)
4. **Fission**: Communities divide at natural interaction-density seams. Daughters inherit trust.
5. **Fusion**: Communities with high cross-community trust edges can merge.
6. **Anti-oligarchy**: Non-permanent roles. Eligibility gated by current trust, not past status.
7. **Data half-life**: `effective_weight = raw_weight × 0.5^(age/half-life)`. Ephemeral by design.
8. **Banality of goodness**: Platform builds conditions where ordinary unremarkable help is the default.
9. **Scaffolding, not dependency**: Platform meant to be outgrown.

---

## Architecture Gotchas (Persistent)

- **Landing page docs**: `apps/landing/src/data/docs/` is in `.gitignore` — always `git add -f`.
- **ADR numbering**: Next ADR after this sprint is **056**.
- **TDD test placement**: Social-graph sprint tests go in `services/social-graph-service/tests/tdd/`.
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`.
- **`git add` on CLAUDE.md**: Tracked as lowercase `claude.md` — always `git add claude.md`.
- **Pre-existing TDD failures**: `sprint-39-provider-ux` (7 fail), `sprint-43-feed-ranking` (crashes). Do NOT fix.
- **Solo dev — no worktrees**: Work directly on feature branches.
- **nav.json revert bug**: `generate-docs.ts` regenerates nav.json on every build. Always add new ADR slugs to the hardcoded list in `scripts/generate-docs.ts` before committing.
- **Sprint 65 migration**: Successfully applied to demo server on 2026-05-25. 670 trust_edges rows, 4 interaction_weights, 0 community_trust_edges.
- **Demo DB credentials**: `docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod` — postgres not running as local socket, must use docker exec.

---

## Sprint 66 Post-Deploy Validation (Human Checklist)

After deploy completes, manually verify:

### 1. Trust graph UI (2 min)
- Open any community on karmyq.com
- Click "trust graph" tab → graph renders with nodes and edges
- Click a node → connections highlight, detail panel shows name/trust score/karma/connections
- Click background → deselect

### 2. Landing site docs (1 min)
- Visit `https://karmyq.com/docs/guides/trust-graph` → user guide renders
- Visit `https://karmyq.com/docs/concepts/adr-055-trust-governance-architecture` → ADR-055 renders

### 3. API smoke test (optional, 2 min)
```bash
TOKEN="<paste from browser DevTools → localStorage → token>"
COMMUNITY_ID="<any community ID>"
curl -H "Authorization: Bearer $TOKEN" https://karmyq.com/api/social/trust/graph/$COMMUNITY_ID | jq '.data.nodes | length'
# Should return a number > 0 for active communities
```
