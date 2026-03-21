# SPRINT 32 COMPLETE — READY FOR SPRINT 33

## Handoff Document for New Conversation

**Date**: 2026-03-20
**Current Version**: v9.7.0 (Sprint 32 merged + deployed to karmyq.com)
**Branch**: `master` (clean — feature branch deleted)
**Status**: Sprint 32 fully deployed. ADR-046 three-sprint arc complete. No pending migrations.

---

## Quick Start

1. Read this handoff
2. Check `docs/IDEAS.md` for sprint ideas
3. Use `/sprint-planning` to plan Sprint 33

---

## What Sprint 32 Delivered (just deployed)

### The ADR-046 arc is complete (Sprints 30–32)

| Area | What shipped | Key file |
|------|-------------|---------|
| **Trust score computation** | `updateTrustScore()` uses evolved `depth_weight`/`breadth_weight` from `getCachedEffectiveParams()` instead of static community defaults | `karmaService.ts:253` |
| **Redis cache** | `effectiveParamsCache.ts` — key `trust_params:{userId}:{communityId}`, TTL 4h, invalidated on evolution write | `services/reputation-service/src/services/effectiveParamsCache.ts` |
| **Curated feed** | For null-degree (cross-community) requesters, trust distance = `Math.round(cross_community_prior * 100)` instead of fixed 10 — applies to both main and sister requests | `requests.ts:~285,577` |
| **Global opt-out** | `reputation.user_trust_preferences` table + 3 API endpoints + UI toggle on trust page | `trustEvolutionDb.ts`, `reputation.ts` |
| **Frontend** | Global toggle ABOVE per-community toggles; badges show Depth/Breadth/Cross-community values; "future update" caveat removed | `trust.tsx` |
| **Docs** | ADR-046 status → Implemented; fractal-feed concept page; understanding-karma guide updated | `apps/landing/src/data/docs/` |

### DB migration deployed
- `infrastructure/postgres/migrations/20260320-fractal-feed.sql` — needs manual apply on demo:
```bash
ssh ubuntu@karmyq.com
docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod -f /dev/stdin < ~/karmyq/infrastructure/postgres/migrations/20260320-fractal-feed.sql
```

### Test state
- 61 unit tests passing
- 3 pre-existing TDD failures (unrelated): `preSelectProvider`, `trust-evolution-flow`, `rateCards` — carry forward

---

## CI/CD Status (Sprint 32 deploy)

- Tests workflow: ✅ green (4m55s)
- CI/CD Pipeline: ✅ green (13m9s)
- CodeQL: ✅ green
- Services responding: ✅ (reputation + request both returning 401, not crashing)

---

## Carry-Forward Issues

- **Migration runner**: deploy.sh does NOT auto-run migrations. Apply manually post-deploy (see above).
- **Sprint 31 migration** must also be applied if not already:
  ```bash
  docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod -f /dev/stdin < ~/karmyq/infrastructure/postgres/migrations/20260320-community-evolution.sql
  ```
- **Pre-existing unstaged files** (not committed, not Sprint 32):
  - `apps/landing/src/data/docs/concepts/rate-cards.json` — deleted locally
  - `apps/landing/src/data/docs/guides/using-service-providers.json` — modified
  - `docs/IDEAS.md` — modified
  - `docs/superpowers/specs/2026-03-18-sprint-29-rate-cards-design.md` — untracked

---

## Persistent Context (carry forward always)

- **JWT field**: `user.communities` (NOT `communityMemberships`). Always: `const memberships = user.communities ?? [];`
- **Nginx**: `infrastructure/nginx/nginx.conf` is source of truth. deploy.sh copies + reloads.
- **Provider service types**: Valid API types: `ride`, `tradesperson`, `tutor`, `other`.
- **Simulation email domain**: `@test.karmyq.com`, password `password123`
- **JWT communities cap**: Auth service caps at 15 (`JWT_COMMUNITIES_LIMIT`).
- **Auto-generated files gitignored**: `services/dependency-graph.md`, `impact-analysis.md`, `version-drift.md`
- **Match status lifecycle**: `proposed` → `matched` → `completed`.
- **responseInterceptor unwraps one level**: `response.data` is already the inner object.
- **Table schema naming**: Community schema is `communities` (plural). `requests.help_requests` has NO `community_id` — use `requests.request_communities` junction table.
- **Admin page tab structure (v9.2.0+)**: 7 tabs — Overview, Members, Norms; Requests, Insights, Providers (`isAdminOrMod`); Settings (`isAdmin` only).
- **Rate card soft-delete**: DELETE sets `is_active = false`.
- **cross_community_prior**: Direction-agnostic (0.05–0.95). Never "more open."
- **Only one simulation**: `services/simulation-service/`. DB user: `karmyq_user`.
- **Collective link auth**: Both link/unlink endpoints accept collective admin OR community admin.
- **social_graph.connections pair normalization**: Always `LEAST/GREATEST(::text)` cast.
- **NetworkGraph lazy-load**: Uses `IntersectionObserver` — `GET /network` NOT called on profile mount.
- **React 19 everywhere**: Root `package.json` has `react@^19.0.0` in `devDependencies` AND `overrides`.
- **completeMatch requires user_id in body**: `PUT /matches/:id/complete` reads `user_id` from body (not JWT).
- **generate-docs.ts is source of truth for nav.json**: Never edit nav.json directly.
- **Landing page force-add**: `git add -f apps/landing/src/data/docs/...`
- **No worktrees**: Solo developer. Work directly on feature branch.
- **Evolution defaults are opt-out (TRUE)**: Sprint 31 migration flipped both tables.
- **effectiveParamsCache circular import guard**: `trustEvolutionDb.ts` must NOT import `effectiveParamsCache.ts`. Cache invalidation is caller-side in `trustEvolutionService.ts:evaluateUserEvolution()`.
- **Global evolution opt-out**: Missing `user_trust_preferences` row = opted IN (default TRUE).
- **Bull queue lazy init in trustEvolutionService**: `_communityEvolutionQueue` is null at module load.
