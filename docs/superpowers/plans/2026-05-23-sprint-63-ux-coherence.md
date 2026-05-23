# Sprint 63: UX Coherence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Three targeted UX improvements — unified community people tab, feed coherence after match acceptance, and amber visual language for provider context.

**Architecture:** All changes are frontend-only except a verification pass on the match acceptance backend path. No new endpoints, no schema changes.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Tailwind CSS.

---

## File Map

### Existing files to modify
| File | Change |
|------|--------|
| `apps/frontend/src/components/community/tabs/ActiveTab.tsx` | Remove sub-tabs + filter; unified pending/active/norms layout |
| `apps/frontend/src/components/BrowseModeControl.tsx` | Amber active-chip color when browseMode === 'provider' |
| `apps/frontend/src/components/BrowseFeed.tsx` | Post-offer confirmation with CommitmentsTab link |
| `apps/frontend/src/pages/dashboard.tsx` | On-duty badge; CommitmentsTab refetch on tab switch |
| `services/request-service/src/routes/matches.ts` | Read-only verification — confirm status='matched' set in all acceptance paths |
| `apps/landing/src/data/docs/guides/community-management.json` | Update member management section |
| `apps/landing/src/data/docs/guides/provider-mode.json` | Add provider visual language note |

### New files to create
| File | Responsibility |
|------|---------------|
| `apps/frontend/tests/tdd/sprint-63-ux-coherence.test.tsx` | TDD tests for ActiveTab unified view and BrowseFeed post-offer confirmation |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **ActiveTab norms in accordion** — use `useState(false)` open/closed toggle. No library. Simple `<button onClick={() => setNormsOpen(o => !o)}>` pattern.

2. **Pending section guard** — `isAdminOrMod && pendingCount > 0` only. Non-admins see clean single-section list. Never show pending section to non-admins.

3. **BrowseModeControl color** — active chip: `browseMode === 'provider' ? 'bg-amber-500 text-white border-amber-500' : 'bg-primary text-white border-primary'`. BrowseMode type lives here — don't move it.

4. **On-duty badge** — `isOnDuty` is `hasProviderProfile && isAvailable` in dashboard.tsx (already computed). Use directly; no new state.

5. **CommitmentsTab id is `'helping'`** — deep-link with `?tab=helping`. Do not rename the id.

6. **Feed coherence is mostly verification** — if matches.ts already sets `status = 'matched'` correctly (Task 2 will confirm), the main work is the post-offer UX link and CommitmentsTab refetch.

7. **git add CLAUDE.md on Windows** — file is tracked as lowercase `claude.md`. Always `git add claude.md`.

---

## Task 1: Feature branch

- [ ] **Create sprint branch**

```bash
git checkout -b feature/sprint-63-ux-coherence
```

- [ ] **Verify branch**

```bash
git status
```

---

## Task 2: Verify match acceptance sets request status (backend read-only)

**Files:**
- Read: `services/request-service/src/routes/matches.ts`

- [ ] **Find all acceptance code paths** — search for every place a match is accepted (both the regular acceptance endpoint and any dibs fast-path). Confirm each path runs:
  ```sql
  UPDATE requests.help_requests SET status = 'matched' WHERE id = $request_id
  ```

- [ ] **Check if dibs acceptance skips the status update** — the dibs path (line ~247) has a comment "Don't update request status here". Confirm this is the OFFER creation step (not acceptance) and that the subsequent acceptance step DOES update status.

- [ ] **Note any paths that skip the update** — if any path is found that accepts a match without setting `status = 'matched'`, add the missing UPDATE. Otherwise, no change to matches.ts.

- [ ] **Verification**

```bash
grep -n "status.*matched\|SET status" services/request-service/src/routes/matches.ts
```

---

## Task 3: ActiveTab — unified member list

**Files:**
- Modify: `apps/frontend/src/components/community/tabs/ActiveTab.tsx`

- [ ] **Remove `peopleSubTab` state and the Members | Norms button row** (lines ~33–145)

- [ ] **Remove `memberFilter` state and the Active | Pending filter buttons** (lines ~209–231)

- [ ] **Replace with unified layout:**

```tsx
return (
  <div>
    {/* Pending requests — admin/mod only, shown when there are pending members */}
    {isAdminOrMod && pendingCount > 0 && (
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          Pending Requests ({pendingCount})
        </h3>
        <div className="space-y-2">
          {(community.members ?? [])
            .filter((m: any) => m.status === 'pending')
            .map((member) => (
              <div key={member.user_id} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div>
                  <div className="font-medium text-sm">{member.user_name}</div>
                  <div className="text-xs text-text-muted">{member.user_email}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApproveMember(member.user_id)}
                    className="px-3 py-1 bg-primary text-white rounded text-sm hover:bg-primary-dark"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleRejectMember(member.user_id)}
                    className="px-3 py-1 bg-surface border border-border rounded text-sm text-text-muted hover:bg-surface-raised"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>
    )}

    {/* Active members */}
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-xl font-semibold">
        Members ({(community.members ?? []).filter((m: any) => m.status === 'active').length})
      </h3>
      {isAdminOrMod && (
        <button
          onClick={() => setShowInviteModal(true)}
          className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark text-sm"
        >
          Invite Member
        </button>
      )}
    </div>

    {/* Non-admin card view */}
    {!isAdminOrMod && ( /* existing card list for non-admins */ )}

    {/* Admin/Mod table */}
    {isAdminOrMod && (
      <div className="overflow-x-auto mb-6">
        {/* existing active members table — no changes to columns */}
      </div>
    )}

    {/* Norms — collapsible */}
    <div className="border-t border-border mt-6 pt-4">
      <button
        onClick={() => setNormsOpen(o => !o)}
        className="flex items-center justify-between w-full text-left text-sm font-medium text-text-muted hover:text-text py-1"
      >
        <span>Community Norms ({norms.length})</span>
        <span>{normsOpen ? '▲' : '▼'}</span>
      </button>
      {normsOpen && (
        <div className="mt-3">
          {/* existing norms list + add norm form */}
        </div>
      )}
    </div>

    {/* Invite modal — unchanged */}
  </div>
)
```

- [ ] **Add `normsOpen` state** — `const [normsOpen, setNormsOpen] = useState(false)`

- [ ] **Remove unused state** — `peopleSubTab`, `memberFilter` (and their setters)

- [ ] **Verify non-admin view is preserved** — the card-list view for non-admin members should be unchanged

- [ ] **Type check**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -30
```

---

## Task 4: BrowseModeControl — amber active chip for provider mode

**Files:**
- Modify: `apps/frontend/src/components/BrowseModeControl.tsx`

- [ ] **Update active chip class to be mode-aware:**

```tsx
className={`flex-1 py-1.5 text-sm font-medium rounded-lg border transition-colors capitalize ${
  browseMode === mode
    ? mode === 'provider'
      ? 'bg-amber-500 text-white border-amber-500'
      : 'bg-primary text-white border-primary'
    : 'bg-surface text-text-muted border-border hover:border-primary hover:text-text'
}`}
```

- [ ] **Verify the BrowseMode type export is unchanged** — `export type BrowseMode = 'community' | 'provider' | 'both'`

---

## Task 5: Dashboard — on-duty badge + CommitmentsTab refetch

**Files:**
- Modify: `apps/frontend/src/pages/dashboard.tsx`

- [ ] **Locate the `isOnDuty` computation** — `const isOnDuty = hasProviderProfile && isAvailable` (or similar). Confirm the exact expression.

- [ ] **Add on-duty badge** — find the dashboard header area (near the community selector or bell icons in the layout). Add:

```tsx
{isOnDuty && (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
    On duty
  </span>
)}
```

Place this where it's visible without cluttering the nav — near the provider bell or adjacent to the community selector. Check the Layout.tsx for where provider state flows.

- [ ] **CommitmentsTab refetch on switch** — find where `activeTab` changes trigger data fetches (the `useEffect([activeTab])` block). Add CommitmentsTab (id: `'helping'`) to that list:

```tsx
if (activeTab === 'helping') {
  refetchCommitments()   // or whatever the commitments fetch function is named
}
```

If CommitmentsTab manages its own fetching internally (likely), instead call a force-refetch via a key prop: `<CommitmentsTab key={tabSwitchCount} ... />` where `tabSwitchCount` increments each time `activeTab === 'helping'`.

- [ ] **Type check**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -30
```

---

## Task 6: BrowseFeed — post-offer confirmation

**Files:**
- Modify: `apps/frontend/src/components/BrowseFeed.tsx`

- [ ] **Add `lastOffered` state** — `const [lastOffered, setLastOffered] = useState<string | null>(null)`

- [ ] **Update `handleOffer` to set `lastOffered`** — after the successful match creation and `setRequests` filter, also set `setLastOffered(requestId)`. Clear it after 6 seconds: `setTimeout(() => setLastOffered(null), 6000)`.

- [ ] **Add inline confirmation banner** — render this above the feed list when `lastOffered` is set:

```tsx
{lastOffered && (
  <div className="flex items-center justify-between gap-2 text-sm bg-primary-light text-primary border border-primary/20 rounded-lg px-3 py-2 mb-3">
    <span>Offer sent!</span>
    <a
      href="/?tab=helping"
      className="font-medium underline underline-offset-2 hover:no-underline"
    >
      Track in Active tab →
    </a>
  </div>
)}
```

- [ ] **Type check**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -30
```

---

## Task 7: TDD tests

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-63-ux-coherence.test.tsx`

- [ ] **ActiveTab: pending section only shown to admins with pending members**

```tsx
it('shows pending section only when isAdminOrMod and pendingCount > 0', () => {
  // render ActiveTab with isAdminOrMod=true, 2 pending members
  // expect pending section to be visible
  // render with isAdminOrMod=false
  // expect no pending section
})
```

- [ ] **ActiveTab: norms hidden by default, revealed on accordion click**

```tsx
it('norms accordion is closed by default and opens on click', () => {
  // render ActiveTab
  // expect norm content to not be visible
  // click the "Community Norms" toggle
  // expect norm content to be visible
})
```

- [ ] **BrowseFeed: post-offer confirmation appears after successful offer**

```tsx
it('shows offer confirmation with CommitmentsTab link after successful match creation', async () => {
  // mock requestService.createMatch to resolve
  // render BrowseFeed with one open request
  // click "Offer Help"
  // expect confirmation message with href including "tab=helping"
})
```

- [ ] **Run TDD tests**

```bash
cd apps/frontend && npx jest tests/tdd/sprint-63-ux-coherence --no-coverage 2>&1 | tail -20
```

---

## Task 8: Landing page docs

**Files:**
- Modify: `apps/landing/src/data/docs/guides/community-management.json`
- Modify: `apps/landing/src/data/docs/guides/provider-mode.json`

- [ ] **community-management.json** — find the "Managing Members" or equivalent section in the content field. Update to reflect:
  - Pending member requests appear at the top of the People tab automatically
  - No sub-tab navigation needed — approve/reject is inline
  - Community norms are accessible via the collapsible section at the bottom

- [ ] **provider-mode.json** — add a note to the content field:
  - When on duty, an amber "On duty" badge appears in the dashboard
  - The Provider chip in the browse control uses amber to signal active provider context
  - Provider-matched request cards have an amber left border

- [ ] **Verify JSON is valid**

```bash
node -e "require('./apps/landing/src/data/docs/guides/community-management.json'); console.log('valid')"
node -e "require('./apps/landing/src/data/docs/guides/provider-mode.json'); console.log('valid')"
```

---

## Task 9: CONTEXT.md + feedback:check

**Files:**
- Modify: `services/request-service/CONTEXT.md` (only if Task 2 found a bug and changed matches.ts)
- Run: `npm run feedback:check`

- [ ] **If matches.ts was changed** — update `services/request-service/CONTEXT.md` "Recent Fixes" section with the match acceptance status fix

- [ ] **If no changes to matches.ts** — skip CONTEXT.md update

- [ ] **Run feedback check**

```bash
npm run feedback:check
```

---

## Task 10: Final verification

- [ ] **Unit + regression tests**

```bash
npm test 2>&1 | tail -20
```

- [ ] **TDD tests**

```bash
npm run test:tdd 2>&1 | tail -20
```

- [ ] **Full type check**

```bash
cd apps/frontend && npx tsc --noEmit
```

- [ ] **Manual smoke test** (if dev server available):
  - Open community people tab as admin — verify no sub-tabs, pending members at top
  - Toggle provider mode on dashboard — verify amber "On duty" badge appears
  - Switch browse control to Provider chip — verify amber chip color
  - Make an offer on a request — verify confirmation banner with link to Active tab

---

## Task 11: Merge + Deploy

- [ ] **Run pre-merge checklist**

```bash
/pre-commit-check
```

- [ ] **Merge and deploy using `/deploy` skill**

```
/deploy
```

Monitor GitHub Actions. SSH to karmyq.com only if a migration script needs to run (none expected this sprint).
