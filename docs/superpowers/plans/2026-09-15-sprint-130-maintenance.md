# Sprint 130 — Stop Asking for Reputation We Can't Be Given — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove every frontend reputation request that ADR-082 guarantees will be denied, show the
community trust badge where a score can actually exist, and clear the carried security and
dependency backlog to 0 open code-scanning alerts.

**Architecture:** Frontend-only call-pattern changes (PR A): `/communities` fetches trust for joined
communities only and renders it on the "Your Communities" chips, the first list fetch waits for the
persisted discovery mode, and the People tab drops its per-member score fan-out. PR B fixes a real
log injection in geocoding-service, dismisses one monitor-script false positive, and applies
Dependabot #239 surgically.

**Tech Stack:** the canonical stack in `CLAUDE.md` → *System Architecture*.

**Spec:** [`docs/superpowers/specs/2026-09-15-sprint-130-maintenance-design.md`](../specs/2026-09-15-sprint-130-maintenance-design.md)

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `apps/frontend/tests/tdd/sprint-130-reputation-fanout.test.tsx` | BUG-042/043/044: request-pattern and render assertions, **moved to `tests/regression/` by hand once green** (note 12) |
| `services/geocoding-service/tests/tdd/sprint-130-log-injection.test.js` | #540–#542, moved to `tests/regression/` by hand before PR B opens (note 9) |

### Existing files to modify
| File | Change | PR |
|------|--------|----|
| `apps/frontend/src/pages/communities/index.tsx` | Trust for joined ids only, badge on chips, discovery badge removed, `modeResolved` gate | A |
| `apps/frontend/src/components/DiscoveryToggle.tsx` | No storage write on mount; persist only after initialisation (BUG-043 half a) | A |
| `apps/frontend/src/hooks/useCommunityData.ts` | Delete `memberTrustScores` + `fetchMemberTrustScores` + return keys | A |
| `apps/frontend/src/pages/communities/[id].tsx` | Delete the `refetchMemberTrustScores()` call and prop | A |
| `apps/frontend/src/components/community/tabs/ActiveTab.tsx` | Delete the `memberTrustScores` prop and score pill | A |
| `apps/frontend/tests/tdd/sprint-129-community-trust-empty-state.test.tsx` | Rework the badge cases to the chip placement (that fixture was unreachable), then **move to `tests/regression/`** | A |
| Existing tests passing `memberTrustScores` (grep) | Drop the prop | A |
| `docs/guides/community-admin-guide.md`, `docs/guides/admin-community-guide.md` | Badge location; `:56` member scores claim | A |
| `docs/adr/ADR-082-reputation-disclosure-boundary.md` | Sprint 130 note | A |
| `services/reputation-service/CONTEXT.md`, `docs/BUGS.md`, `docs/IDEAS.md` | Corrections and closures | A |
| `services/geocoding-service/src/geocodingService.js` | Log `normalized` (not raw `query`) at `:111`, `:118`, `:129`; `normalizeQuery` unchanged | B |
| `services/geocoding-service/CONTEXT.md` | Recent fix | B |
| `apps/frontend/package.json`, `apps/landing/package.json`, `tests/package.json`, `package-lock.json` | #239 surgical bump | B |
| `package.json` | Version bump at merge time | A, B |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **BUG-043 needs both halves, tested with the REAL `DiscoveryToggle`.**
   - (a) The toggle must not write storage on mount.
   - (b) The first fetch waits for the resolved mode.
   - Never use a lazy `useState` initialiser that reads localStorage: the page is prerendered, and a
     mismatch logs a hydration error.
   - **Do not mock `@/components/DiscoveryToggle` in BUG-043 tests.** The mock hid the overwrite.
   - Assert, per case:
     - Saved `interests`: storage still reads `interests` after mount, exactly one `getCommunities`
       call, and no `mode`/`tags` params, because tags start empty.
     - Saved `geography` with `navigator.geolocation` mocked to succeed: exactly one call with
       `mode: 'geography'`, `lat` and `lng`.
     - Geography fallback (no geolocation, or denied): exactly one unfiltered call.
2. **A test must reach a state the real page can reach.** Sprint 129's badge test mocked a score for a
   card the real grid filters out, and passed while the feature was dead (BUG-044). Every PR A
   render test builds its fixture from the page's real filters: joined ids come from
   `user.communities`, and the grid is `communities` minus joined.
3. **Assert the absence of requests, not only of UI.** BUG-042/044 are about requests. Tests must
   assert `getTrustScore` is **not called** on People tab open, and that `getCommunityTrust` is called
   with **exactly** the joined ids, never a discovery-card id.
4. **Keep `LeftSidebar`'s self read.** Only the per-member fan-out in `useCommunityData` goes.
   Grep `getTrustScore(` before and after; exactly one call site should remain.
5. **The server contract doesn't change.** Don't touch `reputation.ts`, `health.ts` or any 404/200
   status. BUG-042's fix is removing the caller, never changing the self-only 404.
6. **Don't edit `apps/frontend/src/lib/api.ts`.** A line shift re-raises the CodeQL
   `js/request-forgery` false positive as new alert ids and blocks the master deploy.
7. **#540–#542 are real, so fix them, never dismiss.** `\s` in `SAFE_ADDRESS_QUERY_PATTERN` admits
   `\n`/`\r` mid-query, and the three log lines print the raw query. The regression test feeds
   `"Main St\nFORGED 200 OK"` and asserts two things. First, no logged string contains `\n` or `\r`
   on the miss, hit and cached paths. Second, the cache key stays exactly what `normalizeQuery`
   produces today (`"main st forged 200 ok"`): the lowercase contract is preserved, not changed.
8. **#578 is one dismissal, with its justification recorded in the PR body.** Never loop the
   dismissal API.
9. **Geocoding tests are `.js`, and the promoter only moves `*.test.ts`** (`promote-tdd-tests.js:33`,
   the same blind spot as BUG-033). The geocoding `test` script runs only `tests/unit` and
   `tests/regression`. Write the test in `tests/tdd/` first, prove red with a direct `npx jest`, then
   **move it to `tests/regression/` by hand** in the same PR. A test left in `tdd/` there runs nowhere.
10. **The dependency edit is surgical** (CLAUDE.md, *Workspace dependencies*). Splice the #239 entries
    in place. Prove with `npx -y npm@11.19.0 ci` **and** `npm ls --all | grep invalid` (baseline is 3
    pre-existing invalids: color-string, ms, picomatch). Never `npm install --workspace`, dedupe or
    scratch-regen on this Windows box.
11. **`eslint-config-next` is already 16.x against `next` 15** (the mismatch recorded on #229). #239
    is a patch within 16, and it must not become a `next` bump.
12. **The TDD promoter sweeps unrelated files.** After any full `npm test`, restore promotions that
    don't belong to the PR. **Frontend `.tsx` tests never promote** (BUG-033), and
    `apps/frontend/package.json`'s blocking `test` runs only `tests/unit` + `tests/regression`. So
    **move this sprint's green `.tsx` tests to `apps/frontend/tests/regression/` by hand**, as for
    geocoding's `.js`. That includes the reworked Sprint 129 test, which has sat non-blocking in
    `tdd/` since it shipped. BUG-033 itself stays deferred.
13. **`apps/landing/src/data/docs/` is only partly tracked, and its directory is gitignored.** Stage
    tracked regenerations with `git add -u`, keep content changes, and revert `architecture.json` and
    `build.json` timestamp churn.
14. **One merge at a time, and PR B branches after PR A merges.** Every master push is a full deploy.
    Take the version bump from `origin/master` at merge time.
15. **Verify live after each deploy, in a browser, as `maria.reyes`:**
    - `/communities`: 0 console errors, **no** community-trust request for a discovery-card id,
      exactly one `GET /communities`, a badge on any joined chip whose score is non-null, and **a
      saved "By Interest" mode still selected after a reload**.
    - Community People tab: 0 `/reputation/trust/` requests.
16. **CodeQL: PR evidence and master evidence are different things.**
    - **Before merge:** confirm the CodeQL analyses for the PR's **exact head SHA** have *completed*
      (not just that a check exists), and read the ref-scoped findings for the PR ref: check-run
      annotations or `code-scanning/alerts?ref=refs/pull/N/head`. They must show #540–#542's rule
      no longer firing at those lines.
    - **After merge:** wait for the master rescan to complete, then verify default-branch alert
      closure.
    - An alert still open on master before that rescan is expected (GitHub's alert status is per
      branch) and never justifies another sanitiser change.
    - Recall the memory: the ADR-060 gate polls the merge ref while CodeQL publishes to `/head`.

**Host traps (Windows primary box):**
- Use `node -e` rather than `curl`/`jq`.
- Run the full suite serially (`npx turbo run test --concurrency=1 --force`), and capture exit codes
  separately because `| tail` masks them.
- Root `jest.config.js` has `resetMocks: true`, so install mock implementations in `beforeEach`.
- The frontend config clears nothing, so call `jest.clearAllMocks()` in `beforeEach`.

---

# PR A — the reputation fan-out (BUG-044, BUG-043, BUG-042)

## Task 1: Branch check and baseline

**Files:** none

- [ ] `git fetch origin`; confirm `feature/sprint-130-maintenance` contains `origin/master` (`git merge-base --is-ancestor origin/master HEAD`). If master moved, merge it in with a merge commit.
- [ ] Record the baseline call sites; exactly these should exist before the change:

```bash
grep -rn "getTrustScore(\|getCommunityTrust(\|memberTrustScores" apps/frontend/src apps/mobile --include=*.ts --include=*.tsx
```

## Task 2: Write the failing frontend tests (TDD)

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-130-reputation-fanout.test.tsx`

Read `tests/claude.md` and `apps/frontend/claude.md` first. Model the page mocks on
`apps/frontend/tests/tdd/sprint-129-community-trust-empty-state.test.tsx`.

- [ ] **BUG-044, chips.** The user has `communities: [J1 (member), J2 (member)]`, and `getCommunities` returns `[J1, D1, D2]` (J1 is joined, so the real page filters it out of the grid). `getCommunityTrust` resolves `{ data: { score: 62 } }` for J1 and `{ data: null }` for J2. Assert:
  - `getCommunityTrust` was called with **exactly** `[J1, J2]` (sorted), never D1 or D2.
  - The J1 chip contains `★ 62% trust`; the J2 chip has no badge.
  - No discovery card contains `% trust`.
  - `console.error` was not called.
- [ ] **BUG-043, saved mode survives and one list fetch.** Use the **real** `DiscoveryToggle`; do not mock `@/components/DiscoveryToggle` in this `describe` (note 1). Seed `localStorage.community_discovery_mode`, let all effects settle, then assert per case:
  - **Saved `interests`:** storage still reads `interests`, the "By Interest" button is the selected one, and `getCommunities` is called **exactly once** with **no** `mode` or `tags` params (tags start empty, `index.tsx:167-174`).
  - **Saved `geography`, geolocation succeeds** (mock `navigator.geolocation.getCurrentPosition` to call back with coordinates): exactly one call with `mode: 'geography'`, `lat` and `lng`.
  - **Geography fallback** (no `navigator.geolocation`, and separately a denied callback): exactly one unfiltered call.
  - Pre-fix, the `interests` case must fail on the storage assertion (reproduced 2026-09-15: saved `interests` became `geography`).
- [ ] **BUG-042, People tab.** Render `ActiveTab` with members and no `memberTrustScores` prop. Assert no `★` pill renders for any member. Through `useCommunityData`, assert the hook no longer exposes `refetchMemberTrustScores`, and that `reputationService.getTrustScore` is never called.
- [ ] Run and confirm it is **red for the right reasons**: trust is called with discovery ids, no chip badge, saved `interests` is overwritten to `geography`, a pill renders.

```bash
cd apps/frontend && npx jest tests/tdd/sprint-130-reputation-fanout.test.tsx
```

## Task 3: BUG-044, fetch trust for joined communities and badge the chips

**Files:** Modify `apps/frontend/src/pages/communities/index.tsx`

- [ ] Remove `fetchTrustScores(newCommunities.map(...))` from `fetchCommunities` and drop `fetchTrustScores` from its dependency array.
- [ ] Add an effect keyed on the joined ids (derived from `user?.communities`) that calls `fetchTrustScores(joinedIds)` once they are known. Keep `Promise.allSettled` and the `data?.score ?? null` read.
- [ ] Render `★ {score}% trust` inside the chip `Link` when `trustScores[c.id] != null`, and remove the discovery-card badge block.
- [ ] Task 2's BUG-044 cases go green.

## Task 4: BUG-043, stop the mount-time overwrite and gate the first fetch

**Files:** Modify `apps/frontend/src/components/DiscoveryToggle.tsx`, `apps/frontend/src/pages/communities/index.tsx`

- [ ] **Half (a):** `DiscoveryToggle` must not write storage on mount. Either persist on a user-initiated change (inside the click handler, before `onChange`), or accept a `persist` prop that the page keeps false until `modeResolved`. Remove the unconditional `useEffect(() => localStorage.setItem(...), [mode])`. The page is the toggle's only consumer (grep confirmed).
- [ ] **Half (b):** the steps below.

- [ ] Add `const [modeResolved, setModeResolved] = useState(false)`. The mount effect calls `setDiscoveryMode(readDiscoveryMode())` and then `setModeResolved(true)`.
- [ ] The mode effect returns early while `!modeResolved`, and its dependency list becomes `[discoveryMode, modeResolved]`. **No** lazy `useState` initialiser reading localStorage (note 1).
- [ ] Task 2's BUG-043 cases go green for all three cases. Then prove the test can fail: with (a) fixed but (b) reverted, the `interests` "exactly once" assertion must fail.

## Task 5: BUG-042, remove the per-member score fan-out

**Files:** Modify `apps/frontend/src/hooks/useCommunityData.ts`, `apps/frontend/src/pages/communities/[id].tsx`, `apps/frontend/src/components/community/tabs/ActiveTab.tsx`

- [ ] Delete the `memberTrustScores` state, `fetchMemberTrustScores`, and both return keys.
- [ ] Delete the `refetchMemberTrustScores()` call (the `people` branch keeps any other fetches) and the `memberTrustScores` prop.
- [ ] Delete the prop from `ActiveTab`'s props interface and destructuring, and remove the pill IIFE.
- [ ] Fix every existing test that passes or mocks `memberTrustScores` (grep).
- [ ] Verify exactly one `getTrustScore(` call site remains (`LeftSidebar.tsx`, note 4):

```bash
grep -rn "getTrustScore(\|memberTrustScores" apps/frontend/src --include=*.ts --include=*.tsx
```

## Task 6: Rework the Sprint 129 badge test to a reachable fixture

**Files:** Modify `apps/frontend/tests/tdd/sprint-129-community-trust-empty-state.test.tsx`

- [ ] Its `/communities` cases mocked a score for a card the grid would filter out (note 2). Move the badge assertions to the joined-chip placement, or delete them where Task 2 now covers them. Keep the `useCommunityData` null-shape cases.
- [ ] All frontend tests touching these files are green:

```bash
cd apps/frontend && npx jest tests/tdd/sprint-130-reputation-fanout.test.tsx tests/tdd/sprint-129-community-trust-empty-state.test.tsx tests/regression/sprint-118-invited-arrival.test.tsx tests/tdd/community-decomposition.test.tsx
```

## Task 7: Docs for PR A — guides, ADR note, bugs

**Files:** Modify both admin guides, `docs/adr/ADR-082-reputation-disclosure-boundary.md`, `docs/BUGS.md`, `docs/IDEAS.md`, `services/reputation-service/CONTEXT.md`

- [ ] Guides, "Community Trust Score": members see the badge on their **Your Communities** chips on the discovery page.
- [ ] `admin-community-guide.md:56`: remove "see their karma and trust scores". Admins browse members and manage roles; ADR-082 keeps exact scores self-only.
- [ ] ADR-082: a short Sprint 130 note under the Sprint 129 amendment. Client fan-outs that could only be denied were removed; the Sprint 113 per-member 404 note is historical.
- [ ] reputation `CONTEXT.md`: correct the Sprint 129 "badge now renders" line, and record the call-pattern change (no server change).
- [ ] `BUGS.md`: BUG-042, BUG-043, BUG-044 → `fixed (Sprint 130 PR A)`, each naming its test.
- [ ] `IDEAS.md`: annotate the batching idea as largely obsolete (only joined communities are fetched now).
- [ ] Onboarding `workflows.ts`: checked, and no per-member score or discovery-badge step exists (`:27` is about request cards). No change.
- [ ] Regenerate landing docs (`cd apps/landing && npx tsx ../../scripts/generate-docs.ts`), keep the content changes, and revert the `architecture.json`/`build.json` churn (note 13).

## Task 8: SDLC quality gates (PR A)

- [ ] `/simplify` on the PR diff: findings applied, or skipped with a reason.
- [ ] `/code-review` **medium** on `origin/master...HEAD`: correctness findings resolved.
- [ ] `/security-review` on the branch diff. Confirm no reputation value becomes visible that ADR-082 forbids (the chip badge is the caller's own community aggregate).
- [ ] Verification: every finding is recorded in the PR body as resolved or dismissed with a justification.

## Task 9: Verify and open PR A

- [ ] `npx tsc --noEmit -p apps/frontend`: clean.
- [ ] **Move this PR's green frontend tests to `apps/frontend/tests/regression/` by hand** (note 12): `sprint-130-reputation-fanout.test.tsx` and the reworked `sprint-129-community-trust-empty-state.test.tsx`. Update any doc references to their paths and re-run them from the new location.
- [ ] `npx turbo run test --concurrency=1 --force`, with the exit code captured separately. Restore anything unrelated the promoter moved (note 12).
- [ ] `npm run feedback:check`.
- [ ] Bump `package.json` from `origin/master` at merge time (expected **v11.54.0**).
- [ ] Update the handoff **before** opening the PR (so no docs-only master push is needed later).
- [ ] Push. The pre-push hook must visibly run the suite; a silent, instant push is an alarm.
- [ ] Open PR A using `.github/pull_request_template.md` (every section; Lane: `claude`).

## Task 10: Merge, deploy and live-verify PR A

Use the `/deploy` skill.

- [ ] Wait for all checks. Confirm no master deploy is in flight: `gh run list --workflow=ci.yml --branch master --limit 3`.
- [ ] The merge needs the maintainer's **explicit** per-PR authorization (`--admin`; self-approval is impossible).
- [ ] Watch the **Deploy to Demo job**, not just the run. Smoke: `POST /api/auth/login` → 200, `POST /api/auth/demo-session` → 200.
- [ ] **Browser (note 15)**, as `maria.reyes` at 1440px:
  - `/communities`: 0 console errors; community-trust requests equal to her joined ids only; one `GET /communities`; badges on her scored chips.
  - Community People tab: 0 `/reputation/trust/` requests.

---

# PR B — security and dependency backlog (#540–#542, #578, #239)

## Task 11: Branch PR B after PR A has merged and deployed

- [ ] `git fetch origin && git switch -c feature/sprint-130-security origin/master` (it must contain PR A's squash).
- [ ] Confirm with the maintainer that **Claude holds the dependency lane** (decided 2026-09-15). No other dependency work is in flight.
- [ ] Baseline: `gh api "repos/ravichavali/karmyq/code-scanning/alerts?state=open"` lists exactly #540, #541, #542, #578. Record `npm ls --all | grep -c invalid` (expected 3).

## Task 12: Write the failing geocoding log-injection test (TDD)

**Files:** Create `services/geocoding-service/tests/tdd/sprint-130-log-injection.test.js`

Model it on `services/geocoding-service/tests/unit/geocodingService.test.js`: inject `pool`, `fetchImpl` and a capturing `logger`.

- [ ] A query `"Main St\nFORGED 200 OK"` (passes validation today) produces **no** logged string containing `\n` or `\r`, on the cache-miss path and the cache-hit path.
- [ ] The cache key passed to `pool.query` is exactly what `normalizeQuery` produces today: `"main st forged 200 ok"` for the query above. **The contract is preserved, not changed** (note 7). Assert it both before and after the fix.
- [ ] A normal query's results and cache behaviour are unchanged.
- [ ] Prove red: `cd services/geocoding-service && npx jest tests/tdd/sprint-130-log-injection.test.js`.

## Task 13: Fix the log injection at the source

**Files:** Modify `services/geocoding-service/src/geocodingService.js`

- [ ] **Do not change `normalizeQuery` or `validateSearchQuery`.** Normalisation already lowercases, trims and collapses whitespace (`:4-5`, used at `:23`).
- [ ] The three `logger.log` lines (`:111`, `:118`, `:129`) interpolate `normalized`, never the raw `query`. Grep `logger\.` for any other site that interpolates `query`.
- [ ] Green. Then **move the test file to `tests/regression/` by hand** (note 9) and re-run it there.
- [ ] Run the full geocoding suite: `cd services/geocoding-service && npm test`.

## Task 14: Dismiss #578 with justification

- [ ] One API call, never a loop (note 8):

```bash
gh api -X PATCH repos/ravichavali/karmyq/code-scanning/alerts/578 -f state=dismissed -f dismissed_reason="false positive" -f dismissed_comment="Package name read from the repo's own security/audit-exemptions.json, URL-encoded to api.github.com's advisory API - the monitor's purpose; file is maintainer-controlled."
```

- [ ] Confirm that the dismissed comment is ≤280 chars and that the alert state reads `dismissed`. Record it in PR B's *Security dismissals*.

## Task 15: Apply Dependabot #239 surgically

**Files:** `apps/frontend/package.json`, `apps/landing/package.json`, `tests/package.json`, `package-lock.json`

- [ ] Read #239's diff (`gh pr diff 239`). Confirm it is exactly `eslint-config-next` 16.3.4→16.3.5 and `yaml` 2.9.0→2.9.1, with no `next` movement (note 11).
- [ ] Apply the manifest edits, and splice only #239's lock entries onto the base lock. Never `npm install --workspace`, dedupe or scratch-regen (note 10).
- [ ] Prove it:

```bash
npx -y npm@11.19.0 ci
npm ls --all 2>&1 | grep -c invalid    # must equal the Task 11 baseline (3)
npm ls eslint-config-next yaml --all
```

- [ ] Frontend lint and type check still pass: `cd apps/frontend && npx tsc --noEmit && npm run lint`.

## Task 16: Docs for PR B

- [ ] `services/geocoding-service/CONTEXT.md`: recent fix (log injection via embedded whitespace; the cache key is now whitespace-collapsed).
- [ ] Check whether `docs/guides/` describes geocoding search normalisation; update if it does, otherwise record "N/A — checked" in the PR body.
- [ ] The PR body records #578's dismissal, #239 superseded, and the lane released on merge.

## Task 17: SDLC quality gates (PR B)

- [ ] `/simplify` on the PR diff.
- [ ] `/code-review` **medium** on `origin/master...HEAD`.
- [ ] `/security-review` on the branch diff. Confirm the sanitiser covers every log site that takes user input in geocoding-service (grep `logger.` for `query`).
- [ ] Verification: findings resolved or dismissed with a written justification in the PR body.

## Task 18: Verify, open, merge and deploy PR B

- [ ] `npx turbo run test --concurrency=1 --force` (exit code captured); `npm run feedback:check`; restore unrelated promotions.
- [ ] Bump the version from `origin/master` at merge time (expected **v11.55.0**). Update the handoff before opening.
- [ ] Push (the hook runs visibly); open PR B from the template.
- [ ] **Before merge (PR evidence, note 16):** confirm the CodeQL analyses for PR B's **exact head SHA** have **completed** (`gh api "repos/ravichavali/karmyq/code-scanning/analyses?ref=refs/pull/<N>/head"`, matching `commit_sha`). Then read the ref-scoped findings (`code-scanning/alerts?ref=refs/pull/<N>/head` and the check-run annotations): `js/log-injection` must not fire at `geocodingService.js:111/118/129`. Only if it **does** fire on the PR head is another sanitiser change warranted.
- [ ] Get explicit merge authorization and merge; watch the **Deploy to Demo job**; smoke login + demo-session.
- [ ] **After merge (master evidence, note 16):** wait for the master CodeQL analysis on the squash SHA to complete, then verify #540–#542 read `fixed` on the default branch. Before that rescan, open alerts on master are expected and are **not** grounds for more changes.
- [ ] Post-merge: **0 open code-scanning alerts**, **0 open Dependabot security alerts**, and #239 closed with a link.

## Task 19: Close the sprint

- [ ] Re-read the handoff end-to-end against `gh pr list`, `git log origin/master` and the alert counts, and reconcile.
- [ ] The handoff archive and memory update ride the **next** sprint's first branch (no docs-only master push).
