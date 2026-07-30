# Sprint 122 PR 2 — Test-Tier Truthfulness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a green test run *mean* something — every cache key hashes the tests it claims to have run, every tier proves it actually executed the files on disk, and every lint config is proven loadable rather than assumed.

**Architecture:** Four independent truth defects are repaired at their source (turbo input globs, the TDD promoter's workspace walk, mobile's `passWithNoTests`, and the unverified flat lint configs), and each repair is locked behind a blocking regression gate in `tests/regression/` so it cannot silently regress. ADR-088 records the principle. Two maintainer decisions taken on 2026-07-30 ride along: `apps/mobile` joins CI's blocking type-check, and the dead root-level `mobile/` scaffold is deleted.

**Tech Stack:** Turborepo 2.x · Jest 29 · ESLint 9 flat config · TypeScript 5 · Node 24 (CI) · npm workspaces

---

## Global Constraints

Copied verbatim from the Sprint 122 spec, the Plan of Record, and CLAUDE.md. Every task's requirements implicitly include this section.

- **Version: `11.37.0`.** Set it in Task 2, **before** any lockfile resolution (Critical Note 15 — bumping after the lock work silently recreates the drift). Assert all three sites: `package.json` `.version`, `package-lock.json` `.version`, `package-lock.json` `.packages[""].version`.
- **`/code-review` effort: HIGH.** All four gates run this PR (testing, `/simplify`, `/code-review`, `/security-review`). One `/simplify` pass per PR; per-task on this PR only, because it is the only PR this sprint writing real new logic.
- **`ADR-088` is the next free number.** Highest existing is ADR-087. PR 1 deliberately created none.
- **Branch:** `deps/sprint-122-pr2-test-truth`, already cut from `origin/master` at `46b2982c` and already carrying the PR 1 handoff commit `35ac7ae9`. Do **not** re-cut it. Never force-push; never direct-push to `master`.
- **Merge requires EXPLICIT maintainer authorization** (`gh pr merge --squash --admin`), every time. Never self-merge.
- **New sprint tests start in the changed workspace's `tests/tdd/`**, then promote when green. Cross-workspace gates belong in the `tests` workspace (`tests/tdd/` → `tests/regression/`), and `scripts/promote-tdd-tests.js` must be **run**, not hand-moved, once Task 4 lands — proving the fix.
- **Run cross-workspace suites directly** — `cd tests && npx jest regression/<file>` — never through Turbo. Turbo's cache is the thing under repair; a cached pass here is worthless evidence. Use `--force` if you must go through Turbo.
- **`npx jest unit regression` is an imprecise positional pattern.** Jest matches args as regexes against the full path and **"comm-unit-y" contains `unit`**, so it silently pulls in DB-dependent `integration/` and WIP `tdd/` suites. Use `--testPathPattern='(unit|regression)/'`.
- **`npm test` regenerates landing docs** (`apps/landing` `prebuild` → `generate-docs`). Revert timestamp/HEAD-sha churn before committing, except in Task 10 where the regen is the deliverable.
- **`apps/landing/src/data/docs/` is gitignored but tracked** (`apps/landing/.gitignore:2`). Regenerated artifacts need `git add -f`.
- **`nav.json` is GENERATED** by `scripts/generate-docs.ts` (written at line 623 from the `ADR_GROUPS` table at line 433). Hand-editing `nav.json` silently reverts on the next regen — edit `ADR_GROUPS` instead. Grep-verify afterwards.
- **Known flakes — do not debug, rerun:** the Windows Turbo timeout flake (confirm by running the workspace directly; community-service runs 122/122 in 7.6s directly vs 162.8s under turbo) and the `feed-dibs` privacy timestamp flake (digit regex false-fires on ms timestamps ~2/1000).
- **Docker is unavailable locally.** `integration/` tiers cannot pass here and ride CI. Never count a red `integration/` run as a regression.
- **Shell:** commands below are written for the **Bash tool** (Git Bash), which is what the executing agent runs. This is a deliberate deviation from Critical Note 17 (PowerShell); PR 1's PowerShell helper needed `-ExecutionPolicy Bypass` per invocation because each tool call is a fresh shell. Every verification step below prints `exit=$?` **immediately** after the native command — a pipeline's exit status is not the command's, and `| tail` masks failures.

---

## Baseline — the honest state, measured 2026-07-30

Recorded here so any later change is unambiguously attributable. All measured on branch `deps/sprint-122-pr2-test-truth` at `35ac7ae9`, code-identical to `origin/master`.

**Turbo `test` input hashing — the defect is monorepo-wide, not two workspaces.** `turbo.json:16` declares `"test/**"` (**singular**) while every workspace stores tests in `tests/` (**plural**). Measured with `npx turbo run test --dry=json`:

| Task | Hashed inputs | What that means |
|---|---|---|
| `karmyq-auth-service#test` | 15 — `package.json` + 14 × `src/**/*.ts` | **Zero test files.** Editing a test replays a cached pass. |
| `@karmyq/mobile#test` | **1** — `package.json` only | |
| `@karmyq/tests#test` | **1** — `package.json` only | |
| `geocoding-service#test` | **1** — `package.json` only | **Third one-input task**; Critical Note 9 named only mobile and tests. |
| every other `#test` | `src/**` + `package.json` only | No `jest.config.js`, no `jest.setup`, no `tsconfig` |

**Test files on disk (tracked), per workspace:** frontend 114 · tests 84 · request 54 · social-graph 30 · community 15 · simulation 14 · shared 11 · auth 10 · reputation 10 · landing 5 · cleanup 5 · notification 2 · geocoding 2 · **mobile 1** · **messaging 0**.

**`apps/mobile`** — `jest.config.js:10` sets `passWithNoTests: true` under the comment "until we write mobile tests", but `apps/mobile/tests/regression/notification-handler.test.ts` exists and **passes 2/2 in 0.774s**. The comment is false and the flag now masks a real regression tier.

**`apps/landing/tests/tdd/sprint-99-network-visualization.test.ts` is PASSING** (verified: landing runs 5 suites / 61 tests, all green) and has sat un-promoted in `tdd/` — the exact fingerprint of the `promote-tdd-tests.js` `APPS_DIR` bug. This is the proof-of-fix for Task 4.

**Lint print-config — all four linted workspaces are green today**, so the Task 6 gate lands green and only catches future breakage:

| Workspace | Probe | exit | bytes | rules |
|---|---|---|---|---|
| `apps/frontend` | `src/pages/dashboard.tsx` | 0 | 45014 | 112 |
| `apps/landing` | `src/app/page.tsx` | 0 | 45014 | 112 |
| `apps/mobile` | `app/_layout.tsx` | 0 | 63539 | 442 |
| `services/cleanup-service` | `src/index.ts` | 0 | 6118 | 89 |

**Versions:** `package.json` `11.36.0`; `package-lock.json` `.version` and `.packages[""].version` both `11.36.0` — **no drift** (PR 1 repaired it). `semver@7.8.5` is present in the tree but **declared by nothing in this repo**.

**`apps/mobile` Expo alignment:** `expo ~57.0.0`; all 13 `expo-*` and `@expo/metro-runtime` are `~57.0.x`; **`@expo/vector-icons` is `^15.0.2`** — independently versioned and a legitimate exception. No dependency is declared `"*"`.

**Stray root `mobile/`:** 12 tracked files, `name: karmyq-mobile`, `expo ~50.0.0` / `react-native 0.73.0` / `react 18.2.0`. Not an npm workspace (workspaces are `apps/*`, `services/*`, `packages/*`, `tests`), so nothing installs, audits, builds, lints or tests it. Unreferenced outside `docs/archive/**` and `actions-runner/_work/**` (a checkout copy, not source).

---

## Two maintainer decisions taken 2026-07-30

| # | Decision | Answer |
|---|---|---|
| **D-4** | Should CI type-check `apps/mobile`? Its `tsc --noEmit` is 0 errors for the first time; `ci.yml:66-68` enumerates only `packages/shared`, `auth-service`, `community-service`. | **YES — add it as a blocking gate** (Task 8). Overrides the standing "don't chase mobile green as a gate." |
| **D-5** | Delete the stray root-level `mobile/` scaffold? | **YES — delete it in PR 2** (Task 9). |

---

## Design refinement — why this plan does NOT bulk-delete `--passWithNoTests`

The Plan of Record outline said "remove `passWithNoTests: true` and its now-false comment" for `apps/mobile`. That stands (Task 5). But recon found `--passWithNoTests` on `test:unit` / `test:regression` / `test:tdd` in **8 services plus `apps/frontend` and `tests`**, generated by `scripts/add-tdd-scripts.js:17-19` and **explicitly justified in ADR-029** ("Empty directories initially — `unit/` and `regression/` may be empty for some services. Requires `--passWithNoTests`").

Bulk-deleting the flag would fight an Accepted ADR across 10 workspaces to fix a hazard the flag is not actually the cause of. `--passWithNoTests` only changes behavior when **zero** tests match; the real hazard is a tier that **has files on disk** whose jest invocation matches **none of them** (testMatch drift, a moved directory, a broken `testPathPattern`) and therefore reports green.

**So the gate asserts the stronger, source-level invariant instead: every test file in a workspace's `unit/` and `regression/` directories must appear in what that workspace's `test` script actually tells jest to run.** That catches the real failure mode, costs nothing to keep, and leaves ADR-029's documented decision intact. ADR-088 records this reasoning.

**The invariant is deliberately tier-agnostic**, because the repo has two legitimate layouts and an earlier draft of this gate mistook the second one for a defect:

| Layout | Workspaces | `test` script |
|---|---|---|
| Tiered scripts | auth, community, request, reputation, notification, social-graph, geocoding, `apps/frontend`, `tests` | `npm run test:unit && npm run test:regression` |
| Bare jest (runs every tier) | cleanup, simulation, `apps/landing`, `apps/mobile` | `jest` / `jest --passWithNoTests` |

Measured 2026-07-30, the bare-jest four have **19 unit+regression files between them and no `test:unit`/`test:regression` scripts at all** (cleanup 3+2, simulation 3+11, landing 0+3, mobile 0+1). Their tests do run — bare `jest` runs everything. A rule of the form "no tier script means the tier must be empty" would fail four correct workspaces, so the gate resolves the `test` script (expanding `npm run X && npm run Y` one level) and asserts **coverage**, not equality: extra files listed are fine, missing ones are not.

---

## File Structure

**Created**

| Path | Responsibility |
|---|---|
| `tests/tdd/sprint-122-turbo-test-inputs.test.ts` → promoted to `regression/` | Proves every `#test` task hashes its own test sources and jest config |
| `tests/tdd/sprint-122-tier-parity.test.ts` → promoted to `regression/` | Proves `npm test` covers every `unit/` + `regression/` file on disk, in both layouts |
| `tests/tdd/sprint-122-lint-config-gate.test.ts` → promoted to `regression/` | Proves every flat ESLint config loads and yields a non-trivial rule set |
| `tests/tdd/sprint-122-expo-sdk-alignment.test.ts` → promoted to `regression/` | Proves `apps/mobile` stays pinned to its SDK major, with no `"*"` ranges |
| `tests/unit/promote-tdd-targets.test.ts` | Unit-tests the promoter's workspace walk (pure, no subprocess) |
| `docs/adr/ADR-088-test-tier-truthfulness.md` | The decision record |
| `docs/guides/testing-guide.md` | Human-facing tier + cache guide |

**Modified**

| Path | Change |
|---|---|
| `turbo.json:16` | `test.inputs` → `["$TURBO_DEFAULT$"]` |
| `scripts/promote-tdd-tests.js` | Extract `collectTddTargets()`; walk `APPS_DIR` as well as `SERVICES_DIR`; guard CLI under `require.main === module` |
| `apps/mobile/jest.config.js:9-10` | Drop `passWithNoTests: true` and the false comment |
| `tests/package.json` | Declare `semver` + `@types/semver` (used by the Expo gate) |
| `package.json`, `package-lock.json` | `11.36.0` → `11.37.0` (three sites) |
| `.github/workflows/ci.yml:66-68` | Add `apps/mobile` to the blocking type-check list (**D-4**) |
| `scripts/generate-docs.ts` (`ADR_GROUPS`, Infrastructure block ~line 528) | Add `adr-088-test-tier-truthfulness` |
| `docs/adr/README.md` | Index entry for ADR-088 |
| `apps/CLAUDE.md`, `apps/frontend/CLAUDE.md` | "Next.js 14" → "Next.js 15" (stale; PR 1 fixed only root CLAUDE.md) |
| `docs/BUGS.md` | Log discoveries; do not fix them here |
| `.claude/handoff/CURRENT_HANDOFF.md` | PR 2 status |

**Deleted**

| Path | Reason |
|---|---|
| `mobile/` (12 tracked files) | Dead pre-`apps/mobile` Expo SDK 50 scaffold (**D-5**) |

**Regenerated** (`git add -f`): `apps/landing/src/data/docs/**` — adds `concepts/adr-088-*.json` and repairs the stale `concepts/adr-059-dependency-security-gate.json` (its `content` is 7190 chars vs the source `.md`'s 8204; it is missing the ADR's "2026-07-21 advisory refresh" section entirely).

---

## Task 1: Baseline capture (no commit)

**Files:** none modified — this task only records evidence.

**Interfaces:**
- Consumes: nothing.
- Produces: the numbers every later task's verification is compared against. Write them into the execution log in `CURRENT_HANDOFF.md` at the end of the PR, not now.

- [ ] **Step 1: Confirm the branch and that no code has changed yet**

```bash
cd /c/Users/ravic/development/karmyq
git fetch origin
git branch --show-current; echo "exit=$?"
git diff --stat origin/master -- ':!*.md' ':!.claude'; echo "exit=$?"
```

Expected: branch is `deps/sprint-122-pr2-test-truth`; the diff prints **nothing** (docs-only delta so far).

- [ ] **Step 2: Record the turbo input-hashing baseline**

```bash
npx turbo run test --dry=json > /tmp/turbo-before.json; echo "exit=$?"
node -e "
const j=require('/tmp/turbo-before.json');
for(const t of j.tasks.filter(t=>t.taskId.endsWith('#test')))
  console.log(String(Object.keys(t.inputs||{}).length).padStart(4), t.taskId);
"
```

Expected: `@karmyq/mobile#test`, `@karmyq/tests#test` and `geocoding-service#test` each report **1**; no `#test` task lists any path under `tests/`.

- [ ] **Step 3: Record the blocking tier per workspace**

Run each workspace directly — **not** through Turbo. For the tiered workspaces:

```bash
for w in services/auth-service services/community-service services/request-service \
         services/reputation-service services/notification-service \
         services/social-graph-service services/cleanup-service \
         services/geocoding-service apps/frontend packages/shared; do
  echo "=== $w ==="
  ( cd "$w" && npx jest --testPathPattern='(unit|regression)/' 2>&1 | tail -6 )
done
```

For the untiered ones (`apps/mobile`, `apps/landing`, `services/simulation-service`) run bare `npx jest`. For `tests`:

```bash
( cd tests && npx jest --testPathPattern='(unit|regression)/' 2>&1 | tail -6 )
```

Expected, from PR 1's Task 1 table: every blocking tier green. `apps/mobile` 2/2. `apps/landing` 61/61 across 5 suites. Anything red here is **pre-existing** — log it in Task 11, do not fix it.

- [ ] **Step 4: Record the four lint print-config probes**

```bash
probe() {
  ( cd "$2" && npx eslint --print-config "$3" > "/tmp/lint-$1.json" 2>"/tmp/lint-$1.err" )
  echo "$1 exit=$? rules=$(node -e "
    const fs=require('fs');
    try{console.log(Object.keys(JSON.parse(fs.readFileSync(process.argv[1],'utf8')).rules||{}).length)}
    catch(e){console.log('PARSEFAIL')}" "/tmp/lint-$1.json")"
}
probe frontend apps/frontend src/pages/dashboard.tsx
probe landing  apps/landing  src/app/page.tsx
probe mobile   apps/mobile   app/_layout.tsx
probe cleanup  services/cleanup-service src/index.ts
```

Expected: `exit=0` for all four; rules `112 / 112 / 442 / 89`.

- [ ] **Step 5: Confirm mobile type-checks clean (D-4's premise)**

```bash
( cd apps/mobile && npx tsc --noEmit ); echo "exit=$?"
```

Expected: `exit=0`, no output. **If this is non-zero, stop and report** — D-4 assumed 0 errors, and adding a red blocking gate to CI is not acceptable.

- [ ] **Step 6: No commit.** This task produces evidence only.

---

## Task 2: Version 11.37.0 + declare `semver` in the tests workspace

Both lockfile-touching changes land in **one** resolution, per Critical Note 15. The Expo gate (Task 7) imports `semver`, and CLAUDE.md's standing rule is **every workspace declares every package it imports** — `semver@7.8.5` is currently in the tree by hoisting alone, declared by nothing.

**Files:**
- Modify: `package.json` (`.version`)
- Modify: `tests/package.json` (`devDependencies`)
- Modify: `package-lock.json` (regenerated in place)

**Interfaces:**
- Consumes: nothing.
- Produces: `semver` importable from `tests/` as `import semver from 'semver'` with types; version `11.37.0` asserted at three sites.

- [ ] **Step 1: Bump the root version**

Edit `package.json`: `"version": "11.36.0"` → `"version": "11.37.0"`.

- [ ] **Step 2: Declare `semver` and `@types/semver` in the tests workspace**

Edit `tests/package.json` `devDependencies`, keeping the existing alphabetical placement (between `playwright` and `ts-jest`):

```json
    "playwright": "^1.40.0",
    "semver": "^7.8.5",
    "ts-jest": "^29.4.5",
```

and add to the same block, in alphabetical position among the `@types/*` entries (after `@types/pg`):

```json
    "@types/semver": "^7.7.1",
```

- [ ] **Step 3: Resolve the lockfile in place, then materialize it**

Never a scratch regen on Windows; never `npm dedupe`. `--package-lock-only` installs **nothing** (Critical Note 18), so `npm ci` must follow.

```bash
npm install --package-lock-only; echo "exit=$?"
npm ci; echo "exit=$?"
```

- [ ] **Step 4: Assert all three version sites and that semver resolves**

```bash
node -e "
const p=require('./package.json'), l=require('./package-lock.json');
const v='11.37.0';
const sites={manifest:p.version, lockRoot:l.version, lockPkgs:l.packages[''].version};
console.log(JSON.stringify(sites));
const bad=Object.entries(sites).filter(([,x])=>x!==v);
if(bad.length) throw new Error('version drift: '+JSON.stringify(bad));
if(!l.packages['tests'].devDependencies.semver) throw new Error('semver not in lock for tests');
console.log('OK');
"; echo "exit=$?"
( cd tests && node -e "console.log(require('semver').valid('1.2.3'))" ); echo "exit=$?"
```

Expected: `{"manifest":"11.37.0","lockRoot":"11.37.0","lockPkgs":"11.37.0"}`, `OK`, then `1.2.3`, both `exit=0`.

- [ ] **Step 5: Verify no half-resolution (only `npm ci` catches it)**

```bash
npm ci --dry-run 2>&1 | tail -5; echo "exit=$?"
git diff --stat origin/master -- package-lock.json; echo "exit=$?"
```

Expected: `npm ci --dry-run` clean; the lock diff is small and confined to the version fields plus the `semver`/`@types/semver` entries.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tests/package.json
git commit -m "chore: v11.37.0 and declare semver in the tests workspace

semver is used by the Expo SDK alignment gate. It was already present in the
tree by hoisting alone with no workspace declaring it, which the standing
'declare what you import' rule forbids.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: Make turbo's `test` cache key honest

`turbo.json:16` reads `"test/**"` — **singular** — and no workspace has a `test/` directory. Every workspace uses `tests/`. The consequence is that no `#test` task in the monorepo hashes a single test file, a jest config, or a jest setup file.

`$TURBO_DEFAULT$` restores Turbo's real default (every non-gitignored file in the package) and is composable with extra globs. Using it **alone** is correct here: the whole point is that the task's inputs should be "the package", not a hand-maintained list that has already drifted once. `dist/`, `coverage/` and `.next/` are gitignored and therefore still excluded.

**Files:**
- Create: `tests/tdd/sprint-122-turbo-test-inputs.test.ts` (promoted to `tests/regression/` in step 6)
- Modify: `turbo.json:13-17`

**Interfaces:**
- Consumes: `semver` is **not** needed here.
- Produces: nothing importable. Later tasks rely only on the corrected `turbo.json`.

- [ ] **Step 1: Write the failing test**

Create `tests/tdd/sprint-122-turbo-test-inputs.test.ts`:

```typescript
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Sprint 122 PR 2 — turbo `test` cache-key truthfulness (ADR-088).
 *
 * turbo.json declared `test/**` (singular) while every workspace stores tests
 * in `tests/` (plural). Measured on 2026-07-30, NO `#test` task in the
 * monorepo hashed a single test file: karmyq-auth-service#test hashed 15
 * inputs, all `src/**` plus package.json, and mobile / tests / geocoding
 * hashed exactly one file each (package.json). Editing a test therefore
 * replayed a cached pass.
 *
 * This gate asserts the inputs are real. It shells out to turbo deliberately:
 * asserting on turbo.json's text would only prove the config was edited, not
 * that Turbo hashes what we think it hashes.
 */
const ROOT = join(__dirname, '..', '..');

type DryRun = { tasks: Array<{ taskId: string; inputs: Record<string, string> }> };

let dry: DryRun;

beforeAll(() => {
  const raw = execSync('npx turbo run test --dry=json', {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  dry = JSON.parse(raw);
}, 180_000);

const inputsOf = (taskId: string): string[] => {
  const task = dry.tasks.find((t) => t.taskId === taskId);
  if (!task) throw new Error(`no such turbo task: ${taskId} (have: ${dry.tasks.map((t) => t.taskId).join(', ')})`);
  return Object.keys(task.inputs || {});
};

describe('turbo test-task inputs are honest', () => {
  it('the three tasks that hashed exactly one file now hash their real sources', () => {
    // Regression floor: each of these hashed ONLY package.json on 2026-07-30.
    for (const taskId of ['@karmyq/mobile#test', '@karmyq/tests#test', 'geocoding-service#test']) {
      const inputs = inputsOf(taskId);
      expect(inputs.length).toBeGreaterThan(1);
      expect(inputs).toContain('package.json');
    }
  });

  it('every test task hashes at least one file under its tests/ directory', () => {
    const testTasks = dry.tasks.filter((t) => t.taskId.endsWith('#test'));
    expect(testTasks.length).toBeGreaterThan(10); // 15 workspaces declare a test task

    const blind = testTasks
      .filter((t) => {
        // messaging-service declares no test script and has zero test files —
        // a real gap, logged as a bug, but not a cache-key lie.
        if (t.taskId.includes('messaging-service')) return false;
        return !Object.keys(t.inputs || {}).some((p) => p.startsWith('tests/'));
      })
      .map((t) => t.taskId);

    expect(blind).toEqual([]);
  });

  it('a workspace jest config is part of its own test cache key', () => {
    const withConfig: Array<[string, string]> = [
      ['karmyq-auth-service', 'services/auth-service'],
      ['@karmyq/mobile', 'apps/mobile'],
      ['@karmyq/tests', 'tests'],
      ['karmyq-frontend', 'apps/frontend'],
    ];

    for (const [taskName, dir] of withConfig) {
      expect(existsSync(join(ROOT, dir, 'jest.config.js'))).toBe(true);
      expect(inputsOf(`${taskName}#test`)).toContain('jest.config.js');
    }
  });

  it('turbo.json does not reinstate a hand-maintained input list for test', () => {
    const turbo = JSON.parse(readFileSync(join(ROOT, 'turbo.json'), 'utf8'));
    expect(turbo.tasks.test.inputs).toEqual(['$TURBO_DEFAULT$']);
  });
});
```

- [ ] **Step 2: Run it and verify it fails for the right reason**

```bash
( cd tests && npx jest tdd/sprint-122-turbo-test-inputs --testTimeout=180000 ) 2>&1 | tail -30; echo "exit=$?"
```

Expected: FAIL. The first test fails with `Expected: > 1, Received: 1`; the second lists ~15 blind task ids; the fourth reports the current four-glob array. This is the non-vacuity proof — **do not skip it.**

- [ ] **Step 3: Fix `turbo.json`**

Replace the `test` task block:

```json
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"],
      "inputs": ["$TURBO_DEFAULT$"]
    },
```

- [ ] **Step 4: Run it again and verify it passes**

```bash
( cd tests && npx jest tdd/sprint-122-turbo-test-inputs --testTimeout=180000 ) 2>&1 | tail -20; echo "exit=$?"
```

Expected: PASS, 4/4, `exit=0`.

- [ ] **Step 5: Confirm the cache keys actually moved**

```bash
npx turbo run test --dry=json > /tmp/turbo-after.json; echo "exit=$?"
node -e "
const b=require('/tmp/turbo-before.json'), a=require('/tmp/turbo-after.json');
const B=Object.fromEntries(b.tasks.map(t=>[t.taskId,Object.keys(t.inputs||{}).length]));
for(const t of a.tasks.filter(t=>t.taskId.endsWith('#test')))
  console.log(t.taskId.padEnd(38), (B[t.taskId]??'-')+' -> '+Object.keys(t.inputs||{}).length);
"
```

Expected: every `#test` count rises; the three one-input tasks rise sharply.

- [ ] **Step 6: Promote and commit**

The gate is green, so it belongs in `regression/`. `scripts/promote-tdd-tests.js` does not walk the `tests` workspace even after Task 4 (it walks `services/` and `apps/`), so move this one by hand — Critical Note 20.

```bash
git mv tests/tdd/sprint-122-turbo-test-inputs.test.ts tests/regression/sprint-122-turbo-test-inputs.test.ts
( cd tests && npx jest regression/sprint-122-turbo-test-inputs --testTimeout=180000 ) 2>&1 | tail -8; echo "exit=$?"
git add turbo.json tests/regression/sprint-122-turbo-test-inputs.test.ts
git commit -m "fix(turbo): hash real test sources in the test cache key

turbo.json declared test/** (singular); every workspace uses tests/ (plural),
so no #test task hashed any test file, jest config or setup file. Editing a
test replayed a cached pass across the whole monorepo.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: Make the TDD promoter walk `apps/`

`scripts/promote-tdd-tests.js:18` declares `APPS_DIR` and never reads it — only `SERVICES_DIR` at lines 63, 65, 73 and 75. `apps/landing/tests/tdd/sprint-99-network-visualization.test.ts` is **passing today** and has never been promoted, which is the bug made visible.

Root `package.json` has `"posttest": "node scripts/promote-tdd-tests.js"`, so this script runs on every `npm test`. That makes its walk part of the blocking path: an `apps/*` tdd test that goes green stays in `tdd/` forever, and `apps/mobile` and `apps/landing` both run **all** tiers (bare `jest`), so a red `apps/*` tdd test blocks pushes with no promotion path out.

**Files:**
- Modify: `scripts/promote-tdd-tests.js`
- Create: `tests/unit/promote-tdd-targets.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `scripts/promote-tdd-tests.js` gains a named export
  `collectTddTargets(roots?: string[]): Array<{ workspace: string; dir: string; tddDir: string }>`
  where `workspace` is the display label (e.g. `apps/landing`), `dir` is the absolute workspace path passed to jest as `cwd`, and `tddDir` is the absolute `tests/tdd` path. It returns targets **only** for workspaces that actually have a `tests/tdd` directory. The CLI entry point stays behavior-identical.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/promote-tdd-targets.test.ts`. This is a pure function test — no jest subprocesses, so it is fast and deterministic.

```typescript
import { existsSync } from 'fs';
import { join } from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { collectTddTargets } = require('../../scripts/promote-tdd-tests.js');

/**
 * Sprint 122 PR 2 — the TDD promoter must walk apps/, not just services/ (ADR-088).
 *
 * scripts/promote-tdd-tests.js declared APPS_DIR at line 18 and never read it.
 * Root package.json runs this script as `posttest`, so an apps/* tdd test that
 * goes green was never promoted, and apps/mobile + apps/landing run every tier
 * on bare `jest` — meaning a red apps/* tdd test blocked pushes with no way out.
 */
const ROOT = join(__dirname, '..', '..');

describe('collectTddTargets', () => {
  const targets = collectTddTargets();
  const workspaces = targets.map((t: { workspace: string }) => t.workspace);

  it('includes apps/ workspaces that have a tests/tdd directory', () => {
    expect(existsSync(join(ROOT, 'apps', 'landing', 'tests', 'tdd'))).toBe(true);
    expect(workspaces).toContain('apps/landing');
  });

  it('still includes services/ workspaces that have a tests/tdd directory', () => {
    expect(existsSync(join(ROOT, 'services', 'request-service', 'tests', 'tdd'))).toBe(true);
    expect(workspaces).toContain('services/request-service');
  });

  it('never returns a workspace whose tests/tdd directory does not exist', () => {
    const phantom = targets.filter((t: { tddDir: string }) => !existsSync(t.tddDir));
    expect(phantom).toEqual([]);
  });

  it('returns each workspace exactly once', () => {
    expect(workspaces.length).toBe(new Set(workspaces).size);
  });

  it('points cwd at the workspace root, not the tdd directory', () => {
    for (const t of targets as Array<{ dir: string; tddDir: string }>) {
      expect(t.tddDir).toBe(join(t.dir, 'tests', 'tdd'));
      expect(existsSync(join(t.dir, 'package.json'))).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

```bash
( cd tests && npx jest unit/promote-tdd-targets ) 2>&1 | tail -20; echo "exit=$?"
```

Expected: FAIL — `collectTddTargets is not a function` (the script exports nothing and executes `promoteTddTests()` at import time).

- [ ] **Step 3: Refactor the script**

Replace lines 56-101 of `scripts/promote-tdd-tests.js` with:

```javascript
/**
 * Every workspace root that can hold a tests/tdd directory.
 * APPS_DIR was declared and never walked until Sprint 122 PR 2, so an
 * apps/* tdd test could never be promoted (see ADR-088).
 */
function collectTddTargets(roots = [SERVICES_DIR, APPS_DIR]) {
  const targets = [];

  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const label = path.basename(root);

    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === 'node_modules') continue;

      const dir = path.join(root, entry.name);
      const tddDir = path.join(dir, 'tests', 'tdd');
      if (!fs.existsSync(tddDir)) continue;

      targets.push({ workspace: `${label}/${entry.name}`, dir, tddDir });
    }
  }

  return targets;
}

function promoteTddTests() {
  console.log('🔄 Checking TDD tests for auto-promotion...\n');

  let promoted = 0;
  let failed = 0;

  for (const { workspace, dir, tddDir } of collectTddTargets()) {
    for (const testFile of findTestFiles(tddDir)) {
      const testName = path.basename(testFile);
      console.log(`  Testing: ${workspace}/tests/tdd/${testName}`);

      if (runTestFile(testFile, dir)) {
        const regressionDir = path.join(dir, 'tests', 'regression');
        fs.mkdirSync(regressionDir, { recursive: true });
        fs.renameSync(testFile, path.join(regressionDir, testName));

        console.log(`    ✅ PROMOTED to regression/${testName}\n`);
        promoted++;
      } else {
        console.log(`    ⏸️  Still failing, keeping in tdd/\n`);
        failed++;
      }
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Promoted: ${promoted}`);
  console.log(`⏸️  Still in TDD: ${failed}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (promoted > 0) {
    console.log('🎉 Tests promoted! Remember to commit the changes.\n');
  }
}

module.exports = { collectTddTargets, promoteTddTests };

if (require.main === module) {
  promoteTddTests();
}
```

Also extend the header comment's usage block to mention that the script now covers `services/*` **and** `apps/*`.

- [ ] **Step 4: Run the test and verify it passes**

```bash
( cd tests && npx jest unit/promote-tdd-targets ) 2>&1 | tail -15; echo "exit=$?"
```

Expected: PASS, 5/5, `exit=0`.

- [ ] **Step 5: Prove the fix end-to-end by running the promoter**

`apps/landing/tests/tdd/sprint-99-network-visualization.test.ts` passes and must now actually move.

```bash
node scripts/promote-tdd-tests.js 2>&1 | tail -40; echo "exit=$?"
git status --short apps/ services/
```

Expected: the output includes `Testing: apps/landing/tests/tdd/sprint-99-network-visualization.test.ts` followed by `✅ PROMOTED`, and `git status` shows the rename into `apps/landing/tests/regression/`.

**If other `apps/*` or `services/*` tdd tests also promote, that is correct behavior** — they were passing and un-promoted. Re-run the affected workspace's blocking tier afterwards to confirm the newly-promoted files pass in the `regression/` tier too:

```bash
( cd apps/landing && npx jest ) 2>&1 | tail -8; echo "exit=$?"
```

If a promoted test turns out to be red in its new tier, move it **back** to `tdd/` and log it in Task 11 — never leave a red file in `regression/`.

- [ ] **Step 6: Commit**

```bash
git add scripts/promote-tdd-tests.js tests/unit/promote-tdd-targets.test.ts apps/ services/
git commit -m "fix(tdd): promote tdd tests from apps/ as well as services/

APPS_DIR was declared and never walked, so a passing apps/* tdd test could
never graduate. apps/landing's sprint-99 test had been green and stuck.
Extracted collectTddTargets() so the walk is unit-testable without spawning
jest.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: Tier parity — prove each tier ran the files on disk

`apps/mobile/jest.config.js:9-10` carries `passWithNoTests: true` under the comment "Pass when no tests are found (until we write mobile tests)". A mobile test exists and passes, so the comment is false and the flag now hides a real regression tier.

Rather than bulk-deleting the flag everywhere (see **Design refinement** above — ADR-029 justifies it for legitimately-empty tiers), this task removes it where it is provably false and installs the stronger invariant: **jest must list exactly the test files that exist on disk, per workspace and per tier.**

**Files:**
- Create: `tests/tdd/sprint-122-tier-parity.test.ts` (promoted to `regression/`)
- Modify: `apps/mobile/jest.config.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: nothing importable.

- [ ] **Step 1: Write the failing test**

Create `tests/tdd/sprint-122-tier-parity.test.ts`:

```typescript
import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

/**
 * Sprint 122 PR 2 — tier coverage (ADR-088).
 *
 * `--passWithNoTests` is not itself the defect: it only changes behavior when
 * ZERO tests match, and ADR-029 justifies it for tiers that are legitimately
 * empty. The real hazard is a blocking tier that HAS files on disk which its
 * jest invocation never matches — a moved directory, a drifted testMatch, a
 * broken testPathPattern — reporting green while running nothing.
 *
 * The invariant is therefore COVERAGE, not equality, and it is tier-agnostic:
 * every file in a workspace's unit/ and regression/ directories must appear in
 * what its `test` script actually tells jest to run. Extra files listed (a bare
 * `jest` also picking up tdd/ and integration/) are fine.
 *
 * Two layouts are both legitimate and both must pass:
 *   - tiered scripts:  "test": "npm run test:unit && npm run test:regression"
 *   - bare jest:       "test": "jest"   (cleanup, simulation, landing, mobile)
 */
const ROOT = join(__dirname, '..', '..');

const TIERS = ['unit', 'regression'] as const;

/**
 * Tier directories live at <ws>/tests/<tier> everywhere EXCEPT the `tests`
 * workspace itself, where they are <ws>/<tier>. Getting this wrong makes the
 * gate silently vacuous on the repo's largest suite, so resolve both.
 */
function tierDir(wsDir: string, tier: string): string | null {
  for (const candidate of [join(wsDir, 'tests', tier), join(wsDir, tier)]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function workspacesWithTiers(): Array<{ ws: string; dir: string }> {
  const out: Array<{ ws: string; dir: string }> = [];
  for (const root of ['services', 'apps', 'packages']) {
    const rootDir = join(ROOT, root);
    if (!existsSync(rootDir)) continue;
    for (const name of readdirSync(rootDir)) {
      if (name === 'node_modules') continue;
      const dir = join(rootDir, name);
      if (!statSync(dir).isDirectory()) continue;
      if (!existsSync(join(dir, 'package.json'))) continue;
      if (TIERS.some((t) => tierDir(dir, t))) out.push({ ws: `${root}/${name}`, dir });
    }
  }
  const testsDir = join(ROOT, 'tests');
  if (TIERS.some((t) => tierDir(testsDir, t))) out.push({ ws: 'tests', dir: testsDir });
  return out;
}

function testFilesUnder(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') found.push(...testFilesUnder(full));
    } else if (/\.(test|spec)\.[jt]sx?$/.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

/**
 * Expand a workspace's `test` script into the jest argument strings it runs.
 * Handles `npm run X && npm run Y` one level deep, which is the only
 * composition shape this repo uses.
 */
function jestInvocations(pkg: { scripts?: Record<string, string> }): string[] {
  const scripts = pkg.scripts || {};
  const top = scripts.test;
  if (!top) return [];

  const args: string[] = [];
  for (const part of top.split('&&').map((s) => s.trim())) {
    const viaNpm = part.match(/^npm run (\S+)/);
    const resolved = viaNpm ? scripts[viaNpm[1]] : part;
    if (!resolved) throw new Error(`test script references missing script: ${part}`);
    const jest = resolved.match(/^jest\b\s*(.*)$/);
    if (jest) args.push(jest[1]);
  }
  return args;
}

/** Ask jest itself which files a given invocation would run. */
function listed(wsDir: string, jestArgs: string): string[] {
  const out = execSync(`npx jest ${jestArgs} --listTests`, {
    cwd: wsDir,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /\.(test|spec)\.[jt]sx?$/.test(l));
}

const norm = (p: string) => relative(ROOT, p).split(sep).join('/');

describe('tier coverage: npm test runs every blocking test on disk', () => {
  const workspaces = workspacesWithTiers();

  it('finds every workspace that has a unit/ or regression/ directory', () => {
    const names = workspaces.map((w) => w.ws).sort();
    expect(names).toEqual([
      'apps/frontend',
      'apps/landing',
      'apps/mobile',
      'services/auth-service',
      'services/cleanup-service',
      'services/community-service',
      'services/geocoding-service',
      'services/messaging-service',
      'services/notification-service',
      'services/reputation-service',
      'services/request-service',
      'services/simulation-service',
      'services/social-graph-service',
      'tests',
    ]);
  });

  it.each(workspacesWithTiers())('$ws runs every unit/ and regression/ file it has', ({ ws, dir }) => {
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));

    const onDisk = TIERS.flatMap((t) => {
      const d = tierDir(dir, t);
      return d ? testFilesUnder(d) : [];
    }).map(norm);

    const invocations = jestInvocations(pkg);

    if (invocations.length === 0) {
      // No jest invocation at all is acceptable ONLY with nothing to run.
      // services/messaging-service is the sole such workspace (0 test files) —
      // a real gap, logged in docs/BUGS.md, but not a cache-key or tier lie.
      expect({ ws, uncovered: onDisk }).toEqual({ ws, uncovered: [] });
      return;
    }

    const seen = new Set(invocations.flatMap((args) => listed(dir, args)).map(norm));
    const uncovered = onDisk.filter((f) => !seen.has(f));

    expect({ ws, uncovered }).toEqual({ ws, uncovered: [] });
  }, 300_000);

  it('apps/mobile does not claim it has no tests', () => {
    const mobile = join(ROOT, 'apps', 'mobile');
    const cfg = readFileSync(join(mobile, 'jest.config.js'), 'utf8');
    expect(testFilesUnder(join(mobile, 'tests')).length).toBeGreaterThan(0);
    expect(cfg).not.toMatch(/passWithNoTests/);
  });
});
```

- [ ] **Step 2: Run it and verify it fails for the right reason**

```bash
( cd tests && npx jest tdd/sprint-122-tier-parity --testTimeout=300000 ) 2>&1 | tail -40; echo "exit=$?"
```

Expected: the **last** test FAILS because `passWithNoTests` is still in `apps/mobile/jest.config.js`. The 14 coverage cases and the enumeration case are expected to **pass** — measured 2026-07-30, every workspace's `test` script does cover its unit+regression files.

**The coverage cases are a discovery surface.** If one fails, the `uncovered` array names the exact files a blocking tier has but never runs. Disposition:
- **One-line scoping fix that is plainly this PR's subject** → fix it here.
- **Anything larger** → log it in Task 11 and add the workspace to an explicit, commented skip list inside the test (`// KNOWN GAP: <ws> — see docs/BUGS.md#<entry>`), so the gate still blocks the other thirteen. Never delete the case.

Do **not** let this become a bug-fixing sprint.

- [ ] **Step 3: Remove the false flag from mobile**

`apps/mobile/jest.config.js` must end up as exactly this — the original file minus the `passWithNoTests` line and its two-line comment. Change nothing else:

```javascript
// Jest configuration for Mobile App
module.exports = {
  testEnvironment: "node",
  setupFilesAfterEnv: [],
  testMatch: [
    "**/__tests__/**/*.test.[jt]s?(x)",
    "**/?(*.)+(spec|test).[jt]s?(x)",
  ],
};
```

- [ ] **Step 4: Run mobile's suite and the gate, and verify both pass**

```bash
( cd apps/mobile && npx jest ) 2>&1 | tail -10; echo "exit=$?"
( cd tests && npx jest tdd/sprint-122-tier-parity --testTimeout=300000 ) 2>&1 | tail -20; echo "exit=$?"
```

Expected: mobile 2/2 passing with `exit=0` (proving the flag was load-bearing for nothing), and the gate green.

- [ ] **Step 5: Promote and commit**

```bash
git mv tests/tdd/sprint-122-tier-parity.test.ts tests/regression/sprint-122-tier-parity.test.ts
( cd tests && npx jest regression/sprint-122-tier-parity --testTimeout=300000 ) 2>&1 | tail -8; echo "exit=$?"
git add apps/mobile/jest.config.js tests/regression/sprint-122-tier-parity.test.ts
git commit -m "test: assert each tier runs the test files it has on disk

apps/mobile set passWithNoTests: true under the comment 'until we write mobile
tests' while a passing regression test existed. The gate asserts the stronger
invariant instead of deleting the flag repo-wide, which would fight ADR-029's
documented justification for legitimately-empty tiers.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: Lint print-config gate

Raised in S121 PR 3's review and deferred. Lint is non-blocking everywhere in CI (`ci.yml:71` ends in `|| echo`), so a flat config that fails to load fails **silently** — the job prints a warning and goes green. This gate separates "the config is broken" from "the code has findings", which matters because there are ~677 outstanding findings and cleaning them up is not a prerequisite for knowing the linter still works.

**Files:**
- Create: `tests/tdd/sprint-122-lint-config-gate.test.ts` (promoted to `regression/`)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing importable.

- [ ] **Step 1: Confirm the sentinel rules exist before asserting on them**

A gate that asserts on a rule name that was never there is vacuous. Verify each sentinel first:

```bash
node -e "
const fs=require('fs');
const checks=[['frontend','@next/next/no-html-link-for-pages'],
              ['landing','@next/next/no-html-link-for-pages'],
              ['mobile','react-hooks/rules-of-hooks'],
              ['cleanup','no-unused-vars']];
for(const [n,rule] of checks){
  const c=JSON.parse(fs.readFileSync('/tmp/lint-'+n+'.json','utf8'));
  console.log(n.padEnd(10), rule.padEnd(40), rule in (c.rules||{}) ? 'PRESENT' : 'MISSING');
}
"
```

If any prints `MISSING`, pick a different sentinel from that config's actual rule set (`node -e "console.log(Object.keys(require('/tmp/lint-<n>.json').rules).join('\n'))"`) and use it in Step 2. Record which sentinel you chose.

- [ ] **Step 2: Write the failing test**

Create `tests/tdd/sprint-122-lint-config-gate.test.ts`. Substitute the sentinels confirmed in Step 1 and the rule-count floors from the Baseline table (use ~80% of the measured count so a legitimate config trim does not false-fail, but a collapsed config does).

```typescript
import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Sprint 122 PR 2 — the flat ESLint configs must actually load (ADR-088).
 *
 * ci.yml runs lint as `npm run lint --if-present || echo "..."`, so a config
 * that throws on load produces a warning and a green job. This gate proves
 * each config resolves to a real rule set, WITHOUT requiring the ~677
 * outstanding lint findings to be cleaned up first: `--print-config` reports
 * the resolved configuration and never inspects code.
 */
const ROOT = join(__dirname, '..', '..');

type Probe = { workspace: string; probeFile: string; minRules: number; sentinel: string };

const PROBES: Probe[] = [
  { workspace: 'apps/frontend', probeFile: 'src/pages/dashboard.tsx', minRules: 90, sentinel: '@next/next/no-html-link-for-pages' },
  { workspace: 'apps/landing', probeFile: 'src/app/page.tsx', minRules: 90, sentinel: '@next/next/no-html-link-for-pages' },
  { workspace: 'apps/mobile', probeFile: 'app/_layout.tsx', minRules: 350, sentinel: 'react-hooks/rules-of-hooks' },
  { workspace: 'services/cleanup-service', probeFile: 'src/index.ts', minRules: 70, sentinel: 'no-unused-vars' },
];

describe('every linted workspace has a loadable flat ESLint config', () => {
  it('covers exactly the workspaces that ship an eslint.config.js', () => {
    // If someone adds a config, they must add a probe — otherwise the new
    // workspace's config is unverified and this gate quietly under-covers.
    const configured = PROBES.map((p) => p.workspace).sort();
    expect(configured).toEqual([
      'apps/frontend',
      'apps/landing',
      'apps/mobile',
      'services/cleanup-service',
    ]);
    for (const p of PROBES) {
      expect(existsSync(join(ROOT, p.workspace, 'eslint.config.js'))).toBe(true);
    }
  });

  it.each(PROBES)('$workspace resolves a real rule set', ({ workspace, probeFile, minRules, sentinel }) => {
    const dir = join(ROOT, workspace);

    // A renamed probe would make --print-config meaningless, so assert it exists.
    expect(existsSync(join(dir, probeFile))).toBe(true);

    const raw = execFileSync('npx', ['eslint', '--print-config', probeFile], {
      cwd: dir,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      shell: process.platform === 'win32',
    });

    const config = JSON.parse(raw);
    const rules = Object.keys(config.rules || {});

    expect(rules.length).toBeGreaterThanOrEqual(minRules);
    expect(rules).toContain(sentinel);
  }, 120_000);
});
```

- [ ] **Step 3: Run it and verify it passes immediately, then prove it is not vacuous**

This gate is green at baseline by design, so a passing run proves nothing on its own. Break a config on purpose and confirm the gate catches it:

```bash
( cd tests && npx jest tdd/sprint-122-lint-config-gate --testTimeout=120000 ) 2>&1 | tail -15; echo "exit=$?"

# Non-vacuity injection: make one config throw on load.
cp apps/mobile/eslint.config.js /tmp/mobile-eslint-backup.js
printf '\nthrow new Error("injected: broken flat config");\n' >> apps/mobile/eslint.config.js
( cd tests && npx jest tdd/sprint-122-lint-config-gate --testTimeout=120000 ) 2>&1 | tail -15; echo "exit=$?  <- MUST be nonzero"

# Restore and re-confirm green.
cp /tmp/mobile-eslint-backup.js apps/mobile/eslint.config.js
git diff --stat apps/mobile/eslint.config.js; echo "exit=$?  (diff must be empty)"
( cd tests && npx jest tdd/sprint-122-lint-config-gate --testTimeout=120000 ) 2>&1 | tail -8; echo "exit=$?"
```

Expected: green → **red with the injection** → green again, and `git diff` on the config is empty after restore. Do not proceed until the injection actually turned it red.

- [ ] **Step 4: Promote and commit**

```bash
git mv tests/tdd/sprint-122-lint-config-gate.test.ts tests/regression/sprint-122-lint-config-gate.test.ts
( cd tests && npx jest regression/sprint-122-lint-config-gate --testTimeout=120000 ) 2>&1 | tail -8; echo "exit=$?"
git add tests/regression/sprint-122-lint-config-gate.test.ts
git commit -m "test: gate that every flat ESLint config actually loads

CI runs lint with '|| echo', so a config that throws on load produces a green
job. --print-config proves the config resolves without requiring the ~677
outstanding findings to be cleaned up first.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: Expo SDK alignment gate

This is the mechanism that would have prevented the drift S121 PR 4 spent a sprint cleaning up, and **PR 3 is about to move three packages away from their SDK pins** — so it lands before PR 3, not after.

**Files:**
- Create: `tests/tdd/sprint-122-expo-sdk-alignment.test.ts` (promoted to `regression/`)

**Interfaces:**
- Consumes: `semver` and `@types/semver`, declared in the `tests` workspace by Task 2.
- Produces: nothing importable.

- [ ] **Step 1: Write the failing test**

Create `tests/tdd/sprint-122-expo-sdk-alignment.test.ts`:

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';
import semver from 'semver';

/**
 * Sprint 122 PR 2 — Expo SDK alignment (ADR-088).
 *
 * S121 PR 4 spent a sprint reconciling apps/mobile against Expo SDK 57 by
 * hand. Nothing detected the drift that made that necessary, and Sprint 122
 * PR 3 is about to propose moving react-native-maps, safe-area-context and
 * react away from their SDK pins. This gate makes the alignment an assertion
 * rather than a review habit.
 */
const ROOT = join(__dirname, '..', '..');

const mobilePkg = JSON.parse(readFileSync(join(ROOT, 'apps', 'mobile', 'package.json'), 'utf8'));
const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8'));

const allDeps: Record<string, string> = {
  ...(mobilePkg.dependencies || {}),
  ...(mobilePkg.devDependencies || {}),
};

/**
 * Packages in the expo family that are versioned independently of the SDK.
 * Each entry needs a reason. An entry that no longer appears in the manifest
 * is itself a failure — stale exemptions are how gates rot.
 */
const INDEPENDENTLY_VERSIONED: Record<string, string> = {
  '@expo/vector-icons': 'Icon set, versioned on its own line (15.x under SDK 57), not with the SDK.',
};

const expoFamily = (name: string) =>
  name === 'expo' || name.startsWith('expo-') || name.startsWith('@expo/');

/** Resolve what npm actually installed for an apps/mobile dependency. */
function installedVersion(name: string): string {
  const nested = lock.packages[`apps/mobile/node_modules/${name}`];
  const hoisted = lock.packages[`node_modules/${name}`];
  const entry = nested || hoisted;
  if (!entry) throw new Error(`${name} is declared by apps/mobile but absent from package-lock.json`);
  return entry.version;
}

describe('apps/mobile stays aligned to its Expo SDK', () => {
  it('declares expo with a concrete range', () => {
    expect(typeof allDeps.expo).toBe('string');
    expect(allDeps.expo).not.toBe('*');
  });

  it('declares no dependency as "*"', () => {
    const wildcards = Object.entries(allDeps)
      .filter(([, range]) => range === '*' || range === 'latest' || range === '')
      .map(([name, range]) => `${name}@${range}`);
    expect(wildcards).toEqual([]);
  });

  it('every expo-family package shares the SDK major', () => {
    const sdkMajor = semver.major(semver.minVersion(allDeps.expo)!);
    expect(sdkMajor).toBeGreaterThanOrEqual(57);

    const misaligned = Object.entries(allDeps)
      .filter(([name]) => expoFamily(name) && !(name in INDEPENDENTLY_VERSIONED))
      .filter(([, range]) => semver.major(semver.minVersion(range)!) !== sdkMajor)
      .map(([name, range]) => `${name}@${range} (expected major ${sdkMajor})`);

    expect(misaligned).toEqual([]);
  });

  it('has no stale exemptions', () => {
    const stale = Object.keys(INDEPENDENTLY_VERSIONED).filter((name) => !(name in allDeps));
    expect(stale).toEqual([]);
  });

  it('the lockfile satisfies every apps/mobile declaration', () => {
    const violations = Object.entries(allDeps)
      .filter(([name, range]) => {
        if (!semver.validRange(range)) return false; // workspace:/file: protocols
        return !semver.satisfies(installedVersion(name), range);
      })
      .map(([name, range]) => `${name}: lock has ${installedVersion(name)}, manifest wants ${range}`);

    expect(violations).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it**

```bash
( cd tests && npx jest tdd/sprint-122-expo-sdk-alignment ) 2>&1 | tail -25; echo "exit=$?"
```

Expected: **PASS 5/5** — the manifest is aligned today (Baseline). If the last case fails, the lockfile genuinely disagrees with the manifest; report it before changing the test.

- [ ] **Step 3: Prove it is not vacuous — three injections**

```bash
cp apps/mobile/package.json /tmp/mobile-pkg-backup.json

inject() {
  node -e "
    const fs=require('fs');
    const p=JSON.parse(fs.readFileSync('apps/mobile/package.json','utf8'));
    $1
    fs.writeFileSync('apps/mobile/package.json', JSON.stringify(p,null,2)+'\n');
  "
  ( cd tests && npx jest tdd/sprint-122-expo-sdk-alignment ) >/dev/null 2>&1
  echo "  injection exit=$?  <- MUST be nonzero"
  cp /tmp/mobile-pkg-backup.json apps/mobile/package.json
}

echo "A: wildcard range";      inject "p.dependencies['expo-font']='*';"
echo "B: off-SDK major";       inject "p.dependencies['expo-camera']='~56.0.0';"
echo "C: stale exemption";     inject "delete p.dependencies['@expo/vector-icons'];"

git diff --stat apps/mobile/package.json; echo "exit=$?  (must be empty)"
( cd tests && npx jest tdd/sprint-122-expo-sdk-alignment ) 2>&1 | tail -8; echo "exit=$?"
```

Expected: all three injections nonzero, the manifest restored byte-identical, and the final run green.

- [ ] **Step 4: Promote and commit**

```bash
git mv tests/tdd/sprint-122-expo-sdk-alignment.test.ts tests/regression/sprint-122-expo-sdk-alignment.test.ts
( cd tests && npx jest regression/sprint-122-expo-sdk-alignment ) 2>&1 | tail -8; echo "exit=$?"
git add tests/regression/sprint-122-expo-sdk-alignment.test.ts
git commit -m "test: gate apps/mobile against Expo SDK drift

Asserts no wildcard ranges, every expo-family package on the SDK major (with
@expo/vector-icons exempted by name and reason), no stale exemptions, and a
lockfile that satisfies the manifest. Lands before PR 3, which proposes moving
three packages off their SDK pins.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 8: CI type-checks `apps/mobile` (D-4)

**Files:**
- Modify: `.github/workflows/ci.yml:66-68`

**Interfaces:** none.

- [ ] **Step 1: Re-confirm the premise**

```bash
( cd apps/mobile && npx tsc --noEmit ); echo "exit=$?"
node -p "require('./apps/mobile/package.json').scripts['type-check']"
```

Expected: `exit=0`, and the script prints `tsc --noEmit`. **If tsc is non-zero, stop** — do not add a red blocking gate.

- [ ] **Step 2: Add mobile to the type-check list**

In `.github/workflows/ci.yml`, extend the block at lines 66-68:

```yaml
          npm run type-check --workspace=packages/shared --if-present
          npm run type-check --workspace=services/auth-service --if-present
          npm run type-check --workspace=services/community-service --if-present
          npm run type-check --workspace=apps/mobile --if-present
```

- [ ] **Step 3: Verify the workflow still parses and the step is blocking**

```bash
node -e "
const fs=require('fs');
const y=fs.readFileSync('.github/workflows/ci.yml','utf8');
const line=y.split('\n').find(l=>l.includes('workspace=apps/mobile'));
if(!line) throw new Error('mobile type-check line missing');
if(/\|\|/.test(line)) throw new Error('mobile type-check must be blocking, found || fallback');
console.log('OK:', line.trim());
"; echo "exit=$?"
```

Expected: `OK: npm run type-check --workspace=apps/mobile --if-present`, `exit=0`. The `|| echo` on line 71 belongs to the **lint** step and must stay untouched.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: type-check apps/mobile as a blocking gate

Maintainer decision D-4 (2026-07-30). Mobile tsc is 0 errors for the first
time after the SDK 57 upgrade, so the gate lands green and locks the cleanup
in. Overrides the standing 'don't chase mobile green as a gate'.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 9: Delete the stray root `mobile/` scaffold (D-5)

**Files:**
- Delete: `mobile/` (12 tracked files)

**Interfaces:** none.

- [ ] **Step 1: Re-confirm it is dead before deleting**

CLAUDE.md's bug-fixing discipline: grep the whole repo for references before any delete.

```bash
git ls-files mobile/ | wc -l; echo "exit=$?"
node -p "const p=require('./mobile/package.json'); p.name+' expo='+p.dependencies.expo+' rn='+p.dependencies['react-native']"
node -p "JSON.stringify(require('./package.json').workspaces)"

grep -rn "mobile/App\|mobile/src\|karmyq-mobile" \
  --include="*.json" --include="*.yml" --include="*.yaml" --include="*.js" \
  --include="*.ts" --include="*.tsx" --include="*.md" --include="Dockerfile*" \
  . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.turbo \
    --exclude-dir=actions-runner --exclude-dir=dist --exclude-dir=.next \
  | grep -v "^./mobile/" | grep -v "^./docs/archive/"
echo "grep-exit=$?  (1 = no matches = safe)"
```

Expected: 12 tracked files; `karmyq-mobile expo=~50.0.0 rn=0.73.0`; workspaces are `["apps/*","services/*","packages/*","tests"]` — `mobile` is not among them; and the grep finds nothing outside `mobile/` itself and `docs/archive/**`. **If anything live references it, stop and report.**

- [ ] **Step 2: Delete**

```bash
git rm -r mobile/; echo "exit=$?"
```

- [ ] **Step 3: Verify nothing broke**

```bash
git status --short | head -20
node -p "JSON.stringify(require('./package.json').workspaces)"
npm ci --dry-run 2>&1 | tail -3; echo "exit=$?"
( cd tests && npx jest regression/ --testTimeout=180000 ) 2>&1 | tail -8; echo "exit=$?"
```

Expected: 12 deletions staged, workspaces unchanged, `npm ci --dry-run` clean (it never resolved `mobile/`), and the `tests` regression tier still green.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: delete the dead root-level mobile/ scaffold

Maintainer decision D-5 (2026-07-30). 12 tracked files from a pre-apps/mobile
Expo SDK 50 / RN 0.73 / React 18 scaffold. Not an npm workspace, so nothing
installed, audited, built, linted or tested it — a security-audit blind spot
and a grep hazard. Unreferenced outside docs/archive/.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 10: ADR-088 and the documentation the sprint owes

CLAUDE.md's docs feedback loop is mandatory, and Sprint 122's "Docs Owed" list assigns ADR-088 and the stale `adr-059` landing artifact to this PR.

**Files:**
- Create: `docs/adr/ADR-088-test-tier-truthfulness.md`
- Create: `docs/guides/testing-guide.md`
- Modify: `docs/adr/README.md`
- Modify: `scripts/generate-docs.ts` (`ADR_GROUPS`, Infrastructure block)
- Modify: `apps/CLAUDE.md`, `apps/frontend/CLAUDE.md`
- Regenerate (`git add -f`): `apps/landing/src/data/docs/**`

**Interfaces:**
- Consumes: the four repairs from Tasks 3-7, which the ADR documents.
- Produces: `adr-088-test-tier-truthfulness` as the landing slug — it must match the `.md` filename stem, because `generate-docs.ts` derives the slug from the filename.

- [ ] **Step 1: Confirm ADR-088 is still free**

```bash
ls docs/adr/ | grep -E "^ADR-08[0-9]"; echo "exit=$?"
```

Expected: ADR-080 through ADR-087 only. If an ADR-088 exists, stop and renumber.

- [ ] **Step 2: Write the ADR**

Create `docs/adr/ADR-088-test-tier-truthfulness.md` following `docs/adr/template.md`. Status **Proposed** (flip to **Implemented** on deploy, Task 12). It must state:

- **Context.** Four independent mechanisms let a green result be produced without evidence: (1) `turbo.json` hashed `test/**` while every workspace uses `tests/`, so no `#test` task hashed any test file, jest config or setup file — measured 2026-07-30, `karmyq-auth-service#test` hashed 15 inputs, all `src/**` plus `package.json`, and mobile/tests/geocoding hashed exactly one; (2) `scripts/promote-tdd-tests.js` declared `APPS_DIR` and never walked it, stranding `apps/landing`'s passing sprint-99 test in `tdd/`; (3) `apps/mobile` set `passWithNoTests: true` under a comment that had become false; (4) lint runs with `|| echo` in CI, so a flat config that throws on load yields a green job.
- **Decision — the invariant.** *A green test result must be evidence that the current code was tested.* Operationally: test-task cache keys use `$TURBO_DEFAULT$` so the package's own files are the key; every tier's jest invocation must list exactly the test files present on disk; every workspace that can hold `tests/tdd/` is walked by the promoter; and any configuration whose failure mode is silent is proven loadable by a blocking gate.
- **Why not bulk-delete `--passWithNoTests`.** The Design-refinement rationale above, and the explicit relationship to ADR-029, which justifies the flag for legitimately-empty tiers. This ADR **amends** ADR-029 rather than superseding it.
- **Consequences.** `$TURBO_DEFAULT$` widens the cache key, so README-only edits in a package now miss its test cache — accepted: a false miss costs a test run, a false hit costs a shipped regression. Four new blocking gates in `tests/regression/`, each proven non-vacuous by injection at authoring time.
- **Known gap, deliberately not gated here.** `services/messaging-service` — a Critical service — has **zero** test files and declares **no** `test` script, so no parity assertion can bite. Logged in `docs/BUGS.md`; a "every Critical service has tests" gate is a future addition once messaging has any, because a blocking gate cannot land red.
- **References.** ADR-029 (TDD framework), ADR-014 (testing strategy), Sprint 122 plan and spec.

- [ ] **Step 3: Add the index entry**

Append to the ADR list in `docs/adr/README.md`, matching the existing format exactly:

```markdown
- [ADR-088: Test-Tier Truthfulness](ADR-088-test-tier-truthfulness.md) — **Proposed**
```

- [ ] **Step 4: Wire it into the landing nav via `ADR_GROUPS`**

`nav.json` is generated (`scripts/generate-docs.ts:623`). Hand-editing it silently reverts. In the `— Infrastructure —` group's `slugs` array, add as the first entry (newest-first, matching how `adr-087` sits there today):

```typescript
      'adr-088-test-tier-truthfulness',
      'adr-087-one-seed-path-init-sql-regeneration',
```

- [ ] **Step 5: Write the testing guide**

Create `docs/guides/testing-guide.md` — human-facing, covering: the four tiers and what each one means; which commands block a push and which report; why `--testPathPattern='(unit|regression)/'` is the correct scoping and why the positional form is a trap ("comm-unit-y" contains `unit`); that Turbo caches test results and how to force a real run (`npx turbo run test --force`, or run the workspace directly); how a `tdd/` test graduates via `scripts/promote-tdd-tests.js`; and the Windows Turbo timeout flake and the `feed-dibs` timestamp flake as known non-bugs.

- [ ] **Step 6: Repair the stale CLAUDE.md drift in the apps tree**

PR 1 fixed only the root file. `apps/CLAUDE.md` says "Next.js 14 web application" and `apps/frontend/CLAUDE.md` says "Next.js 14 web app"; both apps run `^15.5.21`.

```bash
grep -rn "Next.js 14" apps/CLAUDE.md apps/frontend/CLAUDE.md
```

Change both to `Next.js 15`. Then confirm:

```bash
grep -rn "Next.js 1[45]" apps/CLAUDE.md apps/frontend/CLAUDE.md
node -p "require('./apps/frontend/package.json').dependencies.next"
```

- [ ] **Step 7: Regenerate the landing docs — this also repairs `adr-059`**

The stale artifact re-dirties on any regen until it is committed, so commit it here.

```bash
( cd apps/landing && npm run generate-docs ) 2>&1 | tail -10; echo "exit=$?"

node -e "
const fs=require('fs');
const j=JSON.parse(fs.readFileSync('apps/landing/src/data/docs/concepts/adr-059-dependency-security-gate.json','utf8'));
const md=fs.readFileSync('docs/adr/ADR-059-dependency-security-gate.md','utf8');
console.log('adr-059 json has the 2026-07-21 refresh:', /2026-07-21/.test(j.content));
console.log('adr-088 json exists:', fs.existsSync('apps/landing/src/data/docs/concepts/adr-088-test-tier-truthfulness.json'));
const nav=fs.readFileSync('apps/landing/src/data/docs/nav.json','utf8');
console.log('adr-088 in nav.json:', nav.includes('adr-088-test-tier-truthfulness'));
"; echo "exit=$?"
```

Expected: all three `true`. **Grep-verify `nav.json` afterwards** — memory records that it silently reverts.

- [ ] **Step 8: Run the doc-context drift gate directly**

Turbo's cache misses cross-workspace test inputs, and this test reads `apps/landing`. Run it directly, not through Turbo.

```bash
( cd tests && npx jest regression/doc-context-drift-gate ) 2>&1 | tail -15; echo "exit=$?"
( cd apps/landing && npx jest ) 2>&1 | tail -10; echo "exit=$?"
```

Expected: both green. The drift gate asserts every `docs/adr/ADR-*.md` is linked in the index and every landing doc has a `nav.json` entry — it is the direct check on Steps 3, 4 and 7.

- [ ] **Step 9: Commit — `src/data/docs/` is gitignored, so force-add it**

```bash
git add docs/adr/ADR-088-test-tier-truthfulness.md docs/adr/README.md \
        docs/guides/testing-guide.md scripts/generate-docs.ts \
        apps/CLAUDE.md apps/frontend/CLAUDE.md
git add -f apps/landing/src/data/docs/
git status --short | head -20
git commit -m "docs: ADR-088 test-tier truthfulness + testing guide

Adds the decision record for the four truth defects repaired in this PR, a
human-facing testing guide, and the landing artifacts. Regenerating the landing
docs also repairs the stale adr-059 artifact carried forward from S121 PR 4,
which re-dirtied on every regen. Also fixes 'Next.js 14' in the two apps
CLAUDE.md files; PR 1 fixed only the root one.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 11: Discovery triage — the first honest full run

The cache is honest for the first time. **Expect pre-existing failures.** They are the point, and they are not this PR's to fix.

**Files:**
- Modify: `docs/BUGS.md`

**Interfaces:** none.

- [ ] **Step 1: Run the full blocking suite with the cache defeated**

```bash
npx turbo run test --force --concurrency=1 2>&1 | tail -60; echo "exit=$?"
```

`--concurrency=1` sidesteps the known Windows Turbo parallel-contention flake (a different service fails each run with no assertion output). A failure **with** assertion output is real; one **without** is the flake — re-run that workspace directly to confirm:

```bash
( cd <failing-workspace> && npx jest --testPathPattern='(unit|regression)/' ) 2>&1 | tail -20; echo "exit=$?"
```

- [ ] **Step 2: Revert the landing-docs churn `npm test` causes**

`apps/landing`'s `prebuild` regenerates docs with a timestamp and HEAD sha on every run. Task 10's content is already committed; anything the suite re-dirties now is churn.

```bash
git status --short apps/landing/src/data/docs/ | head
git diff -- apps/landing/src/data/docs/ | head -30
git checkout -- apps/landing/src/data/docs/ 2>/dev/null || git restore --source=HEAD apps/landing/src/data/docs/
git status --short apps/landing/src/data/docs/; echo "(must be empty)"
```

- [ ] **Step 3: Classify every failure**

For each red suite, decide exactly one of:
- **Caused by this diff** → fix it now, in the task that caused it.
- **Pre-existing, newly visible** → log to `docs/BUGS.md`. Do not fix.
- **Known flake** → re-run; do not debug.

- [ ] **Step 4: Log the discoveries to `docs/BUGS.md`**

Follow the file's existing entry format. At minimum, log:

1. **`services/messaging-service` has zero tests.** A **Critical** service (port 3006, Socket.io presence/pubsub) with **0** test files and **no** `test` script in `package.json` — "14 files checked, 0 matches". Its `tsc` clean was the only Express 5 signal it gave during PR 1. Found: Sprint 122 PR 1; confirmed PR 2.
2. **Anything Step 3 classified as pre-existing.**

- [ ] **Step 5: Commit**

```bash
git add docs/BUGS.md
git commit -m "docs(bugs): log what the first honest test run surfaced

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 12: Gates, PR, merge, deploy, verify, handoff

Run the gates **inline** (S121 PR 3 / PR 5 precedent, Critical Note 22). `/code-review` at **HIGH** — this PR writes real new logic and changes the mechanism every future PR's safety argument rests on.

**Files:**
- Modify: `.claude/handoff/CURRENT_HANDOFF.md`
- Modify: `docs/adr/ADR-088-test-tier-truthfulness.md` (Proposed → Implemented, after deploy)

**Interfaces:** none.

- [ ] **Step 1: `/simplify` on the branch diff**

One pass over `git diff origin/master`. Pay attention to duplication across the four new gate files — they share workspace-enumeration and file-counting shapes, and PR 1's `/simplify` found exactly this class of defect (three copies of `RouteParams` justified by a wrong premise). If a shared helper is warranted, it belongs in `tests/helpers/`, which already exists. Re-run every affected suite afterwards.

- [ ] **Step 2: `/code-review` at HIGH**

Focus areas, stated up front so the review is not generic:
- Are the four gates **non-vacuous**? Each was proven by injection at authoring time (Tasks 3, 6, 7); confirm the proofs are recorded and that nothing has since made an assertion unreachable.
- Does `$TURBO_DEFAULT$` widen any task's inputs in a way that breaks CI caching or includes generated output? Confirm `dist/`, `coverage/`, `.next/` remain gitignored and therefore excluded.
- Does `collectTddTargets()` preserve the CLI's prior behavior exactly for `services/*`?
- Can the tier-parity gate false-fail on a case-sensitive CI filesystem or on a workspace with no tier scripts?
- Does the mobile type-check step actually block, and does `--if-present` mask a missing script?

- [ ] **Step 3: `/security-review`**

Smaller surface than PR 1 — the only dependency movement is `semver` + `@types/semver` in a devDependency block. Verify the lockfile delta: every added package resolves to `registry.npmjs.org`, carries an integrity hash, and declares no install script. Also confirm deleting `mobile/` removed no secret-bearing file (`git show --stat HEAD~N -- mobile/`).

- [ ] **Step 4: `npm run feedback:check` and dispose of every finding**

```bash
npm run feedback:check 2>&1 | tail -40; echo "exit=$?"
```

It is advisory, but every item needs a disposition in writing. `npm run analyze:services` is **not** needed — no service dependency changed (PR 1 proved the regenerated graph diffs empty for a non-service change; re-confirm if `feedback:check` claims otherwise).

- [ ] **Step 5: Final pre-push verification**

```bash
git diff --stat origin/master | tail -5
npx tsc --noEmit -p tests/tsconfig.json 2>&1 | tail -5; echo "exit=$?"
( cd tests && npx jest --testPathPattern='(unit|regression)/' ) 2>&1 | tail -10; echo "exit=$?"
npm audit --audit-level=moderate 2>&1 | tail -5; echo "exit=$?"
```

Expected: `tests` blocking tier green (286 + the new gates), `found 0 vulnerabilities`. **Advisories publish mid-flight** — re-run `npm audit` immediately before merging, not just here.

- [ ] **Step 6: Push and open the PR**

```bash
git push -u origin deps/sprint-122-pr2-test-truth; echo "exit=$?"
```

Fill `.github/pull_request_template.md` for the body. Title: `Sprint 122 PR 2: test-tier truthfulness (v11.37.0)`. Record in the body: the four repaired defects with their measured before/after numbers, the two maintainer decisions D-4 and D-5, the design refinement on `--passWithNoTests` and why it does not fight ADR-029, and the non-vacuity proofs.

- [ ] **Step 7: Wait for all checks, then request merge authorization**

A merge fans out into three master runs; only **`CI/CD Pipeline`** has a `Deploy to Demo` job. If `Security Audit` **and** `sprint-75-security-gate` go red **together** on this dependency-light diff, that is a newly published advisory, not this diff — check before debugging.

**Never self-merge.** Present the readiness recommendation and wait for explicit authorization for `gh pr merge --squash --admin`.

- [ ] **Step 8: After merge — confirm the deploy, then verify**

```bash
gh run list --branch master --limit 6
```

Confirm the `CI/CD Pipeline` run reached `Deploy to Demo` = **success with no rollback**, and that its internal `localhost:PORT/health` sweep reported all **9** backends healthy. A green pipeline alone is not the bar (S121 PR 5 passed 20/20 and still shipped a broken font).

Then verify the demo reports **v11.37.0**. Note: `/health` is **not** reachable through nginx — the routers mount at `/auth`, `/communities`, … while `/health` sits at the service root. The CI deploy job's internal sweep is the authoritative health check. `curl -o /dev/null -w "%{http_code}"` returns `000` from this Windows host (a schannel TLS quirk); read the response body instead.

This PR changes **no runtime behavior** — no service code, no API, no schema, no UI. The live smoke test is therefore a confirmation that the deploy itself was clean, not a behavioral proof: `POST /api/auth/login` with `maria.reyes@test.karmyq.com` / `password123` should return 200 with a token whose JWT carries `communities[]`.

- [ ] **Step 9: Flip ADR-088 to Implemented**

Only after the deploy succeeds. Update the status line in `docs/adr/ADR-088-test-tier-truthfulness.md` **and** its `docs/adr/README.md` index entry, regenerate the landing docs, and confirm the drift gate is still green.

**This is not a separate master push.** CLAUDE.md forbids docs-only pushes to `master` — every push is a full deploy and a post-merge docs push causes demo 502s. Carry the flip into **PR 3's** branch instead, and note it in the handoff so PR 3's chat knows it is owed.

- [ ] **Step 10: Update the handoff**

Use the `update-handoff` skill. Record: PR 2 shipped at v11.37.0 with the merge sha and deploy run id; the before/after turbo input counts; which tests promoted when the fixed promoter first ran; every `docs/BUGS.md` entry Task 11 added; D-4 and D-5 as taken decisions; that ADR-088's Implemented flip is owed to PR 3's branch; and **PR 3 as next — still NOT execution-ready, with D-1/D-2/D-3 open.**

- [ ] **Step 11: Verification**

Demo reports v11.37.0, all 9 backends healthy, `CI/CD Pipeline` reached `Deploy to Demo` with no rollback, four new gates live in `tests/regression/`, handoff updated, and `git status` clean apart from the two untracked `.github/` files that are not mine.

---

## Self-Review

**Spec coverage.** Every Plan-of-Record PR 2 item maps to a task: turbo inputs → Task 3; promote-tdd walk → Task 4; `passWithNoTests` → Task 5; lint print-config gate → Task 6; SDK-alignment gate → Task 7; ADR-088 → Task 10; stale `adr-059` repair → Task 10 Step 7; `docs/guides/` testing section → Task 10 Step 5; discovery budget → Task 11; the maintainer question on mobile CI → answered D-4, Task 8. Version `11.37.0` → Task 2. `/code-review` HIGH → Task 12. The one addition beyond the outline is Task 9 (D-5), taken as an explicit decision.

**Placeholders.** None: every gate ships full test source, every verification step gives the command and the expected output, and both `promote-tdd-tests.js` replacement blocks are written out rather than described.

**Type consistency.** `collectTddTargets()` returns `{ workspace, dir, tddDir }` in Task 4's implementation and Task 4's test destructures exactly those three names. The Expo gate's `INDEPENDENTLY_VERSIONED` map is keyed by package name in both the declaration and the stale-exemption assertion. `PROBES` uses `workspace` / `probeFile` / `minRules` / `sentinel` consistently, matching the `it.each` `$workspace` template. The turbo gate's `inputsOf()` is defined once and used by three cases.

**Known risk carried deliberately.** Task 5's per-workspace parity assertion is the one case that can surface pre-existing failures across up to 12 workspaces. Its Step 2 gives an explicit disposition rule (fix only what this diff broke; otherwise narrow with a `// KNOWN GAP:` comment naming the BUGS.md entry) so it cannot silently expand PR 2 into a bug-fixing sprint.
