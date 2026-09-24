# Sprint 131 #268 — Expo SDK 57 patch wave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `apps/mobile` back onto Expo's live SDK 57 version map, so that `npx expo install --check` reports only the two registered ADR-094 divergences and issue #268 closes on the next scheduled drift run.

**Architecture:** The PR moves six manifest ranges and splices 13 lockfile nodes in place. It does not re-resolve or regenerate the lockfile, and it adds no dependency. The live arbiter is Expo's version map, read through `node scripts/expo-divergences.js`, which wraps `expo install --check`. The committed regression gates only prove that local files agree with each other, so a green suite alone proves nothing here.

**Tech Stack:** Expo SDK 57, npm 11.19.0 lockfile v3, Node 24, Jest 30 (repo gates).

**Spec:** [issue #268](https://github.com/ravichavali/karmyq/issues/268) (fix recipe) + precedent B3 [#252](https://github.com/ravichavali/karmyq/pull/252) (`238c9009`) + `.claude/handoff/CURRENT_HANDOFF.md` *Expo's map is a moving target*. There is no separate design doc: this is a maintenance catch-up with no design choices.

## Global Constraints

- The dependency lane is held by **Claude** for #268 (maintainer, 2026-09-24). D6 (zod #264) waits until #268 deploys.
- **Never** widen `security/expo-divergences.json` to hide drift. jest `^30.5.1` / @types/jest `^30.0.0` stay exactly as registered.
- **Surgical lockfile edits only.** No `npm install`, `npm install --workspace`, `npm dedupe`, `npx expo install <pkg>` (it runs npm install), or scratch regeneration (CLAUDE.md *Workspace dependencies*).
- Prove the lockfile with strict `npx -y npm@11.19.0 ci`, which must leave `package-lock.json` byte-identical, and with `npm ls --all`, which must report no `npm error` line beyond the 4 that HEAD already has (Task 1 Step 6).
- `npx expo install --check` **must run in `apps/mobile`**. At the repo root it falsely reports "Dependencies are up to date" (B3 finding).
- Version bump: take it from `origin/master`'s `package.json` **at merge time**; today that is 11.67.0 → **11.68.0**. It goes in 3 places: `package.json` `version`, and `package-lock.json` `version` and `packages[""].version`.
- Files are LF in git (`git ls-files --eol` → `i/lf w/lf`). Write with `\n`.
- Host is Windows + Git Bash: use `node -e` rather than `jq`, and capture exit codes directly rather than through `| tail`.
- No master push except the PR merge. The merge needs explicit maintainer authorization **per PR**.

## Verified baseline (2026-09-24, this branch at `78920a5f`)

These facts were measured this session. Re-measure them in Task 1 Step 1 before relying on them.

| Fact | Evidence |
|---|---|
| Live drift = exactly #268's six packages, plus the two registered divergences | `npx expo install --check` in `apps/mobile`, exit 1 |
| All six are hoisted root nodes; there are no nested copies of any of the 13 moved names | lockfile scan: `node_modules/expo` 57.0.24, `node_modules/expo-image-picker` 57.0.19, `node_modules/expo-linking` 57.0.10, `node_modules/expo-location` 57.0.19, `node_modules/expo-notifications` 57.0.20, `node_modules/expo-router` 57.0.22 |
| Only `apps/mobile` declares any of the 13 | workspace-node scan of `package-lock.json` |
| Lockfile node count **1844** | `Object.keys(lock.packages).length` |
| **`SDK_PINNED` needs NO edit.** The issue's recipe says to update "the matching `SDK_PINNED` entry", but that map shadows only the 11 SDK-pinned packages with no `expo` prefix, and none of the six is among them | `tests/regression/sprint-122-expo-sdk-alignment.test.ts:103-115` |
| No reverse break: nothing in the lock declares a range on a moved package that the new version fails | range scan across `dependencies`/`peerDependencies`/`optionalDependencies` |
| Dependabot ignore list unchanged: identities only, and no name is added or removed | `tests/regression/sprint-122-expo-sdk-alignment.test.ts:117-139` |

**Transitive closure**, computed from the registry manifests against the lockfile's resolution paths (probe script in Task 1 Step 2):

| Lock node | From | To | Why |
|---|---|---|---|
| `node_modules/expo` | 57.0.24 | 57.0.25 | direct (#268) |
| `node_modules/expo-image-picker` | 57.0.19 | 57.0.20 | direct |
| `node_modules/expo-linking` | 57.0.10 | 57.0.11 | direct |
| `node_modules/expo-location` | 57.0.19 | 57.0.20 | direct |
| `node_modules/expo-notifications` | 57.0.20 | 57.0.21 | direct |
| `node_modules/expo-router` | 57.0.22 | 57.0.23 | direct |
| `node_modules/@expo/cli` | 57.0.26 | 57.0.27 | expo@57.0.25 needs `^57.0.27` |
| `node_modules/babel-preset-expo` | 57.0.12 | 57.0.13 | expo@57.0.25 needs `~57.0.13` |
| `node_modules/expo-modules-core` | 57.0.18 | 57.0.19 | expo@57.0.25 needs `~57.0.19` |
| `node_modules/expo-modules-jsi` | 57.1.0 | 57.1.1 | expo-modules-core@57.0.19 needs `~57.1.1` |
| `node_modules/@expo/ui` | 57.0.19 | 57.0.20 | expo-router@57.0.23 needs `^57.0.20` |
| `node_modules/expo-glass-effect` | 57.0.3 | 57.0.4 | expo-router@57.0.23 needs `^57.0.4` |
| `node_modules/@expo/router-server` | 57.0.10 | 57.0.11 | @expo/cli@57.0.27 needs `^57.0.11` |

The expected lockfile diff is therefore **14 changed nodes**: the 13 above plus the `apps/mobile` workspace node, which mirrors the manifest. It also includes the root `version` field and `packages[""]` from Task 2, with **0 added and 0 removed**. The probe does not evaluate `peerDependencies`; `npm ls --all` in Task 1 covers them.

## Review Focus

1. **Expo's map moves again before merge.** B3 got a second wave about 10 hours into the PR, and the measured cadence gives a window of roughly 3 days. Expected behavior: the drift re-check at merge time (Task 3 Step 4) is red, and the executor re-targets with the same scripts rather than merging a stale PR.
2. **A moved package's new manifest adds a dependency the lockfile cannot resolve.** Expected behavior: the probe prints `resolves NOTHING` and the splice script aborts before writing anything. A partial splice must never be committed. (Task 1 Steps 2 and 4.)
3. **Strict `npm ci` quietly rewrites the spliced lock**, for example through key order or dropped `libc` fields, the Windows trap in `feedback_windows_lock_resolve_needs_splice`. Expected behavior: the SHA-256 of `package-lock.json` before and after `npm ci` is identical, and the step fails otherwise. (Task 1 Step 6.)
4. **The peer ranges of a moved package are unsatisfied**, which the probe does not check. Expected behavior: `npm ls --all` adds no `invalid` or `missing` line beyond the HEAD baseline, and the step fails otherwise. (Task 1 Step 6.)
5. **A moved package carries a new high or critical advisory.** Expected behavior: `npm audit --audit-level=high` exits 0. The pre-existing moderates (BUG-041 `decode-uri-component` via expo-router → query-string@7) are recorded, not "fixed" with an override. (Task 1 Step 8.)

No new committed test is added. A regression test pinning these patch versions would be exactly the hand-written shadow map that CLAUDE.md Discipline 5 calls false-green. The failing "test" in this TDD cycle is the live arbiter, `node scripts/expo-divergences.js`, which is red now (Step 1) and must be green after (Step 7). The committed gates (`sprint-122`, `sprint-124`, `sprint-131-workspace-declarations`) must stay green as a floor, and `sprint-122`'s *the lockfile satisfies every apps/mobile declaration* is what fails if the manifest moves without the lockfile.

---

### Task 1: Move the six manifest ranges and splice the 13 lock nodes

**Files:**
- Modify: `apps/mobile/package.json:23,28-32` (six ranges)
- Modify: `package-lock.json` (14 nodes, in place)
- Scratch only, never committed: `$SCRATCH/closure.js` and `$SCRATCH/splice.js`, where `SCRATCH` is the session scratchpad directory

**Interfaces:**
- Produces: a `targets` JSON object mapping lock path to version, the output of Step 2 and the input to Step 4. Task 3 reuses both scripts unchanged if the map moves.

- [ ] **Step 1: Re-measure the arbiter (expect RED)**

```bash
cd apps/mobile && npx expo install --check; echo "check-exit=$?"; cd ../..
node scripts/expo-divergences.js; echo "gate-exit=$?"
```

Expected: `check-exit=1`, listing exactly the six packages in the table above plus `@types/jest` and `jest`; `gate-exit` is non-zero and names the six as blocking drift. **If the list differs, the map has moved.** Use the versions it now prints as the direct targets in Step 2 and update this plan's tables before continuing.

- [ ] **Step 2: Re-run the closure probe against the direct targets**

Write `$SCRATCH/closure.js`:

```js
// Read-only: compute which lock nodes must move when the direct targets are applied.
// For each node being moved, fetch its target manifest and resolve each dependency the way
// Node would (nearest node_modules walking up the path), against already-planned moves.
const { execFileSync } = require('child_process');
const semver = require(require.resolve('semver', { paths: [process.cwd()] }));
const P = require(process.cwd() + '/package-lock.json').packages;
const npm = (args) => execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args,
  { encoding: 'utf8', shell: process.platform === 'win32' });

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

const moved = JSON.parse(process.argv[2]);
const queue = Object.keys(moved);
const report = [];
let unresolved = 0;
while (queue.length) {
  const path = queue.shift();
  const name = path.slice(path.lastIndexOf('node_modules/') + 13);
  const m = JSON.parse(npm(['view', `${name}@${moved[path]}`, 'dependencies', 'optionalDependencies', 'version', '--json']));
  const deps = { ...(m.dependencies || {}), ...(m.optionalDependencies || {}) };
  for (const [dep, range] of Object.entries(deps)) {
    const at = resolveFrom(path, dep);
    const have = at ? (moved[at] || P[at].version) : null;
    if (have && semver.satisfies(have, range)) continue;
    report.push(`${path}@${moved[path]} needs ${dep}@${range}; resolves ${at || 'NOTHING'}@${have}`);
    if (!at) { unresolved++; continue; }
    if (at.split('node_modules/').length !== 2) { unresolved++; report.push('  !! nested node — splice by hand after review'); continue; }
    const vs = [].concat(JSON.parse(npm(['view', `${dep}@${range}`, 'version', '--json'])));
    const v = vs[vs.length - 1];
    if (!moved[at]) { moved[at] = v; queue.push(at); report.push(`  -> move ${at} ${P[at].version} -> ${v}`); }
  }
}
console.log(report.join('\n') || '(no further transitive moves)');
console.log(JSON.stringify(moved));
process.exit(unresolved ? 2 : 0);
```

Run from the repo root:

```bash
node "$SCRATCH/closure.js" '{"node_modules/expo":"57.0.25","node_modules/expo-image-picker":"57.0.20","node_modules/expo-linking":"57.0.11","node_modules/expo-location":"57.0.20","node_modules/expo-notifications":"57.0.21","node_modules/expo-router":"57.0.23"}'; echo "exit=$?"
```

Expected: `exit=0`. The final JSON line holds exactly the 13 entries in the closure table. If `exit=2`, **stop**: a new manifest wants something that isn't in the lockfile, or a nested node. Report it to the maintainer; a hand splice that adds nodes is outside this plan's scope. Save the final JSON line as `TARGETS`.

- [ ] **Step 3: Edit the six manifest ranges**

In `apps/mobile/package.json`, change only these lines:

```json
    "expo": "~57.0.25",
    "expo-image-picker": "~57.0.20",
    "expo-linking": "~57.0.11",
    "expo-location": "~57.0.20",
    "expo-notifications": "~57.0.21",
    "expo-router": "~57.0.23",
```

`git diff --stat apps/mobile/package.json` → `6 insertions(+), 6 deletions(-)`.

- [ ] **Step 4: Splice the lockfile in place**

Write `$SCRATCH/splice.js`:

```js
// Surgical splice: patch each target node's registry-derived fields in place (existing key
// order preserved, new keys appended), mirror apps/mobile's manifest into its workspace node,
// and refuse to write if any node would be added or removed.
const fs = require('fs');
const { execFileSync } = require('child_process');
const LOCK = process.cwd() + '/package-lock.json';
const lock = JSON.parse(fs.readFileSync(LOCK, 'utf8'));
const P = lock.packages;
const before = Object.keys(P).length;
const targets = JSON.parse(process.argv[2]);
const npm = (args) => execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args,
  { encoding: 'utf8', shell: process.platform === 'win32' });
const FIELDS = ['dependencies', 'optionalDependencies', 'peerDependencies', 'peerDependenciesMeta',
  'bin', 'engines', 'os', 'cpu', 'license', 'funding'];

for (const [path, version] of Object.entries(targets)) {
  const node = P[path];
  if (!node) throw new Error(`${path} missing from lock — refusing`);
  const name = path.slice(path.lastIndexOf('node_modules/') + 13);
  const m = JSON.parse(npm(['view', `${name}@${version}`, '--json']));
  const next = { version, resolved: m.dist.tarball, integrity: m.dist.integrity };
  // npm stores map-valued fields key-sorted; registry manifests are not, so sort to avoid order churn.
  const sortMap = (v) => (v && typeof v === 'object' && !Array.isArray(v))
    ? Object.fromEntries(Object.keys(v).sort((a, b) => a.localeCompare(b, 'en')).map((k) => [k, v[k]])) : v;
  for (const f of FIELDS) if (m[f] !== undefined && !(typeof m[f] === 'object' && !Object.keys(m[f]).length)) next[f] = sortMap(m[f]);
  if (m.scripts && (m.scripts.install || m.scripts.preinstall || m.scripts.postinstall)) next.hasInstallScript = true;
  const out = {};
  for (const k of Object.keys(node)) {
    if (k in next) out[k] = next[k];
    else if (FIELDS.includes(k) || k === 'hasInstallScript') console.log(`  - ${path}: drops ${k}`);
    else out[k] = node[k]; // dev/optional/peer flags etc. are about THIS tree, keep them
  }
  for (const k of Object.keys(next)) if (!(k in out)) { out[k] = next[k]; console.log(`  + ${path}: adds ${k}`); }
  P[path] = out;
  console.log(`${path}: ${node.version} -> ${version}`);
}

const pkg = JSON.parse(fs.readFileSync(process.cwd() + '/apps/mobile/package.json', 'utf8'));
for (const f of ['dependencies', 'devDependencies']) P['apps/mobile'][f] = pkg[f];

if (Object.keys(P).length !== before) throw new Error('node count changed — refusing');
fs.writeFileSync(LOCK, JSON.stringify(lock, null, 2) + '\n');
console.log(`nodes ${before} -> ${Object.keys(P).length}`);
```

Take a byte copy first. A `git checkout --` restore would wipe uncommitted edits (`feedback_commit_before_mutation_restores`):

```bash
cp package-lock.json "$SCRATCH/package-lock.before.json"
node "$SCRATCH/splice.js" "$TARGETS"; echo "exit=$?"
```

Expected: `exit=0`, 13 `a -> b` lines, `nodes 1844 -> 1844`. Review every `+ adds` / `- drops` line: each one must reflect a real change in the published manifest, which you confirm with `npm view <pkg>@<old> <field>` against `@<new>`.

- [ ] **Step 5: Prove the diff is exactly what the closure predicted**

```bash
node -e '
const a=require(process.argv[1]).packages,b=require("./package-lock.json").packages;
const ch=Object.keys(b).filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k]));
const add=Object.keys(b).filter(k=>!(k in a)),rm=Object.keys(a).filter(k=>!(k in b));
console.log("changed",ch.length,ch.join(" "));console.log("added",add.length,"removed",rm.length);
for(const k of ch) if(b[k].integrity){const n=k.slice(k.lastIndexOf("node_modules/")+13);
  const want=require("child_process").execSync(`npm view ${n}@${b[k].version} dist.integrity`,{encoding:"utf8"}).trim();
  if(want!==b[k].integrity){console.log("INTEGRITY MISMATCH",k);process.exitCode=1}}
' "$SCRATCH/package-lock.before.json"; echo "exit=$?"
git diff --stat package-lock.json
```

Expected: `changed 14`, meaning the 13 closure nodes plus `apps/mobile`; `added 0 removed 0`; no `INTEGRITY MISMATCH`; `exit=0`.

- [ ] **Step 6: Strict install proves the lock without rewriting it**

```bash
sha256sum package-lock.json > "$SCRATCH/lock.sha"
npx -y npm@11.19.0 ci; echo "ci-exit=$?"
sha256sum -c "$SCRATCH/lock.sha"; echo "unchanged-exit=$?"
npm ls --all > "$SCRATCH/ls.txt" 2>&1; echo "ls-exit=$?"
grep -E "^npm error" "$SCRATCH/ls.txt" | grep -v "complete log"
node -e 'for (const n of ["expo","expo-image-picker","expo-linking","expo-location","expo-notifications","expo-router","@expo/cli","babel-preset-expo","expo-modules-core","expo-modules-jsi","@expo/ui","expo-glass-effect","@expo/router-server"]) console.log(n, require(n + "/package.json").version)'
```

Expected: `ci-exit=0`; `package-lock.json: OK` and `unchanged-exit=0`. `ls-exit=1` is **pre-existing**: HEAD `32588ae9` prints exactly these 4 `npm error` lines — `missing: @react-native/metro-config@*, required by react-native-worklets@0.10.1` and `invalid:` `color-string@2.1.4`, `ms@2.0.0`, `picomatch@2.3.2`. Any **other** `npm error` line is new and fails this step. The installed versions equal the closure table's *To* column. Any rewrite, `invalid` line or mismatch → **stop**: restore from `$SCRATCH/package-lock.before.json` and diagnose. Do not commit.

- [ ] **Step 7: The live arbiter is now GREEN**

```bash
cd apps/mobile && npx expo install --check; echo "check-exit=$?"; cd ../..
node scripts/expo-divergences.js; echo "gate-exit=$?"
```

Expected: `check-exit=1` listing **only** `@types/jest` and `jest`. That is correct: they are the registered divergences, and `--check` does not know about the registry. `gate-exit=0`: both divergences are matched and nothing blocks.

- [ ] **Step 8: Committed gates, types, mobile tests, audit**

```bash
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-122-expo-sdk-alignment.test.ts regression/sprint-124-expo-divergence-gate.test.ts regression/sprint-131-workspace-declarations.test.ts; echo "gates-exit=$?"
cd apps/mobile && npx tsc --noEmit; echo "tsc-exit=$?"; npm test; echo "mobile-exit=$?"; cd ../..
npm audit --audit-level=high; echo "audit-exit=$?"
npm audit 2>&1 | grep -E "^# npm audit report|vulnerabilit" 
```

Expected: every exit is 0. The audit summary shows moderates only, the same set as on master (B3 recorded 3 moderate). If the moderate set changed, record the before/after in the PR body.

- [ ] **Step 9: Commit**

The message is written in a quoted heredoc, because backticks inside `-m` are silently deleted in Git Bash:

```bash
git add apps/mobile/package.json package-lock.json
git commit -F - <<'EOF'
fix(deps): catch apps/mobile up to Expo's live SDK 57 patch map (#268)

expo 57.0.24 -> 57.0.25, expo-image-picker and expo-location 57.0.19 -> 57.0.20,
expo-linking 57.0.10 -> 57.0.11, expo-notifications 57.0.20 -> 57.0.21,
expo-router 57.0.22 -> 57.0.23, manifest ranges moved to the ones Expo expects.

Seven hoisted transitives move with them, each required by a published manifest:
@expo/cli 57.0.27, babel-preset-expo 57.0.13, expo-modules-core 57.0.19
(-> expo-modules-jsi 57.1.1), @expo/ui 57.0.20 and expo-glass-effect 57.0.4
(expo-router), @expo/router-server 57.0.11 (@expo/cli).

Surgical splice: 1844 lock nodes before and after, 0 added, 0 removed, 14 changed
(13 packages + the apps/mobile workspace node); integrity matches the registry.
Strict npm@11.19.0 ci exit 0 with the lock byte-identical; npm ls --all clean.
scripts/expo-divergences.js exit 0 - only the registered ADR-094 jest/@types/jest
divergences remain. SDK_PINNED untouched: it shadows only non-expo pins.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 2: Version bump, local docs, handoff

**Files:**
- Modify: `package.json` (`version`)
- Modify: `package-lock.json` (`version`, `packages[""].version`)
- Modify: `apps/mobile/claude.md:29-30` (new *Recent changes* bullet at the top)
- Modify: `.claude/handoff/CURRENT_HANDOFF.md` (banner + *Next unchecked action*)

**Interfaces:**
- Consumes: Task 1's verified numbers (14 nodes, 1844, the exit codes).

- [ ] **Step 1: Bump the version from origin/master**

```bash
git fetch origin && git show origin/master:package.json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).version))'
```

Expected `11.67.0` → set **11.68.0** in all three places. (If master has moved, use master + 1 minor.)

```bash
node -e '
const fs=require("fs");const v=process.argv[1];
const p=JSON.parse(fs.readFileSync("package.json","utf8"));p.version=v;fs.writeFileSync("package.json",JSON.stringify(p,null,2)+"\n");
const l=JSON.parse(fs.readFileSync("package-lock.json","utf8"));l.version=v;l.packages[""].version=v;fs.writeFileSync("package-lock.json",JSON.stringify(l,null,2)+"\n");' 11.68.0
git diff --stat package.json package-lock.json
```

Expected: `package.json` 1+/1−; the lockfile diff grows by exactly 2 lines. Re-run Task 1 Step 6's `npx -y npm@11.19.0 ci` plus the SHA check after taking a fresh `sha256sum`, and confirm the result is still byte-identical.

- [ ] **Step 2: Add the `apps/mobile/claude.md` Recent-changes bullet**

Insert directly under `## Recent changes`:

```markdown
- **Sprint 131 #268:** six `expo-*` packages move one patch to the live SDK 57 map (Expo
  57.0.25, Router 57.0.23), with seven hoisted transitives their manifests require (`@expo/cli`,
  `babel-preset-expo`, `expo-modules-core`/`-jsi`, `@expo/ui`, `expo-glass-effect`,
  `@expo/router-server`). `SDK_PINNED` is unchanged: it shadows only non-expo pins, even though
  the drift issue's template says to update it. Registered jest divergences untouched.
```

- [ ] **Step 3: Update the handoff**

In `.claude/handoff/CURRENT_HANDOFF.md`, replace the *Next unchecked action: #268* block with a status line naming the branch head, the PR number once opened, the verified numbers from Task 1, and "awaiting merge-time drift re-check + maintainer merge authorization". Update the `D5–D7` row note "D6 waits for #268" to point at this PR. Per `feedback_handoff_stranded_by_merge`, the handoff must land **before** asking for merge authorization.

- [ ] **Step 4: Regenerate-churn guard and full suite**

```bash
npm test; echo "test-exit=$?"
git status --porcelain apps/landing/src/data/docs
```

Expected: `test-exit=0`. Revert any `apps/landing/src/data/docs/` timestamp or HEAD-sha churn with `git checkout -- apps/landing/src/data/docs`. That is safe because those paths have no intended edits in this PR.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json apps/mobile/claude.md .claude/handoff/CURRENT_HANDOFF.md
git commit -F - <<'EOF'
chore: v11.68.0; record the #268 Expo catch-up in mobile context and handoff

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 3: Gates, PR, merge-time re-check

**Files:** none beyond fixes the gates demand.

- [ ] **Step 1: SDLC gates, calibrated to a small, well-specified diff**

Run `/simplify` once. The diff has no product code, so a "nothing to simplify" result is expected; record it. Run `/code-review` at **medium** and `/security-review`, verifying the review findings with the `review-response` skill. Record each outcome, or a written dismissal, in the PR body.

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin agent/claude/sprint-131-expo-drift-268
```

The pre-push hook must visibly run the suite; a silent, instant push means no hook ran. Open the PR with `gh pr create`, filling the repo's PR contract headers (`pr-contract.yml`; follow `.github/pull_request_template.md`). The body must carry the closure table, the Task 1 exit codes, the audit summary, and `Closes #268`. End it with the Claude Code attribution line.

- [ ] **Step 3: CI green**

Watch `gh pr checks <N> --watch`. If CodeQL or the audit gate goes red on this no-code diff, treat it as a mid-flight advisory (`feedback_advisories_publish_mid_flight`) and investigate. Never bypass it.

- [ ] **Step 4: Merge-time drift re-check (Review Focus 1)**

Immediately before asking for authorization:

```bash
cd apps/mobile && npx expo install --check; echo "check-exit=$?"; cd ../..
node scripts/expo-divergences.js; echo "gate-exit=$?"
```

`gate-exit=0` → proceed. Non-zero → the map moved. Re-run Task 1 Steps 1–8 against the new targets on this branch, amending with new commits (never force-push), then repeat this step.

- [ ] **Step 5: Ask the maintainer for merge authorization**

Before asking, confirm through `gh pr list` and the latest deploy run that no other deploy is in flight. Merge only on explicit, per-PR authorization (`gh pr merge <N> --squash --admin` only if they say so). After the deploy, verify: all services healthy, the demo smoke (login + `/api/requests`, `/api/conversations`, `/api/reputation/karma/:userId` → 200), and #268 closing on the next `expo-sdk-drift` run or a manual `workflow_dispatch` if the maintainer approves one. Then reconcile the handoff and hand D6 back to planning.

## Execution notes (2026-09-24)

- **Native execution**, maintainer-approved. Task 1 `65ed0aec`, Task 2 `90bef58f`.
- **Splice-script defect, fixed above:** the first splice wrote map-valued fields in registry order, which put 418 lines of churn into the lockfile. npm stores those fields key-sorted. Sorting them brought the diff to 114 lines, the same as B3, with 0 key-order changes.
- **`npm ls --all` exits 1 on HEAD**, with 4 pre-existing errors (listed in Task 1 Step 6). The expectation above is now "no new errors". Commit `65ed0aec`'s message says "5"; it is 4, and the 5th line was the npm log path.
- Everything else matched the plan: closure 13 nodes, strict ci byte-identical, arbiter clean, gates 57/57, mobile tsc and tests, audit 3 moderate / 0 high (same set as HEAD, BUG-041), `npm test` 27/27.
