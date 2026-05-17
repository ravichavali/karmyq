# Sprint 57: Frontend Simplification — Design Spec

**Date**: 2026-05-17
**Status**: Approved
**Version**: v9.23.0 → v9.24.0
**Sprint Branch**: `feature/sprint-57-frontend-simplification`

---

## Overview

Sprint 57 is the second of two KISS simplification sprints, targeting the frontend. Two problems:

1. `apps/frontend/src/lib/api.ts` (975 lines) creates 8 axios instances that each independently apply identical auth, response, and error interceptors. This is ~250 lines of copy-paste. Adding a new service client means copying the boilerplate again.

2. `apps/frontend/src/pages/communities/[id].tsx` (2,257 lines) manages 5 data fetches, 8+ tab states, edit modes, admin actions, forms, and nested UI — all in one file. The legacy tab mapping block at the top (lines 73–78) is a symptom of accumulated debt. This page is also the foundation of the Sprint 58 Dashboard UX redesign (4→3 tabs), so decomposing it now makes that sprint significantly easier.

The sprint also unblocks 20+ already-written geocoding tests in `apps/frontend/tests/tdd/geocoding.test.ts` that are currently skipped due to missing IndexedDB mocking setup.

### Core Principle: KISS

A factory function is simpler than 8 copies. A focused component is simpler than a 2,257-line file. Written tests that run are more useful than written tests that are skipped.

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 56 | Backend simplification — DRY infrastructure + TDD health | 🔮 Previous |
| **Sprint 57** | **Frontend simplification — API factory + community page decomp** | 🔮 This sprint |
| Sprint 58 | Dashboard UX Redesign — community page 4→3 tabs, full-width | 🔮 Next |

---

## New Concepts

None. No new domain abstractions — this is a structural reorganization.

---

## Data Model

No schema changes.

---

## API Endpoints

No new or modified endpoints. The API client factory produces the same 8 named clients (`communityApi`, `requestApi`, etc.) — all callers are unaffected.

---

## Frontend Changes

### 1. API Client Factory (`apps/frontend/src/lib/api.ts`)

Replace 8 independent axios instance declarations with a `createApiClient(baseURL: string)` factory that applies all interceptors once. The 8 named exports remain — callers do not change.

Before (simplified):
```typescript
export const communityApi = axios.create({ baseURL: '/api/community' });
communityApi.interceptors.request.use(authInterceptor);
communityApi.interceptors.response.use(successHandler, errorHandler);

export const requestApi = axios.create({ baseURL: '/api/requests' });
requestApi.interceptors.request.use(authInterceptor);
requestApi.interceptors.response.use(successHandler, errorHandler);
// ... 6 more copies
```

After:
```typescript
function createApiClient(baseURL: string) {
  const client = axios.create({ baseURL });
  client.interceptors.request.use(authInterceptor);
  client.interceptors.response.use(successHandler, errorHandler);
  return client;
}

export const communityApi = createApiClient('/api/community');
export const requestApi = createApiClient('/api/requests');
// ... 6 more one-liners
```

### 2. Community Page Decomposition (`apps/frontend/src/pages/communities/[id].tsx`)

Split the page into:

| Component/Hook | File | Responsibility |
|----------------|------|----------------|
| `useCommunityData` | `hooks/useCommunityData.ts` | All data fetching (members, requests, commitments, feed, config) |
| `CommunityHeader` | `components/community/CommunityHeader.tsx` | Title, avatar, join/leave button, admin badge |
| `BrowseTab` | `components/community/tabs/BrowseTab.tsx` | Request feed browsing |
| `ActiveTab` | `components/community/tabs/ActiveTab.tsx` | Commitments + My Requests combined (prep for Sprint 58 merge) |
| `ProfileTab` | `components/community/tabs/ProfileTab.tsx` | Member profile, karma, trust score |
| `[id].tsx` (trimmed) | `pages/communities/[id].tsx` | Tab shell only — imports the above, no inline logic |

The page file after decomposition should be under 300 lines (tab shell + routing + `useCommunityData` hook call).

**Scope boundary**: Do not implement the 4→3 tab redesign logic here. That is Sprint 58. This sprint only splits the existing 4-tab structure into focused components. The `ActiveTab` component is a placeholder merger — it renders Commitments first, then My Requests, with no UX redesign.

### 3. TDD: Unblock Geocoding Tests

`apps/frontend/tests/tdd/geocoding.test.ts` has 20+ real test cases behind a `describe.skip()`. The skip was added because IndexedDB is not available in the jest environment.

Fix: Install `fake-indexeddb` and configure it in `apps/frontend/jest.setup.js` (or the equivalent setup file) so IndexedDB is available during tests. Remove the `describe.skip()`.

---

## User Guide & Doc Updates

No user-facing behavior changes. Landing page update: `apps/landing/src/data/docs/build.json` — add a sentence noting that the frontend API layer uses a factory pattern.

---

## Critical Implementation Notes

1. **Named exports from `lib/api.ts` must stay identical.** Every component in the frontend imports `communityApi`, `requestApi`, etc. by exact name. The factory refactor must preserve these exports exactly — only the implementation changes, not the public API of the module.

2. **Read the community page's legacy tab mapping before touching it.** Lines 73–78 of `[id].tsx` contain a tab-ID mapping (`commitments` → `helping`, etc.). Understand what it does before removing anything — it may be load-bearing for URL-based tab navigation.

3. **React hooks must be unconditional in `useCommunityData`.** The hook cannot have `if` statements before other hooks. If data fetching is conditional (e.g., only fetch member data if the user is a member), use enabled flags or `skip` patterns inside the hook body, not conditional hook calls.

4. **`fake-indexeddb` setup.** Add to `apps/frontend/package.json` devDependencies and import in the jest setup file with `require('fake-indexeddb/auto')`. This must be in the global setup file, not per-test, so it applies to all frontend tests.

5. **Do not start the 4→3 tab redesign.** Sprint 58 owns that work. This sprint only decomposes; it does not redesign. If you find yourself writing new UX logic, stop — extract what exists as-is.

6. **Run the dev server and navigate to a community page after Task 4.** The decomposition must be verified visually — type checking alone does not confirm rendering works.
