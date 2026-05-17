# Frontend Simplification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal**: Collapse 8 duplicated axios client setups into a factory function, decompose the 2,257-line community page into focused components, and unblock 20+ skipped geocoding tests.

**Architecture**: No new services or endpoints. All changes are within `apps/frontend/`. The community page decomposition prepares the component tree for Sprint 58's tab redesign without implementing it.

**Tech Stack**: Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `apps/frontend/src/hooks/useCommunityData.ts` | All data fetching for the community page |
| `apps/frontend/src/components/community/CommunityHeader.tsx` | Title, avatar, join/leave, admin badge |
| `apps/frontend/src/components/community/tabs/BrowseTab.tsx` | Request feed browsing tab |
| `apps/frontend/src/components/community/tabs/ActiveTab.tsx` | Commitments + My Requests tab (Sprint 58 merger prep) |
| `apps/frontend/src/components/community/tabs/ProfileTab.tsx` | Member karma/trust/profile tab |

### Existing files to modify
| File | Change |
|------|--------|
| `apps/frontend/src/lib/api.ts` | Replace 8 axios instances with `createApiClient` factory |
| `apps/frontend/src/pages/communities/[id].tsx` | Import decomposed components; remove inline logic |
| `apps/frontend/tests/tdd/geocoding.test.ts` | Remove `describe.skip()` |
| `apps/frontend/jest.setup.js` (or equivalent) | Add `require('fake-indexeddb/auto')` |
| `apps/frontend/package.json` | Add `fake-indexeddb` to devDependencies |
| `apps/landing/src/data/docs/build.json` | Add factory pattern note |
| `package.json` (root) | Bump version v9.23.0 → v9.24.0 |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Named exports from `lib/api.ts` must stay identical.** `communityApi`, `requestApi`, etc. are imported by exact name across the codebase. Only the implementation changes — not the module's public API.

2. **Read lines 73–78 of `[id].tsx` before touching the tab logic.** This legacy tab-ID mapping may be load-bearing for URL-based navigation. Understand before removing.

3. **`useCommunityData` must not have conditional hook calls.** Use enabled flags or skip patterns inside, not `if` before hooks.

4. **`fake-indexeddb` must be in the global jest setup file**, not per-test. `require('fake-indexeddb/auto')` in the setup file applies it to all tests.

5. **Do not implement the 4→3 tab redesign.** Decompose what exists as-is. `ActiveTab` is a placeholder that renders existing content — no new UX.

6. **Run the dev server and navigate to a community page after Task 4** to verify the decomposition renders correctly. Type checking does not confirm rendering.

---

## Task 1: Feature Branch

**Files:** none

- [ ] **Create sprint branch**

```bash
git checkout -b feature/sprint-57-frontend-simplification
```

- [ ] **Verify**

```bash
git branch --show-current
```

---

## Task 2: Audit Current API Client Setup

**Files:**
- Read: `apps/frontend/src/lib/api.ts`

- [ ] **Read the full `lib/api.ts`** to understand:
  - The exact interceptor logic (auth header injection, response unwrapping, error handling)
  - All 8 client names and their base URLs
  - Any per-client customizations (some clients may have different timeout or baseURL patterns)

- [ ] **Grep for all imports of the named clients across the frontend:**

```bash
grep -r "from.*lib/api\|from.*@/lib/api" apps/frontend/src --include="*.ts" --include="*.tsx" -l
```

Note how many files import from `lib/api`. This tells you the blast radius of the refactor.

---

## Task 3: API Client Factory Refactor

**Files:**
- Modify: `apps/frontend/src/lib/api.ts`

- [ ] **Extract interceptor logic into named functions** at the top of the file (before the factory):

```typescript
function authInterceptor(config: InternalAxiosRequestConfig) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}
```

Apply the same pattern for the response and error handlers.

- [ ] **Write the factory function:**

```typescript
function createApiClient(baseURL: string) {
  const client = axios.create({ baseURL });
  client.interceptors.request.use(authInterceptor);
  client.interceptors.response.use(responseHandler, errorHandler);
  return client;
}
```

- [ ] **Replace all 8 instance declarations** with factory calls:

```typescript
export const communityApi = createApiClient('/api/community');
export const requestApi = createApiClient('/api/requests');
// ... etc
```

- [ ] **Verify the named exports are unchanged** — grep to confirm callers still resolve:

```bash
grep -r "communityApi\|requestApi\|authApi\|reputationApi" apps/frontend/src --include="*.ts" --include="*.tsx" | head -20
```

- [ ] **Run type check:**

```bash
cd apps/frontend && npx tsc --noEmit
```

---

## Task 4: Community Page — Extract `useCommunityData` Hook

**Files:**
- Read: `apps/frontend/src/pages/communities/[id].tsx`
- Create: `apps/frontend/src/hooks/useCommunityData.ts`

- [ ] **Read `[id].tsx` fully** to map all data fetching:
  - What APIs are called on mount?
  - What state variables hold fetched data?
  - What loading/error states exist?
  - What is the legacy tab mapping at lines 73–78?

- [ ] **Create `apps/frontend/src/hooks/useCommunityData.ts`** that moves all `useEffect`+fetch calls and their corresponding state into a single hook. The hook returns the data, loading states, and any refetch callbacks.

```typescript
export function useCommunityData(communityId: string) {
  // all fetching state here
  return {
    community, members, requests, commitments, feed,
    isLoading, error,
    refetchMembers, refetchRequests  // etc.
  };
}
```

- [ ] **Update `[id].tsx`** to call `useCommunityData(communityId)` and destructure the return value. Remove all inline fetch logic. The page should no longer contain any `useEffect` calls for data fetching.

---

## Task 5: Community Page — Extract Components

**Files:**
- Create: `apps/frontend/src/components/community/CommunityHeader.tsx`
- Create: `apps/frontend/src/components/community/tabs/BrowseTab.tsx`
- Create: `apps/frontend/src/components/community/tabs/ActiveTab.tsx`
- Create: `apps/frontend/src/components/community/tabs/ProfileTab.tsx`
- Modify: `apps/frontend/src/pages/communities/[id].tsx`

- [ ] **Create `CommunityHeader.tsx`** — extract the header section (name, avatar, join/leave button, admin badge). Props: community data, membership status, handlers.

- [ ] **Create `BrowseTab.tsx`** — extract the Browse tab content (request feed). Props: requests, community ID, handlers.

- [ ] **Create `ActiveTab.tsx`** — extract Commitments and My Requests tab content. For now, render both sections stacked (no UX redesign). Props: commitments, my requests, handlers.

- [ ] **Create `ProfileTab.tsx`** — extract Profile tab content (karma, trust score, member info). Props: user data, community stats.

- [ ] **Update `[id].tsx`** to import and render these components. The page file should now contain only:
  - The `useCommunityData` call
  - Tab state management
  - The JSX shell (tab bar + tab content switch)

- [ ] **Verify page is under 300 lines:**

```bash
wc -l apps/frontend/src/pages/communities/\[id\].tsx
```

---

## Task 6: Visual Verification

- [ ] **Start the frontend dev server:**

```bash
cd apps/frontend && npm run dev
```

- [ ] **Navigate to a community page** in the browser. Verify:
  - Page loads without error
  - All 4 tabs render
  - Join/leave button works
  - Browse tab shows requests
  - Active tab shows commitments and requests
  - Profile tab shows member data

- [ ] **Check browser console for errors.** No new errors should appear.

- [ ] **Stop dev server when done.**

---

## Task 7: Unblock Geocoding Tests

**Files:**
- Modify: `apps/frontend/package.json`
- Modify: `apps/frontend/jest.setup.js` (or equivalent setup file)
- Modify: `apps/frontend/tests/tdd/geocoding.test.ts`

- [ ] **Install `fake-indexeddb`:**

```bash
cd apps/frontend && npm install --save-dev fake-indexeddb
```

- [ ] **Find the frontend jest setup file:**

```bash
grep -r "setupFilesAfterFramework\|setupFiles" apps/frontend/jest.config.js apps/frontend/jest.config.ts 2>/dev/null
```

- [ ] **Add IndexedDB mock to the setup file:**

```javascript
require('fake-indexeddb/auto');
```

- [ ] **Remove `describe.skip(` from `geocoding.test.ts`** and replace with `describe(`.

- [ ] **Run the frontend tests to confirm the geocoding tests now execute:**

```bash
cd apps/frontend && npm test -- --testPathPattern=geocoding
```

Confirm tests run (pass or fail with real assertions — not skipped).

---

## Task 8: Frontend Tests for New Components

**Files:**
- Create: `apps/frontend/tests/tdd/community-decomposition.test.tsx`

- [ ] **Write smoke tests** for the new components confirming they render without errors:

```typescript
it('CommunityHeader renders name and avatar', () => { ... });
it('BrowseTab renders request list', () => { ... });
it('ActiveTab renders commitments section', () => { ... });
it('ProfileTab renders member karma', () => { ... });
it('useCommunityData returns data shape', () => { ... });
```

These do not need to be exhaustive — the goal is confirming the components mount correctly and accept their expected props.

- [ ] **Run frontend tests:**

```bash
cd apps/frontend && npm test
```

---

## Task 9: Landing Page Docs

**Files:**
- Modify: `apps/landing/src/data/docs/build.json`

- [ ] **Read `build.json`** to find the relevant section.

- [ ] **Add a sentence** to the content noting that the frontend API layer uses a factory pattern (`createApiClient`) so interceptor logic is defined once and applied to all service clients.

---

## Task 10: Version Bump + Final Verification

**Files:**
- Modify: `package.json` (root)

- [ ] **Bump root `package.json` version:**

```json
"version": "9.24.0"
```

- [ ] **Run full build:**

```bash
npm run build
```

- [ ] **Run all tests:**

```bash
npm test
npm run test:tdd
```

- [ ] **Run feedback check:**

```bash
npm run feedback:check
```

- [ ] **Run type check:**

```bash
cd apps/frontend && npx tsc --noEmit
```

All must pass before Task 11.

---

## Task 11: Merge + Deploy

- [ ] **Run pre-commit check skill** (`/pre-commit-check`) and resolve any issues.

- [ ] **Commit all changes:**

```bash
git add -A
git commit -m "refactor(frontend): API client factory; community page decomposition; unblock geocoding tests (v9.24.0)"
```

- [ ] **Merge to master and push:**

```bash
git checkout master && git merge feature/sprint-57-frontend-simplification && git push origin master
```

- [ ] **Monitor GitHub Actions** for green build.

- [ ] **Use `/deploy` skill** if manual deployment to karmyq.com is needed.
