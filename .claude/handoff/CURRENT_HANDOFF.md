# SPRINT 58 — Dashboard UX Redesign | Ready to Execute

## Handoff Document

**Date**: 2026-05-17
**Current Version**: v9.24.0 (Sprint 57 shipped)
**Status**: Sprint 57 complete + deployed. Sprint 58 (Dashboard UX Redesign) is next.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-56-backend-simplification`
3. Open plan: `docs/superpowers/plans/2026-05-17-sprint-56-backend-simplification.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

---

## Sprint 55 — Brand Rollout ✅

Refined Fractal mark rolled out across the monorepo (PR #18, merged to master, deployed).

| Task | Result |
|------|--------|
| Favicons replaced | `apps/frontend/public/favicon.svg` + `apps/landing/public/favicon.svg` → cream tile + hexagonal dot cluster |
| Headers updated | Fractal mark added alongside Fraunces wordmark in frontend nav + landing header |
| Footer updated | Dark-surface variant (`karmyq-mark-dark.svg`) in landing footer |
| Brand asset library | 9 SVGs in `public/brand/` (frontend + landing); `assets/brand/` (mobile) |
| Mobile icon PNGs | Deferred — SVGs placed in `apps/mobile/assets/brand/`; PNG raster waiting on real screens |
| Nav label audit | `NAV_AUDIT.md` at repo root — read-only, no labels changed yet |

**NAV_AUDIT.md key findings** (high-risk, require coordinated rename):
- `commitments` → `helping` (TabBar.tsx:3, dashboard.tsx:119, requests/[id].tsx:20)
- `my-requests` → `asks` (same files)
- `profile` → `me` (same files)
- Mobile: `Feed` → `Browse`, `Requests` → `Asks`, `Profile` → `Me` (apps/mobile/app/(tabs)/_layout.tsx)

These label renames happen during Sprint 58 (Dashboard UX), which is where the tab structure changes.

---

## Baseline Metrics (captured 2026-05-17)

Track these after each sprint to measure actual reduction.

### Sprint 56 files

| File | Lines | Expected after |
|------|-------|----------------|
| `services/auth-service/src/utils/logger.ts` | 73 | ~1 (re-export) |
| `services/social-graph-service/src/config/logger.ts` | 21 | ~1 (re-export) |
| `services/auth-service/src/events/publisher.ts` | 50 | ~2 (import) |
| `services/request-service/src/events/publisher.ts` | 37 | ~2 (import) |
| `services/community-service/src/events/publisher.ts` | 37 | ~2 (import) |
| `services/reputation-service/src/events/publisher.ts` | 37 | ~2 (import) |
| `services/request-service/src/routes/requests.ts` | 1,391 | <1,300 (query builder extracted) |
| `services/auth-service/tests/regression/auth.routes.test.ts` | 27 | ~27 (same, real assertions) |
| `services/reputation-service/tests/regression/placeholder.test.ts` | 8 | 0 (deleted or todos) |
| `services/social-graph-service/tests/regression/placeholder.test.ts` | 8 | 0 (deleted or todos) |
| `tests/tdd/community-evolution-flow.test.ts` | 36 | ~36 (todos) |
| `tests/tdd/fractal-feed-flow.test.ts` | 50 | ~50 (todos) |
| `tests/integration/complete-workflow.test.ts` | 553 | ~553 (real assertions) |
| **New:** `packages/shared/src/events/publisher.ts` | — | ~30 |
| **New:** `services/request-service/src/utils/queryBuilder.ts` | — | ~100 |
| **Sprint 56 total** | **2,328** | **~2,100** |

### Sprint 57 files

| File | Lines | Expected after |
|------|-------|----------------|
| `apps/frontend/src/lib/api.ts` | 975 | ~750 (factory removes ~250 lines of boilerplate) |
| `apps/frontend/src/pages/communities/[id].tsx` | 2,257 | <300 (tab shell only) |
| **New:** `apps/frontend/src/hooks/useCommunityData.ts` | — | ~120 |
| **New:** `apps/frontend/src/components/community/CommunityHeader.tsx` | — | ~80 |
| **New:** `apps/frontend/src/components/community/tabs/BrowseTab.tsx` | — | ~150 |
| **New:** `apps/frontend/src/components/community/tabs/ActiveTab.tsx` | — | ~200 |
| **New:** `apps/frontend/src/components/community/tabs/ProfileTab.tsx` | — | ~150 |
| **Sprint 57 total** | **3,232** | **~1,750** (net ~1,500 reduction after new files) |

### Combined baseline

| | Lines |
|-|-------|
| All files being touched | **5,560** |
| Expected after Sprint 56 | ~5,350 |
| Expected after Sprint 57 | ~4,100 |
| **Expected total reduction** | **~1,460 lines** |

---

## Sprint 56 — Backend Simplification ✅

Shipped as v9.23.0. Merged to master 2026-05-17. GitHub Actions deploying.

| Task | Result |
|------|--------|
| Shared event publisher | `packages/shared/events/publisher.ts` — `createPublisher(source)` factory |
| 4 service publishers migrated | auth, community, reputation, request → 3-line delegates |
| Social-graph logger migrated | `createLogger` from shared; 12 call sites fixed for new `error()` signature |
| Query builder extracted | `services/request-service/src/utils/queryBuilder.ts`; routes/requests.ts 1,391→1,334 lines |
| Placeholder tests fixed | Real assertions in auth regression; `it.todo()` in reputation + social-graph + integration |
| TDD promotion wired | `posttest` runs `promote-tdd-tests.js`; 9 tests promoted; 6 DB tests correctly kept in tdd/ |
| TDD script bugs fixed | Windows path bug, wrong cwd, `--passWithNoTests` false-positive — all resolved |
| CONTEXT.md updated | auth, community, reputation, request, social-graph + packages/shared |
| registry.json updated | `@karmyq/shared` added to community + reputation service dependencies |

---

## Sprint 57 — Frontend Simplification ✅

Shipped as v9.24.0. Merged to master 2026-05-17.

| Task | Result |
|------|--------|
| Axios factory | `createApiClient(baseURL)` factory in `api.ts`; 8 repeated setups replaced; `isRefreshing`/`pendingRequests` preserved as module-level |
| useCommunityData hook | `apps/frontend/src/hooks/useCommunityData.ts` — all 10 fetch functions + refetch callbacks |
| CommunityHeader | `apps/frontend/src/components/community/CommunityHeader.tsx` — 75 lines |
| BrowseTab | `apps/frontend/src/components/community/tabs/BrowseTab.tsx` — 586 lines |
| ActiveTab | `apps/frontend/src/components/community/tabs/ActiveTab.tsx` — 446 lines |
| ProfileTab | `apps/frontend/src/components/community/tabs/ProfileTab.tsx` — multi-section (overview/providers/settings), 608 lines |
| [id].tsx slimmed | 2,257 → 236 lines (tab shell + hook only) |
| Geocoding tests | 20 tests unblocked: `fake-indexeddb/auto` in jest.setup.js, `structuredClone` polyfill, mock routing by URL |
| Smoke tests | 12 new tests in `tests/tdd/community-decomposition.test.tsx` |
| Version | 9.23.0 → 9.24.0 |

---

## Sprint 58 — Dashboard UX Redesign (Next)

### Goal

---

### Sprint 58 Detail

Previously Sprint 56. Deferred for 2 simplification sprints.

- **Dashboard**: 4 tabs → 3 (Browse / Active / Profile), remove sidebars (full-width), merge Commitments + My Requests into action-first "Active" tab
- **Tab renames**: `commitments→helping`, `my-requests→asks`, `profile→me`
- **Foundation**: Sprint 57's `ActiveTab.tsx` + `useCommunityData.ts` make this sprint much easier — components already decomposed

### Quick Start for Sprint 58

1. Confirm Sprint 57 is merged (✅ done)
2. Check out branch: `git checkout -b feature/sprint-58-dashboard-ux`
3. Write plan or open existing spec
4. Run: `/execute-plan`

---

## Platform Coherence Backlog

*Added 2026-05-17 after codebase audit. Gaps where stated capabilities don't match implementation.*

### 1. Provider Mode Re-entry (High — breaks entire provider economy)
`ProviderModeSwitcher` and `ProviderNotificationBell` removed from nav in Sprint 50, never replaced. Provider economy (profiles, rate cards, offers) fully implemented in backend but no UI entry point.
- **Files**: `apps/frontend/src/components/Layout.tsx`, `services/request-service/src/routes/providers.ts`

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
| **Sprint 58** | **Dashboard UX Redesign (4→3 tabs, full-width)** | 🔵 Next up |

---

## Architecture Gotchas (Persistent)

- **Landing page docs source**: edit `docs/guides/*.md` + update `scripts/generate-docs.ts` arrays. Run `cd apps/landing && npm run generate-docs` to regenerate. Never hand-edit `apps/landing/src/data/docs/` directly.
- **ADR numbering**: next ADR is **053**.
- **TDD test placement**: sprint TDD tests go in `services/request-service/tests/tdd/` (NOT root `tests/tdd/`). Imports are relative: `../../src/...`.
- **Router mount paths**: always mount at full path (e.g. `/communities/trust-questions`) when router uses `router.get('/')`.
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`.
- **Feed weights**: no sum constraint; normalized at query time in feed-service.
- **`git add` on CLAUDE.md**: file is tracked as lowercase `claude.md` — always `git add claude.md`.
- **Pre-existing TDD failures**: `sprint-39-provider-ux` (7 tests fail), `sprint-43-feed-ranking` (crashes), schema-related tests. Do NOT fix.
- **Solo dev — no worktrees**: work directly on feature branches (`git checkout -b feature/sprint-NN`). Worktrees cause hundreds of npm install prompts, lockfile conflicts, and jest path bugs.
- **`?type=` routing in dibs-candidate**: `type === 'service'` → `getBestCandidate` (provider_profiles). Anything else → `getMutualAidBestCandidate` (auth.users).
- **Provider nav (post Sprint 50)**: `ProviderModeSwitcher` and `ProviderNotificationBell` are no longer rendered. Do not add them back.
- **Explore tier — `sg.type = 'exchange'` only**: community-only connections do NOT qualify for explore dibs tier.
- **Trust path URL pattern**: `http://social-graph-service:3010/social-graph/paths/:userId` — nginx strips `/api` prefix but NOT the service prefix (`/social-graph`).
- **Provider offer acceptance**: `offersDb.acceptOffer` closes the request and rejects proposed matches. Keep consistent if any new acceptance path is added.
- **Offer validation**: `providerOffersDb.validateRequestForOffer` uses live DB JOIN — no JWT community array.
- **community-service coverage**: scoped to `src/services/**/*.ts` because DB-dependent routes can't reach 60% without a live DB.
- **Sprint 54 security gotchas**:
  - `ALLOWED_CLEANUP_TABLES` in cleanup-service is exported — tests import the constant directly (don't mock DB).
  - `isRefreshing` + `pendingRequests` in `apps/frontend/src/lib/api.ts` are module-level — must stay outside interceptor function body or the concurrent 401 queue breaks. **Important for Sprint 56/57**: when refactoring `api.ts`, preserve these as module-level variables.
  - Refresh token raw value never stored — always SHA-256 hashed before DB insert.
  - `auth.refresh_tokens` table added in migration `20260510-refresh-tokens.sql` + in `init.sql` with `IF NOT EXISTS`.
- **Sprint 55 brand gotchas**:
  - `next/image` added to `apps/frontend/src/components/Layout.tsx` for the fractal mark.
  - Landing Header + Footer use plain `<img>` (not next/image).
  - Brand assets live in `public/brand/` (not `public/` root).
- **Frontend lint pre-existing failure**: `@next/eslint-plugin-next` not found in CI — pre-existing. Not a blocker.
- **Version drift (pre-existing)**: 5 packages have version drift flagged by `npm run analyze:services`. Defer to a dedicated chore PR.

---

## DB Migration Status

**Sprint 54 migration still needed on demo server** (if not yet run):
```bash
ssh ubuntu@karmyq.com
psql -U postgres -d karmyq < ~/karmyq/infrastructure/postgres/migrations/20260510-refresh-tokens.sql
```

Sprint 56 and 57 have **no schema changes** — no migrations needed.
