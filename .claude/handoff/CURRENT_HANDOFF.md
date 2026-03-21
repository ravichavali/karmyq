# SPRINT 34 READY TO EXECUTE

## Handoff Document for New Conversation

**Date**: 2026-03-21
**Current Version**: v9.8.0 (Sprint 33 complete on `feature/sprint-33-ux-foundation`, ready to merge)
**Status**: Sprint 34 fully planned. Merge Sprint 33 branch, then execute Sprint 34 plan.

---

## Quick Start

1. Read this handoff
2. Merge Sprint 33 branch (if not done):
   ```bash
   git checkout master
   git merge feature/sprint-33-ux-foundation
   ```
3. Check out Sprint 34 branch:
   ```bash
   git checkout -b feature/sprint-34-ux-redesign
   ```
4. Open the plan: `docs/superpowers/plans/2026-03-21-sprint-34-ux-redesign.md`
5. Run: `/execute-plan` (uses `superpowers:subagent-driven-development`)

---

## Sprint 34 Goal

Replace the 3-column dashboard with a tab-based layout that puts the 5 core user flows (Browse, Commitments, My Requests, Profile) front and center with minimal cognitive load.

**No backend changes.** This is 100% frontend restructuring.

---

## What Just Shipped — Sprint 33 (v9.7.1 → v9.8.0)

| Area | What changed | Key files |
|------|-------------|-----------|
| **Design system** | Canonical `.btn-*`, `.card`, `.input`, `.section-heading` in `@layer components` | `apps/frontend/src/styles/globals.css` |
| **Empty states** | New `EmptyState.tsx` wired into 4 pages | `src/components/EmptyState.tsx` |
| **Onboarding** | New `WelcomeModal.tsx` — 3-step guide on first dashboard visit | `src/components/WelcomeModal.tsx`, `dashboard.tsx` |
| **Evolution toggle** | Moved from `trust.tsx` → `profile.tsx` | `profile.tsx`, `reputation/trust.tsx` |
| **Performance** | `next/dynamic` + `ssr: false` for 3 heavy components | `profile.tsx`, `communities/new.tsx`, etc. |
| **Landing copy** | Hero plain-language rewrite | `apps/landing/src/components/sections/Hero.tsx` |
| **TDD tests** | 3 new test files, 18 tests all passing | `tests/tdd/` |

---

## Multi-Sprint UX Arc

| Sprint | Focus | Status |
|--------|-------|--------|
| **33** | Design system foundation: canonical classes, empty states, onboarding, performance | ✅ Complete |
| **34** | Navigation redesign + feed simplification + Commitments as first-class tab | 🔜 **This sprint** |
| **35** | Request creation simplification (progressive disclosure) + service hiring from provider profiles | Future |
| **36** | Commitment depth (timeline, inline messaging) + admin simplification | Future |

---

## Sprint 34 Scope Summary

### What changes
- **Kill the 3-column layout** — `LeftSidebar` and `RightSidebar` removed from dashboard composition (files kept, just not used)
- **New `TabBar` component** — 4 tabs: Browse | Commitments | My Requests | Profile
- **Desktop**: horizontal tab bar below top nav
- **Mobile**: sticky bottom nav bar (4 items)
- **Single-column content** — `max-w-2xl mx-auto` (672px) for all tab content
- **FAB ("+ Get Help")** — fixed bottom-right, visible on Browse + Commitments tabs
- **`BrowseFeed`** — single-column card feed of community requests (extracted from dashboard)
- **`CommitmentsTab`** — "I'm Helping" + "I Asked For Help" two-section view
- **`MyRequestsTab`** — my posted requests + offer acceptance
- **`FilterChipRow`** — horizontal type/urgency chips (replaces hidden FeedFilterPanel)

### What does NOT change this sprint
- Request creation form (Sprint 35)
- Provider profiles + service hiring flow (Sprint 35)
- Admin pages (Sprint 36)
- Backend APIs (none needed)

---

## ⚠️ Critical Implementation Notes

1. **Dashboard becomes a tab shell.** `dashboard.tsx` renders the active tab component based on `activeTab` state. Tab components own their own data fetching — do NOT pass data down from dashboard.

2. **LeftSidebar and RightSidebar are NOT deleted** — just removed from dashboard/Layout imports. Check for other usages before removing any import.

3. **Bottom tab bar must sit above the FAB.** FAB is `fixed bottom-24 right-6`. Bottom nav is `fixed bottom-0 h-16`. Update FAB offset if bottom-nav height changes.

4. **Community selector moves from LeftSidebar to top bar.** Lift `selectedCommunity` state to `dashboard.tsx` and pass as prop to `BrowseFeed`.

5. **FilterChipRow does NOT duplicate FeedFilterPanel logic** — reuse existing filter state, expose as chips. Start with type + urgency chips only.

6. **CommitmentsTab fetches its own matches independently.** Do not pass match data from dashboard.

7. **The FAB opens the EXISTING request form** — do not simplify the form in this sprint. Sprint 35 owns that.

8. **`generate-docs.ts` is source of truth for nav.json.** Never edit nav.json directly. Force-add: `git add -f apps/landing/src/data/docs/...`

9. **Max-width on content**: `max-w-2xl mx-auto` (672px) for all tab content areas.

10. **Single responsive breakpoint**: `md:` (768px) — below = bottom tab bar, above = horizontal tab bar.

---

## New Components to Create

| Component | Path | Purpose |
|-----------|------|---------|
| `TabBar` | `src/components/TabBar.tsx` | Horizontal tabs (desktop) + sticky bottom bar (mobile) |
| `BrowseFeed` | `src/components/BrowseFeed.tsx` | Feed of community requests user can help with |
| `CommitmentsTab` | `src/components/CommitmentsTab.tsx` | "I'm Helping" + "I Asked For Help" sections |
| `MyRequestsTab` | `src/components/MyRequestsTab.tsx` | My posted requests + offer management |
| `FilterChipRow` | `src/components/FilterChipRow.tsx` | Horizontal type/urgency filter chips |

---

## Artifacts

| Artifact | Path |
|----------|------|
| Design spec | `docs/superpowers/specs/2026-03-21-sprint-34-ux-redesign-design.md` |
| Implementation plan | `docs/superpowers/plans/2026-03-21-sprint-34-ux-redesign.md` |
| Sprint branch | `feature/sprint-34-ux-redesign` |

---

## Carry-Forward Issues

- **Migration runner**: deploy.sh does NOT auto-run migrations. Apply manually post-deploy if needed.
- **Pre-existing unstaged files** (not related to Sprint 33):
  - `apps/landing/src/data/docs/concepts/rate-cards.json` — deleted locally
  - `apps/landing/src/data/docs/guides/using-service-providers.json` — modified
  - `docs/IDEAS.md` — modified
  - `docs/superpowers/specs/2026-03-18-sprint-29-rate-cards-design.md` — untracked
- **Pre-existing test failures** (carry forward, not Sprint 33 regressions): `preSelectProvider`, `trust-evolution-flow`, `rateCards`

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
- **Admin page tab structure (v9.2.0+)**: 7 tabs — Overview, Members, Norms; Requests, Insights, Providers (`isAdminOrMod`); Settings (`isAdmin` only).
- **Rate card soft-delete**: DELETE sets `is_active = false`.
- **cross_community_prior**: Direction-agnostic (0.05–0.95). Never "more open."
- **Only one simulation**: `services/simulation-service/`. DB user: `karmyq_user`.
- **Collective link auth**: Both link/unlink endpoints accept collective admin OR community admin.
- **social_graph.connections pair normalization**: Always `LEAST/GREATEST(::text)` cast.
- **NetworkGraph lazy-load**: Uses `IntersectionObserver` — `GET /network` NOT called on profile mount. Also wrapped with `next/dynamic` (Sprint 33).
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
- **Sprint 33 new patterns**:
  - `karmyq_onboarded` localStorage key controls WelcomeModal (absence = show modal)
  - `next/dynamic` + `ssr: false` for `NetworkGraph`/`CommunityConfigEditor`/`SchemaCanvas`
  - Canonical classes in `globals.css @layer components`: `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.card`, `.input`, `.section-heading`
  - Evolution toggle lives in `profile.tsx` (not `trust.tsx`) — `trust.tsx` links to profile
- **Sprint 34 new patterns** (once implemented):
  - Tab-based dashboard shell: `dashboard.tsx` renders `<BrowseFeed>`, `<CommitmentsTab>`, `<MyRequestsTab>` based on `activeTab` state
  - `TabBar` component: `tab-bar` (desktop horizontal) + `bottom-nav` (mobile sticky footer)
  - FAB: `fixed bottom-24 right-6` — above bottom-nav
  - Single responsive breakpoint: `md:` (768px)
  - Content max-width: `max-w-2xl mx-auto` (672px)
