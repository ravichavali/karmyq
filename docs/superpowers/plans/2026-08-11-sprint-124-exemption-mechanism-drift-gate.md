# Exemption Mechanism & The Drift Gate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Resolve the `image-size` exemption before it expires 2026-08-17, extract the
exemption-registry validator into a genuinely schema-driven core, and use it to give the Expo drift
workflow a divergence registry that expires with the SDK generation — so a permanently-red gate can
go green without lying.

**Architecture:** A new `scripts/lib/exemption-registry.js` holds the invariants both registries
share (structure, required fields, duplicates, date parsing, expiry dispatch); each registry
supplies its own field spec and expiry rule. `scripts/audit-exemptions.js` keeps its public surface
and its 7-day cap; a new `scripts/expo-divergences.js` consumes `npx expo install --check` and
subtracts registered divergences.

**Tech Stack:** Node.js 24/TypeScript, Jest 30, GitHub Actions. No service, database, or frontend
code is touched.

**Spec:** `docs/superpowers/specs/2026-08-11-sprint-124-exemption-mechanism-drift-gate-design.md`

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `scripts/lib/exemption-registry.js` | Schema-driven registry validator — the shared core |
| `scripts/expo-divergences.js` | Runs the Expo arbiter, subtracts registered divergences, exits non-zero on real drift |
| `security/expo-divergences.json` | The divergence registry (jest, `@types/jest`) |
| `tests/regression/sprint-124-expo-divergence-gate.test.ts` | Proves the new gate REJECTS |
| `tests/regression/sprint-124-registry-core-parity.test.ts` | Proves both specs share one core and the invariants hold identically |
| `tests/regression/fixtures/expo-check-drift.txt` | Captured real `expo install --check` output for the parser |
| `tests/regression/fixtures/expo-divergences-stale.json` | Fixture: entry matching no current drift |
| `tests/regression/fixtures/expo-divergences-wrong-sdk.json` | Fixture: entry tagged for a past SDK generation |
| `docs/adr/ADR-094-generalized-exemption-registries.md` | The decision |
| `apps/landing/src/data/docs/concepts/time-boxed-exemptions.json` | Concept page (authored, then regenerated) |

### Existing files to modify
| File | Change |
|------|--------|
| `security/audit-exemptions.json` | image-size entries renewed with fresh measured rationale, or deleted |
| `scripts/audit-exemptions.js` | Consume the shared core; keep `validateRegistry` export + CLI behaviour identical |
| `.github/workflows/expo-sdk-drift.yml` | Call `scripts/expo-divergences.js` as the verdict; file/close issues on real drift only |
| `apps/mobile/package.json` | Five Expo patch bumps (read live, not from BUG-035's list) |
| `package-lock.json` | Surgical in-place re-resolution for those five |
| `tests/regression/sprint-122-expo-sdk-alignment.test.ts` | `SDK_PINNED` updated to match the bumps, each with a written reason |
| `docs/adr/ADR-059-dependency-security-gate.md` | Amend: validator relocated; 7-day cap is audit-specific |
| `docs/adr/ADR-092-*.md`, `docs/adr/ADR-093-*.md` | `Accepted` → `Implemented` (carried debt) |
| `docs/adr/README.md` | Index ADR-094 |
| `docs/BUGS.md` | BUG-035 → fixed |
| `scripts/claude.md` | Document `scripts/lib/` + `expo-divergences.js` |
| `scripts/generate-docs.ts` | Add ADR-094 to the nav ordering list (`:438-463`) |
| `package.json` | Version → 11.44.0 |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **The audit gate's 36 tests are the behaviour-preservation proof and must pass UNCHANGED.**
   `tests/regression/sprint-123-audit-exemption-gate.test.ts` (377 lines) is not to be edited to
   accommodate the refactor. If a test needs editing, the refactor changed behaviour — fix the
   refactor. This includes **exact error-message strings**: several assertions match on message
   text, so the core must emit byte-identical messages for the audit spec.

2. **`scripts/audit-exemptions.js` must keep exporting `validateRegistry`.**
   `tests/regression/sprint-75-security-gate.test.ts:60` requires the module and
   `.github/workflows/ci.yml:99` runs it by path. Re-export a spec-bound wrapper with the original
   one-argument signature.

3. **`npx expo install --check` output is the arbiter — parsing it is the fragile part.** Capture
   real output into a fixture and unit-test the parser. **Fail closed on unrecognized output**:
   zero parsed lines from a non-zero exit means "I could not tell", never "clean". Copy the pattern
   at `scripts/audit-exemptions.js:206-208`.

4. **Apply the five Expo patch bumps; do not exempt them.** Re-read the live map on the day —
   BUG-035's list is from 2026-08-06 and Expo revised its map twice during one Sprint 122 review.

5. **Lockfile: `npm install --package-lock-only` reports "up to date" while leaving the nested node
   stale.** Delete the affected entries, re-resolve, then **assert the resolved version**. Surgical
   in-place only — never `npm dedupe`, `npm install --workspace`, or a scratch regen on Windows.

6. **Do not touch `MAX_EXEMPTION_DAYS`.** The 7-day cap is the ADR-059 high-severity SLA and stays
   audit-specific. Sharing a validator core is not sharing rules. `critical` stays never-exemptible.

7. **"Remove the need" for image-size is gate-avoidance unless independently justified.** Moving
   `apps/mobile` out of the root lockfile stops the gate *looking* at it; it does not remove the
   vulnerability.

8. **`nav.json` is GENERATED.** Edit `scripts/generate-docs.ts:438-463`, then regenerate and
   grep-verify. This is why it has "silently reverted" before.

9. **`npm test` dirties `apps/landing/src/data/docs/`.** Revert timestamp/HEAD-sha churn before
   committing; keep the genuine ADR-094 content.

10. **Windows.** `jq` absent, `curl` returns spurious `000` — use `node -e` with `fetch`. `npm test`
    under Turbo is red here with `Exceeded timeout of 5000 ms` on long suites; confirm directly with
    `cd tests && npx jest regression/<file>`. Never `| tail` a test run.

11. **Keep the drift workflow schedule-only** (`expo-sdk-drift.yml:17-21`) — a PR trigger would make
    every merge depend on `api.expo.dev`. Verify with `workflow_dispatch`.

---

## Task 1: Branch + resolve the image-size expiry

**Files:**
- Modify: `security/audit-exemptions.json`

- [ ] Cut the branch from `origin/master` — never local master

```bash
git fetch origin
git checkout -b feature/sprint-124-exemption-mechanism origin/master
```

- [ ] **Re-measure upstream.** Record the exact output; it becomes the renewal rationale

```bash
node -e "
const {execFileSync}=require('child_process');
const run=a=>execFileSync(process.platform==='win32'?'cmd.exe':'npm',
  process.platform==='win32'?['/c','npm',...a]:a,{encoding:'utf8'});
console.log('latest:', run(['view','image-size','version']).trim());
console.log('all 2.x:', run(['view','image-size','versions','--json']).trim().slice(-200));
console.log('metro newest:', run(['view','metro','version']).trim());
console.log('metro image-size dep:', run(['view','metro','dependencies.image-size']).trim());
"
```

- [ ] **Apply the decision rule** (spec §"The image-size decision"):
  - latest **> 2.0.2** → delete both entries (the gate fails on an exemption matching nothing)
  - latest **≤ 2.0.2** → renew both with fresh `created: 2026-08-11` / `expires: 2026-08-18` and a
    rationale stating **what was re-measured on 2026-08-11 and what it showed**
  - Do **not** widen the exemption, drop the gate to `critical`, or split `apps/mobile` out of the
    root lockfile to make the finding disappear

- [ ] **Verification — the gate is green and the expiry is genuinely in the future**

```bash
node scripts/audit-exemptions.js
node -e "
const r=require('./security/audit-exemptions.json');
const today=new Date().toISOString().slice(0,10);
for(const e of r.exemptions){
  const days=(new Date(e.expires)-new Date(e.created))/86400000;
  console.log(e.package,e.advisory,e.created,'->',e.expires,'span',days,'d');
  if(!(e.expires>today)) throw new Error('EXPIRED/today: '+e.advisory);
  if(days>7) throw new Error('span exceeds ADR-059 cap: '+e.advisory);
}
console.log('OK');
"
```

---

## Task 2: RED tests for the shared registry core

**Files:**
- Create: `tests/regression/sprint-124-registry-core-parity.test.ts`

Written **before** the extraction (TDD). These must fail now and pass after Task 3.

- [ ] **Assert the core exists and is spec-driven, not audit-shaped**

```ts
const core = require('../../scripts/lib/exemption-registry');
// The core must NOT know what a GHSA id or a severity is.
const src = readFileSync(join(ROOT, 'scripts', 'lib', 'exemption-registry.js'), 'utf8');
expect(src).not.toMatch(/GHSA/);
expect(src).not.toMatch(/\bhigh\b|\bcritical\b/);
```

- [ ] **Assert the shared invariants hold identically under BOTH specs** — table-driven over
      `[auditSpec, expoSpec]`: non-object registry, missing collection, non-object entry, each
      required field missing, duplicate identity, `created` invalid, and the roll-over rejection
      (`2026-02-31` must not be accepted)

- [ ] **Assert the two specs do NOT share rules** — the firewall

```ts
// The audit spec caps at 7 days; the expo spec has no date window at all.
expect(auditSpec.maxDays).toBe(7);
expect(expoSpec.maxDays).toBeUndefined();
// severity:'critical' is rejected under the audit spec, and 'severity' is not even
// a field the expo spec knows.
```

- [ ] **Verification — these tests are RED for the right reason** (module missing, not a typo)

```bash
cd tests && npx jest regression/sprint-124-registry-core-parity --no-coverage
```

---

## Task 3: Extract the shared core

**Files:**
- Create: `scripts/lib/exemption-registry.js`
- Modify: `scripts/audit-exemptions.js`

- [ ] **Move the registry-agnostic parts into the core**: `parseUtcDate`, `todayUtc`, `ISO_DATE`,
      the structural checks, required-field presence, the bail-on-first-error-per-entry rule
      (`audit-exemptions.js:102`), and duplicate detection. Export
      `validateRegistry(registry, spec, now)`.

- [ ] **Define the audit spec** in `scripts/audit-exemptions.js` — `collection: 'exemptions'`,
      the existing `REQUIRED_FIELDS`, `identity: e => \`${e.package}|${e.advisory}\``, the GHSA and
      `severity === 'high'` validators, and a date-window `checkExpiry` enforcing
      `expires > created`, span ≤ `MAX_EXEMPTION_DAYS`, and `expires >= today`.

- [ ] **Keep the public surface byte-identical.** Re-export a one-argument wrapper so both existing
      callers keep working:

```js
const { validateRegistry: validateWithSpec } = require('./lib/exemption-registry');
const AUDIT_SPEC = { /* ... */ };
/** @deprecated-shape kept for tests/regression/sprint-75-security-gate.test.ts:60 */
function validateRegistry(registry, now = new Date()) {
  return validateWithSpec(registry, AUDIT_SPEC, now);
}
```

- [ ] **Verification — behaviour preserved.** The 36-test suite passes with **zero edits**, and
      `git diff --stat` proves it was not touched

```bash
cd tests && npx jest regression/sprint-123-audit-exemption-gate regression/sprint-75-security-gate regression/sprint-124-registry-core-parity --no-coverage
cd .. && git diff --stat -- tests/regression/sprint-123-audit-exemption-gate.test.ts
# ^ must print NOTHING. Any output means the refactor changed behaviour.
node scripts/audit-exemptions.js
```

- [ ] Run `/simplify` on the diff so far

---

## Task 4: Read the live Expo arbiter and capture a fixture

**Files:**
- Create: `tests/regression/fixtures/expo-check-drift.txt`

- [ ] **Run the real arbiter and capture verbatim output** (needs network; this is the ground truth
      the rest of the sprint is built on)

```bash
cd apps/mobile && EXPO_NO_TELEMETRY=1 npx expo install --check > ../../tests/regression/fixtures/expo-check-drift.txt 2>&1; echo "exit=$?"
cd ../.. && cat tests/regression/fixtures/expo-check-drift.txt
```

- [ ] **Record what it actually says.** Expect roughly seven packages: five Expo patch bumps
      (applied in Task 5) plus jest / `@types/jest` (registered in Task 7). **If the live list
      differs from BUG-035's 2026-08-06 capture, the live list wins** — update the spec's table
      rather than forcing the manifest to match a stale note.

- [ ] **Re-verify the jest rationale before recording it as a decision** (spec F3)

```bash
node -e "
const m=require('./apps/mobile/package.json');
const all={...m.dependencies,...m.devDependencies};
console.log('jest-expo declared:', all['jest-expo'] ?? 'NO — pin does not bind us');
"
node -e "console.log(require('fs').readFileSync('apps/mobile/jest.config.js','utf8'))"
# Must show no Expo preset — testEnvironment: 'node' only.
```

---

## Task 5: Apply the five Expo patch bumps

**Files:**
- Modify: `apps/mobile/package.json`, `package-lock.json`,
  `tests/regression/sprint-122-expo-sdk-alignment.test.ts`

- [ ] **Bump each package to the version the live arbiter names** (Task 4's capture, not BUG-035's
      list). Edit `apps/mobile/package.json` by hand.

- [ ] **Re-resolve the lockfile surgically.** Delete only those packages' entries from
      `package-lock.json`, then re-resolve — a plain run reports "up to date" and leaves the nested
      node stale

```bash
npm install --package-lock-only
```

- [ ] **Assert the resolved versions** — never trust "up to date"

```bash
node -e "
const lock=require('./package-lock.json');
for (const p of ['expo','expo-image-picker','expo-location','expo-notifications','expo-router']) {
  const k='node_modules/'+p;
  console.log(p, '->', lock.packages[k] ? lock.packages[k].version : 'MISSING');
}
"
```

- [ ] **Update `SDK_PINNED`** in `sprint-122-expo-sdk-alignment.test.ts` for any bumped package it
      shadows, each with a written reason naming this sprint — the map's own rule

- [ ] **Verification — strict install, mobile types, alignment suite**

```bash
npm ci
cd apps/mobile && npx tsc --noEmit && cd ../..
cd tests && npx jest regression/sprint-122-expo-sdk-alignment --no-coverage
```

- [ ] Run `/simplify` on the diff so far

---

## Task 6: RED tests for the Expo divergence gate

**Files:**
- Create: `tests/regression/sprint-124-expo-divergence-gate.test.ts`,
  `tests/regression/fixtures/expo-divergences-stale.json`,
  `tests/regression/fixtures/expo-divergences-wrong-sdk.json`

Written **before** the implementation. **Gates must be proven to reject, not merely to pass** —
most of these assert refusals.

- [ ] **Parser tests against the real captured output** (`expo-check-drift.txt`): every drifting
      package is extracted with its expected version; nothing else is

- [ ] **Fail-closed test — the most important one in the file**

```ts
// A non-zero exit whose output parses to zero packages means "I could not tell",
// and must BLOCK. Treating it as clean is the ADR-060 fail-open defect.
expect(evaluate({ status: 1, output: 'some unrecognized future format' }, registry).ok).toBe(false);
```

- [ ] **Rejection tests, one per rule** — each must fail the gate:
  - unregistered drift present
  - registered divergence matching **no** current drift (stale — it converged, delete it)
  - entry tagged `"sdk": "56"` while `apps/mobile` declares `expo ~57.x` (expired by generation)
  - each required field missing in turn
  - duplicate package entries
  - `declared` no longer matching `apps/mobile/package.json`
  - malformed / unparseable registry JSON

- [ ] **The one pass test:** exactly jest + `@types/jest` drifting, both registered, SDK matching →
      gate green

- [ ] **Executable-path test.** Assert the real CLI exits non-zero on a bad fixture — an evaluator
      returning `ok:false` while the CLI exits 0 is a silently inert gate. Use the constant-keyed
      fixture allowlist pattern from `audit-exemptions.js:255-269` (**not** an env-provided path —
      CodeQL rejects that, and correctly)

- [ ] **Verification — RED for the right reason**

```bash
cd tests && npx jest regression/sprint-124-expo-divergence-gate --no-coverage
```

---

## Task 7: Implement the divergence registry and gate

**Files:**
- Create: `scripts/expo-divergences.js`, `security/expo-divergences.json`

- [ ] **Write the registry** with jest + `@types/jest`, using the Task 4 re-verified rationale
      (schema in the spec's Data Model section)

- [ ] **Define the expo spec** — `collection: 'divergences'`; required `package`, `declared`,
      `expoPins`, `sdk`, `rationale`, `decision`, `owner`, `created`; `identity: e => e.package`;
      no `severity`, no `advisory`, no date window

- [ ] **Implement the SDK-generation expiry** — derived from the arbiter, not hand-written

```js
/** Live SDK major from apps/mobile's declared expo range. Never a hand-maintained constant. */
function currentSdkMajor(mobilePkg) {
  const range = (mobilePkg.dependencies || {}).expo;
  const m = /(\d+)\./.exec(String(range || ''));
  if (!m) throw new Error('cannot derive the SDK major from apps/mobile expo range');
  return m[1];
}
// entry.sdk !== currentSdkMajor  =>  "EXPIRED with SDK <n> — re-argue this divergence for SDK <m>"
```

- [ ] **Implement `evaluate(checkResult, registry)`** — parse drift, subtract registered
      divergences, and return `{ ok, errors, blocking, cleared, stale }`. Fail closed on
      unparseable output, stale entries, and unregistered drift.

- [ ] **Verification — every Task 6 test green, and the real registry is valid**

```bash
cd tests && npx jest regression/sprint-124-expo-divergence-gate --no-coverage
cd .. && node scripts/expo-divergences.js --registry-only   # schema/expiry check without network
```

- [ ] Run `/simplify` on the diff so far

---

## Task 8: Wire the workflow

**Files:**
- Modify: `.github/workflows/expo-sdk-drift.yml`

- [ ] **Make `scripts/expo-divergences.js` the verdict**, not `expo install --check`'s raw exit
      status (`:61-64` and `:128-132` today). Keep the schedule-only trigger and the `set +e`
      capture; pass the captured log to the script.

- [ ] **File the issue only on real drift**, and include which divergences were *cleared* so the
      issue body shows what was deliberately allowed

- [ ] **Close the drift issue when a run is green** — a stale open issue from a fixed gate is the
      same ignored-signal problem

- [ ] **Verification — shell correctness before it ever runs on CI.** `[[ ]]` is "not found" under
      `dash` and silently takes the else branch inside an `if`, even under `set -e`

```bash
node -e "
const y=require('fs').readFileSync('.github/workflows/expo-sdk-drift.yml','utf8');
if(/\[\[/.test(y)) throw new Error('bashism [[ ]] in workflow shell');
if(!/expo-divergences\.js/.test(y)) throw new Error('workflow does not call the gate');
if(/on:[\s\S]*?pull_request/.test(y)) throw new Error('PR trigger reintroduced');
console.log('workflow OK');
"
```

- [ ] **Dispatch it for real** and confirm green

```bash
gh workflow run "Expo SDK drift"
gh run list --workflow "Expo SDK drift" --limit 1
```

---

## Task 9: Docs, ADR-094, and carried debt

**Files:**
- Create: `docs/adr/ADR-094-generalized-exemption-registries.md`,
  `apps/landing/src/data/docs/concepts/time-boxed-exemptions.json`
- Modify: `docs/adr/README.md`, `docs/adr/ADR-059-*.md`, `docs/adr/ADR-092-*.md`,
  `docs/adr/ADR-093-*.md`, `docs/BUGS.md`, `scripts/claude.md`, `scripts/generate-docs.ts`,
  `package.json`

- [ ] **Write ADR-094** — one validator core, two registries, two expiry horizons and *why* they
      differ. **Consequences must record the SDK-generation trade-off**: the expiry cannot fire
      while `apps/mobile` stays on SDK 57.

- [ ] **Amend ADR-059** — the validator moved to `scripts/lib/`; the 7-day cap is unchanged and
      audit-specific; `critical` stays never-exemptible

- [ ] **Flip ADR-092 and ADR-093 `Accepted` → `Implemented`** (carried debt; both shipped in #198,
      and this must ride a PR — never a docs-only master push)

- [ ] **BUG-035 → `fixed (Sprint 124, v11.44.0)`** describing the mechanism, and bump
      `package.json` to `11.44.0`

- [ ] **`scripts/claude.md`** — document `scripts/lib/` and `expo-divergences.js` (local context is
      mandatory, not optional)

- [ ] **Landing docs.** Add `adr-094-generalized-exemption-registries` to the nav ordering list in
      `scripts/generate-docs.ts:438-463` — **`nav.json` is generated; editing it directly is why it
      has silently reverted before**. Author the "Time-boxed exemptions" concept page.

- [ ] **Verification — the ADR is indexed and nav actually contains it**

```bash
npm run docs:generate 2>/dev/null || npx tsx scripts/generate-docs.ts
grep -c "adr-094-generalized-exemption-registries" apps/landing/src/data/docs/nav.json
grep -n "ADR-094" docs/adr/README.md
cd tests && npx jest regression/doc-context-drift-gate --no-coverage
```

---

## Task 10: CONTEXT/registry sync + integration proof

**Files:**
- Create/Modify: as `feedback:check` reports

- [ ] **No service changed this sprint**, so `services/registry.json` and every service
      `CONTEXT.md` should be untouched. **Confirm that rather than assuming it**

```bash
git diff --name-only origin/master...HEAD -- services/ | tee /dev/stderr | wc -l
# Expect 0. Any output means a service changed and its CONTEXT.md owes an update.
npm run feedback:check
```

- [ ] **End-to-end proof that the two gates are genuinely independent** — a TDD test asserting the
      audit registry and the expo registry cannot contaminate each other

```bash
# tests/tdd/  — promotes to regression once green
```

- [ ] Verification

```bash
cd tests && npx jest tdd/sprint-124 --no-coverage
```

---

## Task 11: SDLC quality gates

All four gates run every sprint. Effort calibrated to diff size — this is a moderate,
security-gate-adjacent diff, so `/code-review` runs at **high**.

- [ ] **`/simplify`** — final pass over the whole branch diff

```bash
git diff origin/master...HEAD --stat
```

- [ ] **`/code-review high`** — resolve every correctness finding before merge. Pay attention to:
      the parser's fail-closed path, the SDK-major derivation, and whether any assertion is weaker
      than it claims (count vs identity, presence vs blocking)

- [ ] **`/security-review`** — the diff touches a security gate; a weakened gate is the finding to
      hunt for. Confirm no path lets `critical` become exemptible and no env-provided path reaches
      `fs`

- [ ] **Testing gate** — the RED-first tests of Tasks 2 and 6 exist and the rejection cases
      genuinely reject. Prove it by injection, one at a time

```bash
# Temporarily corrupt each registry and confirm the gate FAILS, then restore.
node scripts/audit-exemptions.js; echo "audit exit=$?"
node scripts/expo-divergences.js --registry-only; echo "expo exit=$?"
```

- [ ] Findings resolved, or dismissed with written justification recorded in the PR

---

## Task 12: Final verification + pre-push

- [ ] **Full suite** — never `| tail` it; that masks the exit code

```bash
npm test
```

- [ ] **Type check and strict install**

```bash
npx tsc --noEmit
npm ci
```

- [ ] **Revert landing-doc churn** — the landing prebuild rewrites timestamps and HEAD shas during
      `npm test`. Keep the genuine ADR-094 content, drop the churn

```bash
git diff --stat -- apps/landing/src/data/docs/
```

- [ ] **Confirm hooks are live on this clone before trusting the push.** A push that finishes
      silently and instantly means no hook ran

```bash
git config core.hooksPath
npm run hooks:install
```

- [ ] **Final handoff update — land it BEFORE requesting merge authorization.** A handoff pushed
      after the merge is stranded on a closed branch (that happened on #194)

- [ ] `npm run feedback:check` clean, then push and open the PR

---

## Task 13: Merge + Deploy

Use the `/deploy` skill. **Every merge needs EXPLICIT authorization from the maintainer, every
time** — do not merge without asking.

- [ ] Confirm CI green on the PR: unit + regression, dependency audit (ADR-059), CodeQL (ADR-060),
      PR contract headers, doc/context drift gate
- [ ] **Request merge authorization explicitly.** The Bash `gh pr merge` form is blocked by the
      permission classifier — use the GitHub MCP `merge_pull_request` tool
- [ ] Squash-merge to `master`; GitHub Actions builds ARM64 images, deploys, verifies health, and
      rolls back on failure
- [ ] Post-deploy smoke test (`POST /api/auth/login` — `/health` is not exposed via nginx)
- [ ] **Close issue #196** referencing the PR
- [ ] Confirm the next scheduled `Expo SDK drift` run (07:15 UTC) is **green**. This is the real
      proof; `workflow_dispatch` in Task 8 is only a rehearsal
- [ ] Archive the handoff and reconcile it against real state (`gh pr list`, `git log`)

---

## Deliberately out of scope

Named so they are not rediscovered mid-sprint as "quick wins":

| Item | Why not now |
|---|---|
| BUG-033 (TDD promoter blind to `.tsx`) | Moves ~442 tests into the blocking tier in one change — maintainer decision, its own sprint |
| BUG-034 (messaging-service zero coverage) | A "Critical services have tests" gate cannot be added while it lands red |
| Platform-floor arc (`@types/node` → TS 7 → ESLint 10) | Blast radius is every workspace's `tsc`; deserves a dedicated sprint |
| The ~90 stale remote branches | Housekeeping; requires per-branch PR-state verification, never bulk deletion by name pattern |
| `README.md:2` version badge, ADR-028's `node:18-alpine` template, `@types/node` floor in messaging-service | Small, real, and unrelated — carry forward |
| Dependabot #199 / #200 | Untriaged; **numbers churn on every regeneration — match on what a PR bumps, never the number** |
