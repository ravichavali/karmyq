# Sprint 71: v10.0 Polish + karmyq.org Update — COMPLETE ✅
## karmyq.org Content Upgrade (post-Sprint 71) — COMPLETE ✅

## Handoff Document

**Date**: 2026-05-29
**Current Version**: v10.0.0 ✅ (shipped)
**Status**: Sprint 71 complete. karmyq.org content upgrade complete. Trust Network Arc done. Next sprint TBD — start with /sprint-planning.

---

## karmyq.org Post-Sprint Content (3 commits shipped to master)

All changes live in `apps/landing/` (the Next.js app that serves karmyq.org).

| Commit | Change |
|--------|--------|
| `0718045` | Sprint 71 — ego-network anchor, fission bipartite layout |
| `a68e48a` | Governance manifesto copy + principles v3 |
| `0c86e4a` | Meta title + description updated to manifesto voice |

### What landed

**`HowItWorks.tsx`** — governance section fully rewritten:
- 5 paragraphs: sovereignty → initialization → trust-gated eligibility → no permanent roles → cross-community standing
- New h2 "How communities grow and change." with manifesto-voice fission/fusion (no implementation language)
- "Sisters remember they share a past." / "The platform provides the mechanics; the community provides the judgment."

**`Principles.tsx`** — all 6 card descriptions updated to v3 final copy (tighter, more declarative)

**`layout.tsx`** — meta title: "Meaning-making, not accounting" · description: functional subheadline, applied to both `<meta>` and OpenGraph

**Already-correct (no changes needed):**
- `TheThinking.tsx` — "Trust has been taken from us" already had surveillance-accurate version
- `DeeperSections.tsx` — trust evolution paragraph already present
- `Footer.tsx` — already simplified
- `FadingTimeline.tsx` — diverse name set already correct

---

---

## v10.0 Trust Network Arc — COMPLETE

| Sprint | Theme | Status |
|--------|-------|--------|
| **65** | Trust Graph Foundation | ✅ Shipped v9.50.0 |
| **66** | Trust Graph Visualization + Governance ADR | ✅ Shipped v9.60.0 |
| **67** | Ego-Network + Governance | ✅ Shipped v9.70.0 |
| **68** | Interaction Half-Life (Ebbinghaus decay) | ✅ Shipped v9.80.0 |
| **69** | Fission Mechanism | ✅ Shipped v9.90.0 |
| **70** | Fusion Mechanism | ✅ Shipped v9.95.0 |
| **71** | v10.0 Polish + karmyq.org update | ✅ **Shipped v10.0.0** |

---

## What Sprint 71 Built (complete ✅)

- **Ego-network anchor**: Current user node pinned at `fx: 0, fy: 0` in `fgData` useMemo. `warmupTicks={120}`, `cooldownTicks={50}` for faster settle.
- **Fission bipartite layout**: Custom d3 x-force applied via `fgRef` post-mount. Group A nodes attract to `graphWidth * 0.28`, Group B to `graphWidth * 0.72`. Named `'x-group'` to avoid overwriting d3 centering force.
- **karmyq.org lifecycle narrative**: 3 paragraphs added to "How communities govern themselves" in `HowItWorks.tsx` — size alert → fission → fusion.
- **Version bump**: Root `package.json` 9.50.0 → 10.0.0.
- **User guide**: `docs/guides/trust-graph.md` + `apps/landing/src/data/docs/guides/trust-graph.json` — "Your position" anchor note + "Fission Group Assignment View" section.
- **TDD tests**: `services/community-service/tests/tdd/sprint-71-v10-polish.test.ts` (auto-promoted to regression: 3 pass).
- All 200+ unit + regression tests pass across all services.

---

## Next Sprint Direction

The Trust Network Arc is complete at v10.0.0. Next sprint direction is TBD.

**Candidates for Sprint 72:**
- Mobile app parity (fission/fusion flows on React Native)
- Request matching improvements
- Community discovery / public listings
- Performance: trust score caching at scale

---

## Architecture Gotchas (Persistent)

- **Landing page docs**: `apps/landing/src/data/docs/` is in `.gitignore` — always `git add -f`
- **ADR numbering**: Next ADR is **059**
- **ADR-057 and ADR-058**: Already `implemented` in both source `.md` and landing `.json`
- **TDD test placement**: Community tests in `services/community-service/tests/tdd/`
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`
- **`git add` on CLAUDE.md**: Tracked as lowercase `claude.md` — always `git add claude.md`
- **Solo dev — no worktrees**: Work directly on feature branches
- **nav.json revert bug**: `generate-docs.ts` regenerates nav.json on every build — always add new slugs to the hardcoded list in `scripts/generate-docs.ts`
- **trust_edges_live is a VIEW**: Never INSERT/UPDATE it. Use `trust_edges` for writes, `trust_edges_live` for reads
- **`trust_edges_live` column**: exposes `current_weight` (not `effective_weight`) — use `current_weight AS effective_weight` alias when querying
- **API response unwrap**: `createApiClient` interceptor already unwraps envelope — use `res.data`, not `res.data.data`
- **trust_edges normalized constraint**: `social_graph.trust_edges` requires `user_id_a::text < user_id_b::text` — always sort: `const [a, b] = [uid1, uid2].sort()`
- **community_links UNIQUE**: fusion_origin links must be (merged↔A) and (merged↔B), NOT (A↔B)
- **TrustGraph fission mode ref**: `fgRef.current.d3Force(...)` is only callable after mount — always guard with `if (!fgRef.current) return`
- **Root package.json version**: Now 10.0.0.

---

## Pre-existing TDD Failures (do NOT fix)

- `sprint-39-provider-ux` (7 fail)
- `sprint-43-feed-ranking` (crashes)
- `sprint-68-halflife` (6 DB connection tests)
- `sprint-67-governance` (DB connection tests)
