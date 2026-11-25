# Sprint 146: Expo SDK Drift Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> **Subagent models:** implementers and per-task reviewers run on `sonnet` (`haiku` for a
> one-file mechanical task); only the final whole-branch review runs on `opus`. Pass the
> model on every dispatch; SDD's fix-loop escalation still applies.

**Goal:** Align the nine drifted Expo SDK-57 pins in `apps/mobile` to Expo's live version map,
prove the existing drift gates green, close #329, and land the Deepmerge #178 re-check as an
ADR-059 documentation reconciliation, shipping as v11.119.0.

**Architecture:** Pure dependency-alignment sprint. The arbiter is Expo's live map via
`npx expo install --check`; the committed shadows (`tests/regression/sprint-122-expo-sdk-alignment.test.ts`,
`scripts/expo-divergences.js`, `security/expo-divergences.json`) already enforce the contract
and need no edits. Only `apps/mobile/package.json`, `package-lock.json`, ADR-059, mobile
docs, and the version strings change.

**Tech Stack:** the canonical stack in `CLAUDE.md` → *System Architecture*. Do not restate
version numbers here — a pinned example goes stale and then gets copied into specs.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| — | None. The enforcement gates already exist; this sprint makes them green. |

### Existing files to modify
| File | Change |
|------|--------|
| `apps/mobile/package.json` | Nine SDK-managed ranges bumped to the live-map values captured in Task 1 |
| `package-lock.json` | 31 hoisted nodes (9 direct targets + 22 transitive closure moves, computed with root overrides applied) spliced in place + the `apps/mobile` workspace node manifest mirror; 0 added, 0 removed (RR1/RR2, Task 3) |
| `docs/adr/ADR-059-dependency-security-gate.md` (~line 524) | Deepmerge paragraph amended: advisory withdrawn 2026-11-16, re-check completed 2026-11-24, obligation closed |
| `apps/mobile/claude.md` | Recent-changes line for the alignment (v11.119.0) |
| `package.json` / `package-lock.json` (root) | Version → v11.119.0 (four-line lock diff, Sprint 145 pattern) |
| `.claude/handoff/CURRENT_HANDOFF.md` | Rewritten for the executing conversation; #178 leaves open candidates |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Never trust a drift number older than the run that produced it.** Capture
   `npx expo install --check` (or `node scripts/expo-divergences.js`) output at execution time
   and bump to *those* values. The issue's numbers and the spec table are evidence, not
   instructions. If the live map differs, the live map wins; if it moved a `SDK_PINNED` package,
   that map entry changes too, with a written reason per its comment contract.
2. **Lockfile edits are surgical, and the splice unit is the closure, not the nine — computed
   with root overrides applied.** Never `npm install --workspace`, never `npm dedupe`, never a
   scratch regen. Run the override-aware closure probe (Sprint 131 PR-268 technique plus a check
   of the root `package.json` `overrides`) to compute every hoisted node the new manifests force
   to move — 22 transitive moves at planning time, 31 nodes total. Then run a reverse-break
   scan: any hoisted node that serves another requirer must NOT move. At planning time the probe
   resolves minimatch via its override (`package.json:70` sets `>=11.0.1`; hoisted 11.0.3
   satisfies it), so there is no minimatch move and NO nest — `tests/regression/sprint-131-d9-security-overrides.test.ts`
   floors every locked copy at the patched version and rejects below-floor copies, nested
   included. Update the `apps/mobile` workspace node's mirrored `dependencies` in the same
   splice. Every changed node is registry-verified (version, resolved, integrity, field set);
   the expected end state is 31 moved nodes + the workspace mirror, 1845 → 1845 nodes, proven by
   strict pinned-npm `npm ci` and a before/after comparison of
   `npm ls --all --package-lock-only --json` root problems (9 at HEAD; none new afterwards).
3. **Do not touch the registered divergences.** `security/expo-divergences.json` stays as-is;
   removing a still-matching entry fails the gate, and widening one to hide drift is forbidden
   (ADR-094).
4. **The gate must report exactly two cleared divergences and zero blocking drift.** Any other
   shape (a stale entry, an unparsed row, exit status other than 0/1) is a gate failure, not a
   partial success.
5. **Windows host.** `scripts/expo-divergences.js` already wraps `npx` in `cmd.exe` on win32;
   use the script rather than hand-running npx for the authoritative result. Use `node -e` for
   lockfile inspection; `jq` is absent in Git Bash.
6. **Deepmerge work is documentation only.** No dependency edit, no upgrade, no registry entry;
   the live re-check evidence (withdrawn advisory, closed PR, zero open alerts) is cited in
   ADR-059 verbatim.
7. **No new tests are added.** The enforcement already exists — the sprint-122 alignment test,
   the sprint-124 divergence-gate regression test, and the daily drift workflow are the red→green
   proof. This sprint makes them green; it does not extend them. If the live map surprises us
   (e.g. a `SDK_PINNED` move), tests-first applies to any gate edit.

---

## Task 1: Branch state + live drift capture

**Files:**
- Modify: none (evidence only)

- [ ] Confirm the branch is `agent/claude/sprint-146-planning` at `013d4923` plus this plan's
      commit; `git fetch origin && git log --oneline origin/master -3` still shows `95d5e8c1`
      on top. If master moved, stop and re-plan — the base changed.

- [ ] Run the authoritative gate and save its exact output for the PR validation ledger:

```bash
node scripts/expo-divergences.js
```

- [ ] Record the captured drift table (package, installed, expoPins) in the PR ledger. As of
      2026-11-24 the nine are: @expo/metro-runtime → ~57.0.19, expo → ~57.0.34,
      expo-constants → ~57.0.25, expo-image-picker → ~57.0.22, expo-linking → ~57.0.14,
      expo-location → ~57.0.24, expo-notifications → ~57.0.26, expo-router → ~57.0.32,
      expo-splash-screen → ~57.0.12. **The captured output supersedes this list if they differ.**

- [ ] Verify no `SDK_PINNED` (non-expo-prefixed) package appears in the captured drift. If one
      does, extend Tasks 2–3 to that package and add a written reason to the `SDK_PINNED` map
      comment per its contract.

- [ ] Record the HEAD baselines the splice must preserve (all read-only). The graph-parity
      baseline is `npm ls --all --package-lock-only --json`, which completes where plain
      `npm ls --all` crashes (`Cannot read properties of null (reading 'edgesOut')` at this HEAD
      under npm 10.8.2 and npm@11.19.0 alike — pre-existing, and a repeated crash proves nothing,
      so it is context only, not the proof):

```bash
node -e "const l=require('./package-lock.json'); console.log('nodes:', Object.keys(l.packages).length)"
npm ls --all --package-lock-only --json > "$SCRATCH/ls-plock-baseline.json" 2>"$SCRATCH/ls-plock-baseline.err"; echo "plock-ls-exit=$?"
node -e '
const fs = require("fs");
const doc = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const problems = [];
(function walk(n, path) {
  if (n.problems) for (const p of n.problems) problems.push(path + " :: " + p);
  for (const [k, v] of Object.entries(n.dependencies || {})) walk(v, path + " > " + k);
})(doc, "root");
console.log("root problems:", (doc.problems || []).length);
for (const p of doc.problems || []) console.log(" -", p);
console.log("total problem lines:", problems.length);' "$SCRATCH/ls-plock-baseline.json"
```

      Expected at this HEAD (verified 2026-11-24): **1845** lock nodes; exit 1 (`ELSPROBLEMS`)
      with **9 root problems**: `invalid: minimatch@11.0.3` (the `>=11.0.1` override forces 11.0.3
      over raw `^3`/`^10` ranges — expected), `missing: @react-native/metro-config@*`
      (react-native-worklets), and seven more (`color-string@2.1.4`, `ms@2.0.0`,
      `picomatch@2.3.2`, `@emnapi/core@1.10.0`, `@emnapi/runtime@1.10.0`,
      `@emnapi/wasi-threads@1.2.1`, `@emnapi/runtime@1.11.2` under sharp-wasm32). Save both the
      root-problem list and the total count; Task 3 Step 6 compares against them.

- [ ] **Verification:** gate exits 1 with exactly the nine `BLOCKING` rows and two
      `REGISTERED DIVERGENCE` rows (jest, @types/jest); nothing else.

## Task 2: Bump the nine manifest ranges

**Files:**
- Modify: `apps/mobile/package.json`

- [ ] Edit the nine `dependencies` ranges in place to the values captured in Task 1 (spec
      section "The drift" is the expected shape). Change nothing else — not `react`,
      not the `expo.install.exclude`, not devDependencies.

- [ ] **Verification (TDD red case):** the sprint-122 test
      `tests/regression/sprint-122-expo-sdk-alignment.test.ts` test "the lockfile satisfies every
      apps/mobile declaration" now FAILS, naming each bumped package with
      `lock has <old>, manifest wants <new>` — that red run is the required pre-implementation
      evidence. The root Jest config excludes regression files (`jest.config.js` testMatch has no
      `tests/regression/` pattern — verified: the bare path selects 0 tests), so select the tests
      config explicitly from the repo root (verified green at planning, 47 tests across both
      regression suites when run together):

```bash
npx jest --config tests/jest.config.js --runTestsByPath tests/regression/sprint-122-expo-sdk-alignment.test.ts --runInBand
```

## Task 3: Closure probe, reverse-break scan, surgical splice, strict proof

**Files:**
- Modify: `package-lock.json`
- Scratch only, never committed: `$SCRATCH/closure.js`, `$SCRATCH/reverse.js`,
  `$SCRATCH/splice.js`, `$SCRATCH/package-lock.before.json`,
  `$SCRATCH/ls-plock-after.json` (`$SCRATCH` = `.tmp/sprint-146/`, gitignored)

Technique precedent: the Sprint 131 PR-268 expo-drift plan
(`docs/superpowers/plans/2026-09-24-sprint-131-pr-268-expo-drift.md`) proved this exact class of
splice: closure probe → in-place node moves → strict pinned-npm `ci` → graph baseline
comparison. This task reuses its probe and splice scripts with two documented deltas: the probe
must apply the root `overrides` (RR1 — for this sprint that single change resolves the minimatch
question: no move, no nest), and the `apps/mobile` workspace node must be mirrored (R2).

- [ ] **Step 1: Run the closure probe** (read-only) against the Task 1 targets. Write
      `$SCRATCH/closure.js` as in the PR-268 plan (its Step 2) **plus the override rule** (RR1):
      before reporting an unsatisfied dependency, check the root `package.json` `overrides` — if
      `overrides[dep]` is a string and the installed version satisfies THAT range, there is no
      move. The added lines:

```js
const OVERRIDES = require(process.cwd() + '/package.json').overrides || {};
// inside the dep loop, after the declared-range check fails:
const ov = OVERRIDES[dep];
if (have && typeof ov === 'string' && semver.satisfies(have, ov)) { report.push(`${path}@${moved[path]} needs ${dep}@${range}; OVERRIDE ${ov} satisfied by ${have} — no move`); continue; }
```

```bash
node "$SCRATCH/closure.js" '{"node_modules/@expo/metro-runtime":"57.0.19","node_modules/expo":"57.0.34","node_modules/expo-constants":"57.0.25","node_modules/expo-image-picker":"57.0.22","node_modules/expo-linking":"57.0.14","node_modules/expo-location":"57.0.24","node_modules/expo-notifications":"57.0.26","node_modules/expo-router":"57.0.32","node_modules/expo-splash-screen":"57.0.12"}'; echo "exit=$?"
```

      Expected at planning time (live map 2026-11-24, override-aware probe run and verified):
      `exit=0`; the final `MOVES=` JSON holds the nine targets **plus exactly these 22 transitive
      moves** (each forced by a published manifest, R1):

| Lock node | From | To |
|---|---|---|
| node_modules/@expo/log-box | 57.0.4 | 57.0.5 |
| node_modules/@expo/cli | 57.0.32 | 57.0.35 |
| node_modules/expo-asset | 57.0.20 | 57.0.22 |
| node_modules/@expo/config | 57.0.10 | 57.0.12 |
| node_modules/@expo/fingerprint | 0.20.14 | 0.20.17 |
| node_modules/babel-preset-expo | 57.0.16 | 57.0.17 |
| node_modules/expo-modules-core | 57.0.24 | 57.0.26 |
| node_modules/@expo/metro-config | 57.0.13 | 57.0.14 |
| node_modules/@expo/config-plugins | 57.0.11 | 57.0.13 |
| node_modules/expo-modules-autolinking | 57.0.16 | 57.0.18 |
| node_modules/@expo/local-build-cache-provider | 57.0.9 | 57.0.10 |
| node_modules/@expo/env | 2.4.3 | 2.4.4 |
| node_modules/@expo/image-utils | 0.11.6 | 0.11.7 |
| node_modules/expo-glass-effect | 57.0.4 | 57.0.5 |
| node_modules/@expo/schema-utils | 57.0.2 | 57.0.3 |
| node_modules/@expo/plist | 0.8.1 | 0.8.2 |
| node_modules/agent-cli-detector | 0.1.7 | 0.1.8 |
| node_modules/@expo/require-utils | 57.0.6 | 57.0.7 |
| node_modules/@expo/router-server | 57.0.14 | 57.0.16 |
| node_modules/@expo/inline-modules | 0.1.8 | 0.1.10 |
| node_modules/@expo/metro-file-map | 57.0.4 | 57.0.5 |
| node_modules/@expo/prebuild-config | 57.0.19 | 57.0.21 |

      and exactly one `OVERRIDE ... — no move` line:

      `node_modules/@expo/fingerprint@0.20.17 needs minimatch@^10.2.6; OVERRIDE >=11.0.1 satisfied by 11.0.3 — no move`

      (`package.json:70` overrides minimatch to `>=11.0.1`; hoisted 11.0.3 satisfies it.
      `tests/regression/sprint-131-d9-security-overrides.test.ts` floors every locked minimatch
      copy at 11.0.1 — below-floor copies, including nests, fail the security gate. There is
      therefore no minimatch move and no minimatch nest.) Save the final JSON line as
      `$SCRATCH/moves.json` — **31 entries**. If the probe output differs, the map or the lock
      moved — trust the probe, update this table, and continue. If it exits 2 (an unsatisfied
      dep resolving to NOTHING or an already nested node), stop and report to the maintainer.

- [ ] **Step 2: Run the reverse-break scan.** The probe plans moves but does not check who else
      a moved hoisted node serves. For every planned move, resolve each lock declaration with
      Node semantics from the requirer's path and fail if any requirer that today resolves at the
      hoisted slot would break. Write `$SCRATCH/reverse.js`:

```js
// Read-only: for every planned HOISTED move, check all lock-declared ranges that resolve AT that
// hoisted node; a move that breaks another requirer must become a nested add instead. Nests are
// NOT passed in: they leave the hoisted node untouched, so they cannot break anyone.
const semver = require(require.resolve('semver', { paths: [process.cwd()] }));
const P = require(process.cwd() + '/package-lock.json').packages;
const moved = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8')); // lockpath -> version
function resolveFrom(path, dep) {
  let base = path;
  for (;;) {
    const cand = (base ? base + '/' : '') + 'node_modules/' + dep;
    if (P[cand]) return cand;
    if (!base) return null;
    const i = base.lastIndexOf('/node_modules/');
    base = i >= 0 ? base.slice(0, i) : '';
  }
}
const breaks = [];
for (const [path, node] of Object.entries(P)) {
  if (!node || typeof node !== 'object' || path === '') continue;
  const selfName = path.slice(path.lastIndexOf('node_modules/') + 13);
  const selfPath = path.includes('node_modules/') ? path : null;
  for (const f of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [dn, range] of Object.entries(node[f] || {})) {
      if (selfPath && selfPath in moved && f !== 'peerDependencies') continue; // own manifest is replaced
      const target = 'node_modules/' + dn;
      if (!(target in moved)) continue; // dn is not a hoisted move (it may be a nest — nests can't break)
      const at = resolveFrom(path, dn);
      if (at !== target) continue; // this requirer resolves elsewhere (a nested copy) — untouched
      if (!semver.satisfies(moved[target], range, { includePrerelease: true }))
        breaks.push(`${path} (${f}) resolves ${dn}@${range} at the hoisted slot — move to ${moved[target]} BREAKS it`);
    }
  }
}
console.log(breaks.length ? breaks.join('\n') : 'REVERSE SCAN CLEAN');
process.exit(breaks.length ? 1 : 0);
```

```bash
node "$SCRATCH/reverse.js" "$SCRATCH/moves.json"; echo "exit=$?"
```

      Expected at planning time: `REVERSE SCAN CLEAN` for the 31 hoisted moves (verified
      2026-11-24, override-aware closure). Any other output: stop; if a moved node serves another
      requirer, re-plan THAT node as a nested add and document why — but never below an override
      floor (RR1: `tests/regression/sprint-131-d9-security-overrides.test.ts` rejects every
      locked copy under the patched version, nested included).

- [ ] **Step 3: Confirm the override resolution — no minimatch change at all.** The probe's
      override line (Step 1) is the whole story: `package.json:70` overrides `minimatch` to
      `>=11.0.1`, hoisted 11.0.3 satisfies it, and `@expo/fingerprint@0.20.17`'s raw `^10.2.6`
      edge resolves to the overridden range — exactly what npm's own Arborist OverrideSet does
      (verified 2026-11-24). Therefore: **no minimatch lock entry is touched, no nested copy is
      added**, `tests/regression/sprint-131-d9-security-overrides.test.ts` sees the same single
      hoisted minimatch at 11.0.3 it sees today, and the expected node count stays **1845**.
      Expected final state: **31 hoisted moves + the workspace mirror, 0 added, 0 removed**.

- [ ] **Step 4: Bump the nine manifest ranges** — as Task 2, then splice with the PR-268
      `splice.js` (its plan Step 4) with these deltas: (a) iterate the 31 moves from
      `$SCRATCH/moves.json`; (b) keep the node-count guard as PR-268 wrote it — "refuse if the
      node count changes" (no nests exist to permit); (c) the script's existing
      `P['apps/mobile'][f] = pkg[f]` mirror line now matters — it is the R2 fix: the workspace
      node's `dependencies` must equal the bumped manifest (verify parity explicitly in Step 5).
      Take a byte copy first — `git checkout --` would also wipe the Task 2 manifest edit:

```bash
cp package-lock.json "$SCRATCH/package-lock.before.json"
node "$SCRATCH/splice.js" "$SCRATCH/moves.json"; echo "exit=$?"
```

      Expected: 31 `a -> b` lines, `nodes 1845 -> 1845`.

- [ ] **Step 5: Prove the diff is exactly what the closure predicted** — the PR-268 plan's Step 5
      comparison, with expectations `changed 32` (31 moved package nodes + the `apps/mobile`
      workspace node), `added 0`, `removed 0`, no `INTEGRITY MISMATCH`; plus the R2 parity check:

```bash
node -e '
const lock = require("./package-lock.json");
const pkg = require("./apps/mobile/package.json");
const a = JSON.stringify(lock.packages["apps/mobile"].dependencies);
const b = JSON.stringify(pkg.dependencies);
console.log(a === b ? "workspace-node parity OK" : "WORKSPACE NODE STALE"); process.exit(a === b ? 0 : 1);'
```

- [ ] **Step 6: Strict install proof** — on Windows run from an uppercase `C:\` working
      directory (cmd `cd /d C:\Users\ravic\development\karmyq`; a lowercase `c:\` cwd writes
      workspace junctions that crash later `npm ls` — recorded gotcha, `apps/mobile/claude.md`).
      Pin npm exactly as the PR-268 proof did:

```bash
sha256sum package-lock.json > "$SCRATCH/lock.sha"
npx -y npm@11.19.0 ci; echo "ci-exit=$?"
sha256sum -c "$SCRATCH/lock.sha"; echo "unchanged-exit=$?"
npm ls --all --package-lock-only --json > "$SCRATCH/ls-plock-after.json" 2>/dev/null; echo "plock-ls-exit=$?"
node -e '
const fs = require("fs");
const before = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const after = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const root = (d) => (d.problems || []).slice().sort();
const b = root(before), a = root(after);
const newOnes = a.filter(p => !b.includes(p));
const gone = b.filter(p => !a.includes(p));
console.log("root problems before:", b.length, "after:", a.length);
console.log("new:", newOnes.length ? newOnes : "none");
console.log("resolved:", gone.length ? gone : "none");
if (newOnes.length) process.exit(1);' "$SCRATCH/ls-plock-baseline.json" "$SCRATCH/ls-plock-after.json"; echo "compare-exit=$?"
```

      Expected: `ci-exit=0`; `unchanged-exit=0` (`npm ci` never writes the lock); `compare-exit=0`
      — **no new root problems**. The same 9 baseline problems are expected to remain (the
      override-driven `invalid: minimatch@11.0.3` among them, since raw `^10` ranges stay
      overridden, not satisfied); a baseline problem disappearing is acceptable only if the
      splice plausibly resolved it (e.g. a moved manifest no longer declaring the bad edge) —
      investigate any such line in the diff review. Propagation paths under `dependencies` may
      shift as manifests move; only ROOT problem kinds are compared.

- [ ] **Step 7: Red test turns green** — re-run the Task 2 command (explicit tests config, from
      the repo root, lowercase cwd is fine for jest):

```bash
npx jest --config tests/jest.config.js --runTestsByPath tests/regression/sprint-122-expo-sdk-alignment.test.ts --runInBand
```

      Expected: exit 0; the 'lockfile satisfies every apps/mobile declaration' test now passes.

- [ ] **Step 8: Audit surface unchanged or better:**

```bash
npm audit --audit-level=high; echo "audit-exit=$?"
```

      Expected: exit 0. If the moderate set changed versus master, record before/after in the PR
      body (pre-existing moderates: BUG-041 `decode-uri-component` via expo-router →
      query-string@7).

## Task 4: The drift gates go green

**Files:**
- Modify: none

- [ ] **Verification — the arbiter itself:**

```bash
npx expo install --check
```

run from `apps/mobile`, exits **1** with **exactly the two jest rows** (jest → ~29.7.0,
@types/jest → 29.5.14). That is the designed steady state while the ADR-094 divergences stand:
the raw arbiter lists them as outdated, the committed gate subtracts them (the sprint-124
regression test encodes `status: 1` with both jest rows as the *passing* input). Raw exit 0
would mean the jest pins stopped diverging — the registry entries would go stale and the gate
would fail, so exit 0 here is itself a failure mode requiring registry reconciliation, not
success. The exit-0 check is the committed wrapper in the next bullet (also run in Task 1).

- [ ] **Verification — the committed gate:**

```bash
node scripts/expo-divergences.js
```

must exit 0 and print exactly two `REGISTERED DIVERGENCE` lines (jest, @types/jest) followed by
`✅ Expo divergence gate clean (2 registered divergence(s)).` — no `BLOCKING`, no `❌`.

- [ ] **Verification — the divergence-gate regression test:**

```bash
npx jest --config tests/jest.config.js --runTestsByPath tests/regression/sprint-124-expo-divergence-gate.test.ts --runInBand
```

must pass unchanged (same explicit-config form as Tasks 2/3 — the bare path finds no tests).

## Task 5: Mobile tests + type check + root regression

**Files:**
- Modify: none

- [ ] **Verification — mobile suite and types** (workspace flags; no persistent-`cd` chains,
      which break when steps share one shell):

```bash
npm run type-check --workspace=@karmyq/mobile
npm test --workspace=@karmyq/mobile
```

- [ ] **Verification — full root regression** (the sprint-122/124 files must be included in
      the run, not skipped by cache assumptions):

```bash
npm test
```

Record exit status, suite counts and any cache notes in the PR validation ledger.

## Task 6: Deepmerge #178 re-check — ADR-059 reconciliation

**Files:**
- Modify: `docs/adr/ADR-059-dependency-security-gate.md`

- [ ] Re-verify the live evidence before writing (all three, cite the fresh output):
      `gh api advisories/GHSA-gcqx-w48m-w2h4` (withdrawn_at), `gh pr view 178 --json state`
      (CLOSED), open code-scanning alerts on master (`gh api repos/ravichavali/karmyq/code-scanning/alerts`, 0 open).

- [ ] Amend the deepmerge paragraph (~line 524): record that GHSA-gcqx-w48m-w2h4 was withdrawn
      2026-11-16T18:55:38Z, that the due-by-2026-12-01 re-check was completed in Sprint 146
      (2026-11-24) with PR #178 closed and zero open code-scanning alerts, and that the
      "low with no fix, below the gate floor" reasoning is moot — the advisory no longer exists.
      No registry entry, no upgrade, no exemption change.

- [ ] **Verification:** `grep -n deepmerge docs/adr/ADR-059-dependency-security-gate.md` shows the
      amended paragraph with the withdrawal date; `node scripts/expo-divergences.js --registry-only`
      still exits 0 (registry untouched).

- [ ] **Regenerate the ADR's landing page (review finding R4).** ADR-059 is published:
      `scripts/generate-docs.ts` writes
      `apps/landing/src/data/docs/concepts/adr-059-dependency-security-gate.json`, and
      `.npmrc` `ignore-scripts=true` disables `prebuild`, so CI (`ci.yml` runs only
      `npm run build`) and `scripts/deploy.sh` never regenerate it — committed JSON is what
      ships. Run from the repo root:

```bash
npm run generate-docs --workspace=karmyq-landing
```

      Then `git status` the landing tree: commit `adr-059-dependency-security-gate.json`'s
      content delta. If OTHER generated pages churn, inspect each — revert unrelated churn and
      record why; never commit unreviewed generated output.

- [ ] **Verification:** the JSON's `content` contains the withdrawal date and no longer carries
      an open re-check obligation; `git diff --stat apps/landing` shows the ADR-059 page as the
      only NEW landing change (the branch's four Sprint 145 record files predate this task).

## Task 7: Version bump v11.119.0 + mobile doc line (docs task)

**Files:**
- Modify: `package.json`, `package-lock.json`, `apps/mobile/claude.md`

- [ ] Root `package.json` version → `11.119.0`; lockfile `version` and `packages[""].version`
      → `11.119.0` (the version-only lock diff, same pattern as the v11.118.0 commit `95d5e8c1`,
      whose lockfile stat was 4 diff lines: the two version entries, one add + one delete each).

- [ ] Add a Recent-changes line to `apps/mobile/claude.md`: the nine SDK-managed pins aligned
      to the live SDK-57 map, drift gate green, v11.119.0.

- [ ] **Verification:** `node -e "console.log(require('./package.json').version)"` prints
      `11.119.0`; `git diff --stat` for the lockfile shows the version hunks only beyond the
      Task 3 splice; and `git diff --stat origin/master -- apps/landing` names **exactly these
      five files**, nothing else:

| File | From |
|---|---|
| `apps/landing/src/data/docs/concepts/adr-059-dependency-security-gate.json` | Task 6 (this sprint) |
| `apps/landing/src/data/docs/concepts/adr-062-community-identity-idempotent-creation.json` | `013d4923` Sprint 145 post-merge record (intentional, rides with this PR) |
| `apps/landing/src/data/docs/concepts/adr-106-database-owned-member-count.json` | `013d4923` Sprint 145 post-merge record |
| `apps/landing/src/data/docs/services/community-service.json` | `013d4923` Sprint 145 post-merge record |
| `apps/landing/src/data/docs/services/social-graph-service.json` | `013d4923` Sprint 145 post-merge record |

      (Round-3 review fix: the branch bundles the Sprint 145 record's four landing updates, so
      "only ADR-059" was unachievable; the check now preserves those four and asserts Sprint 146
      adds exactly one.)

## Task 8: Handoff rewrite for the executing conversation

**Files:**
- Modify: `.claude/handoff/CURRENT_HANDOFF.md`

- [ ] Rewrite the handoff per the sprint-planning skill: Sprint 146 goal, spec/plan links,
      critical implementation notes verbatim, task status table (tasks 1–7 done with SHAs and
      evidence), remaining tasks 9–11, and the persistent-context section carried forward. The
      Deepmerge #178 entry leaves the open-candidates list (closed in Task 6); #329 is closed
      by the PR keyword at merge.

- [ ] Record the Step-5b self-audit line: "self-audit at `<sha>`: N findings fixed" (the audit
      ran during planning; re-run the citation checks at execution and update the count).

- [ ] **Verification:** handoff Quick Start names
      `superpowers:subagent-driven-development` (never `/execute-plan`), names this plan's path,
      and instructs reuse of `agent/claude/sprint-146-planning`.

## Task 9: SDLC quality gates

**Files:**
- Modify: none (gates only); fix what the gates find

- [ ] **`/simplify`** on the branch diff — diff is a nine-range manifest bump, a lockfile splice,
      and docs; expected outcome is "nothing to simplify". Record the result.

- [ ] **`/code-review`** on the branch diff — resolve all correctness findings before merge.
      Pay particular attention to: any lock change beyond the 32 predicted changed nodes (31
      hoisted moves + the `apps/mobile` workspace mirror) and the 1 predicted add (nested
      minimatch), any manifest line beyond the nine ranges, any unplanned node add or removal,
      and the ADR-059 wording claiming no upgrade where
      the advisory is withdrawn (two different statements; both must be accurate).
      > **Erratum (execution, 2026-11-25):** "the 1 predicted add (nested minimatch)" above is a
      > round-1 leftover. RR1 removed the nest, and Task 3 measured **changed 32, added 0,
      > removed 0**, with no minimatch node touched. Expect that result, not an add.

- [ ] **`/security-review`** on the branch diff — the dependency-audit standing gate (ADR-059)
      runs on push in CI; the human-level review confirms the splice introduced no unreviewed
      packages: every changed lock node is one of the 31 closure moves or the `apps/mobile`
      workspace mirror, each matching its registry integrity, and no override-floored package
      (minimatch `>=11.0.1` and friends per `tests/regression/sprint-131-d9-security-overrides.test.ts`)
      moved in any direction.

- [ ] **Verification:** each gate's result recorded in the PR validation ledger with the SHA of
      the reviewed HEAD.

## Task 10: Final verification

**Files:**
- Modify: none

- [ ] **The project pre-commit suite.** Note `scripts/pre-commit-check.sh` does NOT run a type
      check (verified — no tsc step); none is needed because this sprint changes no TypeScript
      source, and the mobile type-check already runs in Task 5. Run from the repo root:

```bash
bash scripts/pre-commit-check.sh
```

- [ ] Retain git pre-commit feedback check and pre-push hooks; record the final green run
      (SHA, exit status, cache state, limitations) in the PR validation ledger.

- [ ] **Verification:** exit 0, and `git status` shows only the intended files changed.

## Task 11: Merge + deploy (maintainer-authorized only)

**Files:**
- Modify: none

- [ ] Open the PR from `agent/claude/sprint-146-planning` with the filled
      `.github/pull_request_template.md` body (the `pr-contract` check fails otherwise),
      including `Closes #329`, the PR validation ledger, and the "no user-facing landing docs
      change" assessment. Use the `/deploy` skill for merge → CI/CD → health verification.

- [ ] **Do not merge without the maintainer's explicit yes** — Sprint 145's merge authorization
      does not carry over. After merge: confirm the next daily `expo-sdk-drift.yml` run is green
      and #329 is closed.

- [ ] **Verification:** PR merged as a squash commit on top of `95d5e8c1`; CI/CD deploy run all
      green; nine services healthy; drift workflow green on its next schedule.
