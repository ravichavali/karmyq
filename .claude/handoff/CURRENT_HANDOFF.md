# Sprint 8: Trust UX + Feed + Overall Trust + ADR-040 — Ready to Push

## Handoff Document for New Conversation

**Date**: 2026-02-27
**Current Version**: v9.1.0
**Status**: All Sprint 8 changes implemented, tests passing. Ready to commit and push.

---

## What We Just Completed (this session)

### Sprint 8 — Four Issues Fixed

**1. Trust page updated (trust.tsx)**
- Replaced old 40/30/20/10 breakdown (Karma/Exchanges/Feedback/Account Age) with ADR-037 formula
- New breakdown: Volume (30 pts), Quality (25 pts), Depth (15 pts), Breadth (20 pts), Bonus (5 pts)
- Updated trust tier labels: New/Active/Trusted/Highly Trusted (matching ADR-037)
- Added per-community breakdown section (from overall trust endpoint)
- Updated tips to be accurate

**2. Feed composite default (dashboard.tsx)**
- Removed auto-set of `activeCommunityId` to first community on load (was lines 248-249)
- Feed now starts as composite (all communities) — curated endpoint works without community_id
- Also removed now-unused `communityRequestParams` variable

**3. Overall trust score**
- New function `getOverallTrustScore(userId)` in `karmaService.ts` — weighted average across communities (weighted by recent interaction count)
- New endpoint `GET /reputation/trust/:userId` in `reputation.ts`
- Updated `api.ts`: `getTrustScore()` now calls overall endpoint when no communityId; `getOverallTrustScore()` added
- Updated `LeftSidebar`: extracts `trust?.score ?? trust?.overall_score` (handles both endpoints); shows "(Overall)" label when no community active
- Updated trust tier labels in LeftSidebar to match ADR-037
- Trust page now fetches overall score + shows community breakdown

**4. ADR-040: Community Trust Score**
- New migration `021-community-trust-scores.sql` — `reputation.community_trust_scores` table + `community_trust_bonding_weight/bridging_weight` columns
- New `communityTrustDb.ts` — `getCommunityTrustScore()`, `upsertCommunityTrustScore()`
- New `communityTrustService.ts` — bonding/bridging formula, runs daily in health metrics cron
- New endpoint `GET /reputation/community-trust/:communityId`
- ADR document `docs/adr/ADR-040-community-trust-score.md`
- Landing page JSON `apps/landing/src/data/docs/concepts/adr-040-community-trust-score.json`
- nav.json updated, reputation-service.json updated, CONTEXT.md updated

**Test status**: 81/81 TDD tests passing, 27/27 full suite passing

---

## Current State

### ✅ Already Implemented
- ADR-037/038/039 (full trust formula stack)
- Sprint 8: all four issues above

### ❌ Not Yet Done (before push)

1. **Commit + push** — standard process
2. **`CommunityHealthHero.tsx`** — optional enhancement: add "Community Trust: N/100" metric (deferred, not blocking)

---

## Quick Start for Next Session

### Step 1: Commit

```bash
git add apps/frontend/src/pages/reputation/trust.tsx
git add apps/frontend/src/pages/dashboard.tsx
git add apps/frontend/src/components/LeftSidebar.tsx
git add apps/frontend/src/lib/api.ts
git add services/reputation-service/src/services/karmaService.ts
git add services/reputation-service/src/routes/reputation.ts
git add services/reputation-service/src/services/communityTrustService.ts
git add services/reputation-service/src/database/communityTrustDb.ts
git add services/reputation-service/src/services/healthMetricsService.ts
git add infrastructure/postgres/migrations/021-community-trust-scores.sql
git add docs/adr/ADR-040-community-trust-score.md
git add docs/adr/README.md
git add apps/landing/src/data/docs/concepts/adr-040-community-trust-score.json
git add apps/landing/src/data/docs/nav.json
git add apps/landing/src/data/docs/services/reputation-service.json
git add services/reputation-service/CONTEXT.md
git commit -m "feat(trust): ADR-040 community trust + overall trust + feed composite default + trust page UX"
git push
```

### Optional: Surface community trust in CommunityHealthHero

- `apps/frontend/src/components/CommunityHealthHero.tsx`
- Fetch from `/reputation/community-trust/:communityId`
- Show "Community Trust: N/100" metric alongside existing network_strength

---

## Key Files Changed (Sprint 8)

| File | Change |
|------|--------|
| `apps/frontend/src/pages/reputation/trust.tsx` | New breakdown + tier labels + community breakdown section |
| `apps/frontend/src/pages/dashboard.tsx:248` | Removed auto-set of first community |
| `apps/frontend/src/components/LeftSidebar.tsx` | Overall trust label + ADR-037 tier labels |
| `apps/frontend/src/lib/api.ts` | `getTrustScore()` now calls overall endpoint; `getOverallTrustScore()` added |
| `services/reputation-service/src/services/karmaService.ts` | `getOverallTrustScore()` added |
| `services/reputation-service/src/routes/reputation.ts` | Two new endpoints: `/trust/:userId` and `/community-trust/:communityId` |
| `services/reputation-service/src/services/communityTrustService.ts` | NEW — ADR-040 formula |
| `services/reputation-service/src/database/communityTrustDb.ts` | NEW — DB read/write |
| `services/reputation-service/src/services/healthMetricsService.ts` | Wired community trust into daily cron |
| `infrastructure/postgres/migrations/021-community-trust-scores.sql` | NEW |
| `docs/adr/ADR-040-community-trust-score.md` | NEW |

---

## Open Design Questions (Phase 3)

1. **Community trust visibility** — public to non-members or admin-only?
2. **Minimum activity floor** — exclude communities with < N active members from scoring?
3. **Community trust in discovery** — surface in community search so prospective members can compare?
4. **Individual trust decay** — should inactive communities see scores decay over time?
5. **ADR-039 minimum weight floor** — `0.1` in `getWeightedAvgFeedback()` should be tunable config
6. **Negative-signal carry** — bad actors don't carry negative signals across communities (ADR-038 Open Q1)

---

## Test Status
- 81/81 TDD tests passing: `cd services/reputation-service && npx jest tests/tdd/`
- 27/27 full suite: `npm test`
