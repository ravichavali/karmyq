# SPRINT 32 READY TO EXECUTE

## Handoff Document for New Conversation

**Date**: 2026-03-20
**Current Version**: v9.6.0 (Sprint 31 merged + deployed)
**Branch**: Create `feature/sprint-32-fractal-feed` (see Quick Start)
**Status**: Sprint 31 merged to master, CI/CD deploying to karmyq.com. Sprint 32 is next.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-32-fractal-feed`
3. Sprint 32 goal: **Fractal feed — feed/matching uses blended individual + community evolved params**
4. Before implementing: run `/sprint-planning` to design Sprint 32

> **Before Sprint 32 deploys**: apply Sprint 31 migration on demo:
> ```bash
> ssh ubuntu@karmyq.com
> docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod -f /dev/stdin < infrastructure/postgres/migrations/20260320-community-evolution.sql
> ```

---

## The 3-Sprint Arc (ADR-046)

- **Sprint 30** ✅ — Individual trust config + evolution engine + history report
- **Sprint 31** ✅ — Community evolution: aggregate member deltas → community config drift
- **Sprint 32** (next) — Fractal feed: feed/matching uses blended individual + community model

---

## What Sprint 31 Delivered

### New files
| File | What it does |
|------|-------------|
| `infrastructure/postgres/migrations/20260320-community-evolution.sql` | Flips evolution defaults to TRUE; adds `community_evolution_log` table |
| `services/reputation-service/src/database/communityEvolutionDb.ts` | All DB reads/writes for community evolution |
| `services/reputation-service/src/services/communityEvolutionService.ts` | Aggregation (median delta), damping (interaction rate health), 3-param nudge |
| `docs/adr/ADR-047-community-evolution-engine.md` | Architecture Decision Record |
| `docs/concepts/community-evolution.md` | Source for landing page concept page |
| `tests/unit/reputation/communityEvolutionService.test.ts` | 13 unit tests (all pass) |
| `tests/tdd/community-evolution-flow.test.ts` | Integration test placeholders |

### Modified files
| File | What changed |
|------|-------------|
| `services/reputation-service/src/services/trustEvolutionService.ts` | Fires community evolution queue (lazy init, fire-and-forget) after user evolution |
| `services/reputation-service/src/events/subscriber.ts` | `karmyq-community-evolution` Bull queue consumer |
| `services/reputation-service/src/routes/reputation.ts` | 3 new admin endpoints (history, summary, toggle) |
| `apps/frontend/src/pages/communities/[id].tsx` | Community evolution summary in `CommunityTrustEvolutionSection` |
| `apps/frontend/src/pages/reputation/trust.tsx` | "Contributing to community calibration" note |
| `apps/frontend/src/lib/api.ts` | 3 new reputationService methods |
| `infrastructure/postgres/init.sql` | Evolution defaults flipped to TRUE; `community_evolution_log` table added |
| `scripts/generate-docs.ts` | Added `adr-047` + `community-evolution` to nav generation |

### Key decisions made this session
- **Lazy Bull queue init** in `trustEvolutionService.ts` — prevents Redis connection at module import time from blocking unit tests
- **Fire-and-forget** queue add — `evaluateUserEvolution` doesn't await the queue job (non-critical path)
- **`generate-docs.ts` is the source of truth for nav.json** — never edit `nav.json` directly; it's regenerated on prebuild. Edit `scripts/generate-docs.ts` instead.
- **Concept pages come from `docs/concepts/*.md`** — not from JSON files in `apps/landing/`. Create the markdown source, let the generator produce the JSON.

---

## Sprint 32 Design Context

### What needs to happen
`getUserEffectiveParams()` already exists in `trustEvolutionService.ts` and returns blended params — but it's **not yet wired** into `updateTrustScore()` or the feed/matching pipeline. Sprint 32 connects it.

### Key integration point
`services/reputation-service/src/services/trustEvolutionService.ts:61`
```typescript
export async function getUserEffectiveParams(userId, communityId) {
  // Returns: { depth_weight, breadth_weight, cross_community_prior }
  // Blends user overrides + community defaults
  // NOT YET USED by feed/matching — this is Sprint 32's job
}
```

### What Sprint 32 should wire up
1. **Feed scoring** — `services/reputation-service/src/services/communityTrustService.ts` uses trust weights for feed ranking. Replace static community config weights with `getUserEffectiveParams()` output.
2. **Match scoring** — `requests.matches` responder ranking should use evolved cross-community prior when scoring cross-community candidates.
3. **Blend factor** — ADR-046 describes `(user_personal, community, blend_factor)` triple. Sprint 32 can start simple: just use `getUserEffectiveParams()` which already does the blend.

---

## ⚠️ Critical Notes (carry forward)

- **Migration runner**: `deploy.sh` does NOT auto-run migrations. Apply manually: `docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod -f /dev/stdin < migration.sql`
  *(DB user: `karmyq_prod`, DB: `karmyq_prod`)*
- **Landing page nav**: Edit `scripts/generate-docs.ts` (NOT `apps/landing/src/data/docs/nav.json`). Run `npm run generate-docs` in `apps/landing/` after changes.
- **Concept pages**: Source is `docs/concepts/*.md` → generator writes to `apps/landing/src/data/docs/concepts/`
- **Landing page force-add**: `git add -f apps/landing/src/data/docs/...` since the directory is gitignored but files are tracked
- **Registry.json events must be plain strings**: Landing page build fails if events are objects
- **Community page is the admin page**: `/communities/[id]/admin` redirects to `/communities/[id]`. Tabs are role-gated.
- **init.sql must stay in sync with migrations**: Add new columns/tables to both
- **Trust score is 0-100 integer**: Stored as integer, display as-is
- **LSP diagnostics are false positives**: `npx tsc --noEmit` is source of truth
- **No worktrees**: Solo developer. Work directly on feature branch
- **trust evolution — getUserEffectiveParams not wired to updateTrustScore**: Intentional. Sprint 32 connects it. Evolution log fills but displayed scores don't change yet.
- **community evolution — evolution defaults are now TRUE (opt-out)**: Sprint 31 migration flips both tables. Existing rows updated.
- **community evolution — no snapshot table**: Baselines from first `old_value` in `user_trust_evolution_log`.
- **community evolution — Bull queue key is community_id**: `karmyq-community-evolution` queue uses community_id as job ID for deduplication.
- **community evolution — minimum 3 contributing members**: Fewer than 3 → skip cycle.
- **community evolution — hop count needs 3 consecutive prior cycles**: `trust_path_max_hops` only shifts after 3 consecutive `community_evolution_log` entries for `cross_community_prior` agree on direction.
- **Bull queue lazy init in trustEvolutionService**: `_communityEvolutionQueue` is null at module load; created on first `evaluateUserEvolution` call. Fire-and-forget `.add().catch()` pattern.

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
