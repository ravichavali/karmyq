# Sprint 131 D8 — cleanup-service on eslint 10 (supersedes #244) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `services/cleanup-service` to `@eslint/js` **and** `eslint` 10 as a matched pair, fix the one lint error the new `recommended` set raises, and add the first gate that fails when cleanup-service's lint breaks.

**Architecture:** Dependabot #244 bumps only `@eslint/js`. That leaves it paired with the hoisted `eslint@9.39.5`, outside its peer range, and it breaks lint in a way CI cannot see. This PR supersedes #244. It adds a nested `eslint@10` subtree under `services/cleanup-service/node_modules/`, spliced into the lock in place. The root and the three apps stay on eslint 9. A workspace regression test runs the real eslint binary, so a lint break now reddens `npm test` and CI.

**Tech Stack:** the canonical stack in `CLAUDE.md` → *System Architecture*.

**Spec:** [Sprint 131 design](../specs/2026-09-15-sprint-131-maintenance-design.md), extended by the maintainer's decision of 2026-09-28 that the queued Dependabot majors become D8+, one per PR, each planned first (handoff banner). **D8 scope decisions (maintainer, 2026-09-28, this planning chat):**
1. **"Pair in cleanup":** bump `@eslint/js` and `eslint` to 10 in `services/cleanup-service` only. Root, `apps/frontend`, `apps/landing` and `apps/mobile` stay on eslint 9.
2. **"Regression test":** add a workspace gate for cleanup-service lint, proven by mutation. Making CI's lint step blocking repo-wide is **out of scope**. Log it in `docs/IDEAS.md`.

**Plan revision 1 (2026-09-28), after plan review.** Both findings were verified before any fix.
- **P1 (CONFIRMED):** the Task 3 splice kept only cleanup-prefixed candidate nodes. npm hoists 13 of eslint 10's 32 new nodes to the root, so the filtered lock passed `npm ci` and then failed `Cannot find module 'cacheable'`. That was reproduced. Verifying the fix surfaced a second defect, **in npm's own resolution**: `@keyv/bigmap`'s non-optional peer `keyv ^5.6.0` resolves the root `keyv@4.5.4`. Task 3 now splices the complete tree, relocated under cleanup-service, with bigmap nested under `@cacheable/memory`. The layout was proven by a full `npm ci`, eslint running from that install, lock-only and installed `npm ls` diffs, and an idempotent re-resolve (V6, V8, Task 3).
- **P2 (CONFIRMED):** `@eslint/js@9.39.5` declares no `peerDependencies`, so case A's peer assertion is now conditional (Task 2).

---

## Global Constraints

- **Dependency lane:** held by Claude (maintainer, 2026-09-27: "Claude owns the dependency lane"; D8+ assigned 2026-09-28). The only dependency changes are the cleanup-service devDependencies `@eslint/js` and `eslint`, the lockfile nodes they need, and the root `version`. **Never** run `npm install --workspace`, `npm dedupe` or a scratch lockfile regeneration. Splice in place (Task 3).
- **One major per PR, with one exception.** `eslint` and `@eslint/js` are released in lockstep, and `@eslint/js@10` peers `eslint ^10.0.0`. The maintainer approved moving them as a pair.
- **No ADR, no migration, no demo data operation, no runtime change.** Both packages are `devDependencies`. The production image (`services/cleanup-service/Dockerfile:54`, `npm install --omit=dev`) does not contain them.
- **Version** comes from `origin/master` at merge time. Master is `de01c53e` = **11.71.0**, so this PR is **11.72.0** unless master moves first.
- **Branch:** `agent/claude/sprint-131-d8-eslint-10`, cut from `origin/agent/claude/sprint-131-d7-closeout`. That branch is `de01c53e` (= `origin/master`) plus two docs-only commits: the D7 close-out handoff, IDEAS, and this plan. They must ride in a code PR, because CLAUDE.md forbids docs-only master pushes. Verify with `git merge-base` (Task 1).
- **Windows box:** use `node` for JSON and HTTP, not `jq` or `curl`. Run the full local suite with `--concurrency=2`. Capture exit codes separately (`| tail` masks them). The `PATH` npm is 10.8.2, but CI runs **npm 11.19.0**. Prove the lock with `npx -y npm@11.19.0 ci`.
- **`ignore-scripts=true` (BUG-053/054):** `npm test` does **not** run the `posttest` promoter, and nothing runs landing's `prebuild`. Promote this PR's tdd file by hand (Task 5). Regenerate docs by hand (Task 6). Promote nothing else, because five unrelated green `tdd/` files exist repo-wide (BUG-053).
- **Commit before any mutation proof.** A `git checkout --` restore to HEAD wipes uncommitted edits (S131 D4).
- **Merges need explicit per-PR maintainer authorization.** One merge and deploy at a time.

---

## Verified findings (read before Task 1)

All read from the registry, the installed packages, or by running both versions, on 2026-09-28 against `de01c53e`.

**V1: #244 is manifest mechanics only.** Head `1c32364d`, 2 files:
- `services/cleanup-service/package.json`: `@eslint/js` `^9.39.5` → `^10.0.1`.
- `package-lock.json` (+22/−1): the workspace node's range, plus a new `services/cleanup-service/node_modules/@eslint/js@10.0.1` node carrying `peerDependencies: { eslint: "^10.0.0" }` and `peerDependenciesMeta.eslint.optional: true`.

CI is 20 pass, 1 skipped (Deploy). **Refresh this at Task 1**, because Dependabot rebases and re-versions.

**V2: #244's green CI does not cover lint.** `.github/workflows/ci.yml:78` runs `npm run lint --if-present || echo "⚠️  Linter found issues but continuing (non-blocking)"`, and `test.yml:62`/`:103` also end in `|| echo`. No job can fail on a lint error.

**V3: #244 as-is breaks cleanup-service lint.** `@eslint/js` 10's `eslint-recommended.js` has 64 rules, versus 61 in 9.39.5. None were removed and none changed. Three were **added**: `no-unassigned-vars`, `no-useless-assignment`, `preserve-caught-error` (diff of the two `npm pack` tarballs). The measurements:
- **Today** (eslint 9.39.5, `@eslint/js` 9.39.5): `npx eslint src` exits 0 with no output.
- **`@eslint/js` 10.0.1 on eslint 9.39.5** (#244 as-is): exit 1, 1 error.
- **eslint 10.11.0 and `@eslint/js` 10.0.1** (this plan): exit 1, the **same single error**, 9 files linted, 0 warnings.

The error, in both cases, is `src/jobs/expirationJob.ts:153:7 no-useless-assignment`. `let batchDeleted = 0;` is overwritten inside the `do` block before the `while` condition reads it. `--print-config src/index.ts` shows all three new rules at severity 2 for `.ts` files, so typescript-eslint's `flat/recommended` does not disable them.

**V4: eslint 10 runs this config unchanged.** eslint 10.11.0 is `type: commonjs`. The CommonJS `eslint.config.js` (`require('@eslint/js')`, `require('@typescript-eslint/eslint-plugin')`, `module.exports = [...]`) loads and lints with no edit. Its only peer is `jiti` (optional, used for TS config files; not needed here). Its `engines` is `^20.19.0 || ^22.13.0 || >=24`, so the Node 24 floor is unchanged.

**V5: the typescript-eslint side needs no bump.** cleanup-service already resolves `@typescript-eslint/eslint-plugin` and `parser` **8.70.0**, nested in its own `node_modules`. Both peer `eslint: "^8.57.0 || ^9.0.0 || ^10.0.0"`. The hoisted 8.65.0 copies serve the other declarers and stay untouched.

**V6: eslint 10 cannot hoist, so its tree nests.** The root `eslint@9.39.5` is declared by the root, `apps/frontend`, `apps/landing`, `apps/mobile` and cleanup-service. eslint 10's direct dependencies conflict with the hoisted versions:

| Dependency | eslint 10 needs | Hoisted |
|---|---|---|
| `espree` | `^11.2.0` | 10.4.0 |
| `eslint-scope` | `^9.1.2` | 8.4.0 |
| `@eslint/core` | `^1.2.1` | 0.17.0 |
| `@eslint/config-array` | `^0.23.5` | 0.21.2 |
| `@eslint/config-helpers` | `^0.7.0` | 0.4.2 |
| `@eslint/plugin-kit` | `^0.7.3` | 0.4.1 |
| `file-entry-cache` | `11.1.5 \|\| >11.1.6 <12` | 8.0.0 |
| `ajv` | `^6.14.0` | 8.20.0 |
| `find-up` | `^5.0.0` | 4.1.0 |
| `glob-parent` | `^6.0.2` | 5.1.2 |

`ignore` needs `^5.2.0`, but cleanup-service already nests 7.0.9, so it lands one level deeper under `…/eslint/node_modules/`.

**⚠️ Rev 1 correction (review finding P1).** The original line here said to expect every new node under `services/cleanup-service/node_modules/`, and that was **wrong**. The measured facts, from a re-resolve with npm 11.19.0 on a scratch copy of every manifest and the `de01c53e` lock, 2026-09-28:
- **32 nodes are added, 0 removed, and 1 changed** (the workspace node's `devDependencies`).
- **19 of the added nodes nest under cleanup-service.**
- **13 are hoisted to the root,** because nothing there conflicts. They are `cacheable` (+ `cacheable/node_modules/keyv`), `@cacheable/memory` (+ nested `keyv`), `@cacheable/utils` (+ nested `keyv`), `@keyv/bigmap`, `@keyv/serialize`, `hashery`, `hookified`, `qified` (+ nested `hookified`) and `@types/esrecurse`. They come through `file-entry-cache@11` → `flat-cache@6` → `cacheable`.
- **A filter that keeps only cleanup-prefixed nodes ships a broken tree.** Reproduced by the reviewer and again here: a full `npm ci` on the prefix-filtered lock **exits 0**, then `eslint --version` fails `Cannot find module 'cacheable'`.
- **npm's own placement has a real defect.** `@keyv/bigmap` declares a **non-optional peer** `keyv ^5.6.0` and calls `require("keyv")` at runtime (`dist/index.cjs:32`). Hoisted to the root, it resolves the root `keyv@4.5.4`, and lock-only `npm ls` gains `keyv@4.5.4 invalid: "^5.6.0" from node_modules/@keyv/bigmap`. Its only dependent is `@cacheable/memory`, which carries its own nested `keyv@5.6.0`.

**The layout to ship (maintainer: "preserve the complete transitive tree, relocating those nodes under cleanup-service"):**
- (a) Keep all 19 cleanup-prefixed nodes as npm resolved them.
- (b) Relocate the 13 root-level nodes to the same relative path under `services/cleanup-service/`: 0 collisions, and all 32 are `dev: true`.
- (c) Nest `@keyv/bigmap` under its sole dependent, at `services/cleanup-service/node_modules/@cacheable/memory/node_modules/@keyv/bigmap`, beside that package's `keyv@5.6.0`.

A first attempt, which added `keyv@5.6.0` at cleanup's top level instead of (c), **was pruned by a full `npm ci`** and left the invalid peer in place. Do not use it. Evidence for the (a)+(b)+(c) layout, measured on a scratch copy:
- Lock-only `npm ls --all` gives a problem set identical to base (51 lines each). The comparison can fail: npm's raw candidate shows the two extra `keyv` lines.
- A full `npx -y npm@11.19.0 ci` exits 0.
- The installed tree's problem set is only the pre-existing `@react-native/metro-config`, `color-string`, `ms` and `picomatch`.
- `@cacheable/memory` → bigmap resolves `…/@cacheable/memory/node_modules/@keyv/bigmap`, and bigmap → `keyv` resolves `5.6.0`.
- `eslint --version` prints `v10.11.0`, and `eslint --cache src` reproduces exactly the known single error.
- **An npm 11.19.0 `install --package-lock-only` over the spliced lock changes 0 nodes,** so npm accepts the layout and a later lock operation will not churn it.

**Nothing outside `services/cleanup-service` may change except the root `version`.** Every new node sits under `services/cleanup-service/node_modules/`, and the workspace node changes only its two dev ranges.

**V7: no other workspace imports `@eslint/js`.** `git grep -n "@eslint/js" -- ':!package-lock.json'` finds only `services/cleanup-service/eslint.config.js:2` and its manifest. No de-hoist hazard exists: the hoisted `@eslint/js@9.39.5` stays, because the root eslint 9 depends on it.

**V8: `npm ls --all` baseline, in two forms, and compare like with like.**
- **Lock-only:** `npx -y npm@11.19.0 ls --all --package-lock-only` in a scratch copy holding every manifest plus the base lock. It gives 51 unique problem lines at `de01c53e`, including `@emnapi/*` and `UNMET OPTIONAL` entries.
- **Installed tree:** `npm ls --all` after a full `npm ci`. The invalid set is `color-string@2.1.4`, `ms@2.0.0` and `picomatch@2.3.2`, plus a missing `@react-native/metro-config`, all pre-existing. It also lists platform-optional binaries as `UNMET OPTIONAL`; those are noise.
- **Never diff one form against the other.** Normalize with `lsnorm.js` (Task 3). It exits 2 on empty input, because a broken pipe once produced a false-green "no diff" here. **Judge the splice by "no new problem lines".**

**V9: `batchHardDelete` has no test.** `tests/unit/expirationJob.test.ts` covers only `markExpiredData`. The lint fix edits this function's loop variable, so pin its loop behavior (Task 2) before touching it.

**V10: CI will run the new gate.** `services/cleanup-service/jest.config.js` matches `**/tests/tdd/**` and `**/tests/regression/**`, and `turbo run test` in `Test Backend Services` runs it. The test reads only files inside the workspace, so Turbo's cache inputs cover it.

---

## Review Focus

Failures this PR must catch, most likely first. Each is pinned by a case in Task 2:

1. **Someone lands code that fails cleanup-service lint.** Today nothing stops it (V2). [case B, injection I1]
2. **The config silently stops applying `@eslint/js`'s `recommended` rules** (a refactor drops `js.configs.recommended`, or a later typescript-eslint preset turns core rules off for `.ts`). The run then "passes" because it checks almost nothing. [case C, injection I2]
3. **cleanup-service resolves an eslint whose major does not match `@eslint/js`.** This is #244's own state, or a later hoist change. [case A, injection I3]
4. **The lint fix changes `batchHardDelete`'s behavior.** [Task 2 Step 1, the unit pin]

---

## File map

| File | Change |
|---|---|
| `services/cleanup-service/tests/unit/expirationJob.test.ts` | **Modify.** Add a `batchHardDelete` block: loop totals, the stop condition, and the allow-list guard |
| `services/cleanup-service/tests/tdd/sprint-131-eslint-10.test.ts` | **Create** (promoted to `tests/regression/` in Task 5). Cases A, B, C |
| `services/cleanup-service/src/jobs/expirationJob.ts:153` | `let batchDeleted = 0;` → `let batchDeleted: number;` |
| `services/cleanup-service/package.json:28,37` | `@eslint/js` `^10.0.1`, `eslint` `^10.11.0` (devDependencies) |
| `package-lock.json` | Workspace node ranges, plus the **complete** eslint 10 transitive tree (32 nodes at 10.11.0) under `services/cleanup-service/node_modules/`: 13 relocated from root, and `@keyv/bigmap` nested under `@cacheable/memory` (V6). Also root `version` |
| `services/cleanup-service/eslint.config.js:1` | Comment: "Flat config (ESLint 9)" → "(ESLint 10)" |
| `services/cleanup-service/CONTEXT.md` | Append a *Sprint 131 D8 — eslint 10* section |
| `apps/landing/src/data/docs/services/cleanup-service.json` | Regenerated from `CONTEXT.md`. Commit the content change only |
| `docs/IDEAS.md` | CI lint is non-blocking repo-wide; the remaining eslint 9 declarers |
| `package.json:3`, `package-lock.json` (root `version` fields) | `11.71.0` → `11.72.0` |
| `.claude/handoff/CURRENT_HANDOFF.md` | D8 state, evidence, next action |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **#244's CI is green because lint cannot fail in CI (V2).** Never cite a green PR check as lint evidence. Cite the Task 2 gate and a direct `npx eslint src` exit code.
2. **Bump the pair.** `@eslint/js` alone leaves an unmet (optional) peer on the hoisted eslint 9 (V1). Case A pins that the two majors match.
3. **Splice the COMPLETE transitive tree, relocated under cleanup-service (V6, rev 1).**
   - **Never filter the candidate by prefix.** 13 of its 32 new nodes are hoisted to the root, and dropping them yields a lock that passes `npm ci` but whose eslint cannot load (`Cannot find module 'cacheable'`).
   - Relocate root-level additions to the same relative path under `services/cleanup-service/`. Nest `@keyv/bigmap` under `@cacheable/memory`, because its non-optional peer `keyv ^5.6.0` otherwise resolves the root `keyv@4.5.4`.
   - A Windows re-resolve strips `libc` fields and drops override nodes, so build the result from a byte copy of the base lock, never from the candidate.
   - **`npm ci` exit 0 is not evidence of a working tree.** Prove it by running eslint from a full install, by the lock-only and installed `npm ls` diffs, by a node diff with registry parity, and by an idempotent re-resolve.
4. **The fix is a declaration change, not a logic change.** `let batchDeleted: number;` compiles because TypeScript knows a `do` body runs before its `while` condition. Do not restructure the loop. Task 2's unit pin must pass unchanged before and after.
5. **Gate cases must be able to fail.** Each case gets an injection that turns it red (I1–I3), each on a committed tree, each restored from a byte copy.
6. **Promote only this PR's tdd file.** The promoter does not auto-run (BUG-053), and running it by hand sweeps five unrelated files.
7. **The live smoke is the standard post-deploy one.** Nothing in the running system changes, and the four-endpoint smoke only confirms the deploy did no harm.

---

### Task 1: Branch, and re-verify #244 and master

**Files:** none modified.

- [ ] **Step 1: Cut the branch**

```bash
cd /c/Users/ravic/development/karmyq
git fetch origin
git switch -c agent/claude/sprint-131-d8-eslint-10 origin/agent/claude/sprint-131-d7-closeout
git merge-base HEAD origin/master   # must equal origin/master's sha; if master moved, merge origin/master in (merge commit, never rebase)
git log --oneline origin/master..HEAD   # expect only docs commits (close-out, D8 plan)
```

- [ ] **Step 2: Record the lane holder in the handoff.** Add the D8 banner line "dependency lane: Claude (maintainer 2026-09-27/28)" before the first manifest edit.

- [ ] **Step 3: Re-read #244 against the current master**

```bash
gh pr view 244 --json state,headRefOid,files,statusCheckRollup --jq '{state,headRefOid,files:[.files[].path]}'
npm view @eslint/js@10 version --json; npm view eslint@10 version --json
```

Expected: still OPEN and still touches the same 2 files. If Dependabot re-versioned it (for example to `@eslint/js` 10.0.2), use the **latest 10.x of each** in Task 3 and note the change in the Execution notes. If `eslint`'s latest 10.x differs from `10.11.0`, re-check V4–V6 against it: its `dependencies` and `engines`.

- [ ] **Step 4: Baselines** (save the outputs to the scratchpad; later tasks diff against them)

```bash
cp package-lock.json "$SCRATCH/lock.base.json"
npm ls --all > "$SCRATCH/npmls.base.raw.txt" 2>&1   # raw installed-tree output; normalize later with lsnorm.js (Task 3 Step 4). No grep|sed pipeline: see V8
(cd services/cleanup-service && npx eslint src; echo "lint exit=$?")   # expect 0 on eslint 9 / @eslint/js 9
```

---

### Task 2: Write the gate and the unit pin (TDD — before any bump)

**Files:**
- Modify: `services/cleanup-service/tests/unit/expirationJob.test.ts`
- Create: `services/cleanup-service/tests/tdd/sprint-131-eslint-10.test.ts`

- [ ] **Step 1: Pin `batchHardDelete`** (append to the unit file; it already mocks `../../src/database/db` and the logger. Root `resetMocks: true` applies, so set the mock values inside each test)

```ts
import { batchHardDelete } from '../../src/jobs/expirationJob';
// (merge into the existing import line from '../../src/jobs/expirationJob')

describe('batchHardDelete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps deleting while a batch comes back full, and sums every batch', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 2 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 2 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
    await expect(batchHardDelete('messaging.messages', 2)).resolves.toBe(5);
    expect(mockQuery).toHaveBeenCalledTimes(3);
    expect(mockQuery.mock.calls[0][1]).toEqual([expect.any(String), 2]);
  });

  it('runs exactly once when the first batch is short, including an empty table', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
    await expect(batchHardDelete('requests.help_requests', 1000)).resolves.toBe(0);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('treats a null rowCount as 0 and stops', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: null } as any);
    await expect(batchHardDelete('requests.help_offers', 10)).resolves.toBe(0);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('rejects a table outside the allow-list without querying', async () => {
    await expect(batchHardDelete('auth.users', 10)).rejects.toThrow(/not in the allowed list/);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
```

Run: `npm exec --workspace=services/cleanup-service -- jest tests/unit/expirationJob.test.ts`. **Expected: green on the current code.** It is a characterization pin, and it must stay green unchanged through Task 4.

- [ ] **Step 2: Write the lint gate**

Create `services/cleanup-service/tests/tdd/sprint-131-eslint-10.test.ts`. Design constraints:
- **Run the real binary in a plain `node` child.** Do not load eslint inside Jest's module registry. Use `spawnSync(process.execPath, [eslintBin, ...constantArgs], { cwd: SERVICE_DIR })`. Use only constant arguments, and pass the fixture on stdin as **data**: no `new Function` and no `eval`, because CodeQL's `remote_and_local` threat model (D4 V7) would flag it.
- **Resolve** `eslintBin` with `require.resolve('eslint/package.json', { paths: [SERVICE_DIR] })` plus that package's `bin.eslint`. That is exactly the binary `npm run lint` in this workspace gets.
- **Import nothing undeclared.** Use only `node:child_process`, `node:path` and `node:fs`. No `semver`: cleanup-service does not declare it.
- **Timeout** 60 s per case (Turbo on Windows can run about 60× slow; see the Turbo-flake memory).

Cases:

- **A: the pair matches.** Resolve both `eslint/package.json` and `@eslint/js/package.json` from `SERVICE_DIR`. Parse each major with `Number(v.split('.')[0])`.
  - **Always** assert `major(eslint.version) === major(eslintJs.version)`.
  - **Conditionally**, if `@eslint/js` declares `peerDependencies.eslint`, assert it matches `/^\^(\d+)\.0\.0$/` with that same major.
  - ⚠️ **Rev 1 correction (review finding P2):** `@eslint/js@9.39.5` declares **no** `peerDependencies` (verified from the installed `package.json`), so an unconditional peer assertion fails on the baseline. The peer field first appears in 10.x.
  - Pre-bump, A is green on the major check alone (9 === 9). Post-bump, both checks run (10 === 10, `^10.0.0`). It goes red on #244's mixed state (I3). Name the peer clause in the test title, so a reader can tell which half ran.
- **B: the workspace lints clean.** Run `[eslintBin, '--format', 'json', 'src']`. Assert `status === 0`. Parse stdout, and assert that the sum of `errorCount` is 0 and the linted file paths include `src/jobs/expirationJob.ts` and `src/index.ts`. That proves `src` was actually linted and not an empty glob. Assert on errors only. Warnings are deliberate config (`no-explicit-any: 'warn'`), and the baseline has 0.
- **C: `@eslint/js` 10's new recommended rules are live for `.ts`.** Run `[eslintBin, '--format', 'json', '--stdin', '--stdin-filename', 'src/__eslint_probe__.ts']` with this constant fixture on stdin:

  ```ts
  export function useless(): number { let a = 0; a = 1; return a; }
  export function unassigned(): number | undefined { let b: number | undefined; return b; }
  export function rethrow(): void { try { JSON.parse('x'); } catch (err) { throw new Error(`bad: ${String(err)}`); } }
  ```

  Assert that the set of reported `ruleId`s **contains each of** `no-useless-assignment`, `no-unassigned-vars` and `preserve-caught-error`, each on its own line (1, 2, 3). That is three separate identities, not a count. **Before the bump, case C is red** (eslint 9 plus `@eslint/js` 9's recommended set lacks them). That is the TDD red, and it turns green in Task 3.

  ⚠️ **Verify each fixture line fires under eslint 10 before relying on it.** `preserve-caught-error` with `requireCatchParameter: false` should fire when a catch parameter exists and is not passed as `{ cause }`. `no-unassigned-vars` should fire on a `let` that is read but never assigned. If a line does not fire, adjust the fixture, never the assertion, and record why in the Execution notes.

- [ ] **Step 3: Run the gate on the current tree**

```bash
npm exec --workspace=services/cleanup-service -- jest tests/tdd/sprint-131-eslint-10.test.ts; echo "exit=$?"
```

Expected:
- **A green.** 9 === 9 on the major check; the peer clause is skipped because 9.39.5 declares no peer.
- **B green.** Lint is clean today.
- **C red.** The rules are absent. Probed 2026-09-28: eslint 9 reports nothing on the fixture.

Record the output. If A is red here, the peer clause is unconditional (P2), so fix the test, not the expectation.

- [ ] **Step 4: Commit** (`test(cleanup): pin batchHardDelete + eslint gate (D8 red)`)

---

### Task 3: Bump the pair and splice the lock

**Files:** `services/cleanup-service/package.json`, `package-lock.json`

- [ ] **Step 1: Manifest.** In `services/cleanup-service/package.json` devDependencies, set `"@eslint/js": "^10.0.1"` and `"eslint": "^10.11.0"`, or the latest 10.x from Task 1 Step 3.

- [ ] **Step 2: Re-resolve in a scratch copy, never in the repo**

Copy the repo's `package.json`, `package-lock.json`, `.npmrc` and every tracked workspace `package.json` into `$SCRATCH/resolve/`, keeping their paths:

```bash
git ls-files '*package.json' | grep -v node_modules | while read f; do mkdir -p "$SCRATCH/resolve/$(dirname "$f")"; cp "$f" "$SCRATCH/resolve/$f"; done
cp package-lock.json .npmrc "$SCRATCH/resolve/"
```

Then run `npx -y npm@11.19.0 install --package-lock-only --ignore-scripts --no-audit --no-fund` there. This produces a candidate lock only, and it is **never committed**. Expected at `eslint@10.11.0` / `@eslint/js@10.0.1` (planning run, 2026-09-28): **32 added, 0 removed, 1 changed** (the workspace node). 19 of the added nodes are cleanup-prefixed and **13 are root-level** (V6). If the counts differ because a newer 10.x was published, re-derive them and record the new numbers. `splice.js` throws on any shape it does not expect.

- [ ] **Step 3: Splice — the complete tree, relocated (rev 1)**

Write `$SCRATCH/splice.js` with the Write tool (heredocs eat backslashes). This is the reference implementation, run end to end during planning rev 1:

```js
// D8 lock splice: base lock + npm 11.19.0 candidate -> spliced lock where every NEW node lives under
// services/cleanup-service/node_modules/ (new root-level nodes are relocated there), plus the
// workspace node's changed ranges. @keyv/bigmap is nested under its only dependent, @cacheable/memory,
// so its non-optional peer `keyv ^5.6.0` resolves (npm's own placement resolves it to root keyv@4.5.4).
// Usage: node splice.js <base-lock> <candidate-lock> <out-lock>
'use strict';
const fs = require('fs');
const [basePath, candPath, outPath] = process.argv.slice(2);
const baseText = fs.readFileSync(basePath, 'utf8');
const base = JSON.parse(baseText);
const cand = JSON.parse(fs.readFileSync(candPath, 'utf8'));
const A = base.packages;
const B = cand.packages;
const WS = 'services/cleanup-service';
const PRE = WS + '/node_modules/';

const out = { ...A };
// 1. workspace node: take the candidate's (only devDependencies may differ).
const wsDiff = Object.keys({ ...A[WS], ...B[WS] }).filter(
  (f) => JSON.stringify(A[WS][f]) !== JSON.stringify(B[WS][f]),
);
if (wsDiff.join() !== 'devDependencies') throw new Error('workspace node differs in ' + wsDiff);
out[WS] = B[WS];

// 2. every changed pre-existing node other than the workspace must not exist.
for (const k of Object.keys(B)) {
  if (k in A && k !== WS && k !== '' && JSON.stringify(A[k]) !== JSON.stringify(B[k])) {
    throw new Error('candidate changed pre-existing node ' + k);
  }
}
// 3. no removals.
const removed = Object.keys(A).filter((k) => !(k in B));
if (removed.length) throw new Error('candidate removed ' + removed);

// 4. added nodes: keep cleanup-prefixed ones, relocate root-level ones under cleanup.
const added = Object.keys(B).filter((k) => !(k in A));
for (const k of added) {
  let nk;
  if (k.startsWith(PRE)) nk = k;
  else if (k.startsWith('node_modules/')) nk = WS + '/' + k;
  else throw new Error('added node outside root/cleanup: ' + k);
  if (nk in out) throw new Error('collision ' + nk);
  out[nk] = B[k];
}
// 5. @keyv/bigmap peers keyv ^5.6.0 (non-optional). Its only dependent, @cacheable/memory, carries its
//    own nested keyv@5.6.0, so nest bigmap beside it; npm's hoisted spot resolves the root keyv@4.5.4.
const BM_FROM = PRE + '@keyv/bigmap';
const BM_TO = PRE + '@cacheable/memory/node_modules/@keyv/bigmap';
const dependents = Object.entries(out).filter(([, v]) => v.dependencies && v.dependencies['@keyv/bigmap']).map(([k]) => k);
if (dependents.join() !== PRE + '@cacheable/memory') throw new Error('bigmap dependents: ' + dependents);
if (!out[PRE + '@cacheable/memory/node_modules/keyv']) throw new Error('no nested keyv beside memory');
out[BM_TO] = out[BM_FROM];
delete out[BM_FROM];

// 6. order keys the way npm does (localeCompare 'en'; base is already in this order).
const cmp = (a, b) => a.localeCompare(b, 'en');
const keys = Object.keys(out).sort((a, b) => (a === '' ? -1 : b === '' ? 1 : cmp(a, b)));
const packages = {};
for (const k of keys) packages[k] = out[k];
const result = { ...base, packages };
const indent = baseText.match(/^\{\r?\n( +)/)[1].length;
const eol = baseText.includes('\r\n') ? '\r\n' : '\n';
fs.writeFileSync(outPath, JSON.stringify(result, null, indent).replace(/\n/g, eol) + eol);
console.log('added', Object.keys(packages).length - Object.keys(A).length, 'nodes; relocated',
  added.filter((k) => !k.startsWith(PRE)).length, '; @keyv/bigmap nested under @cacheable/memory');
```

Run `node "$SCRATCH/splice.js" "$SCRATCH/lock.base.json" "$SCRATCH/resolve/package-lock.json" package-lock.json`. Expected output: `added 32 nodes; relocated 13 ; @keyv/bigmap nested under @cacheable/memory`. The candidate's node values are npm's own, with map fields already key-sorted, so no field is hand-built. If Step 2's counts changed, the bigmap step's guards (a sole dependent, a nested `keyv` beside it) either still hold or throw. **If it throws, stop and re-plan, and do not improvise a placement.** A first rev-1 attempt, which put `keyv@5.6.0` at cleanup's top level, was silently pruned by `npm ci`.

- [ ] **Step 4: Prove the splice** (every check must be able to fail; ⚠️ Git Bash + `sed` + backslashes broke a normalizer during planning and produced a false-green empty diff, so use `lsnorm.js`)

Write `$SCRATCH/lsnorm.js` with the Write tool:

```js
// Normalize `npm ls --all` problem lines: strip tree art and the scratch dir prefix; unique + sorted.
// Exits 2 if it saw no problem lines at all (the base is known to have some — empty = broken pipe).
'use strict';
let s = '';
process.stdin.on('data', (d) => (s += d)).on('end', () => {
  const lines = s
    .split(/\r?\n/)
    .filter((l) => /invalid|missing|UNMET/.test(l))
    .map((l) => l.replace(/^[\s|`+-]*/, '').replace(/[A-Za-z]:\\\S*?\\scratchpad\\[^\\]+\\/g, '<ROOT>\\'));
  const uniq = [...new Set(lines)].sort();
  if (uniq.length === 0) { console.error('lsnorm: no problem lines read'); process.exit(2); }
  console.log(uniq.join('\n'));
});
```

Then prove, in order:

1. **Byte scope:** `git diff --numstat package-lock.json` gives about +464/−2 at 10.11.0. The only removed lines are the workspace node's two old ranges. `git diff package-lock.json | grep '^-' | grep -v '^---'` must show exactly those two lines. Every `+` hunk must sit inside a `services/cleanup-service` key.
2. **Registry parity:** for every added node, `version`, `resolved`, `integrity`, `license`, `engines`, `dependencies`, `peerDependencies` and `peerDependenciesMeta` equal `npm view <name>@<version> --json` (key-sorted). Every added node is `"dev": true`.
3. **Lock-only `npm ls`, like with like (V8):** put the new lock plus the Step 1 manifest into a copy of `$SCRATCH/resolve/`, then run `npx -y npm@11.19.0 ls --all --package-lock-only 2>&1 | node "$SCRATCH/lsnorm.js"`. Diff it against the same command over the base lock. Expect **0 diff lines**. **Negative control:** the raw candidate lock (Step 2's output) must show two extra `keyv@4.5.4 … invalid: "^5.6.0" from node_modules/@keyv/bigmap` lines. That proves the diff can fail.
4. **Idempotency:** in that scratch copy, `npx -y npm@11.19.0 install --package-lock-only --ignore-scripts` over the spliced lock must change **0** nodes (node diff). Otherwise npm would churn the layout on the next lock operation.
5. **A real install in the repo, then run what was broken.** Run `npx -y npm@11.19.0 ci; echo "ci exit=$?"`, which proves consistency and integrity only. Then:

```bash
cd services/cleanup-service
node node_modules/eslint/bin/eslint.js --version                # v10.11.0 — the reviewer's failure was here ("Cannot find module 'cacheable'")
node node_modules/eslint/bin/eslint.js --cache --cache-location "$SCRATCH/eslintcache" src; echo "exit=$?"   # 1, ONLY expirationJob.ts:153 no-useless-assignment (the cache path loads cacheable/keyv)
node -e 'const p=require("path");const mem=p.dirname(require.resolve("@cacheable/memory"));const bm=require.resolve("@keyv/bigmap",{paths:[mem]});const k=require.resolve("keyv",{paths:[p.dirname(bm)]});console.log(p.relative(process.cwd(),bm));console.log(p.relative(process.cwd(),k))'
# expect …/@cacheable/memory/node_modules/@keyv/bigmap/… and …/@cacheable/memory/node_modules/keyv/…  (keyv 5.6.0, not the root 4.5.4)
cd ../..
npm ls --all 2>&1 | node "$SCRATCH/lsnorm.js" | grep -E 'invalid|missing: |UNMET DEPENDENCY' | grep -v '^npm error'
# expect ONLY the pre-existing: @react-native/metro-config (UNMET), color-string, ms, picomatch — no keyv line
node -e 'const p=require("path");const s=p.resolve("services/cleanup-service");for(const n of ["eslint","@eslint/js"])console.log(n,"cleanup:",require(require.resolve(n+"/package.json",{paths:[s]})).version,"root:",require(require.resolve(n+"/package.json",{paths:[process.cwd()]})).version)'
# expect cleanup: 10.11.0 / 10.0.1 ; root: 9.39.5 / 9.39.5
for w in apps/frontend apps/landing apps/mobile; do node -e "console.log('$w', require(require.resolve('eslint/package.json',{paths:[require('path').resolve('$w')]})).version)"; done   # expect 9.39.5 each
```

6. **Negative control for P1, kept as evidence:** a prefix-only splice (drop the 13 root-level nodes), installed with a full `npm ci` in a scratch copy, exits 0, and its `eslint --version` fails `Cannot find module 'cacheable'`. This was reproduced during planning rev 1. Re-run it only if Step 2's counts changed.

- [ ] **Step 5: Run the gate.** Case A is green (10 === 10, and the peer clause is now active: `^10.0.0`). **Case B is red on exactly `src/jobs/expirationJob.ts:153 no-useless-assignment`**, reproducing V3 on the real install. Case C is green on all three rules. Record the output.

- [ ] **Step 6: Commit** (`chore(cleanup): eslint + @eslint/js 10 (supersedes #244)`)

---

### Task 4: Fix the lint finding

**Files:** `services/cleanup-service/src/jobs/expirationJob.ts`, `services/cleanup-service/eslint.config.js`

- [ ] **Step 1:** At `expirationJob.ts:153`, change `let batchDeleted = 0;` → `let batchDeleted: number;`. Change nothing else in the function.
- [ ] **Step 2:** Change the comment at `eslint.config.js:1` from `// Flat config (ESLint 9).` to `// Flat config (ESLint 10).`.
- [ ] **Step 3: Verify**

```bash
cd services/cleanup-service
npx tsc --noEmit; echo "tsc exit=$?"                  # 0 — definite assignment through do/while
npx eslint src; echo "lint exit=$?"                   # 0, no output
npm exec -- jest tests/unit/expirationJob.test.ts tests/tdd/sprint-131-eslint-10.test.ts; echo "jest exit=$?"   # all green; unit pin unchanged since Task 2
```

- [ ] **Step 4: Commit** (`fix(cleanup): no-useless-assignment in batchHardDelete`)

---

### Task 5: Mutation proofs and promotion

**Files:** the tdd test moves to `services/cleanup-service/tests/regression/sprint-131-eslint-10.test.ts`

Every injection runs on the committed tree. Byte-copy the file first, and restore it from the copy (`cp`), never with `git checkout --`. After each restore, run `git status --short` and expect it to be clean.

- [ ] **I1 (case B):** revert Step 4.1 (`let batchDeleted = 0;`). B goes **red** and names `no-useless-assignment` at `expirationJob.ts:153`. A and C stay green. Restore.
- [ ] **I2 (case C):** delete the `js.configs.recommended,` line from `eslint.config.js`. C goes **red**, with all three rule ids missing. Restore. *Also note whether B stays green here.* It should, which shows that B alone cannot detect a hollowed-out config, and that is why C exists.
- [ ] **I3 (case A):** rename `services/cleanup-service/node_modules/eslint` → `eslint.off`, so cleanup resolves the hoisted 9.39.5 and reproduces #244's mixed state. A goes **red** (9 ≠ 10). Rename it back.
- [ ] **Promote:** `git mv services/cleanup-service/tests/tdd/sprint-131-eslint-10.test.ts services/cleanup-service/tests/regression/`. Do **not** run `scripts/promote-tdd-tests.js`. Re-run it from its new path and expect green.
- [ ] **Commit** (`test(cleanup): promote eslint-10 gate; injections I1–I3 recorded`), and record I1–I3 with their outputs in this plan's Execution notes.

---

### Task 6: Docs (CONTEXT, landing page, IDEAS)

**Files:** `services/cleanup-service/CONTEXT.md`, `apps/landing/src/data/docs/services/cleanup-service.json`, `docs/IDEAS.md`

- [ ] **Step 1: `CONTEXT.md`.** Append `## Sprint 131 D8 — eslint 10 (2026-09-28)` after the D3 section, matching the D1–D3 section style. It covers:
  - `eslint` 9.39.5 → 10.11.0 and `@eslint/js` 9.39.5 → 10.0.1, devDependencies only, moved as a pair. This supersedes #244, which alone left `@eslint/js` 10 on the hoisted eslint 9.
  - This workspace alone is on eslint 10, and the root and apps stay on 9 (a nested tree).
  - The three rules added to `recommended`, and the one finding they raised and its fix.
  - The new gate, `tests/regression/sprint-131-eslint-10.test.ts`, and why it exists: CI's lint step is non-blocking.
  - That no endpoint, event, schema or runtime change occurs, and the production image does not contain eslint.
- [ ] **Step 2: Landing page.** Run `cd apps/landing && npx tsx ../../scripts/generate-docs.ts`. Keep the `services/cleanup-service.json` content change. Revert timestamp- and HEAD-sha-only churn everywhere else (`git diff --stat apps/landing/src/data/docs`, then `git checkout --` on churn-only files, **after** committing Step 1). If the file is untracked-but-ignored, it needs `git add -f`.
- [ ] **Step 3: `docs/IDEAS.md`.** Append `## [2026-09-28] D8 follow-ups`:
  - **(a) CI lint is non-blocking** (`ci.yml:78`, `test.yml:62,103`). Only cleanup-service has a lint gate. Making lint blocking needs the frontend, landing and mobile lint state measured first.
  - **(b) The remaining eslint 9 declarers:** root, `apps/frontend`, `apps/landing` (`eslint-config-next` peers `eslint >=9`) and `apps/mobile` (`eslint-config-expo` peers `>=8.10`). Their plugin trees are unproven on 10. Dependabot will likely propose eslint 10 next.
- [ ] **Step 4:** No user-guide, onboarding or ADR change. This is a dev-tooling change with no user-visible behavior, and the PR body says so under *Summary*. `services/registry.json` has no dependency listing for npm packages, so it gets no change.
- [ ] **Step 5: Commit** (`docs(cleanup): D8 eslint 10 — CONTEXT, landing page, IDEAS`)

---

### Task 7: Version bump

- [ ] Take the version from `git show origin/master:package.json`. If it is still 11.71.0, bump to **11.72.0** in `package.json:3` and in both root version fields of `package-lock.json`. Diff the lock: exactly the 2 version lines change, plus the `package.json` line. Run strict `npx -y npm@11.19.0 ci`, and expect exit 0. Commit.

---

### Task 8: SDLC quality gates (mandatory)

- [ ] **`/simplify`** on the branch diff (one pass; the diff is small). *Verify:* the edits applied or skipped, each with a reason, recorded in the Execution notes.
- [ ] **`/code-review medium`** on the branch diff. *Verify:* each finding fixed, or dismissed with written justification (use the `review-response` skill).
- [ ] **`/security-review`** on the branch diff. Watch in particular the child-process spawn in the gate: constant args, stdin data only, no shell. *Verify:* findings resolved, or dismissals justified in writing.
- [ ] **Process check:** `npm run feedback:check`. It is advisory, and it is false-green on a committed branch, so also eyeball CONTEXT.md against the diff.

---

### Task 9: Full verification before push

```bash
npx turbo run test --concurrency=2 --force; echo "turbo exit=$?"   # all tasks successful; read failing suite names from raw output if not
(cd services/cleanup-service && npx tsc --noEmit; echo "tsc exit=$?")
npx -y npm@11.19.0 ci; echo "ci exit=$?"
npm exec --workspace=tests -- jest --runTestsByPath regression/doc-context-drift-gate.test.ts regression/sprint-131-workspace-declarations.test.ts --runInBand; echo "root gates exit=$?"
git status --short   # only intended files; no stray tdd→regression moves, no landing churn
```

Confirm that `git push` runs the pre-push suite, and that it is not silent and instant.

---

### Task 10: PR, merge, deploy, smoke

- [ ] **PR:** title `Sprint 131 D8: cleanup-service on eslint 10 (supersedes #244) — lint gate, no-useless-assignment fix`. The body carries `## Summary`, `## Validation`, `## Quality gates` and `## Security dismissals` (`pr-contract.yml:31`). *Validation* cites the gate's red-then-green, I1–I3, the lock proof (node diff, registry parity, `npm ls` set unchanged, strict ci) and resolution per workspace. It says explicitly that CI's lint step is not evidence (V2), and it includes "Supersedes #244".
- [ ] **CI:** expect 20 pass and 1 skip (Deploy). `Test Backend Services` must show cleanup-service's regression run including the new file. `Build Docker Images (cleanup-service)` must pass, because the builder stage installs devDeps from the lock.
- [ ] **Land the handoff before asking for merge auth** (the stranded-handoff lesson). Then ask the maintainer for explicit authorization for **this** PR, and run `gh pr merge <N> --squash --admin` only on that authorization. Try once. If the classifier refuses, hand over the command.
- [ ] **Deploy:** watch the CI/CD run through to `🎉 Demo Deployment Successful` and all 9 services healthy, with no rollback.
- [ ] **Smoke** (one login, read-only): `POST /api/auth/login` 200, then `/api/requests`, `/api/conversations` and `/api/reputation/karma/:userId` all 200. Nothing in the running system changed, and this confirms the deploy did no harm.
- [ ] **Post-merge:** confirm Dependabot closed #244 (its range is now satisfied on master), or close it with a pointer to the merged PR. Update the handoff and the lane-holder memory: D8 shipped, next is D9 #245 ioredis 6.

---

## Execution notes

Executed inline (superpowers:executing-plans) on 2026-09-28, Windows box.

**Task 1 refresh.** `merge-base HEAD origin/master` = `de01c53e` = `origin/master`. #244 is still OPEN at head `1c32364d` and touches the same 2 files. The latest 10.x releases are `@eslint/js` 10.0.1 and `eslint` 10.11.0, unchanged from planning. Master is 11.71.0. Baseline: `npx eslint src` exit 0 on eslint 9.

**Task 2, the red.** The unit pin was green on the current code (9/9 in `expirationJob.test.ts`). On eslint 9 the gate ran A green (the peer clause was skipped: 9.39.5 declares no peer), B green, and **C red** (`Received: []`).

**Task 3, the splice.** The candidate had 32 added nodes (19 cleanup-prefixed, 13 at the root), 0 removed, and 1 changed (the workspace node), matching V6 exactly. `splice.js` printed `added 32 nodes; relocated 13 ; @keyv/bigmap nested under @cacheable/memory`.
- **Byte scope.** `git diff --numstat` gives +454/−2. The plan estimated "about +464"; the difference is in the estimate only, because every added top-level key is under `services/cleanup-service` and the only removed lines are the two old ranges.
- **Registry parity.** All 32 nodes are `dev: true`, and all 8 fields match. One exception is normalization, not a real mismatch: `@types/esrecurse` publishes `dependencies: {}` and `peerDependencies: {}`, and npm leaves empty maps out of the lock.
- **Lock-only `npm ls` (lsnorm).** Base 51 lines, splice 51, diff empty. The raw candidate gives 53: it adds `keyv@4.5.4 deduped invalid: "^5.6.0" from node_modules/@keyv/bigmap` and its `npm error` twin, which is the negative control.
- **Idempotency.** An npm 11.19.0 `install --package-lock-only` over the spliced lock changed 0 nodes.
- **Real install.** `npx -y npm@11.19.0 ci` exit 0. `eslint --version` prints `v10.11.0`, and `--cache src` gives exit 1 with only `153:7 no-useless-assignment`. bigmap resolves `…/@cacheable/memory/node_modules/@keyv/bigmap`, and its `keyv` resolves `…/@cacheable/memory/node_modules/keyv` at 5.6.0.
- **Installed `npm ls`.** The problem set is identical to the pre-bump baseline (`@react-native/metro-config`, `color-string`, `ms`, `picomatch`) with no keyv line.
- **Resolution.** cleanup resolves `eslint` 10.11.0 and `@eslint/js` 10.0.1. The root, frontend, landing and mobile resolve eslint 9.39.5.
- **Audit.** 3 moderate findings (`decode-uri-component`, `expo-router`, `query-string`), all pre-existing in the expo tree. None are in the new nodes.
- **Gate after the bump.** A green (10 === 10, peer `^10.0.0`), **B red on exactly `src/jobs/expirationJob.ts:153 no-useless-assignment`**, C green.
- Step 4.6's negative control was not re-run, because the counts were unchanged.

**Task 4.** After the fix: `tsc --noEmit` 0, `eslint src` 0 with no output, jest 12/12 (the unit pin unchanged since Task 2, plus the gate 3/3).

**Task 5, the injections** (each on a committed tree, restored with `cp` from a byte copy, and `git status` clean after each):
- **I1** (`let batchDeleted = 0;`): **B red** with `src/jobs/expirationJob.ts:153 no-useless-assignment`. A and C green.
- **I2** (`js.configs.recommended,` deleted): **C red** with `Received: []`, all three rule ids missing. **B stayed green**, which confirms that B alone cannot see a hollowed-out config.
- **I3** (`node_modules/eslint` → `eslint.off`, so cleanup resolves the hoisted 9.39.5): **A red**, `Expected: 10, Received: 9`. After renaming it back, `eslint --version` prints `v10.11.0`.
- The gate was promoted by `git mv` to `tests/regression/`, and it is 3/3 green there. The promoter was not run.

**Tasks 6–9.**
- **Landing.** Regenerating it also refreshed the notification and request service pages, which were stale copies of the D4 and D6 CONTEXT sections already on master. That content is kept. The timestamp and HEAD-sha churn is reverted.
- **Version.** Bumped 11.71.0 → 11.72.0 (3 lines), with strict ci exit 0.
- **/simplify.** One fix applied: resolve eslint's `package.json` once. "A timeout is indistinct" was skipped as a false positive, because `spawnSync` sets `ETIMEDOUT` on `result.error`.
- **/code-review and /security-review.** Both medium, both clean.
- **The plan missed one gate interaction.** The first forced turbo run failed `tests/regression/sprint-131-workspace-declarations.test.ts` › "a root bump cannot silently strand a workspace" on `services/cleanup-service devDependencies: eslint@^10.11.0 vs root-hoisted 9.39.5`. That is correct: it is the deliberate "pair in cleanup" divergence. It got a reviewed `DIVERGENCE_ALLOWLIST` entry (`b3ec28f2`), whose stale-entry check fails, requiring the entry to be removed, once root moves to 10, plus a CONTEXT note (`cccca1bb`).
- **Final run.** Turbo 27/27 forced. The pre-push suite ran (2m26s). PR [#276](https://github.com/ravichavali/karmyq/pull/276) is open.
