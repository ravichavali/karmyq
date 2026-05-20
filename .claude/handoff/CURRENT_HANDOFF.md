# SPRINT 60 — Provider Browse Fork | Ready to Plan

## Handoff Document

**Date**: 2026-05-20
**Current Version**: v9.26.0 (Sprint 59 shipped)
**Status**: Sprint 59 complete + deployed. Sprint 60 direction decided — run `/sprint-planning` to produce spec + plan.

---

## Quick Start

1. Read this handoff
2. Run `/sprint-planning` with this goal:

> **Sprint 60 — Provider Browse Fork**
> The availability toggle (Available / Off duty pill in the nav) should fork what Browse shows:
> - **On-duty** → Browse shows only requests matching the provider's service type (provider feed)
> - **Off-duty** → Browse shows the normal community feed
> No extra toggles, no new tabs. The availability pill is the only control.
>
> Key files: `apps/frontend/src/pages/dashboard.tsx`, `apps/frontend/src/components/BrowseFeed.tsx`, `apps/frontend/src/contexts/ProviderContext.tsx`
> `BrowseFeed` already accepts `serviceTypeFilter?: string[]` prop — passing provider's service types when on-duty is likely most of the work.
> `ProviderContext` exposes `isAvailable` and `providerServiceTypes` already.

---

## Sprint 59 — Dashboard UX Simplification ✅

Shipped as v9.26.0. Merged to master 2026-05-19. Deploying via GitHub Actions.

| Task | Result |
|------|--------|
| TabBar restructure | 4 tabs → 3: Browse / Helping / Asks. Profile tab removed entirely |
| Tab renames | `commitments` → `helping`, `my-requests` → `asks` (TabId type, TABS array, badge logic) |
| SpeedDialFab updated | `'commitments'` → `'helping'`, `'my-requests'` → `'asks'`; profile case removed |
| requests/[id].tsx | Redirect updated: `?tab=commitments` → `?tab=helping` |
| dashboard.tsx | Removed `ProviderDashboardCard` + `ProviderMatchingRequests` renders and their imports; removed `activeCommitmentsCount` |
| Layout.tsx | Desktop nav + mobile hamburger: `{hasProviderProfile ? <Providers> : <Become a provider → /providers/new>}` |
| Feed fix verified | All acceptance paths (dibs, matches, offers) already set `status = 'matched'`; BrowseFeed already filters `r.status === 'open'` — no backend change needed |
| Landing email | `ravichavali@gmail.com` → `contact@karmyq.org` in Footer, CommunityStories, Movement |
| Docs guides | "Commitments tab" → "Helping tab", "My Requests" → "Asks" in 6 source markdown files; landing JSON regenerated |
| TDD tests | `apps/frontend/tests/tdd/sprint-59-dashboard-ux.test.tsx` — 4 tests, all passing |
| Version | 9.24.0 → 9.26.0 |

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

These label renames happen during Sprint 59 (Dashboard UX), which is where the tab structure changes.

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

## Sprint 58 — karmyq.org Rebuild ✅

Shipped as v9.25.0. Merged to master 2026-05-18.

Full rebuild of the karmyq.org landing page. Content-complete from `karmyq-org-v3.html`. Aesthetics preserved from existing site (color palette, typography, NetworkVisualization animation).

| Task | Result |
|------|--------|
| TheStory.tsx (NEW) | Layer 1: emotional narrative, wordmark/tagline, functional subheadline, NetworkVisualization bg |
| TheThinking.tsx (NEW) | Layer 2: 8 philosophical sections + Go Deeper cluster |
| DeeperSections.tsx (NEW) | 4 collapsible accordion sections (Stars, Gossip, Village, Research with 9 thinkers) |
| HowItWorks.tsx (rewrite) | Reputation, trust scoring, service layer, community governance |
| CommunityStories.tsx (rewrite) | Ravi's founder's note replaces lorem ipsum; community contact placeholder |
| Movement.tsx (rewrite) | Founding cohort CTA; email signup (mailto interim); stats row removed |
| WhatIsKarmyq.tsx (update) | Simplified to "toolkit" paragraph |
| FadingTimeline.tsx (update) | Diverse global names (Priya/Maria/Carlos/Aisha/Wei/Mohamed/Yuki/James/Amara/Lena) |
| CTAs.tsx (update) | Updated audience descriptions + researchers link → #deeper-research |
| Header.tsx (update) | Nav: Story · Thinking · How it works · Go deeper · Docs; CTA: "Find your neighbors" |
| page.tsx (restructure) | Removed: ComparisonTable, Research, TheCrack, Opportunity, Hero, WhatIsKarmyq (absorbed) |
| **Pass 1 — Voice** | US spellings throughout; sentence case all titles; trailing periods on H2s; dedupe philosophy quote from FadingTimeline; nav labels sentence case |
| **Pass 2 — Tokens** | `.eyebrow` / `.eyebrow-green` / `.eyebrow-orange` utility classes; all eyebrows → text-xs + correct color; backgrounds aligned (HowItWorks→cream, CommunityStories→cream, Movement drops bg-organic-2); CTAs rounded-3xl→rounded-2xl; DeeperSections accordion rounded-2xl overflow-hidden; email signup stacked + rounded-full; wordmark font-semibold tracking-tight; WhatIsKarmyq absorbed into HowItWorks top |
| **Pass 3 — CTA/footer** | CTA cards de-gradient → solid colors (green/brown/teal); CommunityStories id="stories"; Footer 4→3 col (Resources removed); footer anchors corrected; sentence case; contact unified to ravichavali@gmail.com |

**Pending before launch (do not ship without resolving):**
- Replace `mailto:` email signup in `Movement.tsx` with Buttondown/Mailchimp
- Update `ravichavali@gmail.com` → `hello@karmyq.org` once non-profit registration completes
- Confirm karmyq.com platform landing state before "Find your neighbors" CTA goes live

---

## Sprint 59 — Dashboard UX Simplification (Ready to Execute)

### Goal

Simplify the personal dashboard: drop the Profile tab stub (profile is already accessible via name click in nav), rename Commitments→Helping and My Requests→Asks, remove the ProviderDashboardCard stat panel (anti-gamification), restore a "Become a provider" entry point in nav for non-providers, and fix the feed bug where confirmed matches still appear as open requests in Browse.

### Scope

- **Tab restructure**: 4 tabs → 3 (Browse / Helping / Asks). Profile tab removed entirely.
- **Tab renames**: `commitments` → `helping`, `my-requests` → `asks`
- **Remove provider stat cards**: `ProviderDashboardCard` + `ProviderMatchingRequests` removed from dashboard.tsx render (components stay in codebase)
- **Provider re-entry**: Add "Become a provider" link in desktop nav + mobile hamburger for users without a provider profile → `/providers/new`
- **Feed fix**: Verify and fix that accepting a match updates the request status to `matched`; BrowseFeed already filters `status === 'open'`

### Spec + Plan

- Spec: `docs/superpowers/specs/2026-05-19-sprint-59-dashboard-ux-design.md`
- Plan: `docs/superpowers/plans/2026-05-19-sprint-59-dashboard-ux.md`

### Key Files

| File | Change |
|------|--------|
| `apps/frontend/src/components/TabBar.tsx` | Remove `'profile'` from `TabId`, rename tabs |
| `apps/frontend/src/pages/dashboard.tsx` | Remove profile render + provider stat cards; update tab IDs |
| `apps/frontend/src/components/Layout.tsx` | Add "Become a provider" link for non-providers |
| `apps/frontend/src/pages/requests/[id].tsx` | Update `?tab=commitments` → `?tab=helping` |
| `services/request-service/src/routes/requests.ts` | Verify match acceptance sets request status to `matched` |

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
| Sprint 58 | karmyq.org rebuild — 3-layer content, deeper sections | ✅ Complete + deployed |
| Sprint 59 | Dashboard UX Simplification (3 tabs, provider re-entry, feed fix) | ✅ Complete + deployed |
| **Sprint 60** | **TBD — see Platform Coherence Backlog** | 🔵 Not yet planned |

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
