# SPRINT 38 PLANNED — READY TO EXECUTE

## Handoff Document for New Conversation

**Date**: 2026-03-24
**Current Version**: v9.12.0 → v9.13.0 (after Sprint 38)
**Status**: Sprint 38 fully planned. Spec + plan written. Ready to execute.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-38-trust-profile`
3. Open plan: `docs/superpowers/plans/2026-03-24-sprint-38-trust-profile.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

---

## Sprint 38 Goal

Surface trust contextually in feed/match moments via a clickable TrustCard, and deepen personal profiles with self-declared skills, interests, and needs — without turning the platform into a browsable social network.

---

## Multi-Sprint UX Arc

| Sprint | Focus | Status |
|--------|-------|--------|
| **33** | Design system foundation | ✅ Complete |
| **34** | Tab navigation + feed simplification | ✅ Complete |
| **35** | Request wizard + service hiring CTA | ✅ Complete |
| **36** | Commitment depth + admin power + community discovery | ✅ Complete |
| **37** | Provider Mode + Notification Separation | ✅ Complete |
| **38** | Contextual Trust + Member Profile Depth | 🔜 Ready to execute |
| **39** | Admin/Moderator as Connector (TBD) | Upcoming |

---

## What Was Just Shipped (Sprint 37 — v9.12.0)

### Provider Mode (UI-only)
- `ProviderContext` — fetches provider profiles once on mount, exposes `hasProviderProfile`, `providerMode`, `setProviderMode`, `providerServiceTypes`
- Member/Provider pill toggle in top nav (`Layout.tsx`) — only shown when `hasProviderProfile === true`
- `ProviderDashboardCard` stats card above TabBar in provider mode (active commitments, completion rate, pending reviews)
- Browse feed tab → "Requests for Me" in provider mode (filtered by `serviceTypeFilter` prop)
- Mode persisted to `localStorage` key `karmyq_provider_mode`; default `'member'`

### Notification Split (client-side only)
- `PROVIDER_NOTIFICATION_TYPES` constant in `src/lib/notificationCategories.ts`
- `NotificationContext` exposes `providerNotifications`, `communityNotifications`, `providerUnreadCount`, `communityUnreadCount`
- `NotificationBell` uses `communityUnreadCount` (red badge)
- `ProviderNotificationBell` uses `providerUnreadCount` (amber badge, briefcase icon)

---

## Sprint 38 Plan Summary

### Spec
`docs/superpowers/specs/2026-03-24-sprint-38-trust-profile-design.md`

### Plan
`docs/superpowers/plans/2026-03-24-sprint-38-trust-profile.md`

### 11 Tasks

| Task | Description |
|------|-------------|
| 1 | Feature branch + completion rate bug fix + `auth.user_tags` migration |
| 2 | Backend: `GET /social-graph/trust-card/:targetUserId` endpoint |
| 3 | Backend: `/auth/profile/tags` CRUD + suggestions |
| 4 | Frontend: `TrustCard.tsx` modal component |
| 5 | Frontend: Make TrustPathBadge clickable in FeedItem → opens TrustCard |
| 6 | Frontend: `ProfileTagsSection.tsx` + add to `/profile` page |
| 7 | TDD tests (trust tier computation, component rendering) |
| 8 | User guides + landing page docs (3 new files) |
| 9 | CONTEXT.md + registry.json updates |
| 10 | Final type check + `npm test` + `npm run feedback:check` |
| 11 | Merge + deploy + apply DB migration on server |

---

## ⚠️ Critical Implementation Notes (copy verbatim from spec)

1. **Trust path endpoint is in social-graph-service, NOT reputation-service.** New `/trust-card/:targetUserId` route goes in social-graph-service, calls `pathComputation.ts` internally, then fetches karma via `REPUTATION_API_URL` env var.

2. **`REPUTATION_API_URL` in Docker = `http://reputation-service:3004`.** Never hardcode `localhost:3004`.

3. **TrustCard is never a page.** Modal only — no URL, no route. State (`selectedTrustUserId`) lives in FeedItem.

4. **Completion rate bug** — remove `* 100` from:
   - `apps/frontend/src/components/ProviderDashboardCard.tsx` (~line 24)
   - `apps/frontend/src/pages/reputation/providers.tsx` (~line 157)

5. **`auth.user_skills` is left untouched.** `auth.user_tags` is additive.

6. **Tag suggestions are hardcoded** in `services/auth-service/src/constants/tagSuggestions.ts` — not a DB table.

7. **TrustPathBadge is already rendered in FeedItem line 158.** Wrap in a `<button>` with `onClick={() => setSelectedTrustUserId(...)}`.

8. **generate-docs.ts is source of truth for nav.json** — never edit nav.json directly. Add new guides/concepts to GUIDE_ORDER/GUIDE_LABELS/GUIDE_SLUGS.

9. **Landing page force-add**: `git add -f apps/landing/src/data/docs/...` after generate-docs runs.

---

## Trust Tier Thresholds

| Tier | Karma Range |
|------|------------|
| Emerging | 0–29 |
| Trusted | 30–99 |
| Pillar | 100+ |

---

## New Concepts Introduced in Sprint 38

### TrustCard
Modal component showing how the current user is connected to another member. Accessible only by clicking `TrustPathBadge` in feed items. Shows: trust tier label, karma score, directional connection chain (A→B→C with karma at intermediate nodes), invitation path. Not a page — no URL.

### User Tags (`auth.user_tags`)
Unified table with `tag_type` IN ('skill', 'interest', 'need'). Global to user. Tag suggestions hardcoded in auth-service constants. Max 10 per type (client-side warning).

### Member Privacy Philosophy
Member profiles are private. Trust visibility only occurs in relational moments (feed items, matches). Providers remain fully public via `/providers/:id`. This is intentional — the platform is not a browsable directory.

---

## What's Already Built (don't rebuild)

- `GET /social-graph/paths/:targetUserId` — existing bidirectional BFS, 4° max, used internally by new trust-card endpoint
- `TrustPathBadge.tsx` — already renders in FeedItem line 158 (just needs to become clickable)
- `ConnectionBadge.tsx` — compact badge (may also become clickable in future sprints)
- `auth.user_skills` — existing table, untouched this sprint

---

## Carry-Forward Issues

- **Integration tests**: Fail locally (no DB), pass in CI. Expected.
- **GitHub security vulnerabilities**: 8 Dependabot alerts remain (not addressed this sprint).
- **Sprint 36 migrations**: If not yet applied on demo server, apply before Sprint 38 deploys:
  ```bash
  psql $DATABASE_URL -f infrastructure/postgres/migrations/20260322-community-tags-geo.sql
  psql $DATABASE_URL -f infrastructure/postgres/migrations/20260322-request-boost.sql
  ```
- **Sprint 38 migration**: Apply after deploy:
  ```bash
  psql $DATABASE_URL -f infrastructure/postgres/migrations/20260324-user-tags.sql
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
  - `PROVIDER_NOTIFICATION_TYPES`: Set in `src/lib/notificationCategories.ts` — `preferred_provider_selected`, `provider_request_matched`, `provider_review_received`, `match_reminder`
  - `ProviderContext`: fetches provider profiles once on mount, exposes `hasProviderProfile`, `providerMode`, `setProviderMode`, `providerServiceTypes`
  - `ProviderNotificationBell`: amber badge (`bg-amber-500`), briefcase icon, only rendered when `hasProviderProfile === true`
  - Notification split is entirely client-side — `useMemo` in `NotificationContext` derives both streams
- **Sprint 38 trust patterns** (new):
  - Trust tiers: Emerging (0–29 karma) / Trusted (30–99) / Pillar (100+)
  - `auth.user_tags`: unified tag table with CHECK constraint on tag_type ('skill'|'interest'|'need')
  - TrustCard: modal only, no URL, fetches `/social-graph/trust-card/:userId`
  - TrustPathBadge (existing) → wrapped in `<button>` in FeedItem to open TrustCard
