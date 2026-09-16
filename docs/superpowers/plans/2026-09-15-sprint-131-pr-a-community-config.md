# Sprint 131 PR A — Expected Missing Community Config (BUG-045) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** A community with no configuration row loads its page without the application logging
`Failed to load configuration`, while every unexpected config failure keeps logging.

**Architecture:** One caller-side change. `GET /communities/:id/config` answers `404` when
`communities.community_configs` holds no row for the community; that is the server contract and it
does not change. `useCommunityData.fetchConfig` currently logs every rejection, so a config-less
community logs on every page load. The fix is a narrow `err.response.status === 404` branch that
sets `config` to `null` and returns, leaving 500s, network errors and malformed responses on the
existing logging path.

**Tech Stack:** Next.js 15 (Pages Router), React 19 hooks, TypeScript, Jest + `next/jest` with
jsdom, `@testing-library/react` (`renderHook`, `act`, `waitFor`).

**Spec:** [`docs/superpowers/specs/2026-09-15-sprint-131-maintenance-design.md`](../specs/2026-09-15-sprint-131-maintenance-design.md) → *PR A — expected missing config (BUG-045)*

**Sprint plan:** [`docs/superpowers/plans/2026-09-15-sprint-131-maintenance.md`](2026-09-15-sprint-131-maintenance.md) → Tasks 2–4

---

## Global Constraints

Copied from the spec's Critical Implementation Notes; every task below inherits these.

- **Branch:** `agent/codex/sprint-131-maintenance`, already cut from `origin/master` at
  `9fae79f461a909a7337859825f57c678a990d1bc`. It already carries commit `b47c0fe6` (Sprint 131
  planning + the Sprint 130 archive). Do not re-cut it and do not commit on
  `feature/sprint-130-security`.
- **Acceptance boundary:** no application-generated `Failed to load configuration` log for an
  HTTP 404, with `config === null`. The HTTP response stays 404, so the browser's own failed-request
  entry in the Network/Console panel may remain. **Do not claim "zero console errors."**
- **Do not edit** `apps/frontend/src/lib/api.ts`, and do not change the config endpoint's 404
  contract. Keep non-404 failures observable.
- **Do not broaden suppression** to other callers on the basis of route names or status alone.
  Task 1 Step 7 records the sibling audit; its verified answer is "no sibling changes."
- **Version:** derive from `origin/master`'s `package.json` at merge time. No number is reserved
  here. (At time of writing master is `11.55.0`.)
- **Merge is not yours.** Open the PR and stop. The maintainer authorizes each merge, and the
  preceding deploy must have finished its health verification first.
- **Windows host:** use Node for JSON/HTTP probes, never `curl` or `jq`. Capture exit codes
  separately — `| tail` masks them.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `apps/frontend/tests/tdd/sprint-131-community-config-empty-state.test.tsx` | The BUG-045 behavior gate, written red first | Create, then move |
| `apps/frontend/tests/regression/sprint-131-community-config-empty-state.test.tsx` | Same file once green; blocking tier | Destination of the move |
| `apps/frontend/src/hooks/useCommunityData.ts` | `fetchConfig`'s expected-absence branch (lines 111–119) | Modify |
| `docs/BUGS.md` | BUG-045 close-out with the exact acceptance boundary (line 1011) | Modify |
| `apps/frontend/CONTEXT.md` | New dated section recording the caller-side contract | Modify |
| `package.json` | Version bump, derived at merge time | Modify (Task 3) |
| `.claude/handoff/CURRENT_HANDOFF.md` | PR state, evidence, next task | Modify (Task 3) |

Nothing else changes. No new component, no API change, no schema change, no ADR.

---

## Verified Facts (read out of the files; do not re-derive)

These were checked on 2026-09-15 against the working tree. Cite them rather than guessing.

- **The 404 is real and intentional.** `services/community-service/src/routes/config.ts:69` returns
  `res.status(404).json({ success: false, message: 'Community configuration not found' })` when
  `configResult.rowCount === 0`.
- **The axios error survives the interceptor.** `apps/frontend/src/lib/api.ts:166` ends
  `errorInterceptor` with `return Promise.reject(error)`, so `err.response.status` is readable in
  the hook. (The interceptor only rewrites `error.response.data.error` and handles 401 refresh.)
- **The hook logs unconditionally today.** `apps/frontend/src/hooks/useCommunityData.ts:111-119`.
- **Success shape is `response.data.config`.** The response interceptor already unwraps the
  `{ success, data }` envelope, so `response.data` *is* the envelope's `data` and `.config` is the
  field inside it. Mock that exact shape — do not add a second `.data`.
- **`fetchConfig` runs on mount.** The `useEffect` at line 76 calls `fetchCommunity`, `fetchNorms`,
  `fetchConfig` and `fetchSettings` whenever `communityId` is set. Your mock must satisfy all four
  or an unmocked call rejects and pollutes the `console.error` assertions.
- **Sibling audit — already resolved, no changes needed:**
  - `fetchNorms` → `GET /:communityId/norms` (`services/community-service/src/routes/norms.ts:8`)
    has **no 404 path at all**: success at line 40, 500 at line 47. An empty norms list is a 200.
    A 404 there is genuinely unexpected, so it must keep logging.
  - `fetchStats` → `GET /:communityId/stats` (`services/community-service/src/routes/stats.ts:10`)
    404s only with `'Community not found'` (line 177) — the community itself is missing, which is
    exceptional on a community page. It is also **not** eager-loaded on mount (see the S99-001
    comment at `useCommunityData.ts:82`); the Stewardship tab fetches it behind an admin gate. Keep
    logging.
- **The frontend Jest config resets nothing.** `apps/frontend/jest.config.js` sets no `clearMocks`
  / `resetMocks` / `restoreMocks`, unlike the root config. Call `jest.clearAllMocks()` in
  `beforeEach` yourself or call counts accumulate across tests.
- **The promoter cannot see this file.** `scripts/promote-tdd-tests.js:33` matches `.test.ts` only,
  so a `.test.tsx` file is invisible to it — the move in Task 1 must be done by hand. It *can*
  still sweep unrelated `.test.ts` files repo-wide when `npm test` fires `posttest`
  (`package.json:17`); inspect the tree after any full run.

---

## Task 1: Expected-absence handling in `fetchConfig`

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-131-community-config-empty-state.test.tsx`
- Modify: `apps/frontend/src/hooks/useCommunityData.ts:111-119`
- Move to: `apps/frontend/tests/regression/sprint-131-community-config-empty-state.test.tsx`

**Interfaces:**
- Consumes: `useCommunityData(communityId: string | undefined)` from
  `apps/frontend/src/hooks/useCommunityData.ts`; the returned object's `config: CommunityConfig | null`
  and `refetchConfig: () => Promise<void>` fields.
- Produces: no new exports. The observable contract is `config === null` plus silence on 404.

- [ ] **Step 1: Read the local context before touching anything**

Read [`apps/frontend/claude.md`](../../../apps/frontend/claude.md) and
[`tests/claude.md`](../../../tests/claude.md). Then read the pattern this test follows —
`apps/frontend/tests/regression/sprint-129-community-trust-empty-state.test.tsx` — which is the
same shape of problem (a denial is an empty state, not an error) and establishes the house mocking
style: a `jest.mock('@/lib/api', …)` factory, `require` after the mock, a `console.error` spy, and
`renderHook` + `act`.

Then run the scoped gotcha check:

```bash
node scripts/gotcha-check.js --for apps/frontend/src/hooks/useCommunityData.ts apps/frontend/tests/tdd/sprint-131-community-config-empty-state.test.tsx
```

- [ ] **Step 2: Write the failing test**

Create `apps/frontend/tests/tdd/sprint-131-community-config-empty-state.test.tsx`:

```tsx
/**
 * Sprint 131 PR A — BUG-045: a community with no config row is an expected empty state.
 *
 * `GET /communities/:id/config` answers 404 when `communities.community_configs` holds no row
 * (services/community-service/src/routes/config.ts:69). That is the server contract and this PR
 * does not change it. The api client's error interceptor re-rejects with the axios error intact
 * (apps/frontend/src/lib/api.ts:166), so the hook can read `err.response.status`.
 *
 * `useCommunityData.fetchConfig` used to log every rejection, so every config-less community wrote
 * "Failed to load configuration" to the console on page load. Only 404 is expected; a 500, a
 * network failure, or anything else still logs, because those are real breakage.
 */
import { act, renderHook, waitFor } from '@testing-library/react'

jest.mock('@/lib/api', () => ({
  communityService: {
    getCommunity: jest.fn(),
    getNorms: jest.fn(),
    getConfig: jest.fn(),
    getSettings: jest.fn(),
  },
  // Imported by useCommunityData but never reached on the mount path under test.
  requestService: {},
  reputationService: {},
  collectiveService: {},
}))

const { communityService } = require('@/lib/api')

import { useCommunityData } from '../../src/hooks/useCommunityData'

// Portland Mutual Aid Network — the community BUG-045 was observed on.
const COMMUNITY_ID = '7f48de77-e6cc-5eba-819b-cb6f50d3c662'

// Post-interceptor success shape: `response.data` is already the envelope's `data`, and the hook
// reads `.config` off it. A second `.data` here would silently make every assertion vacuous.
const CONFIG = {
  id: 'cfg-1',
  community_id: COMMUNITY_ID,
  member_cap: 50,
  visibility_mode: 'community',
}

const axiosError = (status: number, message: string) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data: { success: false, message } },
  })

let consoleError: jest.SpyInstance

beforeEach(() => {
  // apps/frontend/jest.config.js sets no clearMocks/resetMocks, so call counts would otherwise
  // accumulate across these tests.
  jest.clearAllMocks()
  localStorage.clear()
  communityService.getCommunity.mockResolvedValue({
    data: { id: COMMUNITY_ID, name: 'Portland Mutual Aid Network', members: [] },
  })
  communityService.getNorms.mockResolvedValue({ data: { norms: [] } })
  communityService.getSettings.mockResolvedValue({ data: {} })
  communityService.getConfig.mockResolvedValue({ data: { config: CONFIG } })
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => consoleError.mockRestore())

describe('useCommunityData config absence (BUG-045)', () => {
  it('treats an expected 404 as an empty config and logs nothing', async () => {
    communityService.getConfig.mockRejectedValue(
      axiosError(404, 'Community configuration not found'),
    )

    const { result } = renderHook(() => useCommunityData(COMMUNITY_ID))

    await waitFor(() => expect(communityService.getConfig).toHaveBeenCalledWith(COMMUNITY_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.config).toBeNull()
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('clears a previously loaded config when the row goes away', async () => {
    const { result } = renderHook(() => useCommunityData(COMMUNITY_ID))
    await waitFor(() => expect(result.current.config).toEqual(CONFIG))

    communityService.getConfig.mockRejectedValue(
      axiosError(404, 'Community configuration not found'),
    )
    await act(async () => {
      await result.current.refetchConfig()
    })

    expect(result.current.config).toBeNull()
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('still logs a 500 so a broken config endpoint stays visible', async () => {
    communityService.getConfig.mockRejectedValue(axiosError(500, 'Internal server error'))

    renderHook(() => useCommunityData(COMMUNITY_ID))

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith('Failed to load configuration', {
        error: 'Request failed with status code 500',
      }),
    )
  })

  it('still logs a network failure that carries no response at all', async () => {
    communityService.getConfig.mockRejectedValue(new Error('Network Error'))

    renderHook(() => useCommunityData(COMMUNITY_ID))

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith('Failed to load configuration', {
        error: 'Network Error',
      }),
    )
  })

  it('still exposes the config from a successful response', async () => {
    const { result } = renderHook(() => useCommunityData(COMMUNITY_ID))

    await waitFor(() => expect(result.current.config).toEqual(CONFIG))
    expect(consoleError).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Prove discovery — the file must actually be found**

```bash
npm exec --workspace=apps/frontend -- jest --runTestsByPath tests/tdd/sprint-131-community-config-empty-state.test.tsx --listTests --runInBand
```

Expected: exactly one path printed, ending
`apps\frontend\tests\tdd\sprint-131-community-config-empty-state.test.tsx`.
If it prints nothing, stop — a zero-test run exits non-zero and will masquerade as a red test.

- [ ] **Step 4: Run the test and confirm it fails on the right assertion**

```bash
npm exec --workspace=apps/frontend -- jest --runTestsByPath tests/tdd/sprint-131-community-config-empty-state.test.tsx --runInBand
```

Expected: **2 failed, 3 passed.** The two failures are
`treats an expected 404 as an empty config and logs nothing` and
`clears a previously loaded config when the row goes away`, both failing on
`expect(consoleError).not.toHaveBeenCalled()` — *"Expected number of calls: 0, Received number of
calls: 1"*. Record those two names.

An import error, a "Cannot read properties of undefined" from a missing mock, or "No tests found"
is **not** red. Fix the test first if you see any of those.

- [ ] **Step 5: Write the minimal implementation**

In `apps/frontend/src/hooks/useCommunityData.ts`, replace the body of `fetchConfig` (lines 111–119)
with:

```typescript
  const fetchConfig = async () => {
    if (!communityId) return
    try {
      const response = await communityService.getConfig(communityId)
      setConfig(response.data.config)
    } catch (err: any) {
      // BUG-045: the route answers 404 when communities.community_configs holds no row for this
      // community (routes/config.ts:69). That is an expected empty state, not a failure — the page
      // renders its defaults — so it must not log. The 404 contract itself is unchanged.
      if (err?.response?.status === 404) {
        setConfig(null)
        return
      }
      console.error('Failed to load configuration', { error: err instanceof Error ? err.message : String(err) })
    }
  }
```

Change nothing else in the file. `fetchNorms` and `fetchStats` keep logging — see *Verified Facts*.

- [ ] **Step 6: Run the test and confirm it passes**

```bash
npm exec --workspace=apps/frontend -- jest --runTestsByPath tests/tdd/sprint-131-community-config-empty-state.test.tsx --runInBand
```

Expected: **5 passed, 0 failed, 0 skipped.**

- [ ] **Step 7: Record the sibling audit in the test file**

The audit is already done (see *Verified Facts*), and its answer is that neither sibling changes.
Add this comment directly above the `describe` block so the next reader does not redo it:

```tsx
// Sibling audit (2026-09-15): neither fetchNorms nor fetchStats gets this treatment.
// GET /:communityId/norms has no 404 path at all (routes/norms.ts:8 — 200 on success, 500 on
// error), so an empty norms list is already a 200. GET /:communityId/stats 404s only with
// "Community not found" (routes/stats.ts:177), which is genuinely exceptional, and it is not
// fetched on mount anyway (see the S99-001 comment in the hook). Both keep logging.
```

- [ ] **Step 8: Promote the green test to the blocking tier**

The promoter matches `.test.ts` only, so move this `.tsx` file by hand:

```bash
git mv apps/frontend/tests/tdd/sprint-131-community-config-empty-state.test.tsx apps/frontend/tests/regression/sprint-131-community-config-empty-state.test.tsx
```

Then prove it runs from its new home, and that the blocking tier command picks it up:

```bash
npm exec --workspace=apps/frontend -- jest --runTestsByPath tests/regression/sprint-131-community-config-empty-state.test.tsx --listTests --runInBand
npm run test:regression --workspace=apps/frontend
```

Expected: the listing names the `regression/` path, and `test:regression` passes with the new
suite included. Note `test:regression` carries `--passWithNoTests`, so confirm the suite count
went up rather than trusting the exit code alone.

- [ ] **Step 9: Commit**

```bash
git add apps/frontend/tests/regression/sprint-131-community-config-empty-state.test.tsx apps/frontend/src/hooks/useCommunityData.ts
git status --short
```

Confirm only those two paths are staged, then:

```bash
git commit -F - <<'EOF'
fix(frontend): an absent community config is an empty state, not an error (BUG-045)

GET /communities/:id/config answers 404 when communities.community_configs holds
no row for the community. useCommunityData.fetchConfig logged every rejection, so
every config-less community wrote "Failed to load configuration" to the console on
page load — seen live on Portland Mutual Aid Network during Sprint 130 PR A's
post-deploy check.

fetchConfig now treats only HTTP 404 as an expected empty state: config is set to
null and nothing is logged. A 500, a network failure, or a malformed response still
logs, because those are real breakage. The server contract is unchanged, so the
browser's own 404 network entry remains.

fetchNorms and fetchStats deliberately keep logging: the norms list route has no
404 path, and a stats 404 means the community itself is missing.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

## Task 2: Documentation

**Files:**
- Modify: `docs/BUGS.md:1011`
- Modify: `apps/frontend/CONTEXT.md`

- [ ] **Step 1: Close BUG-045 with its exact boundary**

`docs/BUGS.md:1011` currently reads `## BUG-045 · [2026-09-15] · open`. Change the status line to:

```markdown
## BUG-045 · [2026-09-15] · fixed (Sprint 131 PR A)
```

Then append this to the end of the entry, immediately before its `---` separator:

```markdown
**Fixed (Sprint 131 PR A):** `useCommunityData.fetchConfig` now treats HTTP 404 as an expected
empty state — `config` is set to `null` and nothing is logged. 500s, network failures and
malformed responses still log. The server contract is unchanged: `GET /communities/:id/config`
still answers 404 when `communities.community_configs` has no row, which was the deliberate
choice — the alternative (an empty/default config body, the `fetchSettings` pattern) would have
changed the API for every consumer to silence one caller.

**Boundary — the second console entry is the browser's, not the application's.** The bug was filed
as "two console errors". Only one of them was ours. The other is the browser's own
`Failed to load resource: the server responded with a status of 404` entry for the preserved 404,
which no caller-side change can suppress. Removing it would require changing the endpoint's status
code. Covered by `apps/frontend/tests/regression/sprint-131-community-config-empty-state.test.tsx`
(5 cases: expected 404, cleared-after-load, 500, network failure, success).

**Siblings audited, deliberately unchanged:** `fetchNorms` (`routes/norms.ts:8` has no 404 path)
and `fetchStats` (`routes/stats.ts:177` 404s only when the community itself is missing, and it is
not fetched on mount).
```

- [ ] **Step 2: Record the caller-side contract in the frontend context**

`apps/frontend/CONTEXT.md` is reverse-chronological: `# Frontend CONTEXT.md`, a `**Last updated**`
line, `## Overview`, `---`, then dated sprint sections newest-first. Update the `**Last updated**`
line at line 3 to name this sprint, and insert a new section immediately after the `---` that
follows `## Overview` (currently before `## Sprint 120 PR C Five-Second Clarity`):

```markdown
## Sprint 131 PR A — Expected config absence (2026-09-15, BUG-045)

`useCommunityData.fetchConfig` distinguishes an **expected** empty state from a failure. The
community-service config route answers `404` when `communities.community_configs` has no row for
the community; that is the contract, not an error. `fetchConfig` catches only
`err.response.status === 404`, sets `config` to `null`, and returns without logging. Every other
rejection — 500, network, malformed — still reaches `console.error('Failed to load configuration', …)`.

This works because `lib/api.ts`'s `errorInterceptor` ends in `return Promise.reject(error)`, so the
axios error reaches callers with `response.status` intact. A caller that needs to tell an expected
absence from a real failure reads that status; it does not need a change in `api.ts`.

**The 404 stays.** The browser still records its own failed-request entry in the Network/Console
panel. "No application log" is the contract here, not "an empty console".

`fetchNorms` and `fetchStats` are deliberately NOT given this treatment — the norms list route has
no 404 path, and a stats 404 means the community itself is missing.

---
```

- [ ] **Step 3: Verify the drift gate and the docs to-do list still pass**

```bash
npm exec --workspace=tests -- jest --runTestsByPath regression/doc-context-drift-gate.test.ts --runInBand
git add docs/BUGS.md apps/frontend/CONTEXT.md
npm run feedback:check
```

Expected: the drift gate passes (41 tests at time of writing), and `feedback:check` reports no
outstanding context updates. `feedback:check` reads the **staged** diff, so stage first — on an
already-committed branch it is otherwise a false green.

- [ ] **Step 4: Commit**

```bash
git status --short
git commit -m "docs(bug-045): record the fix, its boundary and the sibling audit

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: Quality gates, version, PR

**Files:**
- Modify: `package.json` (version, derived at merge time)
- Modify: `.claude/handoff/CURRENT_HANDOFF.md`

- [ ] **Step 1: Run the three SDLC gates on the branch diff**

Per CLAUDE.md, effort is calibrated to diff size, and this diff is small and well-specified: one
hook branch, one test file, two doc edits.

```
/simplify
/code-review medium
/security-review
```

Resolve each finding or record a written justification for dismissing it. `/security-review`
should confirm the obvious question directly: that the 404 branch cannot swallow an
authorization failure — it cannot, because 401 and 403 are untouched and the route returns 404
only for a missing row.

- [ ] **Step 2: Run the blocking suite and inspect what it moved**

```bash
npm test -- --concurrency=1
git status --short
```

Expected: exit 0. Then **inspect the tree before staging anything**. Two known side effects:

1. `posttest` runs `scripts/promote-tdd-tests.js`, which promotes *every* green `.test.ts` under
   `tests/tdd/` repo-wide — not just yours. Restore any file it moved that is not part of this PR:
   `git checkout -- <path>` for the regression copy and `git mv` it back, or simply
   `git restore --source=HEAD --staged --worktree <paths>`.
2. The landing prebuild regenerates `apps/landing/src/data/docs/` with timestamp/HEAD-sha churn.
   Revert it: `git checkout -- apps/landing/src/data/docs/`.

Your own test is a `.test.tsx` already sitting in `regression/`, so the promoter cannot touch it.

- [ ] **Step 3: Derive the version and bump it**

```bash
git fetch origin
node -e "console.log(require('./package.json').version)"
git show origin/master:package.json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).version))"
```

Take master's version, increment the minor, and write it to root `package.json`. Do not reserve
anything for PR B or the D-series. (Master is `11.55.0` at time of writing, so this is `11.56.0`
unless master has moved.)

- [ ] **Step 4: Update the handoff to real state**

In `.claude/handoff/CURRENT_HANDOFF.md`: set **Outcome** to PR A open with its number, move
**Next unchecked task** to PR B's first task, and add to *Verification references* — dated
2026-09-15 — the red-then-green test evidence (2 failed → 5 passed), the `feedback:check` and
drift-gate results, and the PR link. Do not record this commit's own SHA; it cannot know it.

- [ ] **Step 5: Commit and push**

```bash
git add package.json .claude/handoff/CURRENT_HANDOFF.md
git status --short
git commit -m "chore: bump version for Sprint 131 PR A, update handoff

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push --set-upstream origin agent/codex/sprint-131-maintenance
```

The branch has **no upstream on purpose** — it was unset because it had been tracking
`origin/master`. `--set-upstream` on this exact refspec is required; never let a bare `git push`
resolve to master.

The pre-push hook runs unit + regression. A push that finishes silently and instantly means no
hook ran — treat that as a red flag and check `git config core.hooksPath`.

- [ ] **Step 6: Open the PR and stop**

Fill in every section of `.github/pull_request_template.md` (Lane: codex). Body must state the
acceptance boundary in the maintainer's words: *no application log on an expected 404; the
browser's own 404 network entry remains because the server contract is unchanged.*

End the PR description with:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Then **stop.** Do not merge. Report the PR number and the check status. The maintainer authorizes
the merge; the deploy and the browser verification below happen after that.

- [ ] **Step 7: After the maintainer merges — verify live, then close the loop**

Watch the **Deploy to Demo** job on the master run and wait for its health verification. Then open
`/communities/7f48de77-e6cc-5eba-819b-cb6f50d3c662` (Portland Mutual Aid Network) as `maria.reyes`
at 1440px with the console open, and confirm:

- no `Failed to load configuration` entry;
- the browser's own `404` network entry for `/config` **is** still there — that is expected and is
  the boundary, not a regression;
- the page renders its default configuration UI rather than an error state.

Record the observation, dated, in the handoff. Do not induce server failures on the demo to test
the 500 path — that is covered by the regression suite.

---

## Self-Review

**Spec coverage.** The spec's PR A section has five requirements: 404 → `config: null` (Task 1
Step 5); logging retained for 500/network/other (Task 1 Steps 2, 5); tests exercise both halves
via the real hook (Task 1 Step 2 — `renderHook` on the actual `useCommunityData`, only the api
module mocked); norms/stats audited without expanding scope (Task 1 Step 7, answer verified in
*Verified Facts*); acceptance boundary documented as "no application log", not "zero console
errors" (Global Constraints, Task 2 Step 1, Task 3 Steps 6–7). The clearing case the spec calls
out — "including after a previously loaded config becomes absent" — is Task 1 Step 2's second test.

**Placeholder scan.** Every code step carries the literal content to write. Every command is
runnable as given. Expected outputs are stated as counts and assertion names, not "verify it
works". The one deliberately unresolved value is the version number, which the spec requires be
derived at merge time; Task 3 Step 3 gives the commands that derive it.

**Type consistency.** `config` is `CommunityConfig | null` in the hook's state declaration
(line 58) and the test asserts `toBeNull()` / `toEqual(CONFIG)` against that. `refetchConfig` is
the hook's exported alias for `fetchConfig` (line 201) and is what the clearing test calls.
`response.data.config` matches the hook's existing read at line 115 and the mock in `beforeEach`.
The `axiosError` helper produces `{ response: { status, data } }`, which is exactly the shape
`err?.response?.status` reads — and, being built on `new Error`, it also satisfies the
`err instanceof Error ? err.message` branch the 500 and network tests assert against.
