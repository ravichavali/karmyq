# SPRINT 43 READY TO EXECUTE — Feed Ranking v2

## Handoff Document

**Date**: 2026-04-03
**Current Version**: v9.17.0 → v9.18.0 (Sprint 43 planned, not yet implemented)
**Status**: Spec + plan written. Branch not yet created. Ready for implementation.

---

## Quick Start

1. Read this handoff
2. Open the implementation plan: `docs/superpowers/plans/2026-04-03-sprint-43-feed-ranking.md`
3. Create branch: `git checkout -b feature/sprint-43-feed-ranking`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

---

## Sprint 43 Goal

Make the community feed the primary driver of participation. Surface requests users are most likely to act on, and log feed outcomes so weight tuning decisions can be grounded in real data.

**North star**: more completed interactions (offers made → matches → completions).

---

## What's Being Built

### 1. Feed scoring: 7 signals (was 4)
Three new signals added to `calculateFeedScore()` in `packages/shared/src/matching/utils.ts`:
- **requesterTrustScore** (0.15 weight): Requester's community trust score — already fetched, not yet used
- **priorInteractionScore** (0.15 weight): 100 if viewer has a prior exchange with requester, 50 if community-only, 0 if none. Batch query from `social_graph.connections`
- **recencyScore** (0.05 weight): Time-decay — 100 for today's requests, 15 for 30d+ old

Existing weights redistributed: skill_match 0.25, trust_distance 0.20, community_relevance 0.15, urgency 0.10

### 2. Feed events logging
New `requests.feed_events` table: impression (on feed load) → offer_made (on match creation) → match_completed (on Bull event). Fire-and-forget, never blocks feed response. Creates dataset for future weight tuning.

### 3. CommitmentsTab sort
Change from `updated_at DESC` to `created_at ASC` within each status group. Earliest commitment first.

### 4. Feed correctness check
Verify `dibs_pending` requests don't appear in browse feed; verify both parties see CommitmentsTab after match.

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 42 | Dibs / First Refusal | ✅ Complete, deployed |
| Sprint 43 | Feed Ranking v2 + Logging | 🟡 Plan ready, not started |
| Sprint 44 | UI Pruning | ⬜ Upcoming |
| Sprint 45+ | Group Communities / Onboarding | ⬜ Future |

---

## Critical Implementation Notes (copy from spec)

1. **Weight sum constraint** — Drop the DB CHECK constraint on `community_configs`; validate in `calculateFeedScore()` (throw if weights don't sum to 1.0 ± 0.01).

2. **Existing config rows** — Migration MUST `UPDATE` all rows to new weights before finalizing. Default 0 columns break the sum immediately.

3. **Prior interaction batch query** — Single SQL, both directions on `social_graph.connections`. Score: exchange=100, community=50, none=0.

4. **Feed events non-blocking** — `setImmediate(() => void (async () => { await query(...) })())`. Never rethrow. A logging failure must never surface to the user.

5. **Recency in app layer** — Compute from `request.created_at` already in response. No extra DB join.

6. **CommitmentsTab** — `created_at ASC` within status groups. Verify `created_at` is present in matches API response; if not, add it to the query.

7. **Error messages** — Every new catch block logs structured: `{ service, endpoint, step, error }`.

---

## Key Files

| File | Role |
|------|------|
| `docs/superpowers/plans/2026-04-03-sprint-43-feed-ranking.md` | **Implementation plan — start here** |
| `docs/superpowers/specs/2026-04-03-sprint-43-feed-ranking-design.md` | Design spec |
| `packages/shared/src/matching/utils.ts` | `calculateFeedScore()`, `scoreRecency()`, `DEFAULT_FEED_WEIGHTS` |
| `packages/shared/src/matching/types.ts` | `FeedScoreInput`, `FeedScoringWeights` |
| `services/request-service/src/routes/requests.ts` | `/requests/curated` endpoint (lines 224–711) |
| `apps/frontend/src/utils/commitmentSort.ts` | CommitmentsTab sort utility |
| `infrastructure/postgres/migrations/20260403-feed-ranking-v2.sql` | DB migration (to create) |

---

## Current State

- **Branch**: `master`
- **Latest commit**: `4c8844e fix(dibs): fix double-redirect on notification click`
- **CI/CD**: All green ✅
- **Demo server**: Healthy

---

## Known Issues (carry-forward)

1. **GitHub security vulnerabilities** (32 total: 1 critical, 18 high, 11 moderate, 2 low) — Dependabot alerts. Address before investor review.
2. **Pre-existing TypeScript warnings** — unused params in notificationTemplates.ts, feed.ts, feedComposer.ts, cleanup-service helpers. Low-priority.
3. **TDD integration tests** (`tests/tdd/sprint-42-dibs.test.ts`) — 11 tests fail with "Services not available" (expected in CI). Need live integration env to promote to regression.

---

## Persistent Context

### JWT Field
JWT payload uses `communities` (NOT `communityMemberships`) for the membership array.
Auth middleware: `const memberships = user.communities ?? []`

### Nginx Config
`infrastructure/nginx/nginx.conf` is source of truth — deploy.sh copies + reloads on each deploy.

### Module Resolution
`@karmyq/shared` subpaths require `moduleResolution: "node16"` and `module: "node16"`.

### Community Config Templates
Three existing presets in `community_configs`: Cohousing Default, Neighborhood Cautious, Experimental Reciprocal. Migration must update all three to new 7-weight distribution.

### Error Observability (ongoing practice)
Not a dedicated sprint. Every code path must produce structured, human-readable errors:
`{ service, endpoint, step, error }`. Distinguish 400 (user error) from 500 (unexpected).
