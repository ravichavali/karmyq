# Sprint 64: Admin-as-Connector + Feed ADR | READY TO EXECUTE

## Handoff Document

**Date**: 2026-05-25
**Current Version**: v9.30.0 → targeting v9.40.0
**Status**: Sprint 64 spec + plan written. Ready to execute.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-64-admin-connector-adr`
3. Open plan: `docs/superpowers/plans/2026-05-25-sprint-64-admin-connector-feed-adr.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

---

## Sprint 64 Goal

Surface the already-built admin boost feature to member feeds, fix a permissions gap that blocks mods from using boost/propose, and write the Feed Design Philosophy ADR.

---

## What Was Already Built (Sprint 36 — do not rewrite)

A prior sprint implemented the full backend for Admin-as-Connector. Sprint 64 finishes what wasn't wired up:

| Feature | Status | Location |
|---------|--------|----------|
| `POST /requests/:id/boost` endpoint | ✅ Done | `services/request-service/src/routes/adminActions.ts` |
| `DELETE /requests/:id/boost` endpoint | ✅ Done | same |
| `POST /requests/:id/propose-match` endpoint | ✅ Done | same |
| Boost DB columns + migration | ✅ Done | `init.sql` + `migrations/20260322-request-boost.sql` |
| Feed scoring +0.3 boost factor | ✅ Done | `services/feed-service/src/services/basicFeedRanker.ts` |
| Admin BrowseTab: boost button + badge | ✅ Done | `apps/frontend/src/components/community/tabs/BrowseTab.tsx` |
| Admin BrowseTab: MemberPicker modal | ✅ Done | same |
| CommitmentsTab: "Suggested by admin" label | ✅ Done | `apps/frontend/src/components/CommitmentsTab.tsx` |

---

## Sprint 64 Actual Work (3 code changes + docs)

### Change 1: "Community Pick" Badge in BrowseFeed
**File**: `apps/frontend/src/components/BrowseFeed.tsx`

The curated requests API already returns `is_boosted` + `boosted_expires_at` on each item. Add:
```typescript
import { isBoostActive } from '@/utils/boost'
```
And in the request card render, add the badge:
```tsx
{isBoostActive(request) && (
  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
    ⚡ Community Pick
  </span>
)}
```
Badge label is "Community Pick" (member framing), not "Boosted" (admin framing).

### Change 2: Mod Support in adminActions.ts
**File**: `services/request-service/src/routes/adminActions.ts`

Rename `isAdminOfRequestCommunity` → `isAdminOrModOfRequestCommunity` and update the filter:
```typescript
.filter((m) => m.role === 'admin' || m.role === 'moderator')
```
4 call sites within the same file. The frontend already shows boost/propose buttons to mods — the backend was silently 403ing them.

### Change 3: ADR-053 (docs only)
**File**: `docs/adr/ADR-053-feed-design-philosophy.md`

Feed as a work surface, not a scroll surface. Key themes: priority order (matched → offers → community → all), trust-weighted surfacing, admin boost as the only curation signal, no engagement mechanics.

---

## Files To Change

| File | Change |
|------|--------|
| `apps/frontend/src/components/BrowseFeed.tsx` | Add "Community Pick" badge |
| `services/request-service/src/routes/adminActions.ts` | Mod support |
| `docs/adr/ADR-053-feed-design-philosophy.md` | New — full ADR content in plan |
| `apps/landing/src/data/docs/concepts/adr-053-feed-design-philosophy.json` | New — landing page |
| `apps/landing/src/data/docs/guides/admin-community.json` | Add boost + propose docs |
| `apps/landing/src/data/docs/nav.json` | ADR-053 nav entry |
| `services/request-service/CONTEXT.md` | Note mod support change |
| `apps/frontend/tests/tdd/sprint-64-admin-connector.test.tsx` | New — TDD tests |
| `package.json` (root) | Bump to 9.40.0 |

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 59 | Dashboard UX Simplification | ✅ Complete + deployed |
| Sprint 60 | Provider Browse Fork + Communities Polish | ✅ Complete + deployed |
| Sprint 61 | On-Duty Browse Refinement | ✅ Complete + deployed |
| Sprint 62 | Platform Coherence — 5 gaps | ✅ Complete + deployed |
| Sprint 63 | UX Coherence — admin, feed, visual language | ✅ Complete + deployed |
| **Sprint 64** | **Admin-as-Connector (badge + mod fix) + Feed ADR** | 🔲 Ready to execute |
| Sprint 65 | TBD — likely trust graph visualization or mobile parity | 🔲 Planned |

---

## Architecture Gotchas (Persistent)

- **Landing page docs**: The `apps/landing/src/data/docs/` directory is in `.gitignore` — always use `git add -f` when committing JSON docs files.
- **ADR numbering**: next ADR is **053**.
- **TDD test placement**: frontend sprint tests go in `apps/frontend/tests/tdd/`. Imports are relative to frontend source.
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`.
- **`git add` on CLAUDE.md**: file is tracked as lowercase `claude.md` — always `git add claude.md`.
- **Pre-existing TDD failures**: `sprint-39-provider-ux` (7 tests fail), `sprint-43-feed-ranking` (crashes). Do NOT fix.
- **Solo dev — no worktrees**: work directly on feature branches. Worktrees cause npm install prompts, lockfile conflicts, and jest path bugs.
- **BrowseModeControl**: shared component at `apps/frontend/src/components/BrowseModeControl.tsx`. `BrowseMode` type exported from there. `browseMode` state lives in `dashboard.tsx` and is passed to BrowseFeed (controlled). Active provider chip is now amber.
- **Tab id vs label**: Active tab has `id: 'helping'` (for URL routing) but label "Active". Do not change the id.
- **Response interceptor unwraps envelopes**: `socialGraphApi` (and all API clients) use a `responseInterceptor` that unwraps `{ success, data }` → `response.data = inner data`. Always use `res.data.field`, never `res.data.data.field`.
- **Flaky CI**: `feed-service` Docker build occasionally fails with npm install timeout. Not caused by code — retry if tests otherwise pass.
- **Sprint 54 migration still needed on demo server** (if not yet run):
  ```bash
  ssh ubuntu@karmyq.com
  psql -U postgres -d karmyq < ~/karmyq/infrastructure/postgres/migrations/20260510-refresh-tokens.sql
  ```
