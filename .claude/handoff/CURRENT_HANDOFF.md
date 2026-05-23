# Sprint 63: UX Coherence | READY TO EXECUTE

## Handoff Document

**Date**: 2026-05-23
**Current Version**: v9.29.0 → v9.30.0 (this sprint)
**Status**: Spec + plan written. Ready to execute.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-63-ux-coherence`
3. Open plan: `docs/superpowers/plans/2026-05-23-sprint-63-ux-coherence.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

---

## Sprint 63 Goal

Three targeted UX improvements — unified community people tab, feed coherence after match acceptance, and amber visual language for provider context.

---

## What This Sprint Delivers

### 1. Admin Page Simplification — `ActiveTab.tsx`

**Problem:** The community people tab has 3 conceptual layers for admins:
- Sub-tab: Members | Norms
- Filter: Active | Pending
- Separate table per filter

**Fix:** Unified single-scroll view:
- Pending members at top with inline Approve/Reject (only shown when there are pending members)
- Active members table below
- Norms as a collapsible accordion section at the bottom

Remove `peopleSubTab` and `memberFilter` state. Add `normsOpen` state (defaults false).

### 2. Feed Coherence — `BrowseFeed.tsx` + `matches.ts` verification

**Problem:** After offering help, users get no confirmation and no clear path to track the offer. The IDEAS note also flags matched requests potentially appearing in the feed.

**Fix:**
- Verify match acceptance sets `status = 'matched'` in all code paths in `matches.ts` (read-only check, fix only if broken)
- After `createMatch` succeeds in BrowseFeed, show a 6-second "Offer sent → Track in Active tab" banner with a link to `?tab=helping`
- CommitmentsTab refetches when the user navigates to the `helping` tab

### 3. Provider/Community Visual Language — dashboard + BrowseModeControl

**Problem:** Provider context has no global visual signal beyond amber card borders in the feed.

**Fix:**
- Amber "On duty" badge in dashboard header when `isOnDuty`
- BrowseModeControl: amber active chip when `browseMode === 'provider'` (vs green for Community/Both)
- All color tokens: `bg-amber-500`, `text-amber-600`, `border-amber-400` — already used in codebase

---

## Key File Paths

| Item | Files |
|------|-------|
| Admin simplification | `apps/frontend/src/components/community/tabs/ActiveTab.tsx` |
| BrowseFeed confirmation | `apps/frontend/src/components/BrowseFeed.tsx` |
| BrowseModeControl amber | `apps/frontend/src/components/BrowseModeControl.tsx` |
| Dashboard badge + refetch | `apps/frontend/src/pages/dashboard.tsx` |
| Match acceptance verify | `services/request-service/src/routes/matches.ts` |
| Landing docs | `apps/landing/src/data/docs/guides/community-management.json`, `provider-mode.json` |
| TDD tests | `apps/frontend/tests/tdd/sprint-63-ux-coherence.test.tsx` |

---

## Critical Implementation Notes (read before any code)

1. **ActiveTab norms accordion** — `useState(false)` + simple button toggle. No library.

2. **Pending section guard** — `isAdminOrMod && pendingCount > 0` only. Non-admins never see it.

3. **BrowseModeControl amber** — active chip: `browseMode === 'provider' ? 'bg-amber-500 text-white border-amber-500' : 'bg-primary text-white border-primary'`. BrowseMode type export stays in BrowseModeControl.tsx.

4. **On-duty badge** — `isOnDuty` already computed as `hasProviderProfile && isAvailable` in dashboard.tsx. No new state.

5. **CommitmentsTab id is `'helping'`** — deep-link URL is `/?tab=helping`. Do NOT change the id.

6. **Feed coherence is mostly verification** — if matches.ts already sets status correctly, the only code change is the post-offer UX banner in BrowseFeed.tsx.

7. **git add CLAUDE.md on Windows** — tracked as `claude.md` lowercase. Always `git add claude.md`.

8. **Pre-existing TDD failures**: `sprint-39-provider-ux` (7 tests), `sprint-43-feed-ranking` (crashes). Do NOT fix.

---

## Spec + Plan Links

- Spec: `docs/superpowers/specs/2026-05-23-sprint-63-ux-coherence-design.md`
- Plan: `docs/superpowers/plans/2026-05-23-sprint-63-ux-coherence.md`

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 59 | Dashboard UX Simplification | ✅ Complete + deployed |
| Sprint 60 | Provider Browse Fork + Communities Polish | ✅ Complete + deployed |
| Sprint 61 | On-Duty Browse Refinement (segmented control + card accents) | ✅ Complete + deployed |
| Sprint 62 | Platform Coherence — 5 coherence gaps + post-sprint fixes | ✅ Complete + deployed |
| **Sprint 63** | **UX Coherence — admin simplification, feed, visual language** | 🔲 Ready to execute |
| Sprint 64 | Admin-as-connector (boost, DM) + Feed design doc (ADR) | 🔲 Planned |

---

## Sprint 64 Preview

- **Admin-as-connector (full)**: Admin sees all open community requests, can boost a request to top of member feeds, and DM a specific member to suggest they help. Requires new backend endpoint (boost) + frontend admin requests tab enhancement.
- **Feed design doc (ADR-053)**: Write the design philosophy for Karmyq feeds — purpose-built, not social-media-style. No code, just the ADR + landing concept page.

---

## Architecture Gotchas (Persistent)

- **Landing page docs source**: edit `docs/guides/*.md` + update `scripts/generate-docs.ts` arrays. Run `cd apps/landing && npm run generate-docs` to regenerate. Never hand-edit `apps/landing/src/data/docs/` directly.
- **ADR numbering**: next ADR is **053**.
- **TDD test placement**: frontend sprint tests go in `apps/frontend/tests/tdd/`. Imports are relative to frontend source.
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`.
- **`git add` on CLAUDE.md**: file is tracked as lowercase `claude.md` — always `git add claude.md`.
- **Pre-existing TDD failures**: `sprint-39-provider-ux` (7 tests fail), `sprint-43-feed-ranking` (crashes). Do NOT fix.
- **Solo dev — no worktrees**: work directly on feature branches. Worktrees cause npm install prompts, lockfile conflicts, and jest path bugs.
- **BrowseModeControl (Sprint 61)**: shared component at `apps/frontend/src/components/BrowseModeControl.tsx`. `BrowseMode` type exported from there. `browseMode` state lives in `dashboard.tsx` and is passed to BrowseFeed (controlled).
- **Tab id vs label**: Active tab has `id: 'helping'` (for URL routing) but label "Active". Do not change the id.
- **Flaky CI**: `feed-service` Docker build occasionally fails with npm install timeout. Not caused by code — retry if tests otherwise pass.
- **Sprint 54 migration still needed on demo server** (if not yet run):
  ```bash
  ssh ubuntu@karmyq.com
  psql -U postgres -d karmyq < ~/karmyq/infrastructure/postgres/migrations/20260510-refresh-tokens.sql
  ```
