# Sprint 64: Admin-as-Connector + Feed ADR — Design Spec

**Date**: 2026-05-25
**Status**: Approved
**Version**: v9.30.0 → v9.40.0
**Sprint Branch**: `feature/sprint-64-admin-connector-adr`

---

## Overview

Sprint 63 simplified the admin People tab. Sprint 64 completes the Admin-as-Connector vision by surfacing two already-built features to members and fixing a permissions gap, then documents the feed design philosophy as ADR-053.

Pre-sprint audit revealed that the majority of Track A backend and UI was implemented in a prior sprint (Sprint 36 based on code comments): the boost and propose-match endpoints exist, the DB migration is deployed, feed scoring is wired, and the admin BrowseTab has boost/propose buttons. What's actually missing is narrower than the handoff anticipated.

### Core Principle: Finish What's Already Built

The most valuable sprint work is sometimes surfacing completed backend functionality that never reached member-facing UI, and fixing permissions gaps that silently block features from working for non-admin roles.

---

## Multi-Sprint Arc

### Sprint 62–63 — Platform and UX Coherence (complete)
Simplified admin UI, unified People tab, visual language for provider mode.

### Sprint 64 — Admin-as-Connector + Feed ADR (this sprint)
Surface Community Pick badge to members, extend boost/propose to mods, document feed philosophy.

### Sprint 65 — TBD (upcoming)
Likely trust graph visualization or mobile parity.

---

## What Is Already Implemented (do not rewrite)

| Feature | Status | Location |
|---------|--------|----------|
| `POST /requests/:id/boost` | ✅ Done | `services/request-service/src/routes/adminActions.ts` |
| `DELETE /requests/:id/boost` | ✅ Done | same file |
| `POST /requests/:id/propose-match` | ✅ Done | same file |
| Boost DB columns + migration | ✅ Done | `init.sql` + `migrations/20260322-request-boost.sql` |
| Feed scoring +0.3 boost | ✅ Done | `basicFeedRanker.ts` + curated endpoint |
| Admin BrowseTab: boost button + badge | ✅ Done | `community/tabs/BrowseTab.tsx` |
| Admin BrowseTab: MemberPicker modal | ✅ Done | same file |
| CommitmentsTab: "Suggested by admin" label | ✅ Done | `CommitmentsTab.tsx` |

---

## What Sprint 64 Actually Builds

### Change 1 — "Community Pick" Badge in BrowseFeed

**Problem:** `BrowseFeed.tsx` calls `getCuratedRequests()` which already returns `is_boosted` and `boosted_expires_at` on each item. The boost score is already applied in ranking. But the member-facing feed renders no visual signal for boosted requests — members can't tell that a request has been highlighted by their admin.

**Fix:** Import `isBoostActive` from `@/utils/boost` into BrowseFeed. In the request card render, check `isBoostActive(request)` and show a `⚡ Community Pick` badge alongside the urgency badge. The label is "Community Pick" (not "Boosted") because it's the member framing — the admin curated it for the community.

**Files:** `apps/frontend/src/components/BrowseFeed.tsx`

---

### Change 2 — Mod Support in adminActions.ts

**Problem:** The frontend already shows boost and propose-match buttons to users with `isAdminOrMod` role. However, `isAdminOfRequestCommunity()` in the backend only grants access to `role === 'admin'`. Mods clicking "Boost" or "Propose a Match" receive a silent 403.

**Fix:** Update `isAdminOfRequestCommunity` to also accept `role === 'moderator'`. Rename to `isAdminOrModOfRequestCommunity` to accurately describe the check. Update all 4 call sites within the file.

**Files:** `services/request-service/src/routes/adminActions.ts`

---

### Change 3 — ADR-053: Feed Design Philosophy

**Purpose:** Document the design principles behind Karmyq feeds as a durable architectural record. No code changes.

**Key themes:**
- Feed is a work surface, not a scroll surface — it exists to generate action, not engagement
- Priority order: matched requests → pending offers → community requests → never algorithmic engagement bait
- No likes, no comments, no follower counts, no trending
- Trust-weighted surfacing: requests from closer trust graph bubble up
- Admin boost is the only human curation signal — no algorithmic trending
- Why infinite scroll is the wrong model for mutual aid

**Deliverables:**
- `docs/adr/ADR-053-feed-design-philosophy.md`
- `apps/landing/src/data/docs/concepts/adr-053-feed-design-philosophy.json`
- nav.json entry under "Architecture Decisions"

---

## API Endpoints

No new endpoints. Existing endpoints updated:

| Method | Path | Change |
|--------|------|--------|
| `POST` | `/requests/:id/boost` | Now accessible to mods (was admin-only) |
| `DELETE` | `/requests/:id/boost` | Now accessible to mods |
| `POST` | `/requests/:id/propose-match` | Now accessible to mods |

---

## Frontend Changes

| File | Change |
|------|--------|
| `apps/frontend/src/components/BrowseFeed.tsx` | Add "⚡ Community Pick" badge on boosted requests |

---

## User Guide & Doc Updates

**Mandatory for this sprint:**

1. **`apps/landing/src/data/docs/guides/admin-community.json`** — Add a section documenting boost and propose-match features:
   - "Boosting a Request" — mark as Community Pick for 48h, appears with ⚡ badge in member feeds
   - "Proposing a Match" — suggest a specific helper to the requester; helper sees it under Awaiting Acceptance with "Suggested by your community admin" label
   - Clarify that mods can also use both features

2. **`apps/landing/src/data/docs/concepts/adr-053-feed-design-philosophy.json`** — New concept page for ADR-053

3. **`apps/landing/src/data/docs/nav.json`** — Add ADR-053 entry under "Architecture Decisions"

---

## Critical Implementation Notes

1. **`isBoostActive` import path**: It's at `@/utils/boost`, not from a service. Already used in `BrowseTab.tsx` — follow that pattern.

2. **Badge label is "Community Pick" not "Boosted"**: Member-facing language. The admin view says "Boosted" (technical); the member view says "Community Pick" (meaningful). Same amber color family: `bg-amber-100 text-amber-700`.

3. **Rename `isAdminOfRequestCommunity` → `isAdminOrModOfRequestCommunity`**: 4 call sites in `adminActions.ts`, all in the same file. Change the function definition and all 4 usages.

4. **Moderator role string is `'moderator'`**: Check the `communities.members` table role values — consistent with other places in codebase.

5. **Landing docs in `.gitignore`**: Always `git add -f apps/landing/src/data/docs/` when committing.

6. **ADR number is 053**: Next ADR in sequence. Confirm by checking `docs/adr/` — no ADR-053 should exist yet.

7. **No DB migration needed**: Boost columns and migration already shipped. This sprint has no schema changes.

8. **TDD tests go in `apps/frontend/tests/tdd/`**: Not root `tests/tdd/`.
