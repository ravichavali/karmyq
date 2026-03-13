# Admin Page Simplification Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the community admin page from 12 tabs to 7 by merging Members+Manage+Pending, Configuration+Settings+Linked Communities, and Statistics+Export.

**Architecture:** All changes land in a single file: `apps/frontend/src/pages/communities/[id].tsx`. No backend changes, no new components. Existing components (`CommunityConfigEditor`, `CommunityTrustQuestionnaire`, `TrustModelDiff`, `CommunityLinks`) are reused as-is.

**Tech Stack:** Next.js 14 (Pages Router), React, TypeScript, Tailwind CSS

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/frontend/src/pages/communities/[id].tsx` | Modify | All tab logic, state, and render blocks |
| `tests/tdd/admin-tab-redirect.test.ts` | Create | Unit test for query param → tab name mapping |

---

## Chunk 1: State Changes and Tab Nav Bar

### Task 1: Write the failing tab redirect test

**Files:**
- Create: `tests/tdd/admin-tab-redirect.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/tdd/admin-tab-redirect.test.ts
/**
 * Tests for the old-tab-name → new-tab-name redirect map.
 * This function is extracted from the component for testability.
 */

const OLD_TAB_MAP: Record<string, string> = {
  manage: 'members',
  pending: 'members',
  config: 'settings',
  stats: 'insights',
  export: 'insights',
  links: 'settings',
};

type ValidTab = 'overview' | 'members' | 'norms' | 'requests' | 'insights' | 'settings' | 'providers';

const VALID_TABS: ValidTab[] = ['overview', 'members', 'norms', 'requests', 'insights', 'settings', 'providers'];

function resolveTab(raw: string | undefined): ValidTab {
  if (!raw) return 'overview';
  if (VALID_TABS.includes(raw as ValidTab)) return raw as ValidTab;
  return (OLD_TAB_MAP[raw] as ValidTab) ?? 'overview';
}

describe('resolveTab', () => {
  it('returns overview for undefined', () => {
    expect(resolveTab(undefined)).toBe('overview');
  });

  it('passes through valid new tab names unchanged', () => {
    for (const tab of VALID_TABS) {
      expect(resolveTab(tab)).toBe(tab);
    }
  });

  it('maps manage → members', () => {
    expect(resolveTab('manage')).toBe('members');
  });

  it('maps pending → members', () => {
    expect(resolveTab('pending')).toBe('members');
  });

  it('maps config → settings', () => {
    expect(resolveTab('config')).toBe('settings');
  });

  it('maps stats → insights', () => {
    expect(resolveTab('stats')).toBe('insights');
  });

  it('maps export → insights', () => {
    expect(resolveTab('export')).toBe('insights');
  });

  it('maps links → settings', () => {
    expect(resolveTab('links')).toBe('settings');
  });

  it('falls back to overview for completely unknown tabs', () => {
    expect(resolveTab('gibberish')).toBe('overview');
  });
});
```

- [ ] **Step 2: Run to confirm it passes**

```bash
npm run test:tdd -- --testPathPattern="admin-tab-redirect"
```

Expected: All 9 tests pass.

> **Note on test isolation:** This test is self-contained — it defines `resolveTab` and `OLD_TAB_MAP` inline rather than importing from the component. This means it validates the mapping contract as a specification, not the component's actual runtime behavior. If the component's `useEffect` diverges from this mapping, the test will not catch it. This tradeoff is intentional: the mapping is simple pure logic and the `useEffect` in Task 2 reads `OLD_TAB_MAP` directly from component scope (not from this test file).

- [ ] **Step 3: Commit**

```bash
git add tests/tdd/admin-tab-redirect.test.ts
git commit -m "test(tdd): lock in admin tab redirect mapping logic"
```

---

### Task 2: Narrow activeTab type and add new state

**Files:**
- Modify: `apps/frontend/src/pages/communities/[id].tsx:70`

- [ ] **Step 1: Read current state declarations (lines 61–160)**

Confirm the exact current type union and any existing state on lines 61–160.

- [ ] **Step 2: Replace the activeTab type union (line ~70)**

Find this line:
```typescript
const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'norms' | 'config' | 'manage' | 'pending' | 'settings' | 'stats' | 'export' | 'providers' | 'links' | 'requests'>('overview');
```

Replace with:
```typescript
type ValidTab = 'overview' | 'members' | 'norms' | 'requests' | 'insights' | 'settings' | 'providers';

const OLD_TAB_MAP: Record<string, ValidTab> = {
  manage: 'members',
  pending: 'members',
  config: 'settings',
  stats: 'insights',
  export: 'insights',
  links: 'settings',
};

const VALID_TABS: ValidTab[] = ['overview', 'members', 'norms', 'requests', 'insights', 'settings', 'providers'];

const [activeTab, setActiveTab] = useState<ValidTab>('overview');
const [memberFilter, setMemberFilter] = useState<'active' | 'pending'>('active');
const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
```

> Place `type ValidTab`, `OLD_TAB_MAP`, and `VALID_TABS` at module scope (above the component function), or just inside the function before the useState call — either works since they are constants.

- [ ] **Step 3: Add query param useEffect**

Locate the existing `useEffect` blocks (typically near the top of the component after state declarations). Add a new `useEffect` that watches `router.query.tab`:

```typescript
// Redirect old tab names to new equivalents (backwards compat)
useEffect(() => {
  const raw = router.query.tab as string | undefined;
  if (!raw) return;
  if (VALID_TABS.includes(raw as ValidTab)) {
    setActiveTab(raw as ValidTab);
  } else if (OLD_TAB_MAP[raw]) {
    router.replace(
      { pathname: router.pathname, query: { ...router.query, tab: OLD_TAB_MAP[raw] } },
      undefined,
      { shallow: true }
    );
    setActiveTab(OLD_TAB_MAP[raw]);
  }
}, [router.query.tab]);
```

- [ ] **Step 4: Run TypeScript check**

```bash
cd c:/Users/ravic/development/karmyq/apps/frontend
npx tsc --noEmit
```

Expected: No errors (or only pre-existing errors unrelated to this change).

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/pages/communities/[id].tsx
git commit -m "refactor(admin): narrow activeTab union, add memberFilter + advancedSettings state, add tab redirect"
```

---

### Task 3: Replace the tab nav bar (12 tabs → 7)

**Files:**
- Modify: `apps/frontend/src/pages/communities/[id].tsx:507–621`

- [ ] **Step 1: Read lines 500–625 to understand current tab bar structure**

Understand the exact JSX pattern — button elements, active class logic, conditional visibility for admin tabs.

- [ ] **Step 2: Compute pending member count (for badge)**

Locate where `community.members` (or the equivalent members array) is accessible in component scope. Before the return statement or inside the render, add:

```typescript
const pendingCount = isAdmin
  ? (members ?? []).filter((m: any) => m.status === 'pending').length
  : 0;
```

> Adapt `members` to whatever the actual variable name is that holds the members array (look for where the Members tab currently reads member data).

- [ ] **Step 3: Replace the entire tab nav bar block (lines 507–621)**

Replace with this 7-tab nav bar:

```tsx
{/* Tab navigation */}
<div className="border-b border-gray-200 mb-6">
  <nav className="-mb-px flex space-x-4 overflow-x-auto" aria-label="Tabs">
    {(['overview', 'members', 'norms', 'requests'] as ValidTab[]).map((tab) => (
      <button
        key={tab}
        onClick={() => setActiveTab(tab)}
        className={`relative whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize ${
          activeTab === tab
            ? 'border-indigo-500 text-indigo-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        }`}
      >
        {tab}
        {tab === 'members' && isAdmin && pendingCount > 0 && activeTab !== 'members' && (
          <span className="absolute top-3 right-0 block h-2 w-2 rounded-full bg-red-500" />
        )}
      </button>
    ))}

    {isAdmin && (
      <>
        {(['insights', 'settings', 'providers'] as ValidTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize ${
              activeTab === tab
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </>
    )}
  </nav>
</div>
```

- [ ] **Step 4: Run TypeScript check**

```bash
cd c:/Users/ravic/development/karmyq/apps/frontend
npx tsc --noEmit
```

Expected: No new errors.

- [ ] **Step 5: Visual smoke test**

Start the frontend and navigate to a community page. Confirm:
- 4 tabs visible as non-admin: Overview, Members, Norms, Requests
- 7 tabs visible as admin: Overview, Members, Norms, Requests, Insights, Settings, Providers

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/pages/communities/[id].tsx
git commit -m "refactor(admin): replace 12-tab nav bar with 7 tabs + pending badge"
```

---

## Chunk 2: Members Tab — Unified Admin/Non-Admin View

### Task 4: Replace Members, Manage Members, and Pending render blocks

**Files:**
- Modify: `apps/frontend/src/pages/communities/[id].tsx:845–1166`

- [ ] **Step 1: Read lines 840–1170 in full**

Understand the exact JSX for all three blocks:
- Members tab (lines 845–911): card layout, member data shape
- Manage Members tab (lines 1106–1135): role dropdown, remove button, API calls
- Pending tab (lines 1138–1166): approve/reject buttons, API calls

Note the exact variable names, API function calls, and any state they read.

- [ ] **Step 2: Write the unified Members tab render block**

Replace the existing Members tab block (`{activeTab === 'members' && (...)}`). **Do not yet delete the Manage/Pending blocks** — leave them in place for now. You will remove them in Step 4.

> **SCAFFOLD:** The code block below is a template. The `PASTE existing JSX` comments are placeholders you MUST fill in using the code you read in Step 1. Do not write the block verbatim — complete each placeholder before applying the edit. Also cross-check the exact variable name holding the members array (used as `members` throughout this block and in the `pendingCount` from Task 3 Step 2 — confirm the name matches what the actual component uses).

The new unified block:

```tsx
{activeTab === 'members' && (
  <div>
    <h2 className="text-xl font-semibold text-gray-900 mb-4">Members</h2>

    {/* Non-admin: original card view */}
    {!isAdmin && (
      <div className="grid grid-cols-1 gap-4">
        {/* --- PASTE the non-admin member card JSX from lines 845–911 here --- */}
        {/* Copy exactly: name, email, invited-by, trust score badge, role badge, join date */}
      </div>
    )}

    {/* Admin: filter row + table/pending view */}
    {isAdmin && (
      <div>
        {/* Filter row */}
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => setMemberFilter('active')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${
              memberFilter === 'active'
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Active ({(members ?? []).filter((m: any) => m.status === 'active').length})
          </button>
          <button
            onClick={() => setMemberFilter('pending')}
            className={`relative px-3 py-1.5 rounded-md text-sm font-medium ${
              memberFilter === 'pending'
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Pending ({pendingCount})
            {pendingCount > 0 && memberFilter !== 'pending' && (
              <span className="absolute -top-1 -right-1 block h-2 w-2 rounded-full bg-red-500" />
            )}
          </button>
          {/* --- DECISION: During Step 1, check whether an invite member button exists in the current Members or Manage tab JSX.
               If YES: paste the button JSX inside a <div className="ml-auto"> wrapper.
               If NO: remove this entire comment and the wrapper div — do not leave an empty div. --- */}
        </div>

        {/* Active members table */}
        {memberFilter === 'active' && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(members ?? [])
                  .filter((m: any) => m.status === 'active')
                  .map((member: any) => {
                    const isSelf = member.user_id === currentUser?.id;
                    const isCreator = member.user_id === community?.creator_id;
                    const disabled = isSelf || isCreator;
                    return (
                      <tr key={member.user_id}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {member.name}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {member.email}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {new Date(member.joined_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {/* --- PASTE existing role dropdown JSX from Manage Members block here --- */}
                          {/* Keep API call (updateMemberRole or equivalent) identical */}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          {/* --- PASTE existing Remove button JSX from Manage Members block here --- */}
                          {/* Keep API call identical; disable when disabled === true */}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pending join requests */}
        {memberFilter === 'pending' && (
          <div className="space-y-3">
            {(members ?? [])
              .filter((m: any) => m.status === 'pending')
              .map((member: any) => (
                <div key={member.user_id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{member.name}</p>
                    <p className="text-sm text-gray-500">{member.email}</p>
                    {member.join_message && (
                      <p className="text-sm text-gray-600 mt-1 italic">"{member.join_message}"</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Requested {new Date(member.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    {/* --- PASTE existing Approve / Reject button JSX from Pending block here --- */}
                    {/* Keep API calls identical */}
                  </div>
                </div>
              ))}
            {pendingCount === 0 && (
              <p className="text-sm text-gray-500 text-center py-8">No pending join requests.</p>
            )}
          </div>
        )}
      </div>
    )}
  </div>
)}
```

> **Important:** Fill in the "PASTE existing JSX" placeholders from the actual code you read in Step 1. Do not invent new API calls. Copy the exact role dropdown, remove button, approve button, and reject button JSX from the old tab blocks.

- [ ] **Step 3: Run TypeScript check**

```bash
cd c:/Users/ravic/development/karmyq/apps/frontend
npx tsc --noEmit
```

Expected: No new errors.

- [ ] **Step 4: Delete the now-dead Manage Members and Pending render blocks**

Remove the old blocks:
- `{activeTab === 'manage' && (...)}` (lines ~1106–1135)
- `{activeTab === 'pending' && (...)}` (lines ~1138–1166)

- [ ] **Step 5: Run TypeScript check again**

```bash
cd c:/Users/ravic/development/karmyq/apps/frontend
npx tsc --noEmit
```

Expected: No errors (TypeScript will flag any uses of `'manage'` or `'pending'` as invalid tab values — fix any remaining references).

- [ ] **Step 6: Visual smoke test**

As a non-admin: Members tab shows card list with no filter row.
As an admin: Members tab shows filter row with Active/Pending buttons. Active shows table with role dropdown and Remove button. Pending shows join request rows with Approve/Reject.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/pages/communities/[id].tsx
git commit -m "refactor(admin): unify Members/Manage/Pending into single Members tab with Active/Pending filter"
```

---

## Chunk 3: Settings Tab

### Task 5: Replace Configuration + old Settings + Linked Communities render blocks

**Files:**
- Modify: `apps/frontend/src/pages/communities/[id].tsx:1011–1213` and `1462–1466`

- [ ] **Step 1: Read lines 1010–1215 and 1460–1468 in full**

Understand the exact JSX for:
- Config tab (lines 1011–1103): `CommunityConfigEditor`, questionnaire button, `TrustModelDiff`
- Old Settings tab (lines 1169–1213): 6 TTL input fields + karma decay toggle + save button
- Linked Communities tab (lines 1462–1466): `<CommunityLinks>` component

Note exact component names, props, state variables, and API call function names.

- [ ] **Step 2: Write the unified Settings tab render block**

Replace the existing `{activeTab === 'config' && (...)}` block with the new Settings block. Leave the old Settings and Linked Communities blocks in place for now. Note: `showAdvancedSettings` state was added in Chunk 1 (Task 2) — it is already in scope.

> **SCAFFOLD:** The code block below is a template. The `PASTE existing JSX` comments are placeholders you MUST fill in using the code you read in Step 1. Do not write the block verbatim — also cross-check the `community.settings?.karma_split` / `trust_path_hops` / `visibility_mode` / `join_approval` field names against the actual data shape from the Config tab JSX before using them.

```tsx
{activeTab === 'settings' && isAdmin && (
  <div className="space-y-8">

    {/* Section 1: Community Configuration */}
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Community Configuration</h2>

      {/* Summary card — key current values */}
      {community && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-600">Karma split:</span>{' '}
            <span className="text-gray-900">{community.settings?.karma_split ?? 'default'}</span>
          </div>
          <div>
            <span className="font-medium text-gray-600">Trust path hops:</span>{' '}
            <span className="text-gray-900">{community.settings?.trust_path_hops ?? 'default'}</span>
          </div>
          <div>
            <span className="font-medium text-gray-600">Visibility:</span>{' '}
            <span className="text-gray-900">{community.settings?.visibility_mode ?? 'default'}</span>
          </div>
          <div>
            <span className="font-medium text-gray-600">Join approval:</span>{' '}
            <span className="text-gray-900">{community.settings?.join_approval ? 'Required' : 'Open'}</span>
          </div>
        </div>
      )}

      {/* --- PASTE existing Config tab JSX here --- */}
      {/* Keep CommunityConfigEditor, questionnaire button, TrustModelDiff unchanged */}
    </div>

    <hr className="border-gray-200" />

    {/* Section 2: Linked Communities */}
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Linked Communities</h2>
      {/* --- PASTE existing <CommunityLinks> JSX from lines 1462–1466 here --- */}
    </div>

    <hr className="border-gray-200" />

    {/* Section 3: Advanced settings */}
    <div>
      <button
        onClick={() => setShowAdvancedSettings(v => !v)}
        className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <span>{showAdvancedSettings ? '▾' : '▸'}</span>
        <span>Advanced</span>
      </button>

      {showAdvancedSettings && (
        <div className="mt-4 space-y-4">
          {/* --- PASTE existing Settings tab JSX here --- */}
          {/* Keep all 6 TTL input fields, karma decay toggle, save button unchanged */}
        </div>
      )}
    </div>

  </div>
)}
```

> **Important:** Fill in the three "PASTE existing JSX" placeholders from the code you read in Step 1. Do not invent new state or API calls.

- [ ] **Step 3: Delete the now-dead render blocks**

Remove:
- The block opened with `{activeTab === 'config' && (` (original Configuration tab — now replaced by the new block from Step 2 which opens with `{activeTab === 'settings' && isAdmin && (`)
- The block opened with `{activeTab === 'settings' && (` at the line number you recorded in Step 1 (the original Settings/TTL block at ~1169–1213 — **not** the new block you just wrote; use the exact line number from your Step 1 read to identify it)
- `{activeTab === 'links' && (...)}` (Linked Communities block, lines ~1462–1466)

After deleting, verify exactly one `activeTab === 'settings'` block remains (the new unified one from Step 2):

```bash
grep -c "activeTab === 'settings'" "apps/frontend/src/pages/communities/[id].tsx"
```

Expected: `1`

- [ ] **Step 4: Run TypeScript check**

```bash
cd c:/Users/ravic/development/karmyq/apps/frontend
npx tsc --noEmit
```

Expected: No new errors. TypeScript will flag any remaining references to `'config'` or `'links'` as invalid tab values — fix them.

- [ ] **Step 5: Visual smoke test**

As an admin, navigate to Settings tab. Confirm:
1. Config summary card shows current community values
2. Edit configuration and Revisit trust model buttons work
3. Linked Communities section renders `CommunityLinks` component
4. "Advanced" toggle is collapsed by default
5. Expanding Advanced shows all 6 TTL fields + karma decay toggle
6. Save advanced settings button still works

As a non-admin, confirm the Settings tab is not visible in the tab bar at all (the tab nav bar only shows Settings when `isAdmin` is true).

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/pages/communities/[id].tsx
git commit -m "refactor(admin): unify Configuration/Settings/Linked into single Settings tab with Advanced toggle"
```

---

## Chunk 4: Insights Tab + Final Cleanup

### Task 6: Replace Statistics and Export render blocks with Insights tab

**Files:**
- Modify: `apps/frontend/src/pages/communities/[id].tsx:1216–1459`

- [ ] **Step 1: Read lines 1210–1465 in full**

Understand the exact JSX for:
- Statistics tab (lines 1216–1356): 4 stat cards, community trust score panel, network cohesion panel, Refresh button
- Export tab (lines 1437–1459): 3 export rows with JSON/CSV buttons

Note exact state variables, API call function names, and any conditional logic.

- [ ] **Step 2: Write the unified Insights tab render block**

Replace the existing `{activeTab === 'stats' && (...)}` block:

> **SCAFFOLD:** The code block below is a template. The `PASTE existing JSX` comments are placeholders you MUST fill in using the code you read in Step 1. Do not write the block verbatim — complete each placeholder before applying the edit. Also cross-check the exact state variable names used in the Statistics block (e.g., whatever holds the trust score, stat card values, network cohesion data, and the refresh handler function name) and the Export block (e.g., the export handler function name), and use those exact names in the filled-in JSX.

```tsx
{activeTab === 'insights' && isAdmin && (
  <div className="space-y-8">

    {/* Section 1: Community stats */}
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Community Insights</h2>
        {/* --- PASTE existing Refresh button JSX here --- */}
      </div>

      {/* --- PASTE existing stat cards JSX here (4 cards: Total exchanges, Active requests, Avg karma, This week) --- */}

      {/* --- PASTE existing community trust score panel here --- */}
      {/* score out of 100, progress bar, 3-part breakdown (Member Quality 40pts, Bonding 30pts, Bridging 30pts) */}

      {/* --- PASTE existing Network Cohesion panel here --- */}
      {/* reciprocity, density, clustering, avg path length */}
    </div>

    <hr className="border-gray-200" />

    {/* Section 2: Export data */}
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Export Data</h2>
      {/* --- PASTE existing Export tab JSX here (3 rows: Full community, Members list, Activity report) --- */}
    </div>

  </div>
)}
```

- [ ] **Step 3: Delete the now-dead render blocks**

Remove:
- `{activeTab === 'stats' && (...)}` (original Statistics block)
- `{activeTab === 'export' && (...)}` (original Export block)

- [ ] **Step 4: Run TypeScript check**

```bash
cd c:/Users/ravic/development/karmyq/apps/frontend
npx tsc --noEmit
```

Expected: No new errors.

- [ ] **Step 5: Visual smoke test**

As an admin, navigate to the Insights tab. Confirm:
1. 4 stat cards render (Total exchanges, Active requests, Avg karma, This week)
2. Community trust score panel renders with score, progress bar, and 3-part breakdown
3. Network Cohesion panel renders with reciprocity, density, clustering, avg path length
4. Refresh button triggers a data re-fetch
5. Export section shows 3 rows (Full community export, Members list, Activity report) each with JSON and CSV buttons

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/pages/communities/[id].tsx
git commit -m "refactor(admin): unify Statistics/Export into single Insights tab"
```

---

### Task 7: Final cleanup — remove dead state and verify

**Files:**
- Modify: `apps/frontend/src/pages/communities/[id].tsx`

- [ ] **Step 1: Search for any remaining references to removed tab names**

Use the Grep tool (not bash grep) to search for the pattern `'manage'|'pending'|'config'|'stats'|'export'|'links'` in `apps/frontend/src/pages/communities/[id].tsx`. Alternatively in bash:

```bash
cd c:/Users/ravic/development/karmyq
grep -n "activeTab === 'manage'\|activeTab === 'pending'\|activeTab === 'config'\|activeTab === 'stats'\|activeTab === 'export'\|activeTab === 'links'" "apps/frontend/src/pages/communities/[id].tsx"
```

Expected: 0 results (all removed tab names gone from the file).

- [ ] **Step 2: Remove any state variables that were used exclusively by removed tabs**

Search for state variable candidates that may now be dead (used only inside the deleted render blocks). Run each grep; for any that return results, check if the variable is still used elsewhere — if not, remove the `useState` declaration and all usages:

```bash
# Typical state that backed the removed tabs — adapt names to match actual code
grep -n "showConfigEditor\|showQuestionnaire\|trustQuestionnaire\|configDiff\|exportLoading\|statsLoading\|refreshing\|pendingMembers\|managedMembers" "apps/frontend/src/pages/communities/[id].tsx"
```

Also scan for any remaining `useState` that is only ever set to a value that can no longer be reached (its setter was inside a deleted block). Use the Grep tool to confirm each state variable is still referenced in the new code.

> **Important:** TypeScript does NOT warn on unused `useState` variables — `tsc --noEmit` in Step 3 will not catch dead state. You must actively verify each candidate by confirming it is referenced in the new render blocks.

- [ ] **Step 3: Run TypeScript check one final time**

```bash
cd c:/Users/ravic/development/karmyq/apps/frontend
npx tsc --noEmit
```

Expected: Clean pass.

- [ ] **Step 4: Run full test suite**

```bash
cd c:/Users/ravic/development/karmyq
npm test
npm run test:tdd
```

Expected: All unit + regression tests pass. TDD tests (including the new `admin-tab-redirect.test.ts`) pass.

- [ ] **Step 5: Full visual end-to-end verification**

Navigate to a community page and verify all 7 success criteria from the spec:

1. **Admin sees exactly 7 tabs**: Overview, Members, Norms, Requests, Insights, Settings, Providers
2. **All admin functionality accessible**: Config editor, TTL settings, karma decay, linked communities, stats, export, member management all reachable
3. **Non-admin Members tab**: Card-style list with no filter row, no role dropdown, no Remove button
4. **Pending badge**: Red dot on Members tab when there are pending join requests (admin-only)
5. **Advanced settings collapsed**: TTL fields and karma decay hidden until "Advanced" toggle clicked
6. **Old query params redirect**: Navigate to `?tab=manage` → auto-redirects to `?tab=members`; try `config`, `stats`, `export`, `pending`, `links` — all redirect correctly
7. **Network Cohesion panel in Insights**: reciprocity, density, clustering, avg path length visible in Insights tab
8. **Overview unchanged**: Config highlight panels (Karma Mechanics, Trust Mechanics, etc.) still visible to non-admins on Overview

- [ ] **Step 6: Update docs feedback loop**

```bash
cd c:/Users/ravic/development/karmyq
npm run feedback:check
```

If it flags CONTEXT.md updates needed, update `apps/frontend/CONTEXT.md` or `apps/frontend/.claude/README.md` to reflect the new 7-tab structure.

- [ ] **Step 7: Final commit**

```bash
git add apps/frontend/src/pages/communities/[id].tsx
git commit -m "refactor(admin): remove dead state from removed tabs, cleanup complete"
```

---

## Summary of All Commits

| # | Message | What it does |
|---|---------|-------------|
| 1 | `test(tdd): lock in admin tab redirect mapping logic` | Adds `tests/tdd/admin-tab-redirect.test.ts` |
| 2 | `refactor(admin): narrow activeTab union, add memberFilter + advancedSettings state, add tab redirect` | State + useEffect changes |
| 3 | `refactor(admin): replace 12-tab nav bar with 7 tabs + pending badge` | Tab bar replacement |
| 4 | `refactor(admin): unify Members/Manage/Pending into single Members tab with Active/Pending filter` | Members tab |
| 5 | `refactor(admin): unify Configuration/Settings/Linked into single Settings tab with Advanced toggle` | Settings tab |
| 6 | `refactor(admin): unify Statistics/Export into single Insights tab` | Insights tab |
| 7 | `refactor(admin): remove dead state from removed tabs, cleanup complete` | Cleanup |
