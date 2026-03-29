# SPRINT 42 READY TO EXECUTE

## Handoff Document for New Conversation

**Date**: 2026-03-28
**Current Version**: v9.16.0 (Sprint 41 complete)
**Status**: Sprint 42 spec + plan written — ready to execute

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-42-dibs-request`
3. Open plan: `docs/superpowers/plans/2026-03-28-sprint-42-dibs-request.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

---

## Sprint 42 Goal

> **Direct "Dibs" Request — scheduled-only private first-refusal**

When creating a *scheduled* request, the requester can optionally nominate one trusted provider (must have a prior completed interaction) for first right of refusal. The dibs window = 20% of lead time, no floor. The platform surfaces the best candidate using trust score → prior interactions → trust graph. On timeout or decline, the request auto-broadcasts publicly. ASAP requests always broadcast immediately — no dibs option.

---

## Key Documents

- **Design spec**: `docs/superpowers/specs/2026-03-28-sprint-42-dibs-request-design.md`
- **Implementation plan**: `docs/superpowers/plans/2026-03-28-sprint-42-dibs-request.md`

---

## Multi-Sprint Arc

| Sprint | Focus | Status |
|--------|-------|--------|
| **40** | Admin Connector Tools + Provider Toggle | ✅ Complete — v9.15.0 |
| **41** | Provider on-duty push notifications + offer submission flow | ✅ Complete — v9.16.0 |
| **42** | Direct "Dibs" Request — scheduled-only private first-refusal | **This sprint** |
| **43** | Offer prioritization ranking in public feed | Upcoming |
| **44** | Group task communities | Upcoming |
| **45** | Onboarding / First-run UX | Upcoming |

---

## Critical Implementation Notes (from spec — read before Task 2)

1. **`scheduled_for` is a new column on `help_requests`** — separate from type-specific payload fields (`departure_time`, `event_date`). For typed requests, set both: `scheduled_for` is the canonical field for dibs; payload fields drive type-specific display. `scheduled_for = NULL` for generic/borrow = ASAP.

2. **Dibs window formula has no floor** — `expires_at = created_at + 0.20 × (scheduled_for − created_at)`. A tiny window is the requester's cost for scheduling late. Do not add a minimum.

3. **`dibs_pending` must be excluded from public feed** — Every query fetching `status = 'open'` requests for the public feed, curated feed, or provider notifications must explicitly exclude `dibs_pending`. Check feed-service and the `provider_went_on_duty` notification query.

4. **One dibs per request, no retry** — `UNIQUE(request_id)` on `requests.dibs`. Once any terminal state is reached (accepted/declined/expired), the request is either matched or permanently public.

5. **Verify `helper_id` vs `responder_id` in `requests.matches`** — Read `services/request-service/src/db/` before writing the prior-interaction query. The handoff says `helper_id`; research found `responder_id`. One is wrong — read the source before implementing.

6. **Dibs acceptance skips `provider.offers`** — Accept writes directly to `requests.matches` with `status = 'matched'` and `helper_id = provider_user_id`. Sprint 41 offer flow is unchanged for the public broadcast path.

7. **Scoring gate: `priorInteractions >= 1` required** — Providers with zero prior completed interactions are not dibs-eligible. Return `{ data: null }` if no eligible candidates, and skip the post-creation prompt.

8. **Provider must be `is_available = true`** — Gate the candidate query on `provider.providers.is_available = true`. Off-duty providers are never surfaced.

9. **Enum migration order** — `ADD VALUE IF NOT EXISTS 'dibs_pending'` must be in the first migration file (before `requests.dibs` table creation).

---

## New Tables This Sprint

```sql
-- requests.help_requests: ADD COLUMN scheduled_for TIMESTAMPTZ
-- migration: infrastructure/postgres/migrations/20260328-help-requests-scheduled-for.sql
-- (also adds 'dibs_pending' to request_status_enum)

-- requests.dibs
-- migration: infrastructure/postgres/migrations/20260328-dibs.sql
```

Both migrations must be run on demo server after deploy (see Task 14 in plan).

---

## Carry-Forward Issues

- **Integration tests**: Fail locally (no DB), pass in CI. Expected.
- **GitHub security vulnerabilities**: 8 Dependabot alerts (pre-existing, non-blocking).
- **Sprint 36 migrations**: Apply before next DB-touching sprint if not yet on demo server.
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
- **Sprint 40 admin connector patterns**:
  - `requests.matches.admin_proposed BOOLEAN DEFAULT FALSE` — TRUE when created via propose-match route
  - Boost scoring: flat +30 added to feedScore after weighted calculation, capped at 100
  - `is_boosted`, `boosted_expires_at` returned by curated feed endpoint
  - "Community Pick" badge: `bg-teal-100 text-teal-700 border-teal-200`
  - Geo fallback: community service returns `{ data: { communities: [...], fallback: true } }` when geo returns 0 rows
  - `ProviderDashboardCard` accepts `providerId?: string` + `isAvailable?: boolean`; local optimistic state
- **Sprint 41 provider offer patterns**:
  - `auth.device_push_tokens`: stores Expo push tokens per user device
  - `provider.offers`: separate from `requests.matches` — commercial offer flow
  - Offer statuses: `pending` | `accepted` | `declined` | `withdrawn`
  - `provider_went_on_duty` event: `{ providerId, providerUserId, communityIds }`
  - Expo push delivered via `expo-server-sdk` in notification service
  - Offer accepted → creates `requests.matches` record with `status = 'matched'`
- **Sprint 42 dibs patterns** (fill in during execution):
  - `requests.dibs`: requester-initiated private first-refusal (vs. provider-initiated offers)
  - Dibs only for scheduled requests (`scheduled_for IS NOT NULL`)
  - `dibs_pending` is a new `request_status_enum` value — exclude from all public feed queries
  - Dibs window = 20% of lead time, no floor
  - Provider must have `priorInteractions >= 1` with requester to be dibs-eligible
  - Scoring: trustScore * 0.50 + min(interactions, 3) * 11.67 + trustGraphBonus (15/10/0)
  - Accept → `requests.matches` with `status = 'matched'` directly (skips provider.offers)
  - Expiry handled by cleanup-service cron (every 5 min)
- **Docker exec for migrations**: Postgres only accessible within Docker network. To run migrations:
  `docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod -f /path/to/migration.sql`
  (copy file to server first with `scp`)
