# SPRINT 38 COMPLETE — READY FOR SPRINT 39

## Handoff Document for New Conversation

**Date**: 2026-03-25
**Current Version**: v9.13.0 (Sprint 38 deployed)
**Status**: Sprint 38 fully implemented, tested, merged, and deployed to karmyq.com.

---

## Quick Start

1. Read this handoff
2. No pending work — Sprint 38 is done
3. When ready for Sprint 39: run `/sprint-planning` to design the next sprint
4. Sprint 39 theme (tentative): **Admin/Moderator as Connector** — tools for admins to actively broker matches and surface unmet needs

---

## Multi-Sprint UX Arc

| Sprint | Focus | Status |
|--------|-------|--------|
| **33** | Design system foundation | ✅ Complete |
| **34** | Tab navigation + feed simplification | ✅ Complete |
| **35** | Request wizard + service hiring CTA | ✅ Complete |
| **36** | Commitment depth + admin power + community discovery | ✅ Complete |
| **37** | Provider Mode + Notification Separation | ✅ Complete |
| **38** | Contextual Trust + Member Profile Depth | ✅ Complete — v9.13.0 |
| **39** | Admin/Moderator as Connector (TBD) | Upcoming |

---

## What Was Just Shipped (Sprint 38 — v9.13.0)

### TrustCard (clickable trust path)
- `GET /social-graph/trust-card/:targetUserId` — returns trust tier (Emerging/Trusted/Pillar), karma, trust path, invitation path
- `TrustCard.tsx` modal — opened by clicking `TrustPathBadge` in feed items
- `FeedItem.tsx` updated — `TrustPathBadge` wrapped in `<button>` with `onClick={() => setSelectedTrustUserId(data.requester_id)}`
- Trust tiers: Emerging (0–29 karma), Trusted (30–99), Pillar (100+)

### User Tags (ProfileTagsSection)
- `auth.user_tags` table — `tag_type IN ('skill', 'interest', 'need')`, max 10/type (client-side warn)
- `/auth/profile/tags` CRUD + `/auth/profile/tags/suggestions?tag_type=` (hardcoded suggestions)
- `ProfileTagsSection.tsx` — three-section tag editor on `/profile` page (save-on-change, suggestion chips)

### Bug fixes
- `ProviderDashboardCard.tsx` line ~24: removed `* 100` from `completion_rate` display
- `providers.tsx` line ~157: same fix

### Tests + Docs
- 15 TDD tests in `apps/frontend/tests/tdd/sprint-38-trust-profile.test.tsx` — all pass
- 3 new docs: `docs/guides/understanding-trust.md`, `docs/guides/profile-guide.md`, `docs/concepts/trust-path.md`
- Landing page generated: `trust-path.json`, `understanding-trust.json`, `profile-guide.json`

---

## Key Files Changed (Sprint 38)

| File | Change |
|------|--------|
| `services/social-graph-service/src/routes/trustCard.ts` | NEW — trust-card endpoint |
| `services/auth-service/src/routes/profileTags.ts` | NEW — user tags CRUD |
| `services/auth-service/src/constants/tagSuggestions.ts` | NEW — hardcoded suggestions |
| `apps/frontend/src/components/TrustCard.tsx` | NEW — modal component |
| `apps/frontend/src/components/ProfileTagsSection.tsx` | NEW — profile tag editor |
| `apps/frontend/src/components/Feed/FeedItem.tsx` | TrustPathBadge → clickable button |
| `apps/frontend/src/pages/profile.tsx` | Added ProfileTagsSection |
| `infrastructure/postgres/migrations/20260324-user-tags.sql` | NEW — user_tags table |

---

## Carry-Forward Issues

- **Integration tests**: Fail locally (no DB), pass in CI. Expected.
- **GitHub security vulnerabilities**: 8 Dependabot alerts remain (not addressed).
- **Sprint 36 migrations**: If not yet applied on demo server, apply before next DB-touching sprint:
  ```bash
  docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod -f ~/karmyq/infrastructure/postgres/migrations/20260322-community-tags-geo.sql
  docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod -f ~/karmyq/infrastructure/postgres/migrations/20260322-request-boost.sql
  ```
- **Sprint 38 migration**: Applied on demo server ✅ (`auth.user_tags` table confirmed present).
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
  - `ProviderNotificationBell`: amber badge, briefcase icon, only when `hasProviderProfile === true`
- **Sprint 38 trust patterns**:
  - Trust tiers: Emerging (0–29 karma) / Trusted (30–99) / Pillar (100+)
  - `auth.user_tags`: unified tag table, CHECK constraint on tag_type ('skill'|'interest'|'need')
  - TrustCard: modal only, no URL, fetches `/social-graph/trust-card/:userId` via `socialGraphApi`
  - ProfileTagsSection: fetches from `/auth/profile/tags` via `api` (auth service axios instance)
  - TrustPathBadge (existing) → wrapped in `<button>` in FeedItem `OpenRequestItem` component
  - Tag suggestions: hardcoded in `services/auth-service/src/constants/tagSuggestions.ts`
- **Docker exec for migrations**: Postgres is only accessible within Docker network. To run migrations on server:
  `docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod -f /path/to/migration.sql`
  (copy file to server first with `scp`, then mount/exec)
