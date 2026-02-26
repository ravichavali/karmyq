# Sprint 5: Feed Restructure + Trust Score Bug Fix — COMPLETE ✅

## Handoff Document for New Conversation

**Date**: 2026-02-26
**Current Version**: v9.1.0
**Status**: Feed restructure and trust score bug fix shipped; ready for Sprint 6

---

## What We Just Completed (this session)

### Trust Score Bug Fix
- ✅ `karmaService.ts:getUserTrustScore()` was reading non-existent columns (`avg_helpfulness`, `avg_responsiveness`, `avg_clarity`) — feedback contribution was always 0 on read
- ✅ Fixed: now calls `getAvgFeedback(user_id)` from `feedbackDb.ts` — same source as POST feedback endpoint
- ✅ Read and write paths now consistent — star ratings actually affect displayed trust score

### Feed Restructuring
- ✅ Own requests with **zero offers** no longer appear in the feed (nothing to act on)
  - Own requests WITH at least one pending offer still show as amber cards
- ✅ Left panel community click now **filters the feed** instead of navigating to the community page
  - Clicking the active community again deselects it (reverts to all communities)
  - "Your Communities" header link still navigates to full community management page
- ✅ When a community is selected → feed uses `GET /requests/curated` (trust-scored, preference-aware)
- ✅ When no community selected → raw combined fetch across all communities (existing behavior)
- ✅ `activeCommunityId` added to filter re-fetch dependency — feed re-fetches on community change

### Key Design Decisions (do not re-debate)
- **No `user_id` in curated params** — curated endpoint reads user from JWT, not query params
- **Community filter is toggle** — clicking active community deselects (shows all), not a permanent state
- **All communities = raw fetch** — curated endpoint requires a single `community_id`; pooling across communities would require N parallel calls or a backend change; deferred

---

## Current State (v9.1.0)

### ✅ Already Implemented
- Fixed karma pool model (ADR-035)
- Private feedback ratings after match (ADR-036) — star picker, fire-and-forget
- Trust score formula: `50 + min(40,floor(karma/10)) + round((avg_feedback/5)×10)` — now actually reads feedback (**interim formula; ADR-037 target is the next major milestone**)
- Feed filter panel (trust distance + request type) — works end-to-end when community is selected (curated endpoint applies server-side)
- Left panel community → filter feed (not navigate)
- Own requests shown only when someone has responded

### ❌ Not Yet Implemented

#### High Priority: ADR-037 Trust Score Formula (Phase 2)
The most important upcoming work. Fully designed, not yet coded. See [ADR-037](docs/adr/ADR-037-multi-signal-trust-score.md).

Formula to implement:
```
volume_score    = min(30, floor(log2(interactions_completed + 1) × 10))
quality_score   = round(((avg_feedback_score - threshold) / (5 - threshold)) × 25)
                  // threshold = community_feedback_threshold (default 3.0)
depth_score     = min(15, repeat_interaction_pairs × 2) × community_depth_weight
breadth_score   = (min(10, distinct_people × 2) + min(10, distinct_communities × 3)) × community_breadth_weight
bonus_score     = interactions_completed >= min_interactions_for_trust ? 5 : 0
floor           = community_negative_allowed ? -50 : 0
trust_score     = max(floor, min(100, raw_score))
```

Files to create/update:
1. `services/reputation-service/src/services/trustScoreStrategy.ts` — new formula + interface
2. `services/reputation-service/src/database/trustMetricsDb.ts` — NEW: `getTrustMetrics(userId, communityId)`
3. `services/reputation-service/src/services/karmaService.ts` — read new config fields + call getTrustMetrics
4. `services/reputation-service/src/routes/reputation.ts` — feedback endpoint wiring
5. `services/reputation-service/tests/tdd/trustScoreStrategy.test.ts` — new signal tests

#### Other Sprint Candidates
- **Notification bell** — port 3005, endpoints exist (`GET /notifications/:userId`, `PUT /notifications/:id/read`), no frontend
- **Cross-community trust assignment** — open question documented in ADR-037 §Open Question 5; defer to Phase 3

---

## Key Files Reference

### Feed (just changed)
- `apps/frontend/src/pages/dashboard.tsx` — Priority 3 filter (lines ~289-298), curated fetch (lines ~217-230), activeCommunityId in useEffect dep (line ~193)
- `apps/frontend/src/components/LeftSidebar.tsx` — `onCommunityChange` prop, toggle click (lines ~141-152)

### Trust score (just fixed)
- `services/reputation-service/src/services/karmaService.ts` — `getUserTrustScore()` now calls `getAvgFeedback()` (line ~411)
- `services/reputation-service/src/database/feedbackDb.ts` — `getAvgFeedback()` source of truth

### ADR-037 implementation targets (next sprint)
- `services/reputation-service/src/services/trustScoreStrategy.ts` — formula to replace
- `services/reputation-service/src/database/` — add `trustMetricsDb.ts` here
- `infrastructure/postgres/init.sql` lines 847–917 — community_configs JSONB (add `trust_negative_allowed`, `trust_feedback_threshold`)

---

## Quick Start for Next Session

### To start ADR-037 Phase 2 implementation:

1. **Read the ADR** (complete design, ready to implement):
   ```bash
   cat docs/adr/ADR-037-multi-signal-trust-score.md
   ```

2. **Read current trustScoreStrategy**:
   ```bash
   cat services/reputation-service/src/services/trustScoreStrategy.ts
   cat services/reputation-service/src/services/karmaService.ts
   ```

3. **Check existing DB patterns** (to follow for trustMetricsDb):
   ```bash
   cat services/reputation-service/src/database/feedbackDb.ts
   cat services/reputation-service/src/database/karmaDb.ts
   ```

4. **Run baseline tests before changing anything**:
   ```bash
   cd services/reputation-service && npx jest tests/tdd/
   ```

5. **Implement in order**: trustScoreStrategy.ts → trustMetricsDb.ts → karmaService.ts → reputation.ts → tests

---

## Open Design Questions (to discuss, not yet resolved)

1. **Cross-community trust assignment** — when a match spans multiple communities, which community's trust score gets the signal? Documented as Open Question #5 in ADR-037. Phase 2 simplification: use `community_id` from karma_record. Phase 3 to revisit.

2. **Feed "all communities" curation** — currently raw/unscored when no community is selected. Future: could add a backend endpoint that curates across all user communities.

---

## Success Definition

Sprint 5 complete:
- ✅ Trust score now reflects star ratings (bug fixed)
- ✅ Feed filtered by community click (left panel)
- ✅ Curated endpoint used when community is selected
- ✅ Own requests with no engagement hidden from feed
- ✅ All 178 frontend + 41 reputation-service tests passing
