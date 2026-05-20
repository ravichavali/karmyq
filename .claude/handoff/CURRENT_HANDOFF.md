# SPRINT 61 — Next Sprint TBD | Sprint 60 Shipped

## Handoff Document

**Date**: 2026-05-20
**Current Version**: v9.27.0 (Sprint 60 shipped)
**Status**: Sprint 60 merged + pushed. GitHub Actions deploying to karmyq.com. No active plan.

---

## Quick Start

Sprint 60 is complete. No active handoff task. Pick from the Platform Coherence Backlog or plan Sprint 61.

```bash
# Check deploy status
gh run list --branch master --limit 3
```

---

## Sprint 60 — Provider Browse Fork + Communities Polish ✅

Shipped as v9.27.0. Merged to master 2026-05-20. GitHub Actions deploying.

| Task | Result |
|------|--------|
| Provider Browse Fork | `serviceTypeFilter` passed to `BrowseFeed` when `hasProviderProfile && isAvailable && providerServiceTypes.length > 0`; undefined otherwise |
| BrowseFeed indicator | "Showing requests matching your service types" label above feed when filter active |
| Duplicate heading fixed | `<Layout>` title prop removed from communities/index.tsx; in-page `<h1>` is the only heading |
| Config banner removed | `else` branch of `isWelcomeFlow` ternary removed; only welcome banner remains (welcome flow only) |
| Your Communities strip | JWT-sourced chips above discovery toggle; zero extra API calls; joined communities filtered from discover grid |
| Activity sort | `GET /communities?sort=activity` orders by `COALESCE(ls.inner_circle, 0) DESC, COALESCE(ls.active_community, 0) DESC, c.current_members DESC` |
| Frontend default sort | `useState('activity')` in communities/index.tsx; Clear Filters also resets to `'activity'` |
| Browse Templates link | Subtle `text-sm text-text-muted` paragraph at top of `basic` step in communities/new.tsx |
| TDD tests | `apps/frontend/tests/tdd/sprint-60-browse-fork-communities.test.tsx` — 10 tests, all passing |
| User guide | `docs/guides/finding-communities-guide.md` updated — Your Communities section + sort options table |
| Landing docs | Regenerated via `cd apps/landing && npm run generate-docs` |
| CONTEXT.md | `services/community-service/CONTEXT.md` updated with `activity` sort option |
| registry.json | `GET /communities` entry updated with sort options description |
| Version | 9.26.0 → 9.27.0 |

### Key implementation details
- **BrowseFeed filtering is client-side**: `serviceTypeFilter` filters the 50-item fetched list in render. Backend `getCuratedRequests` doesn't need a service_type param — fetching all types and filtering locally is sufficient for demo scale.
- **`useProvider()` hook** (not `useProviderContext`) — the correct export from `ProviderContext.tsx`
- **Your Communities IIFE in render**: `joinedIds` and `discoverCommunities` are derived inside an IIFE in the JSX return (not in state) to keep "Load More" offsets correct.
- **Activity sort uses full expressions**: `COALESCE(ls.inner_circle, 0) DESC` not alias `inner_circle_count DESC` — avoids any PostgreSQL ambiguity with lateral join aliases in ORDER BY.

---

## Platform Coherence Backlog

*Added 2026-05-17 after codebase audit. Gaps where stated capabilities don't match implementation.*

### 1. Provider Mode Re-entry (High — breaks entire provider economy)
`ProviderModeSwitcher` and `ProviderNotificationBell` removed from nav in Sprint 50, never replaced. Provider economy (profiles, rate cards, offers) fully implemented in backend but no UI entry point.
- **Files**: `apps/frontend/src/components/Layout.tsx`, `services/request-service/src/routes/providers.ts`
- **Note**: Sprint 59 added "Become a provider" link for non-providers. Existing providers can toggle availability in nav. The missing piece is a UI to browse/manage existing provider profiles.

### 2. Karma Multipliers per Request Type (Medium — config silently ignored)
Communities configure per-type karma multipliers but `karmaAllocation.ts` never reads them.
- **Files**: `services/reputation-service/src/karmaAllocation.ts`

### 3. Request Type Enforcement (Medium — community sovereignty gap)
`community_configs.enabled_request_types` is never used to filter incoming requests.
- **Files**: `services/request-service/src/routes/` (request creation route)

### 4. Community Type Differentiation (Medium — group vs mutual aid behave identically)
`community_type` enum exists, activity tables exist, but no application code branches on type.
- **Files**: `services/community-service/src/`, `apps/frontend/src/pages/communities/[id].tsx`

### 5. Trust Evolution Signals (Low — trust loop incomplete)
Signals emitted by `trustEvolutionService.ts` have no subscriber that processes them into score updates.
- **Files**: `services/reputation-service/src/trustEvolutionService.ts`

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 53 | Test coverage: critical paths + CI enforcement | ✅ Complete |
| Sprint 54 | OWASP security hardening | ✅ Complete + deployed |
| Sprint 55 | Brand rollout (Refined Fractal mark) | ✅ Complete + deployed |
| Sprint 56 | Backend simplification — DRY + TDD health | ✅ Complete |
| Sprint 57 | Frontend simplification — API factory + community page | ✅ Complete + deployed |
| Sprint 58 | karmyq.org rebuild — 3-layer content, deeper sections | ✅ Complete + deployed |
| Sprint 59 | Dashboard UX Simplification (3 tabs, provider re-entry, feed fix) | ✅ Complete + deployed |
| Sprint 60 | Provider Browse Fork + Communities Polish | ✅ Complete + deployed |
| **Sprint 61** | **TBD** | 🔲 Not planned |

---

## Architecture Gotchas (Persistent)

- **Landing page docs source**: edit `docs/guides/*.md` + update `scripts/generate-docs.ts` arrays. Run `cd apps/landing && npm run generate-docs` to regenerate. Never hand-edit `apps/landing/src/data/docs/` directly.
- **ADR numbering**: next ADR is **053**.
- **TDD test placement**: backend sprint tests go in `services/request-service/tests/tdd/` (NOT root `tests/tdd/`). Frontend sprint tests go in `apps/frontend/tests/tdd/`. Imports are relative to respective source dirs.
- **Router mount paths**: always mount at full path (e.g. `/communities/trust-questions`) when router uses `router.get('/')`.
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`.
- **Feed weights**: no sum constraint; normalized at query time in feed-service.
- **`git add` on CLAUDE.md**: file is tracked as lowercase `claude.md` — always `git add claude.md`.
- **Pre-existing TDD failures**: `sprint-39-provider-ux` (7 tests fail), `sprint-43-feed-ranking` (crashes), schema-related tests. Do NOT fix.
- **Solo dev — no worktrees**: work directly on feature branches (`git checkout -b feature/sprint-NN`). Worktrees cause hundreds of npm install prompts, lockfile conflicts, and jest path bugs.
- **`?type=` routing in dibs-candidate**: `type === 'service'` → `getBestCandidate` (provider_profiles). Anything else → `getMutualAidBestCandidate` (auth.users).
- **Provider nav (post Sprint 50)**: `ProviderModeSwitcher` and `ProviderNotificationBell` are no longer rendered. Do not add them back. Sprint 59 adds a "Become a provider" link (`/providers/new`) for non-provider users in the nav — that's the intended replacement for re-entry.
- **Explore tier — `sg.type = 'exchange'` only**: community-only connections do NOT qualify for explore dibs tier.
- **Trust path URL pattern**: `http://social-graph-service:3010/social-graph/paths/:userId` — nginx strips `/api` prefix but NOT the service prefix (`/social-graph`).
- **Provider offer acceptance**: `offersDb.acceptOffer` closes the request and rejects proposed matches. Keep consistent if any new acceptance path is added.
- **Offer validation**: `providerOffersDb.validateRequestForOffer` uses live DB JOIN — no JWT community array.
- **community-service coverage**: scoped to `src/services/**/*.ts` because DB-dependent routes can't reach 60% without a live DB.
- **Sprint 54 security gotchas**:
  - `ALLOWED_CLEANUP_TABLES` in cleanup-service is exported — tests import the constant directly (don't mock DB).
  - `isRefreshing` + `pendingRequests` in `apps/frontend/src/lib/api.ts` are module-level — must stay outside interceptor function body or the concurrent 401 queue breaks.
  - Refresh token raw value never stored — always SHA-256 hashed before DB insert.
  - `auth.refresh_tokens` table added in migration `20260510-refresh-tokens.sql` + in `init.sql` with `IF NOT EXISTS`.
- **Sprint 55 brand gotchas**:
  - `next/image` added to `apps/frontend/src/components/Layout.tsx` for the fractal mark.
  - Landing Header + Footer use plain `<img>` (not next/image).
  - Brand assets live in `public/brand/` (not `public/` root).
- **Frontend lint pre-existing failure**: `@next/eslint-plugin-next` not found in CI — pre-existing. Not a blocker.
- **Version drift (pre-existing)**: 5 packages have version drift flagged by `npm run analyze:services`. Defer to a dedicated chore PR.
- **BrowseFeed serviceTypeFilter**: client-side only (filters the 50-item fetched array). Backend curated endpoint doesn't support service_type param — this is intentional for demo scale.
- **Communities index IIFE pattern**: `joinedIds` + `discoverCommunities` are derived in an IIFE `{(() => { ... return (...) })()}` inside JSX so they don't pollute component state and Load More offsets stay correct.

---

## DB Migration Status

**Sprint 54 migration still needed on demo server** (if not yet run):
```bash
ssh ubuntu@karmyq.com
psql -U postgres -d karmyq < ~/karmyq/infrastructure/postgres/migrations/20260510-refresh-tokens.sql
```

Sprint 56–60 have **no schema changes** — no migrations needed.
