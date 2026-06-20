# App Shell Clarity & Commitment Truth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** Finish the app shell clarity pass and make Home/Helping commitment surfaces tell one
consistent truth.

**Architecture:** Frontend chrome gets a dedicated wide container while feed/prose content keeps the
42rem reading measure. Pending dibs actions use the existing server-ranked DecisionBand as the
canonical surface, and offered-awaiting state gets a request-service read endpoint shared by Home and
Helping.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

## Global Constraints

- Version moves from `11.14.1` to `11.15.0`.
- Branch name: `feature/sprint-107-app-shell-clarity`.
- Do not widen `--measure`; add a chrome-specific width token/container.
- Keep Dashboard tabs as `Browse`, `Helping`, `Asks`.
- Keep DecisionBand in Helping, not Browse.
- BUG-022/023 may exist only on `docs/close-sprint-106`; copy them into docs if PR #106 is not merged.
- Use PowerShell syntax on Windows.
- Run `/simplify` after implementation tasks and final `/simplify`, `/code-review`, `/security-review`
  before merge.
- Human browser validation is a deploy gate.

---

## File Map

### New files to create

| File | Responsibility |
|------|----------------|
| `services/request-service/tests/tdd/sprint-107-offered-awaiting-truth.test.ts` | Locks the canonical offered-awaiting predicate and new endpoint. |
| `apps/frontend/tests/tdd/sprint-107-app-shell-clarity.test.tsx` | Locks chrome container, responsive overflow, and menu reachability. |
| `apps/frontend/tests/tdd/sprint-107-dibs-single-surface.test.tsx` | Proves pending dibs render once in Helping via DecisionBand. |
| `apps/frontend/tests/tdd/sprint-107-offered-awaiting-helping.test.tsx` | Proves Home's offered-awaiting rows are findable in Helping. |

### Existing files to modify

| File | Change |
|------|--------|
| `package.json` | Bump version to `11.15.0`. |
| `docs/BUGS.md` | Add BUG-022/023 from `docs/close-sprint-106` if absent; mark planned/fixed through the sprint. |
| `services/request-service/src/routes/requests.ts` | Extract canonical offered-awaiting helper and add `GET /requests/offered-awaiting` before `/:id`. |
| `services/request-service/CONTEXT.md` | Document the new endpoint and recent fix. |
| `services/registry.json` | Add `GET /requests/offered-awaiting` to request-service provides. |
| `apps/frontend/src/styles/globals.css` | Add chrome measure token. |
| `apps/frontend/src/styles/karmyq-shell.css` | Add `.kq-chrome-page`; keep `.kq-page` as content measure. |
| `apps/frontend/src/components/Layout.tsx` | Use chrome container and responsive overflow menu. |
| `apps/frontend/src/pages/dashboard.tsx` | Tune shell rhythm and keep `/dashboard?tab=helping`. |
| `apps/frontend/src/components/TabBar.tsx` | Adjust alignment only if needed after shell changes. |
| `apps/frontend/src/components/CommitmentsTab.tsx` | Remove duplicate DibsCard action list; render offered-awaiting section. |
| `apps/frontend/src/components/Feed/OfferedAwaitingPanel.tsx` | Keep Home preview copy/link aligned with Helping section. |
| `apps/frontend/src/lib/api.ts` | Add `requestService.getOfferedAwaiting()`. |
| `apps/frontend/CONTEXT.md` | Document shell rule and commitment-truth fixes. |
| `apps/landing/src/data/docs/nav.json` and guide/service JSON files | Update generated docs if docs pipeline requires it. |

---

## Critical Implementation Notes

1. **Do not widen `--measure`.** The 42rem measure is intentional for feed cards and prose. Add a
   chrome-specific container for topbar/app-shell width.
2. **Responsive overflow is a rule, not a disappearance.** Communities, Service Providers or Become a
   provider, Profile, provider management, duty state, notifications, and logout must remain reachable
   on every viewport.
3. **BUG-022 is a duplicate-surface bug.** Pending dibs should not render both in DecisionBand and in
   a separate DibsCard list. Choose one canonical action surface; this sprint chooses DecisionBand.
4. **BUG-023 is a truth mismatch, not just copy.** The Home offered-awaiting count/preview and the
   Helping list must share the same backend predicate.
5. **If Home says "View all in Helping", Helping must show those asks.** Do not leave the user to infer
   that "Awaiting Acceptance" means the Home preview.
6. **Keep DecisionBand in Helping.** Sprint 106 deliberately moved decisions out of Browse; do not
   reintroduce commitment actions into Browse.
7. **Use semantic and accessible controls.** Icon/menu buttons need labels, focus states, and keyboard
   behavior. Status must not be color-only.
8. **Use the global `next/router` Jest mock.** Do not add one-off router mocks for widely rendered
   shell components unless a test needs custom query behavior.
9. **BUG-022/023 evidence may live only on `docs/close-sprint-106`.** Do not assume PR #106 is merged;
   copy the exact bug text into Sprint 107 docs if needed.
10. **Human browser validation is required.** Validate desktop, tablet, and 320-375px mobile chrome,
    plus Home -> Helping flows for pending dibs and offered-awaiting rows.
11. **Decision-derived dibs counts must use freshly mapped rows.** `CommitmentsTab.loadDecisions()`
    is fire-and-forget with internal state updates; derive `onDibsLoaded` from the local mapped
    decision array inside the `.then()`, not from stale React state.
12. **Dibs dedupe tests must use the same dibs in both mocked sources.** The BUG-022 regression only
    proves duplicate-surface removal when `getCuratedRequests()` and `getPendingDibsForProvider()`
    return the same pending dibs/title.

---

## Task 1: Branch, Evidence, and Bug Log Sync

**Files:**
- Modify: `docs/BUGS.md`
- Modify: `package.json`

- [ ] Create the sprint branch from fresh `origin/master`.

```powershell
git fetch origin
git checkout master
git pull --ff-only origin master
git checkout -b feature/sprint-107-app-shell-clarity
```

- [ ] Confirm BUG-022/BUG-023 source text from the docs close branch.

```powershell
git show docs/close-sprint-106:docs/BUGS.md | Select-String -Pattern "BUG-022|BUG-023" -Context 0,6
```

Expected: BUG-022 describes accepted dibs showing twice; BUG-023 describes Home offered-awaiting asks
not findable in Helping.

- [ ] If `docs/BUGS.md` on the sprint branch does not include BUG-022/023, append both entries exactly
from `docs/close-sprint-106`, with status `planned (Sprint 107)`.

- [ ] Bump `package.json` version from `11.14.1` to `11.15.0`.

- [ ] Run a quick status check.

```powershell
git status --short
```

Expected: only the sprint planning/state files touched so far.

---

## Task 2: TDD for App Shell Width and Overflow

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-107-app-shell-clarity.test.tsx`
- Read: `apps/frontend/src/components/Layout.tsx`
- Read: `apps/frontend/src/styles/karmyq-shell.css`

- [ ] Write tests that assert the topbar uses a chrome container and that the content measure remains
owned by `.kq-page`.

Key assertions:

```ts
expect(layoutSource).toMatch(/className="kq-chrome-page py-4"/)
expect(shellCss).toMatch(/\.kq-chrome-page/)
expect(shellCss).toMatch(/max-width:\s*var\(--measure-chrome\)/)
expect(shellCss).toMatch(/\.kq-page\s*\{[\s\S]*max-width:\s*var\(--measure\)/)
```

- [ ] Write render tests for menu reachability.

Required assertions:

```ts
expect(screen.getByRole('link', { name: 'Communities' })).toBeInTheDocument()
expect(screen.getAllByRole('link', { name: /Service Providers|Become a provider/ }).length).toBeGreaterThan(0)
expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument()
expect(screen.getByRole('button', { name: /off duty|on duty/i })).toBeInTheDocument()
```

- [ ] Run the new test and verify it fails before implementation.

```powershell
npx jest apps/frontend/tests/tdd/sprint-107-app-shell-clarity.test.tsx --runInBand
```

Expected: FAIL because `.kq-chrome-page` and the new overflow behavior do not exist yet.

---

## Task 3: Implement App Shell Width and Responsive Overflow

**Files:**
- Modify: `apps/frontend/src/styles/globals.css`
- Modify: `apps/frontend/src/styles/karmyq-shell.css`
- Modify: `apps/frontend/src/components/Layout.tsx`
- Modify: `apps/frontend/src/pages/dashboard.tsx`
- Modify: `apps/frontend/src/components/TabBar.tsx` only if visual alignment requires it

- [ ] Add a chrome measure token in `:root`.

```css
--measure-chrome: 72rem;               /* app chrome width; keep --measure for content */
```

- [ ] Add `.kq-chrome-page` in `karmyq-shell.css`.

```css
.kq-chrome-page {
  max-width: var(--measure-chrome);
  @apply mx-auto px-4;
}
```

- [ ] Change the topbar inner container from `kq-page` to `kq-chrome-page`.

- [ ] Refactor `HamburgerMenu` into a reusable overflow/menu component that can appear below `xl`,
not only below `md`. The menu must include:

```text
Communities
Service Providers or Become a provider
Manage my profile (provider only, when provider id exists)
Profile
Logout
```

- [ ] Set desktop top-level nav to a width where the labels fit, for example `hidden xl:flex`, while
showing the overflow menu below `xl`.

- [ ] Keep notification bell, duty toggle, and avatar/profile visible in the action cluster.

- [ ] Tune Dashboard shell spacing so the community selector, tabs, and Browse heading do not read as
three unrelated headers. Keep content in `kq-page`; use `kq-chrome-page` only for chrome if needed.

- [ ] Run the shell test.

```powershell
npx jest apps/frontend/tests/tdd/sprint-107-app-shell-clarity.test.tsx --runInBand
```

Expected: PASS.

- [ ] Run `/simplify` on this task's diff and fold in real findings.

---

## Task 4: TDD for BUG-022 Dibs Single Surface

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-107-dibs-single-surface.test.tsx`
- Read: `apps/frontend/src/components/CommitmentsTab.tsx`
- Read: `apps/frontend/src/components/Feed/DecisionBand.tsx`

- [ ] Write a test that renders `CommitmentsTab` with one pending dibs decision from
`requestService.getCuratedRequests({ view:'home' })` and one pending dibs response from
`dibsService.getPendingDibsForProvider()`.

- [ ] Ensure both mocks describe the same dibs row. Use the same id/title in both sources so the test
actually proves duplicate rendering is gone.

```ts
const sameDibsTitle = 'Need a Saturday repair visit'
```

- [ ] Assert the dibs title appears once and only one Accept button is associated with it.

Example expectation:

```ts
expect(screen.getAllByText('Need a Saturday repair visit')).toHaveLength(1)
expect(screen.getAllByRole('button', { name: 'Accept' })).toHaveLength(1)
```

- [ ] Assert accepting the DecisionBand row calls `dibsService.acceptDibs('dibs-1')`, removes the row
after `onResolved`, and does not leave a second stale card.

- [ ] Run the test and verify it fails before implementation.

```powershell
npx jest apps/frontend/tests/tdd/sprint-107-dibs-single-surface.test.tsx --runInBand
```

Expected: FAIL because `CommitmentsTab` still renders the separate DibsCard list.

---

## Task 5: Implement BUG-022 Canonical Dibs Surface

**Files:**
- Modify: `apps/frontend/src/components/CommitmentsTab.tsx`
- Optionally leave unchanged: `apps/frontend/src/components/commitments/DibsCard.tsx`

- [ ] Remove `pendingDibs` rendering from `CommitmentsTab`.

- [ ] Remove `dibsService.getPendingDibsForProvider()` from `loadCommitments()`.

- [ ] Remove `handleAcceptDibs()` and `handleDeclineDibs()` from `CommitmentsTab`; DecisionBand
already routes `accept_dibs` and `decline_dibs`.

- [ ] Drive `onDibsLoaded` from DecisionBand data:

```ts
const nextDecisions = items
  .filter((i): i is Extract<UnifiedFeedItem, { kind: 'decision' }> => i.kind === 'decision')
  .map((i) => i.data)
setDecisions(nextDecisions)
const dibsDecisionCount = nextDecisions.filter((d) => d.subject_kind === 'dibs').length
onDibsLoaded?.(dibsDecisionCount)
```

Call this inside the `loadDecisions()` `.then()` block from the freshly mapped rows. Do not derive
the badge count from the stale `decisions` state variable.

- [ ] Preserve the current `limit: 50` decision fetch unless implementation finds real evidence that
a higher limit is needed. This changes the badge source from `getPendingDibsForProvider().length` to
curated dibs-decision count; both predicates are equivalent for pending, non-expired provider dibs,
with `limit: 50` as the only theoretical divergence.

- [ ] After `handleDecisionResolved`, reload decisions and commitments as the file already does.

- [ ] Run the dibs single-surface test.

```powershell
npx jest apps/frontend/tests/tdd/sprint-107-dibs-single-surface.test.tsx --runInBand
```

Expected: PASS.

- [ ] Run existing related tests.

```powershell
npx jest apps/frontend/tests/tdd/sprint-106-band-placement.test.tsx apps/frontend/tests/tdd/sprint-92-completion-rating.test.tsx --runInBand
```

Expected: PASS.

- [ ] Run `/simplify` on this task's diff and fold in real findings.

---

## Task 6: TDD for BUG-023 Offered-Awaiting Backend Truth

**Files:**
- Create: `services/request-service/tests/tdd/sprint-107-offered-awaiting-truth.test.ts`
- Modify later: `services/request-service/src/routes/requests.ts`

- [ ] Write an integration or focused route test that seeds:
  - an authenticated helper;
  - two open unexpired asks where helper has `matches.status='proposed'`;
  - one duplicate proposed match for one ask;
  - one matched/completed or closed request that must not count.

- [ ] Assert `GET /requests/offered-awaiting` returns:

```ts
expect(res.body.data.count).toBe(2)
expect(res.body.data.items.map((i: any) => i.request_id).sort()).toEqual([askA, askB].sort())
expect(new Set(res.body.data.items.map((i: any) => i.request_id)).size).toBe(res.body.data.items.length)
```

- [ ] Assert `GET /requests/curated?view=home` returns the same `offeredAwaiting` count and preview
request ids.

- [ ] Run the test and verify it fails before implementation.

```powershell
npm run test:tdd -- --runInBand sprint-107-offered-awaiting-truth
```

Expected: FAIL because `/requests/offered-awaiting` does not exist.

---

## Task 7: Implement BUG-023 Offered-Awaiting Endpoint and Frontend Section

**Files:**
- Modify: `services/request-service/src/routes/requests.ts`
- Modify: `apps/frontend/src/lib/api.ts`
- Modify: `apps/frontend/src/components/CommitmentsTab.tsx`
- Modify: `apps/frontend/src/components/Feed/OfferedAwaitingPanel.tsx`

- [ ] In `requests.ts`, keep `fetchOfferedAwaiting()` as the canonical helper used by both Home and
the new endpoint.

- [ ] Add `GET /requests/offered-awaiting` before `/requests/:id`.

Endpoint behavior:

```ts
const userId = (req as any).user?.userId
if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' })
const offeredAwaiting = await fetchOfferedAwaiting(userId, 50)
sendSuccess(res, offeredAwaiting, HTTP_STATUS.OK, { requestId: (req as any).id })
```

- [ ] Add `requestService.getOfferedAwaiting()` to `apps/frontend/src/lib/api.ts`.

- [ ] In `CommitmentsTab`, load offered-awaiting rows on mount and after relevant actions.

- [ ] Render a Helping section above or within "I'm Helping" with a clear title such as
`Offers awaiting requester`.

Section behavior:
  - Shows only when count > 0.
  - Lists the same titles Home previews.
  - Links each row to `/requests/{request_id}`.
  - If `count > items.length`, renders quiet text such as `Showing the most recent {items.length} of {count}.`

- [ ] Keep `OfferedAwaitingPanel` copy aligned with the Helping section:

```text
Waiting for the requester to respond.
View all in Helping
```

- [ ] Run backend and frontend focused tests.

```powershell
npm run test:tdd -- --runInBand sprint-107-offered-awaiting-truth
npx jest apps/frontend/tests/tdd/sprint-107-offered-awaiting-helping.test.tsx --runInBand
```

Expected: PASS.

- [ ] Run `/simplify` on this task's diff and fold in real findings.

---

## Task 8: TDD and Polish for Home-to-Helping Navigation

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-107-offered-awaiting-helping.test.tsx`
- Modify: `apps/frontend/src/pages/dashboard.tsx`
- Modify: `apps/frontend/src/components/Feed/OfferedAwaitingPanel.tsx`

- [ ] Write a Dashboard test with router query `{ tab: 'helping' }` proving the page opens on Helping.

Expectation:

```ts
expect(screen.getByRole('tab', { name: /Helping/i })).toHaveAttribute('aria-selected', 'true')
```

- [ ] Write a CommitmentsTab test proving an offered-awaiting item from `getOfferedAwaiting()` renders
in Helping with the same title Home uses.

- [ ] Verify Home's `View all in Helping` link remains `/dashboard?tab=helping`.

- [ ] Run the focused tests.

```powershell
npx jest apps/frontend/tests/tdd/sprint-107-offered-awaiting-helping.test.tsx --runInBand
```

Expected: PASS.

---

## Task 9: Docs, Registry, and Landing Docs

**Files:**
- Modify: `docs/BUGS.md`
- Modify: `apps/frontend/CONTEXT.md`
- Modify: `services/request-service/CONTEXT.md`
- Modify: `services/registry.json`
- Modify: `apps/landing/src/data/docs/services/request-service.json` if generated docs are committed
- Modify: relevant user guide JSON/source under `apps/landing/src/data/docs/guides/`
- Modify: `apps/landing/src/data/docs/nav.json` if a guide is added

- [ ] Mark BUG-022 and BUG-023 as fixed in `docs/BUGS.md`, with one paragraph each explaining the
source-layer fix and test names.

- [ ] Update `apps/frontend/CONTEXT.md` with:
  - `.kq-chrome-page` vs `.kq-page`;
  - responsive overflow behavior;
  - DecisionBand as canonical pending-dibs surface;
  - offered-awaiting Home/Helping truth rule.

- [ ] Update `services/request-service/CONTEXT.md` and `services/registry.json` for
`GET /requests/offered-awaiting`.

- [ ] Update landing docs/user guide content for Dashboard Home and Helping.

- [ ] Grep-verify `nav.json` after edits.

```powershell
rg -n "offered-awaiting|offered to help|Helping|requests/offered-awaiting" apps/landing/src/data/docs docs/BUGS.md apps/frontend/CONTEXT.md services/request-service/CONTEXT.md services/registry.json
```

Expected: all changed docs are discoverable.

- [ ] Run feedback loop check.

```powershell
npm run feedback:check
```

Expected: PASS or documented known false positive.

---

## Task 10: SDLC Quality Gates

**Files:**
- Review the whole branch diff.

- [ ] Run focused frontend tests.

```powershell
npx jest apps/frontend/tests/tdd/sprint-107-app-shell-clarity.test.tsx apps/frontend/tests/tdd/sprint-107-dibs-single-surface.test.tsx apps/frontend/tests/tdd/sprint-107-offered-awaiting-helping.test.tsx --runInBand
```

Expected: PASS.

- [ ] Run focused request-service tests.

```powershell
npm run test:tdd -- --runInBand sprint-107-offered-awaiting-truth
```

Expected: PASS.

- [ ] Run TypeScript checks.

```powershell
npx tsc --noEmit
```

Expected: PASS.

- [ ] Run unit + regression tests.

```powershell
npm test
```

Expected: PASS for unit + regression. If a known pre-existing TDD failure appears, record exact test
name and master-baseline evidence.

- [ ] Run `/simplify` on the whole diff.

Verification: every real simplification finding is either fixed or documented with a reason.

- [ ] Run `/code-review` on the whole diff.

Verification: correctness findings resolved before merge.

- [ ] Run `/security-review` on the whole diff.

Verification: real findings resolved; any false positive documented in the PR "Security dismissals"
section.

---

## Task 11: Final Verification and Human Browser Validation

**Files:**
- No code edits unless validation finds a defect.

- [ ] Run final checks.

```powershell
npx tsc --noEmit
npm test
npm run test:tdd
npm run feedback:check
```

Expected: PASS, except any pre-existing non-blocking TDD failure must be documented with master
baseline.

- [ ] Start the frontend locally for browser validation.

```powershell
npm run dev
```

- [ ] Human browser validation checklist:
  - Desktop wide: topbar uses a wider chrome container; content/feed remains 42rem.
  - Tablet/narrow desktop: nav moves to overflow before crowding.
  - Mobile 320-375px: wordmark, notification, duty dot, avatar/menu do not overlap.
  - Menu includes Communities, Service Providers or Become a provider, Profile, provider management
    when relevant, and Logout.
  - Pending dibs appears once in Helping; accepting it removes it without a stale second error.
  - Home "You've offered to help..." rows are visible in Helping through `/dashboard?tab=helping`.

- [ ] Stop any dev server session started for validation.

---

## Task 12: Merge and Deploy

**Files:**
- `.github/pull_request_template.md` for PR body.

- [ ] Open a PR to `master` using `.github/pull_request_template.md` as the body template.

- [ ] Include in PR:
  - summary of shell changes;
  - BUG-022/023 fixes;
  - tests run;
  - docs/registry updates;
  - security dismissals if any;
  - human validation notes.

- [ ] Do not self-merge. Wait for Admin approval/merge authority.

- [ ] After Admin merge, deploy through CI/CD first: push to `master` triggers GitHub Actions.

- [ ] Monitor GitHub Actions deploy and verify demo health. Use the `/deploy` skill only if manual
intervention is needed.

---

## Plan Self-Review

- Spec coverage: shell width, responsive overflow, BUG-022, BUG-023, docs, registry, and human
  validation each map to tasks above.
- Placeholder scan: clean; each task has exact files, commands, and expected outcomes.
- Type consistency: `OfferedAwaitingItem`, `DecisionData.subject_kind === 'dibs'`, and
  `requestService.getOfferedAwaiting()` are named consistently across backend, frontend, and tests.
