# SPRINT 56 — Backend Simplification | Ready to Execute

## Handoff Document

**Date**: 2026-05-17
**Current Version**: v9.22.0 (Sprint 55 shipped)
**Status**: Sprint 55 complete + deployed. Sprint 56 (Backend Simplification) is next. Sprint 57 (Frontend Simplification) follows.

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

## Sprint 56 — Backend Simplification

### Goal

Remove duplicated infrastructure (event publishers, loggers) by centralizing in `packages/shared`. Extract query-building logic from the request service's 1,391-line route file. Replace placeholder `expect(true).toBe(true)` tests with real assertions. Wire the TDD promotion pipeline.

### Spec + Plan

- Spec: `docs/superpowers/specs/2026-05-17-sprint-56-backend-simplification-design.md`
- Plan: `docs/superpowers/plans/2026-05-17-sprint-56-backend-simplification.md`

### What's being simplified

| Problem | Fix |
|---------|-----|
| 4 services have identical event publishers | Create `packages/shared/src/events/publisher.ts`; services import `createPublisher` |
| 2 services have custom loggers despite shared one existing | Migrate to `packages/shared/utils/logger.ts` (already 309 lines, full-featured) |
| `services/request-service/src/routes/requests.ts` is 1,391 lines | Extract SQL query builder to `services/request-service/src/utils/queryBuilder.ts` |
| ~25% of regression tests have `expect(true).toBe(true)` | Replace with real assertions or honest `it.todo()` |
| TDD promotion script exists but never runs | Wire into `posttest` npm script |

### ⚠️ Critical Implementation Notes

1. **Check shared logger API before migrating services.** Read `packages/shared/utils/logger.ts` exports first — confirm the call signature so all migration sites match.

2. **`@karmyq/shared` must be in each service's `package.json` dependencies.** Missing → Turbo skips building shared first → import failures.

3. **`moduleResolution: node16` for subpath imports.** Services importing from `@karmyq/shared/src/events/publisher` need this in their `tsconfig.json`.

4. **Query builder scope: lines 35–99 only.** Extract the `paramCount++` SQL builder block. Do not refactor route handlers.

5. **Delete placeholder files if they'd be all-todos.** An empty `describe` block causes jest warnings. `it.todo()` stubs are fine; zero assertions in a file is not.

6. **Do not use `--no-verify`.** Fix assertions, don't bypass the pre-push hook.

---

## Sprint 57 — Frontend Simplification (After Sprint 56)

### Goal

Collapse 8 duplicated axios client setups into a factory function. Decompose the 2,257-line community page into focused components (prepares Sprint 58). Unblock 20+ skipped geocoding tests.

### Spec + Plan

- Spec: `docs/superpowers/specs/2026-05-17-sprint-57-frontend-simplification-design.md`
- Plan: `docs/superpowers/plans/2026-05-17-sprint-57-frontend-simplification.md`

### Quick Start for Sprint 57

1. Confirm Sprint 56 is merged and deployed
2. Check out branch: `git checkout -b feature/sprint-57-frontend-simplification`
3. Open plan: `docs/superpowers/plans/2026-05-17-sprint-57-frontend-simplification.md`
4. Run: `/execute-plan`

### ⚠️ Critical Implementation Notes

1. **Named exports from `lib/api.ts` must stay identical.** `communityApi`, `requestApi`, etc. are imported by exact name — only the implementation changes.

2. **Read lines 73–78 of `[id].tsx` before touching tab logic.** Legacy tab-ID mapping may be load-bearing for URL navigation.

3. **Do not implement the 4→3 tab redesign.** Sprint 58 owns that. This sprint only decomposes existing structure into components.

4. **`fake-indexeddb` in global jest setup.** `require('fake-indexeddb/auto')` in the setup file, not per-test.

5. **Run dev server after decomposition.** Navigate to a community page to verify it renders — type checking does not confirm rendering.

---

## Sprint 58 — Dashboard UX Redesign (After Sprint 57)

Previously this was Sprint 56. Deferred for 2 simplification sprints.

- **Dashboard**: 4 tabs → 3 (Browse / Active / Profile), remove sidebars (full-width), merge Commitments + My Requests into action-first "Active" tab
- **Tab renames**: `commitments→helping`, `my-requests→asks`, `profile→me`
- **Foundation**: Sprint 57's `ActiveTab.tsx` + `useCommunityData.ts` make this sprint easier

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
| **Sprint 56** | **Backend simplification — DRY + TDD health** | 🔵 Next up |
| Sprint 57 | Frontend simplification — API factory + community page | 🔮 Planned |
| Sprint 58 | Dashboard UX Redesign (4→3 tabs, full-width) | 🔮 Planned |

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
