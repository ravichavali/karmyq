# SPRINT 40 READY TO EXECUTE

## Handoff Document for New Conversation

**Date**: 2026-03-25
**Current Version**: v9.14.0 (Sprint 39 deployed)
**Status**: Sprint 40 planned — ready to execute

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-40-admin-connectors`
3. Open plan: `docs/superpowers/plans/2026-03-25-sprint-40-admin-connectors.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

---

## Sprint 40 Goal

Make admin connector tools real — boosted requests float higher in the member feed with a "Community Pick" badge; admin-proposed matches are labeled for the requester; fix provider availability toggle placement and geolocation community list returning empty.

**Version bump**: v9.14.0 → v9.15.0

---

## Multi-Sprint Arc

| Sprint | Focus | Status |
|--------|-------|--------|
| **36** | Admin power tools (boost, propose match UI) | ✅ Complete |
| **37** | Provider Mode | ✅ Complete |
| **38** | Contextual Trust + Member Profile Depth | ✅ Complete |
| **39** | Provider Mode UX Hardening + Accept Offers | ✅ Complete — v9.14.0 |
| **40** | Admin Connector Tools (make them real) + bug fixes | Ready to execute |
| **41** | Onboarding / First-run UX (empty states, welcome flow) | Upcoming |

**5-6 sprint horizon**: Making Karmyq ready for cold-start user testing (send link, no intro, users complete end-to-end journey on their own).

---

## Spec + Plan

- **Spec**: `docs/superpowers/specs/2026-03-25-sprint-40-admin-connectors-design.md`
- **Plan**: `docs/superpowers/plans/2026-03-25-sprint-40-admin-connectors.md`

---

## What Sprint 40 Ships

1. **Boost affects curated feed rank** — `GET /requests/curated` adds `is_boosted`, `boosted_expires_at` to SELECT; active boost adds +30 flat to feedScore after weighted calculation
2. **"Community Pick" badge in FeedItem** — teal badge (`bg-teal-100 text-teal-700`) when `is_boosted && !expired`
3. **`admin_proposed` flag on matches** — `POST /requests/:id/propose-match` sets `admin_proposed = TRUE`; GET /matches returns it
4. **"Suggested by admin" in CommitmentsTab** — `admin_proposed === true` shows label under the match card
5. **Provider Availability Toggle on ProviderDashboardCard** — passes `providerId` + `isAvailable` from dashboard; toggle calls `providerService.updateAvailability`
6. **Geo community list fix** — community service fallback when geo query returns 0 rows; frontend shows "Showing all communities — we couldn't narrow by location"

---

## ⚠️ Critical Implementation Notes

1. **Boost is in DB but NOT in curated SQL.** Add `r.is_boosted`, `r.boosted_expires_at` to the `GET /requests/curated` SELECT — without this the frontend can't show the badge.

2. **Boost scoring: flat +30 AFTER weighted score.** After the existing `feedResult.score` computation, check `if (request.is_boosted && new Date(request.boosted_expires_at) > new Date())` → add 30, cap at 100. Apply to both main and sister-community scoring blocks.

3. **Migration before code.** `ALTER TABLE requests.matches ADD COLUMN IF NOT EXISTS admin_proposed BOOLEAN NOT NULL DEFAULT FALSE` — run this first, then update adminActions.ts INSERT. Production: `docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod -f /path/to/migration.sql`

4. **Geo bug root cause**: Community service geo query filters `WHERE c.latitude IS NOT NULL AND c.longitude IS NOT NULL`. Seed communities have no coordinates → 0 rows. Fix: if geo query returns 0, re-run without filter and return `{ ..., data: { communities: [...], fallback: true } }`. Frontend handles `fallback: true`.

5. **Provider toggle in card**: `ProviderDashboardCard` needs `providerId?: string` + `isAvailable?: boolean` props. Dashboard.tsx passes `providerProfiles[0]?.id` and `providerProfiles[0]?.is_available`. Card calls `providerService.updateAvailability(providerId, !currentValue)`. Use local state for optimistic update.

6. **CommitmentsTab Match type**: Add `admin_proposed?: boolean` to Match interface. The GET /matches query must SELECT `m.admin_proposed`.

7. **"Community Pick" badge expiry**: `const boostActive = data.is_boosted && data.boosted_expires_at && new Date(data.boosted_expires_at) > new Date()`.

8. **Landing docs**: Update `apps/landing/src/data/docs/guides/admin-community.json` (NOT a new file). Run `cd apps/landing && npm run generate-docs`, then `git add -f apps/landing/src/data/docs/`.

---

## What Already Exists (do not rebuild)

- `is_boosted`, `boosted_at`, `boosted_expires_at` columns on `requests.help_requests`
- Admin boost/remove-boost buttons in communities/[id].tsx admin Requests tab
- `POST /requests/:id/propose-match` endpoint in `services/request-service/src/routes/adminActions.ts`
- Member picker modal for propose-match in communities/[id].tsx
- Mark Urgent button + `requestService.markUrgent` (leave alone this sprint)
- `providerService.updateAvailability(providerId, boolean)` in api.ts

---

## Carry-Forward Issues

- **Integration tests**: Fail locally (no DB), pass in CI. Expected.
- **GitHub security vulnerabilities**: 8 Dependabot alerts remain (5 high, 2 moderate, 1 low).
- **Sprint 36 migrations**: Apply before next DB-touching sprint if not yet on demo server.
- **Sprint 38 migration**: Applied on demo server ✅ (`auth.user_tags` confirmed present).
- **Mobile app lint**: Pre-existing CI failure — non-blocking.

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
- **Admin page tab structure (v9.12.0)**: 5 tabs — Overview, People (Members+Norms), Requests (Requests+Insights+Actions), Providers, Settings.
- **Rate card soft-delete**: DELETE sets `is_active = false`.
- **cross_community_prior**: Direction-agnostic (0.05–0.95). Never "more open."
- **Only one simulation**: `services/simulation-service/`. DB user: `karmyq_user`.
- **Collective link auth**: Both link/unlink endpoints accept collective admin OR community admin.
- **social_graph.connections pair normalization**: Always `LEAST/GREATEST(::text)` cast.
- **NetworkGraph lazy-load**: Uses `IntersectionObserver`. Wrapped with `next/dynamic` (Sprint 33).
- **React 19 everywhere**: Root `package.json` has `react@^19.0.0` in `devDependencies` AND `overrides`.
- **completeMatch requires user_id in body**: `PUT /matches/:id/complete` reads `user_id` from body (not JWT).
- **generate-docs.ts is source of truth for nav.json**: Never edit nav.json directly. Create markdown source in `docs/guides/` or `docs/concepts/`, then add to GUIDE_ORDER/GUIDE_LABELS/GUIDE_SLUGS in `scripts/generate-docs.ts`.
- **Landing page force-add**: `git add -f apps/landing/src/data/docs/...`
- **Landing generate-docs location**: `cd apps/landing && npm run generate-docs` (NOT root `npm run generate-docs`)
- **No worktrees**: Solo developer. Work directly on feature branch.
- **Evolution defaults are opt-out (TRUE)**: Sprint 31 migration flipped both tables.
- **effectiveParamsCache circular import guard**: `trustEvolutionDb.ts` must NOT import `effectiveParamsCache.ts`.
- **Global evolution opt-out**: Missing `user_trust_preferences` row = opted IN (default TRUE).
- **Bull queue lazy init in trustEvolutionService**: `_communityEvolutionQueue` is null at module load.
- **REPUTATION_API_URL in Docker**: Must be `http://reputation-service:3004` — NOT `localhost:3004`.
- **Feed empty after deploy**: Transient — simulation needs warm-up time. Not a code regression.
- **tailwindcss-animate NOT installed**: `animate-in` class is unavailable. Do not use it in CSS or JSX.
- **Provider mode patterns (Sprint 37)**:
  - `karmyq_provider_mode`: localStorage key, values `'member'` | `'provider'`, default `'member'`
  - `PROVIDER_NOTIFICATION_TYPES`: Set in `src/lib/notificationCategories.ts`
  - `ProviderContext`: fetches provider profiles once on mount
  - `ProviderNotificationBell`: amber badge, briefcase icon, only when `hasProviderProfile === true` AND `providerMode === 'provider'`
- **Sprint 38 trust patterns**:
  - Trust tiers: Emerging (0–29 karma) / Trusted (30–99) / Pillar (100+)
  - `auth.user_tags`: unified tag table, CHECK constraint on tag_type ('skill'|'interest'|'need')
  - TrustCard: modal only, no URL, fetches `/social-graph/trust-card/:userId` via `socialGraphApi`
  - ProfileTagsSection: fetches from `/auth/profile/tags` via `api` (auth service axios instance)
  - TrustPathBadge (existing) → wrapped in `<button>` in FeedItem `OpenRequestItem` component
  - Tag suggestions: hardcoded in `services/auth-service/src/constants/tagSuggestions.ts`
- **Sprint 39 CommitmentsTab patterns**:
  - Helping+proposed → single "Withdraw Offer" → `rejectMatch` (removes from array)
  - Requested+proposed → Accept (`acceptMatch`, status→matched) + Decline (`rejectMatch`, remove)
  - `requester_id` is optional in Match interface — guard before rendering as button
  - TrustCard triggered by `selectedProfileUserId` state, rendered at bottom of return JSX
- **Sprint 40 admin connector patterns** (new this sprint):
  - `requests.matches.admin_proposed BOOLEAN DEFAULT FALSE` — TRUE when created via propose-match route
  - Boost scoring: flat +30 added to feedScore after weighted calculation, capped at 100
  - `is_boosted`, `boosted_expires_at` returned by curated feed endpoint
  - "Community Pick" badge: `bg-teal-100 text-teal-700 border-teal-200`
  - Geo fallback: community service returns `{ data: { communities: [...], fallback: true } }` when geo returns 0 rows
- **Docker exec for migrations**: Postgres is only accessible within Docker network. To run migrations on server:
  `docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod -f /path/to/migration.sql`
  (copy file to server first with `scp`, then mount/exec)
