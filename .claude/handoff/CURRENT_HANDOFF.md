# Sprint 64: Admin-as-Connector + Feed ADR | READY TO PLAN

## Handoff Document

**Date**: 2026-05-25
**Current Version**: v9.30.0 + post-sprint fixes (all deployed)
**Status**: Sprint 63 complete + all post-sprint bugs fixed + deployed. Sprint 64 direction known — start with `/sprint-planning`.

---

## Quick Start

1. Read this handoff
2. Run `/sprint-planning` to write the Sprint 64 spec + plan
3. Sprint 64 goals are defined below — no additional context-gathering needed

---

## What Was Completed This Session (post-sprint 63 fixes)

All commits since the sprint shipped:

| Commit | What |
|--------|------|
| `1ed9bf3` | Fixed offer-sent banner URL (`/?tab=helping` → `/dashboard?tab=helping`); relabeled "Needs Your Response" → "Awaiting Acceptance" in helping section |
| `53e9af4` | Fixed Mark Done reset after tab switch (was prematurely setting `status: 'completed'`); fixed Confirm Done never appearing for requester (was gated on dead `pending-confirmation` status) |
| `5860375` | Restored rating flow — inline 5-star `RatingPrompt` in `CommitmentsTab` after mark-done; wires `reputationService.submitFeedback` (best-effort); passes `communityId` from dashboard |
| `c0afa7d` | Added missing nginx route `/api/trust-card` → `social_graph_service/trust-card` |
| `7942adc` | Fixed `TrustCard` double-unwrap: `res.data.data` → `res.data` (response interceptor already unwraps the envelope) |

### Key decisions made
- **Rating is shown immediately after mark-done** (both parties), not gated on `fully_completed`. Best-effort — silently ignored on error.
- **`communityId` is passed from `activeCommunityId` in dashboard** — this is the currently-selected community, which is the right context for rating since the match was in that community.
- **TrustCard bug was two-layered**: nginx route missing (so request never reached service) + double-unwrap (so even if route existed, response would be `undefined`). Both fixed.

---

## What Sprint 63 Delivered (original sprint — commit `6a3b0f0`)

### 1. ActiveTab — Unified People Tab
**File:** `apps/frontend/src/components/community/tabs/ActiveTab.tsx`
- Removed `peopleSubTab` state and Members|Norms sub-toggle buttons
- Removed `memberFilter` state and Active|Pending filter buttons
- Single-scroll layout: pending (top, admin/mod only) → active members → norms accordion (collapsed by default)

### 2. BrowseFeed — Post-Offer Confirmation
**File:** `apps/frontend/src/components/BrowseFeed.tsx`
- "Offer sent! → Track in Active tab" banner (6-second auto-dismiss) links to `/dashboard?tab=helping`
- Request removed from feed immediately on successful offer

### 3. Provider Visual Language
**Files:** `apps/frontend/src/components/BrowseModeControl.tsx`, `apps/frontend/src/pages/dashboard.tsx`
- Provider chip: amber when on-duty (`bg-amber-500 text-white border-amber-500`)
- Dashboard: amber "On duty" badge in community selector row when `isOnDuty`

### 4. Tests + Docs
- TDD: `apps/frontend/tests/tdd/sprint-63-ux-coherence.test.tsx` — 8 tests, all pass
- Landing docs: `admin-community.json` (unified People tab), `provider-mode.json` (Provider Visual Language)

---

## Sprint 64 Goals

Two tracks, both clearly scoped:

### Track A: Admin-as-Connector (full)

**Context:** Sprint 63 delivered the simplified People tab. Sprint 64 adds active facilitation tools for admins — boost a request and propose a specific helper.

**Feature 1 — Boost a Request:**
- Admin sees all open community requests in the Requests tab (already exists)
- New "Boost" button on each request card — marks request as boosted for 48h
- Boosted requests get `+0.3` to their feed score and show a ⚡ "Community Pick" badge in member feeds
- Requires new backend endpoint: `POST /requests/:id/boost` in `request-service`
- New DB column: `requests.help_requests.boosted_until TIMESTAMPTZ`
- Feed query needs to include boost factor in scoring

**Feature 2 — Propose a Match (suggest a helper):**
- Admin sees open requests → clicks "Propose a Match" → picks a community member
- Creates a match record with `proposed` status (same as existing match flow)
- The proposed helper sees it in their Active tab under "Awaiting Acceptance"
- This is essentially the existing `POST /requests/matches` endpoint — admin just calls it from the UI
- Frontend: admin requests tab needs "Propose a Match" button + member picker modal

**Files to change:**
| Area | Files |
|------|-------|
| Backend (boost) | `services/request-service/src/routes/requests.ts`, new migration |
| Frontend admin | `apps/frontend/src/components/community/tabs/RequestsTab.tsx` (or wherever the admin requests view lives — confirm before starting) |
| Frontend Active tab | `apps/frontend/src/components/CommitmentsTab.tsx` — "Awaiting Acceptance" section already exists, admin-proposed matches get "Suggested by your community admin" label (already wired via `admin_proposed` field) |
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
| Sprint 63 | UX Coherence — admin simplification, feed, visual language + post-sprint fixes | ✅ Complete + deployed |
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
- **Response interceptor unwraps envelopes**: `socialGraphApi` (and all API clients) use a `responseInterceptor` that unwraps `{ success, data }` → `response.data = inner data`. Always use `res.data.field`, never `res.data.data.field`. TrustCard was the only place that had this wrong.
- **Flaky CI**: `feed-service` Docker build occasionally fails with npm install timeout. Not caused by code — retry if tests otherwise pass.
- **Sprint 54 migration still needed on demo server** (if not yet run):
  ```bash
  ssh ubuntu@karmyq.com
  psql -U postgres -d karmyq < ~/karmyq/infrastructure/postgres/migrations/20260510-refresh-tokens.sql
  ```
