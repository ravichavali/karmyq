# SPRINT 37 READY TO EXECUTE

## Handoff Document for New Conversation

**Date**: 2026-03-23
**Current Version**: v9.11.0 → v9.12.0
**Status**: Spec + plan written. Ready to implement.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-37-provider-mode`
3. Open plan: `docs/superpowers/plans/2026-03-23-sprint-37-provider-mode.md`
4. Run: `/execute-plan` (uses `superpowers:subagent-driven-development`)

---

## Sprint 37 Goal

Add a **Member / Provider mode switcher** to the top nav that reorients the dashboard and feed for users with provider profiles, and split notifications into two distinct streams (community bell + provider bell).

---

## Multi-Sprint UX Arc

| Sprint | Focus | Status |
|--------|-------|--------|
| **33** | Design system foundation | ✅ Complete |
| **34** | Tab navigation + feed simplification | ✅ Complete |
| **35** | Request wizard + service hiring CTA | ✅ Complete |
| **36** | Commitment depth + admin power + community discovery | ✅ Complete |
| **37** | Provider Mode + Notification Separation | 🔜 This sprint |
| **38** | TBD (likely trust visibility or member profile depth) | Upcoming |

---

## Key Files

| Artifact | Path |
|----------|------|
| Design spec | `docs/superpowers/specs/2026-03-23-sprint-37-provider-mode-design.md` |
| Implementation plan | `docs/superpowers/plans/2026-03-23-sprint-37-provider-mode.md` |

---

## What Gets Built

### Provider Mode (UI-only, no DB migration)
- `Member / Provider` pill toggle in top nav (`Layout.tsx`)
- Only shown when user has ≥1 provider profile (fetched from `GET /api/requests/providers/my`)
- Users with no provider profile: see "Become a Provider" link instead
- In Provider mode:
  - `ProviderDashboardCard` stats card above TabBar (active commitments, completion rate, pending reviews)
  - Browse feed tab → "Requests for Me" (filtered to user's service type(s))
  - Second notification bell (amber, briefcase icon) for provider-stream notifications
- Mode persisted to `localStorage` key `karmyq_provider_mode`; default `'member'`

### Notification Split (client-side only, no DB migration)
- New constant `PROVIDER_NOTIFICATION_TYPES` in `src/lib/notificationCategories.ts`
- `NotificationContext` exposes `providerNotifications`, `communityNotifications`, `providerUnreadCount`, `communityUnreadCount` via `useMemo`
- `NotificationBell` → uses `communityUnreadCount` (red badge)
- New `ProviderNotificationBell` → uses `providerUnreadCount` (amber badge)
- Fix `NotificationItem` rendering for `preferred_provider_selected`, `match_reminder` (currently showing default bell icon and no CTA)

### New notification types (backend, TypeScript only)
- `provider_request_matched` — fires to matching providers when a typed service request is created
- `provider_review_received` — fires to provider when a review is submitted after match completion
- `request_created` event payload gets `service_type` field (request-service)
- Notification service subscriber routes to matching providers via internal provider query

### Carry-forward test fixes (thorough root-cause fixes)
- `preSelectProvider` — likely stale import path or mock target
- `trust-evolution-flow` — likely Bull queue lazy-init issue in test setup
- `rateCards` — likely hard-delete assertion against soft-delete API (`is_active = false`)

---

## ⚠️ Critical Implementation Notes

1. **Provider mode is UI-only — never send it to the server.** `karmyq_provider_mode` must never appear in API request bodies or headers.
2. **Mode switcher only appears when user has a provider profile.** Fetch `GET /api/requests/providers/my` once in `ProviderContext`; empty array = show "Become a Provider" link.
3. **Provider feed uses `service_type` filter, not a new endpoint.** Pass user's service types to existing `BrowseFeed` via `serviceTypeFilter` prop. Do NOT create a new route.
4. **Notification split is entirely client-side.** `useMemo` in `NotificationContext` derives the two streams. No new API calls, no DB migration.
5. **`provider_request_matched` must skip the requester.** Notification subscriber must exclude `requester_id` when finding matching providers.
6. **Do not disable `new_request`.** It serves member volunteers. Provider routing is additive via `provider_request_matched`.
7. **No `tailwindcss-animate` / `animate-in` class** — unavailable in this project.
8. **`ProviderDashboardCard` derives from existing data only.** No new endpoints. If data unavailable, show `—` gracefully.
9. **Carry-forward fixes: read test → trace source → fix forward.** No `describe.skip` or `it.skip`.

---

## Carry-Forward Issues (pre-existing, not Sprint 36 regressions)

- **Pre-existing test failures**: `preSelectProvider`, `trust-evolution-flow`, `rateCards` — Sprint 37 will fix these properly
- **Integration tests**: Fail locally (no DB), pass in CI. Expected.
- **Migration runner**: deploy.sh does NOT auto-run migrations. (No migrations needed for Sprint 37.)
- **GitHub security vulnerabilities**: 8 dependabot alerts remain.
- **Untracked file**: `docs/superpowers/specs/2026-03-18-sprint-29-rate-cards-design.md` — ignore unless relevant.
- **Sprint 36 migrations**: If not yet applied on demo server, apply before this sprint deploys:
  ```bash
  psql $DATABASE_URL -f infrastructure/postgres/migrations/20260322-community-tags-geo.sql
  psql $DATABASE_URL -f infrastructure/postgres/migrations/20260322-request-boost.sql
  ```

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
- **Admin page tab structure (v9.11.0)**: 5 tabs — Overview, People (Members+Norms), Requests (Requests+Insights+Actions), Providers, Settings.
- **Rate card soft-delete**: DELETE sets `is_active = false`.
- **cross_community_prior**: Direction-agnostic (0.05–0.95). Never "more open."
- **Only one simulation**: `services/simulation-service/`. DB user: `karmyq_user`.
- **Collective link auth**: Both link/unlink endpoints accept collective admin OR community admin.
- **social_graph.connections pair normalization**: Always `LEAST/GREATEST(::text)` cast.
- **NetworkGraph lazy-load**: Uses `IntersectionObserver`. Wrapped with `next/dynamic` (Sprint 33).
- **React 19 everywhere**: Root `package.json` has `react@^19.0.0` in `devDependencies` AND `overrides`.
- **completeMatch requires user_id in body**: `PUT /matches/:id/complete` reads `user_id` from body (not JWT).
- **generate-docs.ts is source of truth for nav.json**: Never edit nav.json directly.
- **Landing page force-add**: `git add -f apps/landing/src/data/docs/...`
- **No worktrees**: Solo developer. Work directly on feature branch.
- **Evolution defaults are opt-out (TRUE)**: Sprint 31 migration flipped both tables.
- **effectiveParamsCache circular import guard**: `trustEvolutionDb.ts` must NOT import `effectiveParamsCache.ts`.
- **Global evolution opt-out**: Missing `user_trust_preferences` row = opted IN (default TRUE).
- **Bull queue lazy init in trustEvolutionService**: `_communityEvolutionQueue` is null at module load.
- **REPUTATION_API_URL in Docker**: Must be `http://reputation-service:3004` — NOT `localhost:3004`.
- **Feed empty after deploy**: Transient — simulation needs warm-up time. Not a code regression.
- **tailwindcss-animate NOT installed**: `animate-in` class is unavailable. Do not use it in CSS or JSX.
- **Sprint 37 patterns** (add as you implement):
  - `karmyq_provider_mode`: localStorage key, values `'member'` | `'provider'`, default `'member'`
  - `PROVIDER_NOTIFICATION_TYPES`: Set defined in `src/lib/notificationCategories.ts`
  - `ProviderContext`: fetches provider profiles once on mount, exposes `hasProviderProfile`, `providerMode`, `setProviderMode`, `providerServiceTypes`
  - `ProviderNotificationBell`: amber badge (`bg-amber-500`), briefcase icon, only rendered when `hasProviderProfile === true`
