# SPRINT 41 READY TO EXECUTE

## Handoff Document for New Conversation

**Date**: 2026-03-26
**Current Version**: v9.15.0 (Sprint 40 deployed)
**Status**: Sprint 41 spec + plan written — ready to execute

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-41-provider-offer-flow`
3. Open plan: `docs/superpowers/plans/2026-03-26-sprint-41-provider-offer-flow.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

---

## Sprint 41 Goal

> **Provider on-duty push notifications + offer submission flow (Phase 1)**

Provider toggles on-duty → push notified of matching open requests in their communities → submits an offer with editable price (defaulting from rate card) → requester gets push notified → accepts or declines from CommitmentsTab.

---

## Key Documents

- **Design spec**: `docs/superpowers/specs/2026-03-26-sprint-41-provider-offer-flow-design.md`
- **Implementation plan**: `docs/superpowers/plans/2026-03-26-sprint-41-provider-offer-flow.md`

---

## Multi-Sprint Arc

| Sprint | Focus | Status |
|--------|-------|--------|
| **37** | Provider Mode (profiles, rate cards, dashboard) | ✅ Complete |
| **39** | Provider UX Hardening + Accept Offers (community match flow) | ✅ Complete |
| **40** | Admin Connector Tools + Provider Toggle | ✅ Complete — v9.15.0 |
| **41** | Provider on-duty push notifications + offer submission flow | **This sprint** |
| **42** | Offer prioritization by prior interactions + direct "dibs" request | Upcoming |
| **43** | Group task communities | Upcoming |
| **44** | Onboarding / First-run UX (empty states, welcome flow) | Upcoming |

---

## Critical Implementation Notes (from spec — read before Task 2)

1. **Push tokens must be registered after auth** — `useExpoNotifications` must only call the API once `userId` is available. Registering before auth means the token can't be linked to a user.

2. **`provider_went_on_duty` query uses the junction table** — `requests.help_requests` has NO `community_id` column. To find matching open requests: `JOIN requests.request_communities rc ON rc.request_id = hr.id WHERE rc.community_id = ANY($1) AND hr.status = 'open'`.

3. **Rate card lookup for offer pre-fill** — query `provider.rate_cards WHERE provider_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1`. If no rate card, price field is blank (not zero).

4. **`offer_accepted` creates a `requests.matches` record** — map `provider_user_id` → `helper_id`, set `status = 'matched'`. Skip the `proposed` stage.

5. **Expo push API** — install `expo-server-sdk` in notification service. Token format: `ExponentPushToken[xxxx]`. Batch up to 100 per call.

6. **One active offer per provider per request** — check for existing `pending` or `accepted` offer before inserting. Return 409 if duplicate.

7. **Locate the existing availability endpoint** — find in `services/provider-service/src/routes/` before modifying. Do not guess the path.

8. **`communityIds` in event payload** — provider service must include the provider's community IDs in the `provider_went_on_duty` event (read from JWT `user.communities`) so notification service can query matching requests without a cross-service DB call.

---

## New Tables This Sprint

```sql
-- auth.device_push_tokens
-- migration: infrastructure/postgres/migrations/20260326-device-push-tokens.sql

-- provider.offers
-- migration: infrastructure/postgres/migrations/20260326-provider-offers.sql
```

Both migrations must be run on demo server after deploy (see Task 13 in plan).

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
- **Sprint 41 provider offer patterns** (fill in during execution):
  - `auth.device_push_tokens`: stores Expo push tokens per user device
  - `provider.offers`: separate from `requests.matches` — commercial offer flow
  - Offer statuses: `pending` | `accepted` | `declined` | `withdrawn`
  - `provider_went_on_duty` event: `{ providerId, providerUserId, communityIds }`
  - Expo push delivered via `expo-server-sdk` in notification service
  - Offer accepted → creates `requests.matches` record with `status = 'matched'`
- **Docker exec for migrations**: Postgres only accessible within Docker network. To run migrations:
  `docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod -f /path/to/migration.sql`
  (copy file to server first with `scp`)
