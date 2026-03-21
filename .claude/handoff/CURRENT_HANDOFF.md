# SPRINT 33 READY TO EXECUTE — UX FOUNDATION

## Handoff Document for New Conversation

**Date**: 2026-03-20
**Current Version**: v9.7.1 (Sprint 32 + post-deploy fixes on master)
**Branch**: `master` (clean — start new feature branch per Quick Start)
**Status**: Sprint 33 planned and ready. Design spec + implementation plan written.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-33-ux-foundation`
3. Open plan: `docs/superpowers/plans/2026-03-20-sprint-33-ux-foundation.md`
4. Run: `/execute-plan` (uses `superpowers:subagent-driven-development`)

---

## Sprint 33 Goal

**Make Karmyq feel intentional.** Design consistency across all pages, guided first-time onboarding, empty states everywhere, performance improvements for slow connections, landing page fixes, and plain-language guide rewrites. First sprint of a multi-sprint UX arc — web-first, mobile deferred to Sprint 34.

---

## Multi-Sprint UX Arc

| Sprint | Focus |
|--------|-------|
| **33 (this)** | Web foundation: design consistency + onboarding + landing fixes + guide rewrites + performance |
| **34** | Mobile responsiveness (hamburger nav, dashboard tab bar) + core flows (community join, request creation) |
| **35** | Admin simplification, social graph naturalness, deep performance pass |

---

## What Sprint 33 Delivers (v9.7.1 → v9.8.0)

| Area | What changes |
|------|-------------|
| **Design system** | Canonical `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.card`, `.input`, `.section-heading` in `globals.css @layer components`. Applied across high-traffic pages. |
| **Empty states** | New `EmptyState.tsx` component wired into dashboard, communities, requests, offers |
| **Onboarding** | New `WelcomeModal.tsx` — 3-step guide shown on first dashboard visit (localStorage `karmyq_onboarded` flag) |
| **Evolution toggle** | Moved from `reputation/trust.tsx` → `profile.tsx` (correct home for a one-time preference) |
| **Performance** | `next/dynamic` + `ssr: false` for `NetworkGraph`, `CommunityConfigEditor`, `SchemaCanvas` |
| **Landing page bugs** | 3 truncated ADR nav labels fixed; ADR-007 status "unknown" → "implemented"; 11 orphaned ADRs added to sidebar nav |
| **Landing page copy** | Hero: plain-language rewrite (no "gift economy"/"infrastructure" jargon) |
| **User guides** | `getting-started-guide.md` + `making-requests-guide.md` rewritten for non-technical readers |

---

## Spec and Plan Files

- **Design spec**: `docs/superpowers/specs/2026-03-20-sprint-33-ux-foundation-design.md`
- **Implementation plan**: `docs/superpowers/plans/2026-03-20-sprint-33-ux-foundation.md`

---

## ⚠️ Critical Implementation Notes

1. **`generate-docs.ts` is source of truth for `nav.json`** — NEVER edit `apps/landing/src/data/docs/nav.json` directly. All landing fixes go in `scripts/generate-docs.ts`:
   - Line 453: `.slice(0, 55)` → `.slice(0, 80)` (label truncation)
   - Line 58: fix `extractAdrStatus` regex to skip emoji before status word
   - Lines 371–431 (`ADR_GROUPS`): add 11 orphaned ADR slugs

2. **`git add -f` for generated docs** — `apps/landing/src/data/docs/` may be gitignored. Always force-add before commit.

3. **WelcomeModal hydration safety** — `visible` initializes `false`; set to `true` only in `useEffect`. Never read `localStorage` at render time.

4. **`next/dynamic` requires `ssr: false`** for all three heavy components (`NetworkGraph`, `CommunityConfigEditor`, `SchemaCanvas`).

5. **EmptyState guard** — only render when `!loading && items.length === 0`.

6. **Evolution toggle duplication** — `TrustEvolutionToggle` sub-component will be temporarily copied into `profile.tsx`. Sprint 34 cleanup extracts it to a shared file.

7. **Evolution communities in `profile.tsx`** — read from localStorage JWT, no extra API call: `JSON.parse(localStorage.getItem('user') || '{}')?.communities ?? []`.

8. **Design consistency = targeted fixes only** — replace visible divergence; don't refactor consistent components.

9. **Guide source files are markdown** — edit `docs/guides/*.md`, then run `generate-docs.ts` to propagate to JSON.

10. **No `services/registry.json` changes** — pure frontend sprint.

---

## Carry-Forward Issues (from Sprint 32)

- **Migration runner**: deploy.sh does NOT auto-run migrations. Apply manually post-deploy if needed:
  ```bash
  ssh ubuntu@karmyq.com
  docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod -f /dev/stdin < ~/karmyq/infrastructure/postgres/migrations/20260320-fractal-feed.sql
  ```
- **Pre-existing unstaged files** (not related to Sprint 33):
  - `apps/landing/src/data/docs/concepts/rate-cards.json` — deleted locally
  - `apps/landing/src/data/docs/guides/using-service-providers.json` — modified
  - `docs/IDEAS.md` — modified
  - `docs/superpowers/specs/2026-03-18-sprint-29-rate-cards-design.md` — untracked
- **Pre-existing test failures** (carry forward, not Sprint 33 regressions): `preSelectProvider`, `trust-evolution-flow`, `rateCards`

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
- **NetworkGraph lazy-load**: Uses `IntersectionObserver` — `GET /network` NOT called on profile mount. Sprint 33 also wraps with `next/dynamic`.
- **React 19 everywhere**: Root `package.json` has `react@^19.0.0` in `devDependencies` AND `overrides`.
- **completeMatch requires user_id in body**: `PUT /matches/:id/complete` reads `user_id` from body (not JWT).
- **generate-docs.ts is source of truth for nav.json**: Never edit nav.json directly.
- **Landing page force-add**: `git add -f apps/landing/src/data/docs/...`
- **No worktrees**: Solo developer. Work directly on feature branch.
- **Evolution defaults are opt-out (TRUE)**: Sprint 31 migration flipped both tables.
- **effectiveParamsCache circular import guard**: `trustEvolutionDb.ts` must NOT import `effectiveParamsCache.ts`. Cache invalidation is caller-side in `trustEvolutionService.ts:evaluateUserEvolution()`.
- **Global evolution opt-out**: Missing `user_trust_preferences` row = opted IN (default TRUE).
- **Bull queue lazy init in trustEvolutionService**: `_communityEvolutionQueue` is null at module load.
- **REPUTATION_API_URL in Docker**: Must be `http://reputation-service:3004` — NOT `localhost:3004`. Set in both docker-compose files.
- **Feed empty after deploy**: Transient — simulation restarts during `docker compose down/up` and needs warm-up time. Not a code regression.
- **Sprint 33 new patterns**: `karmyq_onboarded` localStorage key controls WelcomeModal; `next/dynamic` + `ssr: false` used for `NetworkGraph`/`CommunityConfigEditor`/`SchemaCanvas`; canonical classes in `globals.css`.
