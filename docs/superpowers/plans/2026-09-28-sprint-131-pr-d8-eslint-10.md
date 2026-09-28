# Sprint 131 D8 — cleanup-service on eslint 10 (supersedes #244) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `services/cleanup-service` to `@eslint/js` **and** `eslint` 10 as a matched pair, fix the one lint error the new `recommended` set raises, and add the first gate that fails when cleanup-service's lint breaks.

**Architecture:** Dependabot #244 bumps only `@eslint/js`. That leaves it paired with the hoisted `eslint@9.39.5`, outside its peer range, and it breaks lint in a way CI cannot see. This PR supersedes #244. It adds a nested `eslint@10` subtree under `services/cleanup-service/node_modules/`, spliced into the lock in place. The root and the three apps stay on eslint 9. A workspace regression test runs the real eslint binary, so a lint break now reddens `npm test` and CI.

**Tech Stack:** the canonical stack in `CLAUDE.md` → *System Architecture*.

**Spec:** [Sprint 131 design](../specs/2026-09-15-sprint-131-maintenance-design.md), extended by the maintainer's decision of 2026-09-28 that the queued Dependabot majors become D8+, one per PR, each planned first (handoff banner). **D8 scope decisions (maintainer, 2026-09-28, this planning chat):**
1. **"Pair in cleanup":** bump `@eslint/js` and `eslint` to 10 in `services/cleanup-service` only. Root, `apps/frontend`, `apps/landing` and `apps/mobile` stay on eslint 9.
2. **"Regression test":** add a workspace gate for cleanup-service lint, proven by mutation. Making CI's lint step blocking repo-wide is **out of scope**. Log it in `docs/IDEAS.md`.

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

**Expect every new lock node to sit under `services/cleanup-service/node_modules/`, and none elsewhere.** Nothing outside that prefix may change except the workspace node's two dev ranges and the root version.

**V7: no other workspace imports `@eslint/js`.** `git grep -n "@eslint/js" -- ':!package-lock.json'` finds only `services/cleanup-service/eslint.config.js:2` and its manifest. No de-hoist hazard exists: the hoisted `@eslint/js@9.39.5` stays, because the root eslint 9 depends on it.

**V8: `npm ls --all` baseline.** On the Windows checkout at `de01c53e`, the invalid set is `color-string@2.1.4`, `ms@2.0.0` and `picomatch@2.3.2`, all pre-existing. The handoff also records a missing `@react-native/metro-config`. **Judge the splice by "no new errors".**

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
| `package-lock.json` | Workspace node ranges, plus the nested eslint 10 subtree under `services/cleanup-service/node_modules/`. Also root `version` |
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
3. **Never let the splice touch anything outside `services/cleanup-service/node_modules/`,** apart from the workspace node's two ranges and the root version (V6). A Windows re-resolve strips `libc` fields and drops override nodes, so splice only the intended entries onto a byte copy of the base lock. Sort map-valued fields (npm stores them key-sorted, the registry returns them unsorted). Prove it with a node diff and registry parity, **not** with `npm ci`, which never writes the lock.
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
npm ls --all 2>&1 | grep -E " invalid| missing" | sed 's/^[ |`-]*//' | sort -u > "$SCRATCH/npmls.base.txt"; echo "exit=${PIPESTATUS[0]}"
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

- **A: the pair matches.** Resolve both `eslint/package.json` and `@eslint/js/package.json` from `SERVICE_DIR`. Assert `major(eslint.version) === major(eslintJs.version)`, and read `@eslint/js`'s `peerDependencies.eslint`. Assert it is `^<major>.0.0` with the same major. Parse the major with `Number(v.split('.')[0])`. On the current tree this is 9 === 9, and after the bump 10 === 10. It survives future lockstep bumps and goes red on #244's mixed state.
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

Expected: **A green** (9/9), **B green** (lint is clean today), **C red** (rules absent). Record the output.

- [ ] **Step 4: Commit** (`test(cleanup): pin batchHardDelete + eslint gate (D8 red)`)

---

### Task 3: Bump the pair and splice the lock

**Files:** `services/cleanup-service/package.json`, `package-lock.json`

- [ ] **Step 1: Manifest.** In `services/cleanup-service/package.json` devDependencies, set `"@eslint/js": "^10.0.1"` and `"eslint": "^10.11.0"`, or the latest 10.x from Task 1 Step 3.

- [ ] **Step 2: Re-resolve in a scratch copy, never in the repo**

Copy the repo's `package.json`, `package-lock.json` and every workspace `package.json` into `$SCRATCH/resolve/`, keeping their paths. Run `npx -y npm@11.19.0 install --package-lock-only --ignore-scripts --no-audit --no-fund` there. This produces a candidate lock only, and it is **never committed**.

- [ ] **Step 3: Splice**

Write `$SCRATCH/splice.js`, a Node script (use the Write tool, not a heredoc, because heredocs eat backslashes). Starting from `lock.base.json`, it:
- takes **only** candidate nodes whose key starts with `services/cleanup-service/node_modules/` and that are new or differ from base;
- takes the `services/cleanup-service` workspace node's two devDependency ranges;
- removes base nodes under that prefix that the candidate dropped (expect none, and list any it finds);
- keeps every other node and field byte-identical and in base key order, inserting new keys where npm sorts them (lexicographic among `packages` keys);
- sorts map-valued fields (`dependencies`, `peerDependencies`, `peerDependenciesMeta`, `engines`, `funding` objects).

Write the result to `package-lock.json`.

- [ ] **Step 4: Prove the splice**

```bash
node "$SCRATCH/lockdiff.js" "$SCRATCH/lock.base.json" package-lock.json
```

Expected, and asserted by the script:
- (a) every added or changed key is under `services/cleanup-service/node_modules/` or is `services/cleanup-service`;
- (b) 0 key-order changes among pre-existing nodes;
- (c) the added set includes `…/eslint` at `10.11.0` and `…/@eslint/js` at `10.0.1`, plus the nested set predicted by V6;
- (d) for **every** added node, `version`, `resolved`, `integrity`, `license`, `engines`, `dependencies`, `peerDependencies` and `peerDependenciesMeta` equal `npm view <name>@<version> --json` (registry parity), with no `dev: false`. Every node must carry `"dev": true`.

Then run:

```bash
npx -y npm@11.19.0 ci; echo "ci exit=$?"          # consistency + integrity only
npm ls --all 2>&1 | grep -E " invalid| missing" | sed 's/^[ |`-]*//' | sort -u > "$SCRATCH/npmls.after.txt"; diff "$SCRATCH/npmls.base.txt" "$SCRATCH/npmls.after.txt"; echo "diff exit=$?"   # expect 0
node -e 'const p=require("path");const s=p.resolve("services/cleanup-service");for(const n of ["eslint","@eslint/js"])console.log(n,"cleanup:",require(require.resolve(n+"/package.json",{paths:[s]})).version,"root:",require(require.resolve(n+"/package.json",{paths:[process.cwd()]})).version)'
# expect cleanup: 10.11.0 / 10.0.1 ; root: 9.39.5 / 9.39.5
for w in apps/frontend apps/landing apps/mobile; do node -e "console.log('$w', require(require.resolve('eslint/package.json',{paths:[require('path').resolve('$w')]})).version)"; done   # expect 9.39.5 each
```

- [ ] **Step 5: Run the gate.** Case A is green (10 === 10). **Case B is red on exactly `src/jobs/expirationJob.ts:153 no-useless-assignment`**, reproducing V3 on the real install. Case C is green on all three rules. Record the output.

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

*(Filled in during execution: Task 1 refresh results, the gate's red-then-green output, the splice diff summary, I1–I3 outputs, gate results.)*
