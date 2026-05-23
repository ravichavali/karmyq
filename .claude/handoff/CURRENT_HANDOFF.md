# Sprint 64: Admin-as-Connector + Feed ADR | READY TO PLAN

## Handoff Document

**Date**: 2026-05-23
**Current Version**: v9.30.0 (just shipped)
**Status**: Sprint 63 complete + deployed. Sprint 64 direction known — needs spec + plan.

---

## Quick Start

1. Read this handoff
2. Run `/sprint-planning` to write the Sprint 64 spec + plan
3. Sprint 64 goals are defined below — no additional context-gathering needed

---

## What Sprint 63 Delivered (just shipped — commit `6a3b0f0`)

### 1. ActiveTab — Unified People Tab
**File:** `apps/frontend/src/components/community/tabs/ActiveTab.tsx`
- Removed `peopleSubTab` state and Members|Norms sub-toggle buttons
- Removed `memberFilter` state and Active|Pending filter buttons
- Added `normsOpen` state (defaults false) — single collapsible norms section at bottom
- New layout: pending section at top (admin/mod only, only when pendingCount > 0) → active members table → norms accordion
- Pending members use amber styling (`bg-amber-50 border border-amber-200`)

### 2. BrowseFeed — Post-Offer Confirmation
**File:** `apps/frontend/src/components/BrowseFeed.tsx`
- Added `lastOffered` state with 6-second auto-dismiss
- After `createMatch` succeeds: removes request from feed + shows banner
- Banner: "Offer sent! → Track in Active tab" (links to `/?tab=helping`)

### 3. Provider Visual Language
**Files:** `apps/frontend/src/components/BrowseModeControl.tsx`, `apps/frontend/src/pages/dashboard.tsx`
- BrowseModeControl: amber active chip when `browseMode === 'provider'` (`bg-amber-500 text-white border-amber-500`)
- Dashboard: `const isOnDuty = hasProviderProfile && isAvailable` extracted; amber "On duty" badge in community selector row when on-duty
- CommitmentsTab already refetches via conditional mount — no key prop needed

### 4. Backend Verification (no changes)
- `services/request-service/src/routes/matches.ts` — confirmed all acceptance paths set `help_requests.status = 'matched'`. No code changes needed.

### 5. Tests + Docs
- TDD: `apps/frontend/tests/tdd/sprint-63-ux-coherence.test.tsx` — 8 tests, all pass
- Landing docs: `apps/landing/src/data/docs/guides/admin-community.json` (unified People tab), `apps/landing/src/data/docs/guides/provider-mode.json` (Provider Visual Language section added)

---

## Sprint 64 Goals

Two tracks, both clearly scoped:

### Track A: Admin-as-Connector (full)

**Context:** Sprint 63 delivered the simplified People tab. Sprint 64 adds active facilitation tools for admins — the ability to boost a request and to DM a specific member with a suggestion.

**Feature 1 — Boost a Request:**
- Admin sees all open community requests in the Requests tab (already exists in some form)
- New "Boost" button on each request card — marks request as boosted for 48h
- Boosted requests get `+0.3` to their feed score and show a ⚡ "Community Pick" badge in member feeds
- Requires new backend endpoint: `POST /requests/:id/boost` in `request-service`
- New DB column: `requests.help_requests.boosted_until TIMESTAMPTZ`
- Feed query needs to include boost factor in scoring

**Feature 2 — Propose a Match (suggest a helper):**
- Admin sees open requests → clicks "Propose a Match" → picks a community member
- Creates a match record with `proposed` status (same as existing match flow)
- The proposed helper sees it in their Active tab under a "Suggested for you" section
- This is essentially the existing `POST /requests/matches` endpoint — admin just calls it from the UI
- Frontend: admin requests tab needs "Propose a Match" button + member picker modal

**Files to change:**
| Area | Files |
|------|-------|
| Backend (boost) | `services/request-service/src/routes/requests.ts`, new migration |
| Frontend admin | `apps/frontend/src/components/community/tabs/RequestsTab.tsx` (or wherever the admin requests view lives) |
| Frontend Active tab | `apps/frontend/src/components/CommitmentsTab.tsx` — add "Suggested for you" section |
| Landing docs | `apps/landing/src/data/docs/guides/admin-community.json` |

### Track B: Feed Design ADR (ADR-053)

**Context:** Write the design philosophy for Karmyq feeds — purpose-built, not social-media-style. No code, just the ADR + landing concept page.

**Deliverables:**
- `docs/adr/ADR-053-feed-design-philosophy.md`
- `apps/landing/src/data/docs/concepts/adr-053-feed-design-philosophy.json`
- nav.json entry under "Architecture Decisions"

**Key themes to document:**
- Feed is a work surface, not a scroll surface
- Priority order: matched requests → pending offers → community requests → never algorithmic engagement
- No likes, no comments, no follower counts
- Trust-weighted surfacing (requests from closer trust graph = higher)
- Why we don't show "trending" or "popular"

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 59 | Dashboard UX Simplification | ✅ Complete + deployed |
| Sprint 60 | Provider Browse Fork + Communities Polish | ✅ Complete + deployed |
| Sprint 61 | On-Duty Browse Refinement (segmented control + card accents) | ✅ Complete + deployed |
| Sprint 62 | Platform Coherence — 5 coherence gaps + post-sprint fixes | ✅ Complete + deployed |
| Sprint 63 | UX Coherence — admin simplification, feed, visual language | ✅ Complete + deployed |
| **Sprint 64** | **Admin-as-Connector (boost, propose) + Feed ADR** | 🔲 Ready to plan |
| Sprint 65 | TBD — likely trust graph visualization or mobile parity | 🔲 Planned |

---

## Architecture Gotchas (Persistent)

- **Landing page docs**: The `apps/landing/src/data/docs/` directory is in `.gitignore` — always use `git add -f` when committing JSON docs files. Direct editing of JSON files IS the correct approach (no generate-docs pipeline is active).
- **ADR numbering**: next ADR is **053**.
- **TDD test placement**: frontend sprint tests go in `apps/frontend/tests/tdd/`. Imports are relative to frontend source.
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`.
- **`git add` on CLAUDE.md**: file is tracked as lowercase `claude.md` — always `git add claude.md`.
- **Pre-existing TDD failures**: `sprint-39-provider-ux` (7 tests fail), `sprint-43-feed-ranking` (crashes). Do NOT fix.
- **Solo dev — no worktrees**: work directly on feature branches. Worktrees cause npm install prompts, lockfile conflicts, and jest path bugs.
- **BrowseModeControl**: shared component at `apps/frontend/src/components/BrowseModeControl.tsx`. `BrowseMode` type exported from there. `browseMode` state lives in `dashboard.tsx` and is passed to BrowseFeed (controlled). Active provider chip is now amber.
- **Tab id vs label**: Active tab has `id: 'helping'` (for URL routing) but label "Active". Do not change the id.
- **Flaky CI**: `feed-service` Docker build occasionally fails with npm install timeout. Not caused by code — retry if tests otherwise pass.
- **Sprint 54 migration still needed on demo server** (if not yet run):
  ```bash
  ssh ubuntu@karmyq.com
  psql -U postgres -d karmyq < ~/karmyq/infrastructure/postgres/migrations/20260510-refresh-tokens.sql
  ```
