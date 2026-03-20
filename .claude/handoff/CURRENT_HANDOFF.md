# SPRINT 32 READY TO EXECUTE

## Handoff Document for New Conversation

**Date**: 2026-03-20
**Current Version**: v9.6.0 (Sprint 31 merged + deployed)
**Branch**: Create `feature/sprint-32-fractal-feed` (see Quick Start)
**Status**: Sprint 31 merged to master, CI/CD deploying to karmyq.com. Sprint 32 designed and ready.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-32-fractal-feed`
3. Open plan: `docs/superpowers/plans/2026-03-20-sprint-32-fractal-feed.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

> **Before Sprint 32 deploys**: apply Sprint 31 migration on demo if not done:
> ```bash
> ssh ubuntu@karmyq.com
> docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod -f /dev/stdin < infrastructure/postgres/migrations/20260320-community-evolution.sql
> ```

---

## Sprint 32 Goal

Wire `getUserEffectiveParams()` into trust score computation and curated feed ranking so the three-sprint evolution arc (ADR-046) has real impact on what users see and how their trust scores are computed.

---

## The 3-Sprint Arc (ADR-046)

- **Sprint 30** ✅ — Individual trust config + evolution engine + history report
- **Sprint 31** ✅ — Community evolution: aggregate member deltas → community config drift
- **Sprint 32** (this sprint) — Fractal feed: evolved params wired into trust scores + curated feed; global opt-out surfaced in UI; arc complete

---

## What Sprint 32 Delivers

| Area | What ships |
|------|-----------|
| **Trust score computation** | `updateTrustScore()` uses evolved `depth_weight`/`breadth_weight` from `getUserEffectiveParams()` instead of static community defaults |
| **Curated feed** | For null-degree (cross-community) requesters, trust distance score = `Math.round(cross_community_prior * 100)` instead of fixed 10 |
| **Redis cache** | `effectiveParamsCache.ts` — key `trust_params:{userId}:{communityId}`, TTL 4h, invalidated on evolution write |
| **Global opt-out** | New table `reputation.user_trust_preferences (user_id, global_evolution_enabled)` + 3 new API endpoints + UI toggle on trust page |
| **Frontend** | Global toggle above per-community toggles; effective params shown as read-only badges; "future update" caveat removed |
| **Docs** | ADR-046 status → Implemented; fractal-feed concept page; trust-evolution guide updated |

---

## ⚠️ Critical Implementation Notes

1. **`getUserEffectiveParams()` is already safe for null userConfig** — falls back to community defaults (karmaService.ts:82–85). No extra null guards needed.

2. **`updateTrustScore()` partial replacement** — only replace `depth_weight` and `breadth_weight` with effective params. Keep `feedback_threshold`, `min_interactions_for_bonus`, `negative_allowed` from community config (community policy, not user calibration).

3. **Redis cache key**: `trust_params:{userId}:{communityId}`, TTL 14400s (4h). Invalidate in `evaluateUserEvolution()` after each `upsertUserTrustConfig()` call (caller-side pattern to avoid circular import).

4. **Cross-community prior formula**: `degrees !== null ? scoreTrustDistance(degrees) : Math.round(cross_community_prior * 100)`. At prior=0.5 → 50 (up from fixed 10). Intentional behavior change.

5. **Effective params HTTP call in request-service**: Fetch from reputation service at start of curated handler. Fall back to `{ depth_weight: 0.6, breadth_weight: 0.4, cross_community_prior: 0.5 }` if call fails — never block the feed.

6. **Global opt-out gate**: Check `user_trust_preferences.global_evolution_enabled` FIRST in `isEvolutionEligible()`. Missing row = opted in (default TRUE).

7. **`generate-docs.ts` is source of truth** — never edit `nav.json` directly. Run `npm run generate-docs` in `apps/landing/` after changes.

8. **Global toggle placement**: ABOVE per-community toggles in `trust.tsx`. When global OFF, per-community toggles are grayed out with "global evolution paused" note.

9. **Circular import guard**: `trustEvolutionDb.ts` → `effectiveParamsCache.ts` → `trustEvolutionService.ts` → `trustEvolutionDb.ts` is circular. Call `invalidateEffectiveParamsCache()` from `trustEvolutionService.ts`'s `evaluateUserEvolution()` (caller side), not from inside `trustEvolutionDb.ts`.

10. **Sister community requests** in curated feed also need the cross-community prior applied — there's a second `calculateFeedScore` call around line 581 in `requests.ts`. Apply the same null-degree treatment there.

---

## Key Integration Points

### `karmaService.ts:updateTrustScore()` (line ~253)
```typescript
// BEFORE:
const [trustConfig, avg_feedback_score, trustMetrics] = await Promise.all([...])
depth_weight: trustConfig.depth_weight,
breadth_weight: trustConfig.breadth_weight,

// AFTER:
const [trustConfig, avg_feedback_score, trustMetrics, effectiveParams] = await Promise.all([
  ..., getCachedEffectiveParams(user_id, community_id)
])
depth_weight: effectiveParams.depth_weight,   // evolved
breadth_weight: effectiveParams.breadth_weight, // evolved
```

### `requests.ts:GET /requests/curated` (null-degree requesters)
```typescript
const trustDistance = degrees !== null
  ? scoreTrustDistance(degrees)
  : Math.round(userEffectiveParams.cross_community_prior * 100);
```

### `trustEvolutionService.ts:isEvolutionEligible()` (global gate first)
```typescript
const [globalPref, communityEvolution, userConfig, lastEvolution] = await Promise.all([
  getGlobalEvolutionPreference(userId), ...
]);
if (!globalPref) return false; // global gate — new
if (!communityEvolution.community_evolution_enabled) return false;
```

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `infrastructure/postgres/migrations/20260320-fractal-feed.sql` | `reputation.user_trust_preferences` table |
| `services/reputation-service/src/services/effectiveParamsCache.ts` | Redis cache: get/set/invalidate effective params |
| `tests/unit/reputation/fractalFeed.test.ts` | Unit tests (TDD — write first) |
| `tests/tdd/fractal-feed-flow.test.ts` | Integration test |
| `docs/concepts/fractal-feed.md` | Source for landing page concept page |

### Modified files
| File | Change |
|------|--------|
| `services/reputation-service/src/services/karmaService.ts` | Wire effective params into `updateTrustScore()` |
| `services/reputation-service/src/services/trustEvolutionService.ts` | Global opt-out gate in `isEvolutionEligible()` + cache invalidation |
| `services/reputation-service/src/database/trustEvolutionDb.ts` | New DB helpers: `getGlobalEvolutionPreference`, `upsertGlobalEvolutionPreference` |
| `services/reputation-service/src/routes/reputation.ts` | 3 new endpoints: effective-params GET, evolution-global GET/PUT |
| `services/request-service/src/routes/requests.ts` | Cross-community prior in curated feed + sister requests |
| `apps/frontend/src/pages/reputation/trust.tsx` | Global opt-out toggle + effective params display + caveat removal |
| `apps/frontend/src/lib/api.ts` | 3 new methods: getGlobalEvolutionSetting, setGlobalEvolutionSetting, getEffectiveParams |
| `infrastructure/postgres/init.sql` | Add `user_trust_preferences` table |
| `services/reputation-service/CONTEXT.md` | Document 3 new endpoints |
| `services/registry.json` | Add 3 new endpoints |
| `scripts/generate-docs.ts` | Add fractal-feed + update ADR-046 + update trust-evolution guide |

---

## Carry-Forward Issues

- **Migration runner**: deploy.sh does NOT auto-run migrations. Apply manually: `docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod -f /dev/stdin < migration.sql`
- **Sprint 31 migration must be applied first** on demo before Sprint 32 deploys

---

## Persistent Context (carry forward always)

- **JWT field**: `user.communities` (NOT `communityMemberships`). Always: `const memberships = user.communities ?? [];`
- **Nginx**: `infrastructure/nginx/nginx.conf` is source of truth. deploy.sh copies + reloads. Manual: `sudo cp ... && sudo nginx -t && sudo systemctl reload nginx`
- **Provider service types**: Valid API types: `ride`, `tradesperson`, `tutor`, `other`. Never `skill`, `errand`, `care`.
- **Simulation email domain**: `@test.karmyq.com`, password `password123`
- **JWT communities cap**: Auth service caps at 15 (`JWT_COMMUNITIES_LIMIT`). Full membership always checked via DB.
- **Auto-generated files gitignored**: `services/dependency-graph.md`, `impact-analysis.md`, `version-drift.md`
- **Match status lifecycle**: `proposed` → `matched` → `completed`. No `active` status.
- **responseInterceptor unwraps one level**: `response.data` is already the inner object. Never `response.data?.data`.
- **Table schema naming**: Community schema is `communities` (plural). `requests.help_requests` has NO `community_id` — use `requests.request_communities` junction table.
- **Admin page tab structure (v9.2.0+)**: 7 tabs — Overview, Members, Norms (always visible); Requests, Insights, Providers (`isAdminOrMod`); Settings (`isAdmin` only).
- **Rate card soft-delete**: DELETE sets `is_active = false`. Public GET only returns active cards.
- **cross_community_prior**: Direction-agnostic (0.05–0.95). UI language: "Your cross-community trust calibration." Never "more open."
- **Only one simulation**: `services/simulation-service/`. DB user: `karmyq_user`, organic growth.
- **Collective link auth**: Both link/unlink endpoints accept collective admin OR community admin via `user.communities` JWT.
- **social_graph.connections pair normalization**: Always `LEAST/GREATEST(::text)` cast. Both INSERT and ON CONFLICT.
- **NetworkGraph lazy-load**: Uses `IntersectionObserver` — `GET /network` is NOT called on profile mount.
- **React 19 everywhere**: Root `package.json` has `react@^19.0.0` in `devDependencies` AND `overrides`.
- **providerTrustService is the single formula source**: `recalculateProviderTrustScore` called from both `subscriber.ts` and `providerReviews.ts`.
- **completeMatch requires user_id in body**: `PUT /matches/:id/complete` reads `user_id` from request body (not JWT).
- **preferred_provider_id validation order**: PROVIDER_NOT_FOUND → PROVIDER_INACTIVE → PROVIDER_TYPE_MISMATCH — all before Zod schema validation.
- **generate-docs.ts is source of truth for nav.json**: Never edit nav.json directly. Run `npm run generate-docs` in apps/landing/ after changes. Concept pages come from `docs/concepts/*.md`.
- **Landing page force-add**: `git add -f apps/landing/src/data/docs/...` since directory is gitignored but files are tracked.
- **No worktrees**: Solo developer. Work directly on feature branch.
- **Evolution defaults are opt-out (TRUE)**: Sprint 31 migration flipped both tables. Community evolution defaults to enabled.
- **community evolution — Bull queue key is community_id**: `karmyq-community-evolution` queue uses community_id as job ID for deduplication.
- **Bull queue lazy init in trustEvolutionService**: `_communityEvolutionQueue` is null at module load; created on first `evaluateUserEvolution` call. Fire-and-forget `.add().catch()` pattern.
