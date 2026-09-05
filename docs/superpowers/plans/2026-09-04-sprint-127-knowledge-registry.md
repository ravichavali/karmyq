# Sprint 127: Ecosystem Knowledge Registry — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give repo-scoped operational knowledge a home, a review path, and a test that fails when it goes stale — so a `git clone` becomes the only distribution mechanism required.

**Architecture:** A `docs/gotchas/` directory holds one `.json` sidecar plus one `.md` body per entry. A dependency-free plain-JavaScript validator (`scripts/gotcha-registry.js`) exposes pure functions consumed by a regression-tier Jest gate, by a pre-commit credential screen, and by a clean-room fixture that clones the candidate commit and runs the validator with bare `node`. Every entry carries exactly one of a declarative machine check or a review date; promotion to a mechanically enforced invariant is a reviewer's judgment, not a validator rule.

**Tech Stack:** Node 24, plain CommonJS JavaScript (no new dependencies), Jest + ts-jest for the gate, bash for the pre-commit hook.

**Spec:** [`docs/superpowers/specs/2026-09-04-ecosystem-knowledge-registry-design.md`](../specs/2026-09-04-ecosystem-knowledge-registry-design.md) — read it alongside this plan. Three Codex review rounds are integrated there; several constraints below exist because a specific alternative was tried and rejected.

## Global Constraints

- **Zero new dependencies.** The validator is plain CommonJS JavaScript parsed with `JSON.parse`. Do NOT add `js-yaml` or any parser — it is undeclared in every workspace and present only as a transitive security override. This is what keeps the lane dependency-independent.
- **The validator never executes strings from entry files.** Only the four declarative check types. This is a public repo accepting fork PRs; a free-form command string is arbitrary code execution.
- **The validator performs no network I/O**, including transitively.
- **Fail closed.** An unreadable or absent `verify` target is a FAILURE, never a skip.
- **Every gate must be proven to fail.** Each assertion gets its own negative fixture; one representative case is not proof.
- **Scope validation uses git-tracked paths; scope discovery matches paths about to change, including new files not yet staged.** These are different inputs on purpose.
- **Never hand-edit `apps/landing/src/data/docs/`** — it is generated. Author `docs/concepts/<slug>.md` and add the slug to the generator's lists.
- New tests start in the changed workspace's `tests/tdd/` and are promoted to `regression/` when green.
- Landing docs regenerate during `npm test`; revert `build.json`/`architecture.json` timestamp and HEAD-sha churn before committing.
- Branch from `origin/master`. ADR number is **maintainer-allocated** — ask before writing ADR-097.

## Prerequisites — do these before Task 1

1. **PR #219 must be merged first.** This plan's branch is cut from `master`, and `master`'s
   `.claude/handoff/CURRENT_HANDOFF.md` is the **pre-merge Sprint 126 copy** — it still says PR #210
   is open, Task 14 is unauthorized, and the demo database has only been read. All three are false:
   #210 merged 2026-09-03 and the backfill wrote 20,341 karma rows. The reconciled handoff, the
   maintainer-allocated ADR rules, and the ADR-uniqueness gate this plan depends on all live in
   #219. Starting before it merges means working from a handoff that will actively mislead.
2. **Ask the maintainer to allocate the ADR number** (Task 12). Do not derive it from the directory
   listing — two lanes reading the same listing get the same answer.
3. **Confirm the dependency lane is free.** This plan takes no dependencies, so it should not
   contend — but verify no one has designated an active dependency task that touches
   `package.json`, and remember an open Dependabot PR is a queued proposal, not the holder.
4. **Fresh chat.** This plan was authored in the chat that produced the spec; per the cadence rule,
   the next chat executes.

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/gotcha-registry.js` | **Create.** All pure validation + discovery functions. Dependency-free, hermetic, plain CommonJS so it runs under bare `node`. |
| `scripts/gotcha-check.js` | **Create.** Thin CLI wrapper: loads the registry, prints failures, sets exit code. Used by the clean-room fixture and available manually. |
| `tests/regression/sprint-127-gotcha-registry-gate.test.ts` | **Create.** The blocking gate. Positive assertions over the real registry plus every negative fixture. |
| `tests/regression/doc-context-drift-gate.test.ts` | **Modify.** Add the onboarding-doc policy assertion. |
| `scripts/git-hooks/pre-commit` | **Modify.** Add the credential screen for staged `docs/gotchas/` files. |
| `docs/gotchas/*.json` + `*.md` | **Create.** Six seed entries. |
| `.claude/skills/learned/SKILL.md` | **Create.** The `/learned` capture skill. |
| `docs/concepts/how-karmyq-learns.md` | **Create.** Public philosophy page source. |
| `scripts/generate-docs.ts` | **Modify.** Add the slug to `CONCEPT_ORDER` (~line 246) and `whyKarmyq` (line 585). |
| `README.md`, `CONTRIBUTING.md`, `claude.md` | **Modify.** Philosophy, authoring manual, doc-map + the `claude.md:126` correction. |
| `docs/adr/ADR-0NN-*.md` + `docs/adr/README.md` | **Create/modify.** Architectural record. |

---

## Task 1: Registry loader and schema validation

**Files:**
- Create: `scripts/gotcha-registry.js`
- Test: `tests/tdd/sprint-127-gotcha-registry.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `REVIEW_CAP_DAYS: number` (400)
  - `loadRegistry(rootDir: string): { entries: Entry[]; errors: string[] }`
  - `Entry = { slug: string; jsonPath: string; bodyPath: string; data: object; body: string }`
  - `validateSchema(entry: Entry): string[]` — returns human-readable error strings, empty when valid

- [ ] **Step 1: Write the failing test**

```typescript
// tests/tdd/sprint-127-gotcha-registry.test.ts
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const reg = require('../../scripts/gotcha-registry.js');

function fixtureRoot(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'gotcha-'));
  mkdirSync(join(root, 'docs', 'gotchas'), { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    writeFileSync(join(root, rel), content, 'utf8');
  }
  return root;
}

const VALID = {
  title: 'npm status page is not a signal',
  owner: 'ravichavali',
  created: '2026-09-04',
  expires: '2027-03-04',
  scope: ['scripts/audit-exemptions.js'],
};

describe('gotcha registry — schema', () => {
  it('accepts a well-formed entry', () => {
    const root = fixtureRoot({
      'docs/gotchas/a.json': JSON.stringify(VALID),
      'docs/gotchas/a.md': 'body',
    });
    const { entries, errors } = reg.loadRegistry(root);
    expect(errors).toEqual([]);
    expect(entries).toHaveLength(1);
    expect(reg.validateSchema(entries[0])).toEqual([]);
    rmSync(root, { recursive: true, force: true });
  });

  it('FAILS when a required field is missing', () => {
    const { owner, ...noOwner } = VALID;
    const root = fixtureRoot({
      'docs/gotchas/a.json': JSON.stringify(noOwner),
      'docs/gotchas/a.md': 'body',
    });
    const { entries } = reg.loadRegistry(root);
    expect(reg.validateSchema(entries[0])).toEqual([expect.stringContaining('owner')]);
    rmSync(root, { recursive: true, force: true });
  });

  it('FAILS when both verify and expires are present', () => {
    const root = fixtureRoot({
      'docs/gotchas/a.json': JSON.stringify({
        ...VALID,
        verify: { path_exists: 'README.md' },
      }),
      'docs/gotchas/a.md': 'body',
    });
    const { entries } = reg.loadRegistry(root);
    expect(reg.validateSchema(entries[0])).toEqual([
      expect.stringContaining('exactly one of'),
    ]);
    rmSync(root, { recursive: true, force: true });
  });

  it('FAILS when neither verify nor expires is present', () => {
    const { expires, ...neither } = VALID;
    const root = fixtureRoot({
      'docs/gotchas/a.json': JSON.stringify(neither),
      'docs/gotchas/a.md': 'body',
    });
    const { entries } = reg.loadRegistry(root);
    expect(reg.validateSchema(entries[0])).toEqual([
      expect.stringContaining('exactly one of'),
    ]);
    rmSync(root, { recursive: true, force: true });
  });

  // These three all passed an earlier draft: an entry asserting nothing, with no
  // review date, satisfied "exactly one of". That defeats the whole invariant.
  it.each([null, false, {}, [], 'yes'])('FAILS when verify is %p (asserts nothing)', (bad) => {
    const { expires, ...noExpires } = VALID;
    const root = fixtureRoot({
      'docs/gotchas/a.json': JSON.stringify({ ...noExpires, verify: bad }),
      'docs/gotchas/a.md': 'body',
    });
    const { entries } = reg.loadRegistry(root);
    expect(reg.validateSchema(entries[0]).length).toBeGreaterThan(0);
    rmSync(root, { recursive: true, force: true });
  });

  it.each([
    ['renewed', 'not-an-array'],
    ['see_also', { a: 1 }],
  ])('FAILS when %s is malformed rather than silently treating it as empty', (field, bad) => {
    const root = fixtureRoot({
      'docs/gotchas/a.json': JSON.stringify({ ...VALID, [field]: bad }),
      'docs/gotchas/a.md': 'body',
    });
    const { entries } = reg.loadRegistry(root);
    expect(reg.validateSchema(entries[0])).toEqual([expect.stringContaining(field)]);
    rmSync(root, { recursive: true, force: true });
  });

  it('FAILS a check with malformed arguments', () => {
    const { expires, ...noExpires } = VALID;
    const root = fixtureRoot({
      'docs/gotchas/a.json': JSON.stringify({
        ...noExpires,
        verify: { file_matches: { path: 'a.sh', pattern: '[unclosed' } },
      }),
      'docs/gotchas/a.md': 'body',
    });
    const { entries } = reg.loadRegistry(root);
    expect(reg.validateSchema(entries[0])).toEqual([expect.stringContaining('not a valid regex')]);
    rmSync(root, { recursive: true, force: true });
  });

  it('loads a body whose path is repo-relative, not double-joined', () => {
    const root = fixtureRoot({
      'docs/gotchas/a.json': JSON.stringify(VALID),
      'docs/gotchas/a.md': 'the body text',
    });
    const { entries } = reg.loadRegistry(root);
    expect(entries[0].bodyPath).toBe('docs/gotchas/a.md');
    expect(entries[0].body).toBe('the body text');
    rmSync(root, { recursive: true, force: true });
  });

  it('reports malformed JSON as a load error rather than throwing', () => {
    const root = fixtureRoot({
      'docs/gotchas/a.json': '{ not json',
      'docs/gotchas/a.md': 'body',
    });
    const { errors } = reg.loadRegistry(root);
    expect(errors).toEqual([expect.stringContaining('a.json')]);
    rmSync(root, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tests && npx jest tdd/sprint-127-gotcha-registry.test.ts`
Expected: FAIL — `Cannot find module '../../scripts/gotcha-registry.js'`

- [ ] **Step 3: Write minimal implementation**

```javascript
// scripts/gotcha-registry.js
'use strict';
const fs = require('fs');
const path = require('path');

// Deliberately longer than ADR-059's security-exemption cap. A stale gotcha is
// unhelpful; a stale security exemption is an active risk. Reusing that cap would
// impose security-grade churn on low-risk content.
const REVIEW_CAP_DAYS = 400;

// Posix-separated on every platform: compared directly against git output.
const GOTCHA_DIR = 'docs/gotchas';
const REQUIRED = ['title', 'owner', 'created', 'scope'];
const CHECK_TYPES = ['path_exists', 'file_matches', 'file_not_matches', 'json_equals'];

function loadRegistry(rootDir) {
  const dir = path.join(rootDir, GOTCHA_DIR);
  const entries = [];
  const errors = [];
  if (!fs.existsSync(dir)) return { entries, errors };

  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith('.json')) continue;
    const slug = file.replace(/\.json$/, '');
    // Entry paths are ALWAYS repository-relative, posix-separated. They are compared
    // against `git ls-files` and `git diff --cached` output, which is relative and
    // posix. Resolve to disk exactly once, at read time — never store an absolute
    // path in an Entry.
    const jsonPath = `${GOTCHA_DIR}/${file}`;
    const bodyPath = `${GOTCHA_DIR}/${slug}.md`;
    let data;
    try {
      data = JSON.parse(fs.readFileSync(path.join(rootDir, jsonPath), 'utf8'));
    } catch (e) {
      errors.push(`${jsonPath}: not valid JSON (${e.message})`);
      continue;
    }
    const bodyAbs = path.join(rootDir, bodyPath);
    const body = fs.existsSync(bodyAbs) ? fs.readFileSync(bodyAbs, 'utf8') : '';
    entries.push({ slug, jsonPath, bodyPath, data, body });
  }
  return { entries, errors };
}

function validateSchema(entry) {
  const errs = [];
  const d = entry.data;
  for (const field of REQUIRED) {
    if (d[field] === undefined || d[field] === null || d[field] === '') {
      errs.push(`${entry.jsonPath}: missing required field "${field}"`);
    }
  }
  if (d.scope !== undefined && (!Array.isArray(d.scope) || d.scope.length === 0)) {
    errs.push(`${entry.jsonPath}: "scope" must be a non-empty array`);
  }

  // `verify` counts as present only if it is a NON-EMPTY plain object. Without this,
  // `verify: null`, `verify: false` and `verify: {}` all satisfy "exactly one of" while
  // asserting nothing and carrying no review date — bypassing the invariant that makes
  // the collection self-pruning. Verified: all three passed an earlier draft.
  const verifyPresent = d.verify !== undefined;
  const verifyUsable =
    verifyPresent &&
    typeof d.verify === 'object' &&
    d.verify !== null &&
    !Array.isArray(d.verify) &&
    Object.keys(d.verify).length > 0;
  if (verifyPresent && !verifyUsable) {
    errs.push(`${entry.jsonPath}: "verify" must be a non-empty object of declarative checks`);
  }
  const hasExpires = d.expires !== undefined;
  if (verifyUsable === hasExpires) {
    errs.push(
      `${entry.jsonPath}: exactly one of "verify" or "expires" is required (found ${
        verifyUsable ? 'both' : 'neither'
      })`,
    );
  }

  // Malformed containers must fail loudly. Treating a string or object as an empty
  // array silently drops the very data these fields exist to carry.
  if (d.renewed !== undefined && !Array.isArray(d.renewed)) {
    errs.push(`${entry.jsonPath}: "renewed" must be an array of {date, evidence} objects`);
  }
  if (d.see_also !== undefined && !Array.isArray(d.see_also)) {
    errs.push(`${entry.jsonPath}: "see_also" must be an array of slugs`);
  }

  errs.push(...validateCheckArgs(entry));
  return errs;
}

// Each check type's arguments are validated up front, so a typo fails as a schema
// error naming the field rather than as a confusing runtime failure.
function validateCheckArgs(entry) {
  const v = entry.data.verify;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return [];
  const errs = [];
  for (const [type, arg] of Object.entries(v)) {
    if (!CHECK_TYPES.includes(type)) {
      errs.push(`${entry.jsonPath}: unsupported check type "${type}" (allowed: ${CHECK_TYPES.join(', ')})`);
      continue;
    }
    if (type === 'path_exists') {
      if (typeof arg !== 'string' || arg === '') {
        errs.push(`${entry.jsonPath}: path_exists takes a non-empty path string`);
      }
      continue;
    }
    if (typeof arg !== 'object' || arg === null) {
      errs.push(`${entry.jsonPath}: ${type} takes an object`);
      continue;
    }
    if (typeof arg.path !== 'string' || arg.path === '') {
      errs.push(`${entry.jsonPath}: ${type} requires a non-empty "path"`);
    }
    if (type === 'file_matches' || type === 'file_not_matches') {
      if (typeof arg.pattern !== 'string' || arg.pattern === '') {
        errs.push(`${entry.jsonPath}: ${type} requires a non-empty "pattern"`);
      } else {
        try {
          new RegExp(arg.pattern);
        } catch (e) {
          errs.push(`${entry.jsonPath}: ${type} "pattern" is not a valid regex (${e.message})`);
        }
      }
    }
    if (type === 'json_equals') {
      if (typeof arg.key !== 'string' || arg.key === '') {
        errs.push(`${entry.jsonPath}: json_equals requires a non-empty "key"`);
      }
      if (!('value' in arg)) {
        errs.push(`${entry.jsonPath}: json_equals requires a "value"`);
      }
    }
  }
  return errs;
}

module.exports = { REVIEW_CAP_DAYS, GOTCHA_DIR, loadRegistry, validateSchema };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tests && npx jest tdd/sprint-127-gotcha-registry.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add scripts/gotcha-registry.js tests/tdd/sprint-127-gotcha-registry.test.ts
git commit -m "feat: gotcha registry loader and schema validation"
```

---

## Task 2: Declarative verify executors

**Files:**
- Modify: `scripts/gotcha-registry.js`
- Test: `tests/tdd/sprint-127-gotcha-verify.test.ts`

**Interfaces:**
- Consumes: `loadRegistry`, `Entry` from Task 1.
- Produces: `runVerify(rootDir: string, entry: Entry): string[]` — supports exactly `path_exists`, `file_matches`, `file_not_matches`, `json_equals`. Returns error strings; empty when the claim holds.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/tdd/sprint-127-gotcha-verify.test.ts
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const reg = require('../../scripts/gotcha-registry.js');

function root(files: Record<string, string>): string {
  const r = mkdtempSync(join(tmpdir(), 'gv-'));
  mkdirSync(join(r, 'docs', 'gotchas'), { recursive: true });
  for (const [rel, c] of Object.entries(files)) {
    mkdirSync(join(r, rel, '..'), { recursive: true });
    writeFileSync(join(r, rel), c, 'utf8');
  }
  return r;
}

function entryWith(verify: object) {
  return { slug: 'a', jsonPath: 'docs/gotchas/a.json', bodyPath: 'docs/gotchas/a.md',
           data: { verify }, body: '' };
}

describe('gotcha registry — verify executors', () => {
  it('path_exists passes when the path is present', () => {
    const r = root({ 'target.txt': 'x' });
    expect(reg.runVerify(r, entryWith({ path_exists: 'target.txt' }))).toEqual([]);
    rmSync(r, { recursive: true, force: true });
  });

  it('path_exists FAILS on a deleted path', () => {
    const r = root({ 'other.txt': 'x' });
    expect(reg.runVerify(r, entryWith({ path_exists: 'gone.txt' }))).toEqual([
      expect.stringContaining('gone.txt'),
    ]);
    rmSync(r, { recursive: true, force: true });
  });

  it('file_matches passes when the pattern is found', () => {
    const r = root({ 'a.sh': 'hooks_dir=".git/hooks"' });
    expect(
      reg.runVerify(r, entryWith({ file_matches: { path: 'a.sh', pattern: 'hooks_dir' } })),
    ).toEqual([]);
    rmSync(r, { recursive: true, force: true });
  });

  it('file_matches FAILS when the pattern no longer matches', () => {
    const r = root({ 'a.sh': 'something else' });
    expect(
      reg.runVerify(r, entryWith({ file_matches: { path: 'a.sh', pattern: 'hooks_dir' } })),
    ).toEqual([expect.stringContaining('no longer contains')]);
    rmSync(r, { recursive: true, force: true });
  });

  it('file_not_matches FAILS when the forbidden pattern appears', () => {
    const r = root({ 'a.sh': 'npm install' });
    expect(
      reg.runVerify(r, entryWith({ file_not_matches: { path: 'a.sh', pattern: 'npm install' } })),
    ).toEqual([expect.stringContaining('unexpectedly contains')]);
    rmSync(r, { recursive: true, force: true });
  });

  it('json_equals compares a dotted key path', () => {
    const r = root({ 'p.json': JSON.stringify({ engines: { node: '>=24.0.0' } }) });
    expect(
      reg.runVerify(r, entryWith({ json_equals: { path: 'p.json', key: 'engines.node', value: '>=24.0.0' } })),
    ).toEqual([]);
    expect(
      reg.runVerify(r, entryWith({ json_equals: { path: 'p.json', key: 'engines.node', value: '>=20' } })),
    ).toEqual([expect.stringContaining('expected')]);
    rmSync(r, { recursive: true, force: true });
  });

  // Fail-closed: mirrors ADR-060's refusal to treat an unreadable source as "nothing found".
  it('FAILS rather than skips when the target is unreadable', () => {
    const r = root({ 'a.sh': 'x' });
    const errs = reg.runVerify(r, entryWith({ file_matches: { path: 'missing.sh', pattern: 'x' } }));
    expect(errs).toEqual([expect.stringContaining('unreadable')]);
    rmSync(r, { recursive: true, force: true });
  });

  it('FAILS on an unknown check type instead of ignoring it', () => {
    const r = root({ 'a.sh': 'x' });
    expect(reg.runVerify(r, entryWith({ run_shell: 'rm -rf /' }))).toEqual([
      expect.stringContaining('unsupported check type'),
    ]);
    rmSync(r, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tests && npx jest tdd/sprint-127-gotcha-verify.test.ts`
Expected: FAIL — `reg.runVerify is not a function`

- [ ] **Step 3: Write minimal implementation**

Append to `scripts/gotcha-registry.js`, and add `runVerify` to `module.exports`:

```javascript
// CHECK_TYPES is defined in Task 1 — do not redeclare it here.

function readOr(rootDir, rel) {
  try {
    return fs.readFileSync(path.join(rootDir, rel), 'utf8');
  } catch (e) {
    return null; // caller turns this into a failure, never a skip
  }
}

function runVerify(rootDir, entry) {
  const v = entry.data.verify;
  if (!v) return [];
  const errs = [];
  for (const type of Object.keys(v)) {
    if (!CHECK_TYPES.includes(type)) {
      errs.push(`${entry.jsonPath}: unsupported check type "${type}" (allowed: ${CHECK_TYPES.join(', ')})`);
      continue;
    }
    const arg = v[type];
    if (type === 'path_exists') {
      if (!fs.existsSync(path.join(rootDir, arg))) {
        errs.push(`${entry.jsonPath}: path_exists "${arg}" does not exist`);
      }
      continue;
    }
    const text = readOr(rootDir, arg.path);
    if (text === null) {
      errs.push(`${entry.jsonPath}: ${type} target "${arg.path}" is unreadable — failing closed`);
      continue;
    }
    if (type === 'file_matches' && !new RegExp(arg.pattern).test(text)) {
      errs.push(`${entry.jsonPath}: ${arg.path} no longer contains /${arg.pattern}/`);
    }
    if (type === 'file_not_matches' && new RegExp(arg.pattern).test(text)) {
      errs.push(`${entry.jsonPath}: ${arg.path} unexpectedly contains /${arg.pattern}/`);
    }
    if (type === 'json_equals') {
      let cur;
      try {
        cur = arg.key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), JSON.parse(text));
      } catch (e) {
        errs.push(`${entry.jsonPath}: ${arg.path} is not valid JSON — failing closed`);
        continue;
      }
      if (cur !== arg.value) {
        errs.push(`${entry.jsonPath}: ${arg.path} ${arg.key} expected ${JSON.stringify(arg.value)}, found ${JSON.stringify(cur)}`);
      }
    }
  }
  return errs;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tests && npx jest tdd/sprint-127-gotcha-verify.test.ts`
Expected: PASS — 8 tests

- [ ] **Step 5: Commit**

```bash
git add scripts/gotcha-registry.js tests/tdd/sprint-127-gotcha-verify.test.ts
git commit -m "feat: declarative verify executors, fail-closed on unreadable targets"
```

---

## Task 3: Dates, review cap, and renewal evidence

**Files:**
- Modify: `scripts/gotcha-registry.js`
- Test: `tests/tdd/sprint-127-gotcha-dates.test.ts`

**Interfaces:**
- Consumes: `Entry`, `REVIEW_CAP_DAYS`.
- Produces: `checkDates(entry: Entry, today: Date): string[]` — validates `created`/`expires` format, expiry against `today`, span against `REVIEW_CAP_DAYS` measured **from the most recent review** (latest `renewed[].date`, else `created`), and that every `renewed` item has a non-empty `evidence`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/tdd/sprint-127-gotcha-dates.test.ts
const reg = require('../../scripts/gotcha-registry.js');

const TODAY = new Date('2026-09-04T00:00:00Z');

function e(data: object) {
  return { slug: 'a', jsonPath: 'docs/gotchas/a.json', bodyPath: 'docs/gotchas/a.md',
           data, body: '' };
}

describe('gotcha registry — dates and renewal', () => {
  it('accepts an unexpired entry inside the cap', () => {
    expect(reg.checkDates(e({ created: '2026-09-04', expires: '2027-01-01' }), TODAY)).toEqual([]);
  });

  // The span here is deliberately INSIDE the cap so this fixture isolates the expiry
  // failure. An earlier draft used created 2025-01-01, which is a 610-day span and
  // therefore produced two errors while asserting exactly one.
  it('FAILS an entry past its review date, and only for that reason', () => {
    expect(reg.checkDates(e({ created: '2026-08-01', expires: '2026-09-03' }), TODAY)).toEqual([
      expect.stringContaining('past its review date'),
    ]);
  });

  it('FAILS a malformed date', () => {
    expect(reg.checkDates(e({ created: '2026-13-45', expires: '2027-01-01' }), TODAY)).toEqual([
      expect.stringContaining('not a valid ISO date'),
    ]);
  });

  it('accepts a span of exactly the cap', () => {
    const created = '2026-09-04';
    const expires = new Date(Date.UTC(2026, 8, 4) + reg.REVIEW_CAP_DAYS * 86400000)
      .toISOString().slice(0, 10);
    expect(reg.checkDates(e({ created, expires }), TODAY)).toEqual([]);
  });

  it('FAILS a span one day beyond the cap', () => {
    const created = '2026-09-04';
    const expires = new Date(Date.UTC(2026, 8, 4) + (reg.REVIEW_CAP_DAYS + 1) * 86400000)
      .toISOString().slice(0, 10);
    expect(reg.checkDates(e({ created, expires }), TODAY)).toEqual([
      expect.stringContaining('exceeds the review cap'),
    ]);
  });

  // Expiry is measured from the LATEST review, not from creation.
  it('measures the cap from the most recent renewal, not from created', () => {
    expect(
      reg.checkDates(
        e({
          created: '2024-01-01',
          expires: '2027-06-01',
          renewed: [{ date: '2026-08-01', evidence: 're-probed 2026-08-01: still true' }],
        }),
        TODAY,
      ),
    ).toEqual([]);
  });

  it('accepts many evidenced renewals on an unverifiable entry', () => {
    expect(
      reg.checkDates(
        e({
          created: '2024-01-01',
          expires: '2027-06-01',
          renewed: [
            { date: '2025-01-01', evidence: 'probe A' },
            { date: '2025-09-01', evidence: 'probe B' },
            { date: '2026-08-01', evidence: 'probe C' },
          ],
        }),
        TODAY,
      ),
    ).toEqual([]);
  });

  it('FAILS a renewal with no evidence', () => {
    expect(
      reg.checkDates(
        e({ created: '2026-01-01', expires: '2027-01-01', renewed: [{ date: '2026-08-01' }] }),
        TODAY,
      ),
    ).toEqual([expect.stringContaining('evidence')]);
  });

  it('FAILS a renewal with a malformed date', () => {
    expect(
      reg.checkDates(
        e({ created: '2026-01-01', expires: '2027-01-01',
            renewed: [{ date: 'last tuesday', evidence: 'x' }] }),
        TODAY,
      ),
    ).toEqual([expect.stringContaining('not a valid ISO date')]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tests && npx jest tdd/sprint-127-gotcha-dates.test.ts`
Expected: FAIL — `reg.checkDates is not a function`

- [ ] **Step 3: Write minimal implementation**

Append to `scripts/gotcha-registry.js`, add `checkDates` to exports:

```javascript
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function parseIso(s) {
  if (typeof s !== 'string' || !ISO.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  if (d.toISOString().slice(0, 10) !== s) return null; // rejects 2026-13-45
  return d;
}

function checkDates(entry, today) {
  const errs = [];
  const d = entry.data;
  const created = parseIso(d.created);
  if (d.created !== undefined && !created) {
    errs.push(`${entry.jsonPath}: "created" (${d.created}) is not a valid ISO date`);
  }

  const renewals = Array.isArray(d.renewed) ? d.renewed : [];
  let latestReview = created;
  for (const r of renewals) {
    const rd = parseIso(r && r.date);
    if (!rd) {
      errs.push(`${entry.jsonPath}: renewal date "${r && r.date}" is not a valid ISO date`);
      continue;
    }
    if (!r.evidence || String(r.evidence).trim() === '') {
      errs.push(`${entry.jsonPath}: renewal ${r.date} is missing "evidence" — say how the fact was re-confirmed`);
    }
    if (!latestReview || rd > latestReview) latestReview = rd;
  }

  if (d.expires !== undefined) {
    const expires = parseIso(d.expires);
    if (!expires) {
      errs.push(`${entry.jsonPath}: "expires" (${d.expires}) is not a valid ISO date`);
    } else {
      if (expires < today) {
        errs.push(`${entry.jsonPath}: past its review date (${d.expires}) — renew with evidence, or delete it`);
      }
      if (latestReview) {
        const span = Math.round((expires - latestReview) / 86400000);
        if (span > REVIEW_CAP_DAYS) {
          errs.push(`${entry.jsonPath}: review span ${span}d exceeds the review cap of ${REVIEW_CAP_DAYS}d`);
        }
      }
    }
  }
  return errs;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tests && npx jest tdd/sprint-127-gotcha-dates.test.ts`
Expected: PASS — 9 tests

- [ ] **Step 5: Commit**

```bash
git add scripts/gotcha-registry.js tests/tdd/sprint-127-gotcha-dates.test.ts
git commit -m "feat: review dates, cap from latest review, evidenced renewals"
```

---

## Task 4: Scope tracking, references, and pairing

**Files:**
- Modify: `scripts/gotcha-registry.js`
- Test: `tests/tdd/sprint-127-gotcha-integrity.test.ts`

**Interfaces:**
- Consumes: `Entry`.
- Produces:
  - `checkScope(entry: Entry, trackedPaths: string[]): string[]`
  - `checkReferences(entry: Entry, allSlugs: string[]): string[]`
  - `checkPairing(rootDir: string): string[]`

**Note:** `trackedPaths` is injected, not read from git inside the function — that keeps the module hermetic and testable. The caller supplies `git ls-files` output.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/tdd/sprint-127-gotcha-integrity.test.ts
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const reg = require('../../scripts/gotcha-registry.js');

const TRACKED = ['scripts/install-hooks.sh', 'scripts/git-hooks/pre-push', 'README.md'];

function e(data: object) {
  return { slug: 'a', jsonPath: 'docs/gotchas/a.json', bodyPath: 'docs/gotchas/a.md',
           data, body: '' };
}

describe('gotcha registry — scope, references, pairing', () => {
  it('accepts an exact tracked file', () => {
    expect(reg.checkScope(e({ scope: ['scripts/install-hooks.sh'] }), TRACKED)).toEqual([]);
  });

  it('accepts a directory prefix covering a tracked file', () => {
    expect(reg.checkScope(e({ scope: ['scripts/git-hooks/'] }), TRACKED)).toEqual([]);
  });

  // .husky/ exists on a dev machine but is gitignored — this is the exact defect
  // that made an earlier draft of the spec fail on every fresh clone.
  it('FAILS an untracked-but-present path', () => {
    expect(reg.checkScope(e({ scope: ['.husky/'] }), TRACKED)).toEqual([
      expect.stringContaining('.husky/'),
    ]);
  });

  it('FAILS a see_also pointing at a non-existent slug', () => {
    expect(reg.checkReferences(e({ see_also: ['no-such-entry'] }), ['a', 'b'])).toEqual([
      expect.stringContaining('no-such-entry'),
    ]);
  });

  it('accepts a see_also that resolves', () => {
    expect(reg.checkReferences(e({ see_also: ['b'] }), ['a', 'b'])).toEqual([]);
  });

  it('FAILS an orphaned .json and an orphaned .md', () => {
    const r = mkdtempSync(join(tmpdir(), 'gp-'));
    mkdirSync(join(r, 'docs', 'gotchas'), { recursive: true });
    writeFileSync(join(r, 'docs/gotchas/lonely-json.json'), '{}', 'utf8');
    writeFileSync(join(r, 'docs/gotchas/lonely-md.md'), 'body', 'utf8');
    const errs = reg.checkPairing(r);
    expect(errs).toEqual(
      expect.arrayContaining([
        expect.stringContaining('lonely-json'),
        expect.stringContaining('lonely-md'),
      ]),
    );
    rmSync(r, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tests && npx jest tdd/sprint-127-gotcha-integrity.test.ts`
Expected: FAIL — `reg.checkScope is not a function`

- [ ] **Step 3: Write minimal implementation**

Append to `scripts/gotcha-registry.js`, add all three to exports:

```javascript
function normalizePath(p) {
  return String(p).replace(/\\/g, '/');
}

// A trailing slash means "directory prefix"; anything else must match exactly.
function scopeMatches(scopeEntry, candidatePath) {
  const s = normalizePath(scopeEntry);
  const c = normalizePath(candidatePath);
  return s.endsWith('/') ? c.startsWith(s) : c === s;
}

function checkScope(entry, trackedPaths) {
  const errs = [];
  const scope = Array.isArray(entry.data.scope) ? entry.data.scope : [];
  for (const s of scope) {
    const hit = trackedPaths.some((t) => scopeMatches(s, t));
    if (!hit) {
      errs.push(
        `${entry.jsonPath}: scope "${s}" matches no git-tracked path — stale, misfiled, or machine-local`,
      );
    }
  }
  return errs;
}

function checkReferences(entry, allSlugs) {
  const refs = Array.isArray(entry.data.see_also) ? entry.data.see_also : [];
  return refs
    .filter((r) => !allSlugs.includes(r))
    .map((r) => `${entry.jsonPath}: see_also "${r}" has no matching entry`);
}

function checkPairing(rootDir) {
  const dir = path.join(rootDir, GOTCHA_DIR);
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir);
  const jsons = new Set(files.filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)));
  const mds = new Set(files.filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)));
  const errs = [];
  for (const s of jsons) if (!mds.has(s)) errs.push(`docs/gotchas/${s}.json has no matching ${s}.md`);
  for (const s of mds) if (!jsons.has(s)) errs.push(`docs/gotchas/${s}.md has no matching ${s}.json`);
  return errs.sort();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tests && npx jest tdd/sprint-127-gotcha-integrity.test.ts`
Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add scripts/gotcha-registry.js tests/tdd/sprint-127-gotcha-integrity.test.ts
git commit -m "feat: tracked-scope validation, reference integrity, sidecar pairing"
```

---

## Task 5: Discovery

**Files:**
- Modify: `scripts/gotcha-registry.js`
- Test: `tests/tdd/sprint-127-gotcha-discovery.test.ts`

**Interfaces:**
- Consumes: `Entry`, `scopeMatches`.
- Produces: `discover(entries: Entry[], changedPaths: string[]): string[]` — returns matching slugs, sorted. `changedPaths` are the paths **about to change**, including files that do not exist yet.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/tdd/sprint-127-gotcha-discovery.test.ts
const reg = require('../../scripts/gotcha-registry.js');

function e(slug: string, scope: string[]) {
  return { slug, jsonPath: `docs/gotchas/${slug}.json`,
           bodyPath: `docs/gotchas/${slug}.md`, data: { scope }, body: '' };
}

const ENTRIES = [
  e('hooks-path', ['scripts/install-hooks.sh', 'scripts/git-hooks/']),
  e('audit-gate', ['scripts/audit-exemptions.js']),
  e('landing-generated', ['scripts/generate-docs.ts']),
];

describe('gotcha registry — discovery', () => {
  it('returns the exact expected entries for a changed file', () => {
    expect(reg.discover(ENTRIES, ['scripts/audit-exemptions.js'])).toEqual(['audit-gate']);
  });

  it('matches a directory prefix', () => {
    expect(reg.discover(ENTRIES, ['scripts/git-hooks/pre-push'])).toEqual(['hooks-path']);
  });

  // The case directory-scoped knowledge exists for: a file that does not exist yet.
  it('matches a NEW file not yet created or staged', () => {
    expect(reg.discover(ENTRIES, ['scripts/git-hooks/pre-merge'])).toEqual(['hooks-path']);
  });

  // Over-matching prefixes are a silent correctness bug a positive-only test cannot see.
  it('does NOT match an adjacent prefix', () => {
    expect(reg.discover(ENTRIES, ['scripts/git-hooks-old/pre-push'])).toEqual([]);
  });

  it('returns nothing for an unrelated path', () => {
    expect(reg.discover(ENTRIES, ['apps/frontend/src/pages/index.tsx'])).toEqual([]);
  });

  it('deduplicates when several changed paths hit one entry', () => {
    expect(
      reg.discover(ENTRIES, ['scripts/install-hooks.sh', 'scripts/git-hooks/pre-push']),
    ).toEqual(['hooks-path']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tests && npx jest tdd/sprint-127-gotcha-discovery.test.ts`
Expected: FAIL — `reg.discover is not a function`

- [ ] **Step 3: Write minimal implementation**

```javascript
function discover(entries, changedPaths) {
  const hits = new Set();
  for (const entry of entries) {
    const scope = Array.isArray(entry.data.scope) ? entry.data.scope : [];
    for (const s of scope) {
      if (changedPaths.some((c) => scopeMatches(s, c))) {
        hits.add(entry.slug);
        break;
      }
    }
  }
  return [...hits].sort();
}
```

Add `discover`, `scopeMatches` and **`normalizePath`** to `module.exports`.

`normalizePath` is exported because callers outside this module — the discovery CLI in Task 6 —
need identical separator handling. Re-implementing it inline is exactly how a `SyntaxError` that
disabled validation, discovery and the pre-commit hook simultaneously reached an earlier draft.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tests && npx jest tdd/sprint-127-gotcha-discovery.test.ts`
Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add scripts/gotcha-registry.js tests/tdd/sprint-127-gotcha-discovery.test.ts
git commit -m "feat: scope-based discovery incl. new files and adjacent-prefix rejection"
```

---

## Task 6: Credential screening and the pre-commit hook

**Files:**
- Modify: `scripts/gotcha-registry.js`
- Create: `scripts/gotcha-check.js`
- Modify: `scripts/git-hooks/pre-commit`
- Test: `tests/tdd/sprint-127-gotcha-credentials.test.ts`

**Interfaces:**
- Consumes: `loadRegistry`.
- Produces:
  - `scanCredentials(text: string, label: string): string[]`
  - `scripts/gotcha-check.js` CLI: `node scripts/gotcha-check.js [--staged]` — exit 0 clean, exit 1 with findings on stderr.

**Rationale:** the screen runs at pre-commit because a CI rejection arrives after the content is already on a public remote, where deletion does not remove it from history. The regression gate keeps the check as defence-in-depth, since hooks here have a documented history of being inert.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/tdd/sprint-127-gotcha-credentials.test.ts
const reg = require('../../scripts/gotcha-registry.js');

describe('gotcha registry — credential screening', () => {
  it('passes ordinary prose', () => {
    expect(reg.scanCredentials('Diagnose the endpoint with a direct probe.', 'a.md')).toEqual([]);
  });

  it('FLAGS a password assignment', () => {
    expect(reg.scanCredentials('password: hunter2seventeen', 'a.md')).toEqual([
      expect.stringContaining('a.md'),
    ]);
  });

  it('FLAGS a private key block', () => {
    expect(reg.scanCredentials('-----BEGIN OPENSSH PRIVATE KEY-----', 'a.md')).toEqual([
      expect.stringContaining('a.md'),
    ]);
  });

  it('FLAGS a postgres connection string with credentials', () => {
    expect(
      reg.scanCredentials('postgresql://karmyq_prod:s3cr3tvalue@karmyq.com:5432/db', 'a.md'),
    ).toEqual([expect.stringContaining('a.md')]);
  });

  it('FLAGS a bearer token', () => {
    expect(reg.scanCredentials('Authorization: Bearer ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123', 'a.md'))
      .toEqual([expect.stringContaining('a.md')]);
  });

  // High recall is the safer failure direction here: a false positive costs a
  // rewording, a false negative publishes a secret irreversibly.
  it('does not flag the word "password" used descriptively', () => {
    expect(reg.scanCredentials('The runbook explains where the password is stored.', 'a.md')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tests && npx jest tdd/sprint-127-gotcha-credentials.test.ts`
Expected: FAIL — `reg.scanCredentials is not a function`

- [ ] **Step 3: Write minimal implementation**

Append to `scripts/gotcha-registry.js`:

```javascript
// The optional quote group is load-bearing. Without it a JSON sidecar containing
// {"password":"..."} produced NO findings — the character after the key is a quote,
// not a colon. Confirmed against the earlier pattern set during review, which is why
// both halves of every pair are now screened in every mode.
const CREDENTIAL_PATTERNS = [
  { name: 'private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  {
    name: 'credential assignment',
    re: /["']?\b(password|passwd|pwd|secret|token|api[_-]?key|private[_-]?key)\b["']?\s*[:=]\s*["']?\S{6,}/i,
  },
  { name: 'bearer token', re: /\bBearer\s+[A-Za-z0-9._-]{20,}/ },
  { name: 'connection string with credentials', re: /\b[a-z+]+:\/\/[^\s:@/]+:[^\s:@/]+@/i },
];

function scanCredentials(text, label) {
  return CREDENTIAL_PATTERNS.filter((p) => p.re.test(text)).map(
    (p) => `${label}: possible ${p.name} — never commit credentials to a public repo`,
  );
}
```

Create `scripts/gotcha-check.js`:

```javascript
#!/usr/bin/env node
'use strict';
const { execFileSync } = require('child_process');
const path = require('path');
const reg = require('./gotcha-registry.js');

const ROOT = path.join(__dirname, '..');

function tracked() {
  return execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').map((s) => s.trim()).filter(Boolean);
}

// Discovery entry point. Without this, discover() is reachable only from tests and the
// spec's central promise — "read the gotchas scoped to what you are about to change" —
// has no way to be acted on. Accepts paths that do NOT yet exist, which is the case
// directory-scoped knowledge exists for.
function runDiscovery(paths) {
  const { entries } = reg.loadRegistry(ROOT);
  // normalizePath is exported from gotcha-registry.js (Task 4) — do not re-implement the
  // separator fix inline. An earlier draft did, and shipped a SyntaxError that disabled
  // validation, discovery AND the pre-commit hook at once.
  const slugs = reg.discover(entries, paths.map(reg.normalizePath));
  if (!slugs.length) {
    console.log('No gotchas scoped to those paths.');
    return 0;
  }
  console.log(`${slugs.length} gotcha(s) apply to those paths — read them before changing:\n`);
  for (const slug of slugs) {
    const entry = entries.find((e) => e.slug === slug);
    console.log(`  ${entry.data.title}`);
    console.log(`    ${entry.bodyPath}`);
  }
  return 0;
}

function main() {
  const forIndex = process.argv.indexOf('--for');
  if (forIndex !== -1) {
    const paths = process.argv.slice(forIndex + 1).filter((a) => !a.startsWith('--'));
    if (!paths.length) {
      console.error('Usage: node scripts/gotcha-check.js --for <path> [<path>...]');
      process.exit(2);
    }
    process.exit(runDiscovery(paths));
  }
  const stagedOnly = process.argv.includes('--staged');
  const { entries, errors } = reg.loadRegistry(ROOT);
  const all = [...errors];
  const slugs = entries.map((e) => e.slug);

  if (stagedOnly) {
    // Publication-preventing screen. Reads each staged BLOB from the index, never the
    // working tree: staging a credential and then editing it out WITHOUT staging the
    // removal would otherwise pass this screen while the commit still carries it.
    // Iterating loaded entries is also wrong — it would miss a staged .md with no .json.
    const statusLines = execFileSync(
      'git', ['diff', '--cached', '--name-status', '--', 'docs/gotchas'],
      { cwd: ROOT, encoding: 'utf8' },
    ).split('\n').map((s) => s.trim()).filter(Boolean);

    for (const line of statusLines) {
      const parts = line.split('\t');
      const status = parts[0][0];              // A, M, D, R...
      const file = parts[parts.length - 1];    // for renames, the destination path
      if (status === 'D') continue;            // a deletion publishes nothing
      let blob;
      try {
        blob = execFileSync('git', ['show', ':' + file], { cwd: ROOT, encoding: 'utf8' });
      } catch (e) {
        all.push(file + ': could not read the staged blob — failing closed');
        continue;
      }
      all.push(...reg.scanCredentials(blob, file));
    }
  } else {
    const t = tracked();
    all.push(...reg.checkPairing(ROOT));
    for (const e of entries) {
      all.push(...reg.validateSchema(e));
      all.push(...reg.runVerify(ROOT, e));
      all.push(...reg.checkDates(e, new Date()));
      all.push(...reg.checkScope(e, t));
      all.push(...reg.checkReferences(e, slugs));
      // BOTH halves of the pair, in every mode. Scanning only the body left the
      // sidecar unscreened, and a credential sits as easily in a JSON field.
      all.push(...reg.scanCredentials(e.body, e.bodyPath));
      all.push(...reg.scanCredentials(JSON.stringify(e.data, null, 1), e.jsonPath));
    }
  }

  if (all.length) {
    console.error('\n❌ Gotcha registry check failed:\n');
    for (const e of all) console.error(`  ✗ ${e}`);
    console.error('\n  → Fix the entry, or delete it if it no longer applies.\n');
    process.exit(1);
  }
  console.log(`✅ Gotcha registry clean (${entries.length} entries).`);
}

main();
```

Add to `scripts/git-hooks/pre-commit`, before its final exit:

```bash
# Credential screen for gotcha entries — runs BEFORE publication. A CI rejection
# would arrive after the content is already on a public remote, where deletion
# does not remove it from git history.
staged_gotchas=$(echo "$changed_files" | grep '^docs/gotchas/' || true)
if [ -n "$staged_gotchas" ]; then
  echo ""
  echo "🔐 Screening staged gotcha entries for credentials..."
  if ! node scripts/gotcha-check.js --staged; then
    echo "❌ Commit blocked: possible credential in a gotcha entry."
    exit 1
  fi
fi
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tests && npx jest tdd/sprint-127-gotcha-credentials.test.ts`
Expected: PASS — 6 tests

Then prove the hook blocks the cases that matter. **Reinstall the hook first** — on Windows the
installer copies rather than symlinks, so an edited `scripts/git-hooks/pre-commit` is not live
until `npm run hooks:install` runs again:

```bash
npm run hooks:install
```

**Run every probe in a DISPOSABLE clone**, never in your working repo — Case D needs a committed
file to delete, and you must not commit probe content to the real branch.

```bash
PROBE=$(mktemp -d) && git clone --quiet --no-hardlinks . "$PROBE" && cd "$PROBE"
npm run hooks:install    # hooks are per-clone; on Windows the installer copies, so this is required
```

**Every probe asserts the DIAGNOSTIC, not just a non-zero exit.** A syntax error in the CLI also
exits non-zero — an earlier draft's probes would have passed against a completely broken script.

**Case A — the partial-staging bypass.** Stage a credential, then remove it from the working tree
WITHOUT staging the removal. The commit still carries it.

```bash
mkdir -p docs/gotchas
printf '{"title":"t","owner":"o","created":"2026-09-04","expires":"2027-01-01","scope":["README.md"]}' > docs/gotchas/tmp-a.json
printf 'password: hunter2seventeen\n' > docs/gotchas/tmp-a.md
git add docs/gotchas/tmp-a.json docs/gotchas/tmp-a.md
printf 'clean now\n' > docs/gotchas/tmp-a.md          # working tree clean, INDEX still dirty
git commit -m "probe A" 2>&1 | tee /tmp/a.txt; test ${PIPESTATUS[0]} -ne 0
grep -q "credential assignment" /tmp/a.txt && echo "A: blocked for the right reason"
git reset -q HEAD . && rm -f docs/gotchas/tmp-a.*
```

**Case B — a genuine quoted JSON key**, which is the format the earlier regex missed. Note the
credential is a real `"password"` **key**, not prose inside a `note` field.

```bash
printf '{"title":"t","owner":"o","created":"2026-09-04","expires":"2027-01-01","scope":["README.md"],"password":"synthetic-example-value"}' > docs/gotchas/tmp-b.json
printf 'body\n' > docs/gotchas/tmp-b.md
git add docs/gotchas/tmp-b.*
git commit -m "probe B" 2>&1 | tee /tmp/b.txt; test ${PIPESTATUS[0]} -ne 0
grep -q "credential assignment" /tmp/b.txt && echo "B: quoted JSON key caught"
git reset -q HEAD . && rm -f docs/gotchas/tmp-b.*
```

**Case C — an orphaned staged `.md` with no `.json`**, which iterating loaded entries skipped.

```bash
printf 'token = abcdef123456789\n' > docs/gotchas/tmp-c.md
git add docs/gotchas/tmp-c.md
git commit -m "probe C" 2>&1 | tee /tmp/c.txt; test ${PIPESTATUS[0]} -ne 0
grep -q "credential assignment" /tmp/c.txt && echo "C: orphan .md caught"
git reset -q HEAD . && rm -f docs/gotchas/tmp-c.md
```

**Case D — deleting a COMMITTED file must NOT block**, because a deletion publishes nothing. This
needs a real commit first; unstaging an uncommitted file never invokes the screen at all.

```bash
printf '{"title":"harmless","owner":"o","created":"2026-09-04","expires":"2027-01-01","scope":["README.md"]}' > docs/gotchas/tmp-d.json
printf 'nothing sensitive here\n' > docs/gotchas/tmp-d.md
git add docs/gotchas/tmp-d.* && git commit -q -m "probe D setup"   # must SUCCEED
git rm -q docs/gotchas/tmp-d.json docs/gotchas/tmp-d.md
git commit -m "probe D: deletion must pass"                        # must SUCCEED, exit 0
echo "D: staged deletion allowed"
```

**Tear the probe clone down:**

```bash
cd - >/dev/null && rm -rf "$PROBE"
```

- [ ] **Step 5: Commit**

```bash
git add scripts/gotcha-registry.js scripts/gotcha-check.js scripts/git-hooks/pre-commit tests/tdd/sprint-127-gotcha-credentials.test.ts
git commit -m "feat: credential screening at pre-commit, before publication"
```

---

## Task 7: The blocking regression gate

**Files:**
- Create: `tests/regression/sprint-127-gotcha-registry-gate.test.ts`
- Delete: the six `tests/tdd/sprint-127-gotcha-*.test.ts` files (their assertions move here)

**Interfaces:**
- Consumes: every function from Tasks 1–6.
- Produces: a regression-tier gate that blocks the pre-push hook and the required `Test Backend Services` check.

- [ ] **Step 1: Write the gate**

```typescript
// tests/regression/sprint-127-gotcha-registry-gate.test.ts
import { execFileSync } from 'child_process';
import { join } from 'path';
import { readFileSync } from 'fs';

const reg = require('../../scripts/gotcha-registry.js');
const ROOT = join(__dirname, '..', '..');

const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
  .split('\n').map((s) => s.trim()).filter(Boolean);

describe('Sprint 127 — gotcha registry gate', () => {
  const { entries, errors } = reg.loadRegistry(ROOT);
  const slugs = entries.map((e: any) => e.slug);

  it('every sidecar parses', () => {
    expect(errors).toEqual([]);
  });

  it('every entry satisfies the schema', () => {
    expect(entries.flatMap((e: any) => reg.validateSchema(e))).toEqual([]);
  });

  it('every verify claim still holds', () => {
    expect(entries.flatMap((e: any) => reg.runVerify(ROOT, e))).toEqual([]);
  });

  it('no entry is past its review date, and every renewal carries evidence', () => {
    expect(entries.flatMap((e: any) => reg.checkDates(e, new Date()))).toEqual([]);
  });

  it('every scope anchor is git-tracked', () => {
    expect(entries.flatMap((e: any) => reg.checkScope(e, tracked))).toEqual([]);
  });

  it('every see_also resolves', () => {
    expect(entries.flatMap((e: any) => reg.checkReferences(e, slugs))).toEqual([]);
  });

  it('every sidecar has its body and vice versa', () => {
    expect(reg.checkPairing(ROOT)).toEqual([]);
  });

  // BOTH halves. An earlier draft asserted over bodies only, so a credential in a
  // sidecar passed this blocking gate and would have been caught only later, by the
  // clean-room CLI, after the content was already committed.
  it('no entry contains credential-shaped content, in either half of the pair', () => {
    expect(
      entries.flatMap((e: any) => [
        ...reg.scanCredentials(e.body, e.bodyPath),
        ...reg.scanCredentials(JSON.stringify(e.data, null, 1), e.jsonPath),
      ]),
    ).toEqual([]);
  });

  it('the credential scan catches a QUOTED JSON key, not just a bare assignment', () => {
    expect(reg.scanCredentials('{"password":"synthetic-example-value"}', 'x.json')).toEqual([
      expect.stringContaining('x.json'),
    ]);
  });

  it('the credential scan still ignores descriptive prose', () => {
    expect(reg.scanCredentials('The runbook explains where the password is stored.', 'x.md')).toEqual([]);
  });

  // The CLI is the entry point for the hook and the clean room. A syntax error in it
  // disables all three at once, and every probe that asserts only "exit 1" would still
  // look like it passed.
  it('the CLI parses and its discovery mode answers', () => {
    const out = execFileSync(process.execPath, ['scripts/gotcha-check.js', '--for', 'scripts/install-hooks.sh'], {
      cwd: ROOT, encoding: 'utf8',
    });
    expect(out).toMatch(/gotcha\(s\) apply/);
  });

  // Hermeticity: the module must not reach the network, directly or transitively.
  it('the validator makes no network calls', () => {
    const src = readFileSync(join(ROOT, 'scripts', 'gotcha-registry.js'), 'utf8');
    expect(src).not.toMatch(/require\(['"](https?|net|dns|tls)['"]\)/);
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/child_process/);
  });
});
```

- [ ] **Step 2: Move every negative fixture from the tdd files into this file**

Copy each `it(...)` block from `tests/tdd/sprint-127-gotcha-{registry,verify,dates,integrity,discovery,credentials}.test.ts` into `describe('negative fixtures — the gate must be able to FAIL', ...)` inside this file, unchanged. Then delete the six tdd files.

- [ ] **Step 3: Run the gate**

Run: `cd tests && npx jest regression/sprint-127-gotcha-registry-gate.test.ts`
Expected: PASS — 9 positive + 40 negative assertions

- [ ] **Step 4: Verify Turbo did not serve a stale cache**

Run: `cd tests && npx jest regression/sprint-127-gotcha-registry-gate.test.ts --force`
Expected: same result

- [ ] **Step 5: Commit**

```bash
git add tests/regression/sprint-127-gotcha-registry-gate.test.ts
git rm tests/tdd/sprint-127-gotcha-*.test.ts
git commit -m "test: promote gotcha registry gate to regression tier"
```

---

## Task 8: Clean-room fixture — validator and discovery from a fresh clone

**Files:**
- Modify: `tests/regression/sprint-127-gotcha-registry-gate.test.ts`

**Interfaces:**
- Consumes: `scripts/gotcha-check.js`, `discover`.
- Produces: nothing consumed downstream.

**Rationale:** whole-registry validation proves the validator survives a fresh clone. It does not prove discovery returns the right entries, which is the part people depend on. This does both.

- [ ] **Step 1: Write the fixture**

```typescript
// append to tests/regression/sprint-127-gotcha-registry-gate.test.ts
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';

describe('Sprint 127 — clean-room: validator and discovery from a fresh clone', () => {
  let clone: string;
  let sha: string;

  beforeAll(() => {
    sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
    clone = mkdtempSync(join(tmpdir(), 'gotcha-clean-'));
    execFileSync('git', ['clone', '--quiet', '--no-hardlinks', ROOT, clone], { encoding: 'utf8' });
    execFileSync('git', ['checkout', '--quiet', sha], { cwd: clone, encoding: 'utf8' });
  }, 120000);

  afterAll(() => {
    if (clone) rmSync(clone, { recursive: true, force: true });
  });

  it('validated the commit under test, not some other tree', () => {
    const cloneSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: clone, encoding: 'utf8' }).trim();
    expect(cloneSha).toBe(sha);
  });

  it('has no node_modules — the validator must need none', () => {
    expect(existsSync(join(clone, 'node_modules'))).toBe(false);
  });

  it('the validator runs under bare node and exits 0', () => {
    const out = execFileSync(process.execPath, ['scripts/gotcha-check.js'], {
      cwd: clone, encoding: 'utf8',
    });
    expect(out).toMatch(/Gotcha registry clean/);
  });

  it('discovery returns the EXACT expected entries for representative paths', () => {
    const cleanReg = require(join(clone, 'scripts', 'gotcha-registry.js'));
    const { entries } = cleanReg.loadRegistry(clone);
    expect(cleanReg.discover(entries, ['scripts/install-hooks.sh']))
      .toEqual(['hooks-install-to-git-hooks-on-a-fresh-clone']);
    expect(cleanReg.discover(entries, ['scripts/audit-exemptions.js']).sort())
      .toEqual(['adr-059-cannot-tell-no-answer-from-no-advisories',
                'npm-status-page-is-not-a-signal'].sort());
  });

  it('discovery rejects an adjacent prefix', () => {
    const cleanReg = require(join(clone, 'scripts', 'gotcha-registry.js'));
    const { entries } = cleanReg.loadRegistry(clone);
    expect(cleanReg.discover(entries, ['scripts/git-hooks-old/pre-push'])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd tests && npx jest regression/sprint-127-gotcha-registry-gate.test.ts -t "clean-room"`
Expected: FAIL initially — the seed slugs do not exist yet. That is correct; Task 9 creates them.

- [ ] **Step 3: Commit (gate red until Task 9 — note it in the message)**

```bash
git add tests/regression/sprint-127-gotcha-registry-gate.test.ts
git commit -m "test: clean-room validator + discovery fixture (red until seeds land)"
```

---

## Task 9: Seed the six entries

**Files:**
- Create: `docs/gotchas/hooks-install-to-git-hooks-on-a-fresh-clone.{json,md}`
- Create: `docs/gotchas/npm-status-page-is-not-a-signal.{json,md}`
- Create: `docs/gotchas/adr-059-cannot-tell-no-answer-from-no-advisories.{json,md}`
- Create: `docs/gotchas/landing-docs-are-generated-never-authored.{json,md}`
- Create: `docs/gotchas/dependabot-regenerates-expo-sdk-breaks.{json,md}`
- Create: `docs/gotchas/node-24-is-a-gate-locked-floor.{json,md}`

**Interfaces:**
- Consumes: the schema from Task 1.
- Produces: the slugs Task 8 asserts on.

**Coverage, stated honestly.** An earlier draft claimed "each entry exercises a different check
type". That was false — both executable seeds used `file_matches`. Actual coverage:

| Check type | Seed coverage | Fixture coverage |
|---|---|---|
| `file_matches` | hooks, landing | ✅ |
| `path_exists` | hooks (second check) | ✅ |
| `json_equals` | node-24-floor | ✅ |
| `file_not_matches` | **none** | ✅ |

`file_not_matches` has no seed because no current gotcha truthfully needs one. **A seed must never
be contrived to satisfy a coverage target** — an entry that exists to exercise the validator rather
than to record a true fact is exactly the rot this registry is meant to prevent. If a real
`file_not_matches` gotcha appears later, it gets an entry then.

- [ ] **Step 1: Write the two executable entries**

`docs/gotchas/hooks-install-to-git-hooks-on-a-fresh-clone.json`:

```json
{
  "title": "Git hooks install to .git/hooks on a fresh clone; .husky only where husky already ran",
  "owner": "ravichavali",
  "created": "2026-09-04",
  "scope": ["scripts/install-hooks.sh", "scripts/git-hooks/"],
  "verify": {
    "file_matches": {
      "path": "scripts/install-hooks.sh",
      "pattern": "hooks_dir=\"\\.git/hooks\""
    },
    "path_exists": "scripts/git-hooks/pre-push"
  }
}
```

`docs/gotchas/node-24-is-a-gate-locked-floor.json`:

```json
{
  "title": "Node 24 is gate-locked across images, engines and CI — they move as one",
  "owner": "ravichavali",
  "created": "2026-09-04",
  "scope": ["package.json", ".github/workflows/ci.yml"],
  "verify": {
    "json_equals": { "path": "package.json", "key": "engines.node", "value": ">=24.0.0" }
  }
}
```

`docs/gotchas/node-24-is-a-gate-locked-floor.md`:

```markdown
Container images run `node:24-alpine`, the root `engines.node` is `>=24.0.0`, and CI's
`NODE_VERSION` is `24.x`. Per ADR-090 these are **gate-locked to one major** — changing any one
of them alone puts the runtime, the manifest and CI out of agreement.

Older majors install with `EBADENGINE` warnings rather than failing outright, so the breakage is
quiet until something else surfaces it.

This entry carries a `json_equals` check, so bumping the floor without updating this gotcha fails
the build — which is the point: the entry and the fact move together.
```

`docs/gotchas/hooks-install-to-git-hooks-on-a-fresh-clone.md`:

```markdown
`git config core.hooksPath` is **empty on a fresh clone**, and that is correct. The installer reads
it and falls back to `.git/hooks`. It prints `.husky` only on a machine where husky previously ran
— and `.npmrc` sets `ignore-scripts=true`, so husky's `prepare` never runs on a new clone.

Verify at whichever path git actually resolves, not at a hardcoded one:

    HOOKS_DIR=$(git config --get core.hooksPath); [ -z "$HOOKS_DIR" ] && HOOKS_DIR=.git/hooks
    ls -l "$HOOKS_DIR/pre-push"

On macOS and Linux the installed hooks are **symlinks** (`lrwxr-xr-x`) by design; copies only on
Windows, where symlinks need privilege and silently dangle.

The real proof is at runtime: a push must print `🚀 Running pre-push checks...`. A push that
finishes silently and instantly means no hook ran.
```

`docs/gotchas/landing-docs-are-generated-never-authored.json`:

```json
{
  "title": "apps/landing/src/data/docs/ is generated — author docs/concepts/ and the generator's lists",
  "owner": "ravichavali",
  "created": "2026-09-04",
  "scope": ["scripts/generate-docs.ts", "docs/concepts/", "docs/guides/"],
  "verify": {
    "file_matches": { "path": "scripts/generate-docs.ts", "pattern": "const whyKarmyq" }
  },
  "see_also": ["npm-status-page-is-not-a-signal"]
}
```

`docs/gotchas/landing-docs-are-generated-never-authored.md`:

```markdown
`apps/landing/src/data/docs/` — including `nav.json` — is **build output**. A hand edit survives
until the next `npm test` (the landing prebuild runs `generate-docs`), then vanishes.

To add a concept page:

1. Write `docs/concepts/<slug>.md`.
2. Add the slug to **`CONCEPT_ORDER`** (reading order) **and** to **`whyKarmyq`** or **`howItWorks`**
   (nav placement) in `scripts/generate-docs.ts`.
3. Regenerate, then verify the produced page and nav entry.

Missing either list fails the doc-context drift gate.

⚠️ Do not record this as "grep-verify nav.json after every edit". That is the symptom's workaround,
and stating it that way has already caused one wrong instruction to be written into a design spec.
The file reverts *because it is generated*; the fix is always at the source.
```

- [ ] **Step 2: Write the three expiring entries**

`docs/gotchas/npm-status-page-is-not-a-signal.json`:

```json
{
  "title": "npm's status page is not a signal for advisory-endpoint health",
  "owner": "ravichavali",
  "created": "2026-09-04",
  "expires": "2027-09-04",
  "scope": ["scripts/audit-exemptions.js", "security/audit-exemptions.json"],
  "see_also": ["adr-059-cannot-tell-no-answer-from-no-advisories"]
}
```

`docs/gotchas/npm-status-page-is-not-a-signal.md`:

```markdown
During a 2026-09-03 outage, `POST` to both `/-/npm/v1/security/audits/quick` and
`/-/npm/v1/security/advisories/bulk` hung or returned 503 — in two independent networks (a dev
machine and GitHub-hosted runners) — while `GET /-/ping` returned 200 and
<https://status.npmjs.org/> reported "All Systems Operational" with 100% Security Audit uptime over
90 days.

A single-dependency throwaway project reproduced the 503, so it was not payload size.

Diagnose advisory-endpoint health with a direct probe. Never from the status page.
```

`docs/gotchas/adr-059-cannot-tell-no-answer-from-no-advisories.json`:

```json
{
  "title": "The ADR-059 gate cannot distinguish no advisories from no answer",
  "owner": "ravichavali",
  "created": "2026-09-04",
  "expires": "2027-03-04",
  "scope": ["scripts/audit-exemptions.js", "security/audit-exemptions.json", ".github/workflows/ci.yml"],
  "see_also": ["npm-status-page-is-not-a-signal"]
}
```

`docs/gotchas/adr-059-cannot-tell-no-answer-from-no-advisories.md`:

```markdown
Behaviour depends on the exemption registry, which is the dangerous part:

| Registry | Result |
|---|---|
| Shipped (has exemptions) | The stale-exemption check trips → `ADR-059 gate FAILED`. Fails **closed**, for the wrong reason. |
| Empty | No advisories seen → nothing to block → exit 0. Fails **OPEN**. |

During an outage the gate prints `upstream may be fixed; remove it` for every shipped exemption.
**Following that instruction empties the registry**, moving the gate from fail-closed to fail-open
exactly when it cannot tell you so. Do not act on that output while the endpoint is degraded.

Tracked as BUG-038. The fix pattern already exists in this repo:
`tests/regression/sprint-122-adr-060-code-scanning-gate.test.ts` — "ADR-060 gate — refuses to fail
open on API errors".
```

`docs/gotchas/dependabot-regenerates-expo-sdk-breaks.json`:

```json
{
  "title": "Dependabot regenerates an Expo-SDK-breaking group PR weekly until the packages are ignored",
  "owner": "ravichavali",
  "created": "2026-09-04",
  "expires": "2027-03-04",
  "scope": [".github/dependabot.yml", "apps/mobile/package.json"]
}
```

`docs/gotchas/dependabot-regenerates-expo-sdk-breaks.md`:

```markdown
The `production-deps` group bumps React Native packages past what Expo SDK 57 pins — `react-native`
0.87.1 vs 0.86.2, plus `react-native-maps`, `safe-area-context`, `reanimated`, `worklets`,
`screens`. Caught by `tests/regression/sprint-122-expo-sdk-alignment.test.ts`, with consequent
`TS2322`/`TS2769` errors in `apps/mobile`.

These packages are version-managed by the Expo SDK and must move as a set when the SDK moves.
`.github/dependabot.yml` has no `ignore` list for them, so the PR regenerates every week and the
gate fails it every week.

When adding that ignore list, **generate it from or verify it against the gate's `SDK_PINNED` map**.
A hand-copied YAML list is a shadow map and will drift.
```

- [ ] **Step 3: Run the WORKING-TREE checks only**

The clean-room fixture clones `HEAD`, and the seeds exist only in the working tree at this
point — so it cannot pass yet, and running it here would prove nothing.

```bash
node scripts/gotcha-check.js
cd tests && npx jest regression/sprint-127-gotcha-registry-gate.test.ts -t "gotcha registry gate"
cd ..
```

Expected: `✅ Gotcha registry clean (6 entries).` and the non-clean-room assertions pass.

- [ ] **Step 4: Prove the gate fails on a stale seed, before committing**

```bash
# Restore is guaranteed by trap, and there is NO cd — step 3 already returned to the
# repo root. An earlier draft added a stray `cd ..`, which left the repo entirely and
# so left scripts/install-hooks.sh mutated for every later step.
trap 'git checkout -- scripts/install-hooks.sh' EXIT
sed -i 's/hooks_dir=".git\/hooks"/hooks_dir="ELSEWHERE"/' scripts/install-hooks.sh
node scripts/gotcha-check.js 2>&1 | tee /tmp/stale.txt; test ${PIPESTATUS[0]} -eq 1
grep -q "no longer contains" /tmp/stale.txt   # the RIGHT failure, not just a non-zero exit
git checkout -- scripts/install-hooks.sh
git diff --quiet scripts/install-hooks.sh && echo "restored"
```

- [ ] **Step 5: Verify discovery answers from the CLI**

```bash
node scripts/gotcha-check.js --for scripts/git-hooks/pre-merge
```

Expected: names the hooks entry — a file that does not exist, which is exactly the case
directory-scoped knowledge exists for.

- [ ] **Step 6: Commit the seeds**

```bash
git add docs/gotchas
git commit -m "docs: seed the registry with six verified entries"
```

- [ ] **Step 7: NOW run the clean-room fixture**

`HEAD` contains the seeds only after Step 6, so this is the first point at which the clone
under test has a populated registry.

```bash
cd tests && npx jest regression/sprint-127-gotcha-registry-gate.test.ts && cd ..
```

Expected: PASS — including the clean-room discovery assertions from Task 8, which were
committed red and go green here.

---

## Task 10: Onboarding-doc policy assertion

**Files:**
- Modify: `tests/regression/doc-context-drift-gate.test.ts`
- Modify: `README.md`, `CONTRIBUTING.md`

**Interfaces:**
- Consumes: nothing.
- Produces: `onboardingDocIssues(docs: Record<string, string>): string[]` — exported pure predicate.

**Rationale:** consistency alone is satisfiable by all three documents regressing to `npm install`. The policy must be asserted explicitly. `npm ci` is not an external arbiter's value — it is the policy, so stating it is not a shadow map.

- [ ] **Step 1: Write the failing test**

```typescript
// add to tests/regression/doc-context-drift-gate.test.ts
// Extracts every `npm install|ci` invocation WITH its flags, so the check compares
// actual commands rather than asserting that two independent strings are present
// somewhere in the file. An earlier draft passed `npm install --legacy-peer-deps`
// whenever "npm ci" appeared anywhere else in the document.
export function extractInstallCommands(text: string): string[] {
  return [...text.matchAll(/^\s*(npm (?:install|ci)[^\n]*)$/gm)]
    .map((m) => m[1].trim())
    .filter((c) => !/--workspace/.test(c)); // workspace examples are illustrative, not the policy
}

export function onboardingDocIssues(docs: Record<string, string>): string[] {
  const issues: string[] = [];
  const perDoc: Record<string, string[]> = {};

  for (const [name, text] of Object.entries(docs)) {
    const cmds = extractInstallCommands(text);
    perDoc[name] = cmds;
    // 1. POLICY: no forbidden command, regardless of flags.
    for (const c of cmds) {
      if (/^npm install\b/.test(c)) {
        issues.push(`${name}: uses "${c}"; the policy is "npm ci"`);
      }
    }
    // 2. POLICY: the required commands are present.
    if (!cmds.some((c) => /^npm ci\b/.test(c))) {
      issues.push(`${name}: has no "npm ci" install command`);
    }
    if (!/npm run hooks:install/.test(text)) {
      issues.push(`${name}: does not mention "npm run hooks:install"`);
    }
  }

  // 3. CONSISTENCY: the install command must be identical across documents, flags
  //    included — this catches divergence the policy check alone would miss.
  const canonical = Object.entries(perDoc)
    .map(([name, cmds]) => [name, cmds.find((c) => /^npm ci\b/.test(c))] as const)
    .filter(([, c]) => c);
  const distinct = [...new Set(canonical.map(([, c]) => c))];
  if (distinct.length > 1) {
    issues.push(`onboarding docs disagree on the install command: ${distinct.join(' | ')}`);
  }

  return issues.sort();
}

describe('onboarding docs state the policy, not merely agree', () => {
  const docs = {
    'README.md': read('README.md'),
    'CONTRIBUTING.md': read('CONTRIBUTING.md'),
    'claude.md': readRootDoc('CLAUDE.md'),
  };

  it('all three state npm ci and hooks:install', () => {
    expect(onboardingDocIssues(docs)).toEqual([]);
  });

  // Each failure gets its OWN fixture. An earlier draft used a single fixture that
  // also removed "npm ci" and "hooks:install", so it fired three different errors and
  // could not prove the forbidden-command check worked at all.
  const OK = 'npm ci\nnpm run hooks:install\n';

  it('FAILS the forbidden command even when npm ci is also present', () => {
    const docs = {
      'README.md': 'npm install\nnpm ci\nnpm run hooks:install\n',
      'CONTRIBUTING.md': OK,
      'claude.md': OK,
    };
    expect(onboardingDocIssues(docs)).toEqual([expect.stringContaining('uses "npm install"')]);
  });

  // Flags must not launder a forbidden command past the check.
  it('FAILS "npm install --legacy-peer-deps" even with npm ci elsewhere', () => {
    const docs = {
      'README.md': 'npm install --legacy-peer-deps\nnpm ci\nnpm run hooks:install\n',
      'CONTRIBUTING.md': OK,
      'claude.md': OK,
    };
    expect(onboardingDocIssues(docs)).toEqual([expect.stringContaining('--legacy-peer-deps')]);
  });

  it('FAILS a missing hooks:install on its own', () => {
    const docs = { 'README.md': 'npm ci\n', 'CONTRIBUTING.md': OK, 'claude.md': OK };
    expect(onboardingDocIssues(docs)).toEqual([expect.stringContaining('hooks:install')]);
  });

  // Uniform regression is perfectly consistent and uniformly wrong — consistency alone
  // cannot catch it, which is why the policy is asserted explicitly.
  it('FAILS when all three agree on the wrong command', () => {
    const wrong = {
      'README.md': 'npm install\nnpm run hooks:install\n',
      'CONTRIBUTING.md': 'npm install\nnpm run hooks:install\n',
      'claude.md': 'npm install\nnpm run hooks:install\n',
    };
    const issues = onboardingDocIssues(wrong);
    expect(issues.filter((i) => i.includes('uses "npm install"'))).toHaveLength(3);
  });

  it('FAILS when documents disagree on the install command flags', () => {
    const docs = {
      'README.md': 'npm ci --no-audit\nnpm run hooks:install\n',
      'CONTRIBUTING.md': OK,
      'claude.md': OK,
    };
    expect(onboardingDocIssues(docs)).toEqual([
      expect.stringContaining('disagree on the install command'),
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tests && npx jest regression/doc-context-drift-gate.test.ts`
Expected: FAIL — `README.md: uses "npm install"`, `README.md: does not mention "npm run hooks:install"`

- [ ] **Step 3: Fix the documents**

In `README.md` replace the Quick Start install block:

```bash
# 1. Clone the repository
git clone https://github.com/ravichavali/karmyq.git
cd karmyq

# 2. Install dependencies (npm workspaces + Turborepo)
npm ci

# 3. Wire up git hooks — REQUIRED. .npmrc sets ignore-scripts=true, so hooks
#    do NOT install themselves. A push that finishes silently means no hook ran.
npm run hooks:install
```

In `CONTRIBUTING.md` change `npm install` to `npm ci` in the Quick start block.

**`claude.md` also needs the commands, and this is not optional.** It currently mentions `npm ci`
only inline in prose (`claude.md:205`, inside the dependency-edits paragraph) and `hooks:install`
only inline at `:58` and `:221`. The extractor requires a **standalone** command line, so applying
only the README and CONTRIBUTING edits leaves the test red with
`claude.md: has no "npm ci" install command` — verified by running the predicate against the real
files. Add to Discipline 3, immediately after the `npm run hooks:install` sentence:

```markdown
   Clone setup is exactly two commands, and they must match `README.md` and `CONTRIBUTING.md`
   verbatim:

   ```bash
   npm ci
   npm run hooks:install
   ```
```

All three documents must then carry the **identical** `npm ci` line — no extra flags in one and not
the others, or the consistency assertion fires.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd tests && npx jest regression/doc-context-drift-gate.test.ts && cd ..
```

Expected: PASS. If it reports `claude.md: has no "npm ci" install command`, Step 3's `claude.md`
edit was skipped — that is the failure mode this step exists to catch.

- [ ] **Step 5: Commit**

```bash
git add tests/regression/doc-context-drift-gate.test.ts README.md CONTRIBUTING.md claude.md
git commit -m "fix: assert the onboarding policy, not merely agreement between docs"
```

---

## Task 11: The /learned capture skill

**Files:**
- Create: `.claude/skills/learned/SKILL.md`

**Interfaces:**
- Consumes: the schema from Task 1.
- Produces: nothing consumed by code.

- [ ] **Step 1: Write the skill**

```markdown
---
name: learned
description: Capture a durable, repo-scoped operational fact to docs/gotchas/ mid-session, so it reaches everyone who clones instead of dying in one agent's private memory. Use when the user says "we learned", "remember this for the repo", "/learned ...", or when a session produces a gotcha that is not a bug, an ADR, or an idea.
disable-model-invocation: false
---

Propose a gotcha entry in `docs/gotchas/`. **Propose — do not write it unasked.** An agent
authorised to add entries unprompted floods the directory.

## What belongs here

A durable, repo-scoped operational fact that is **not** a decision (ADR), a defect (bug), or a
proposal (idea). "Hooks land in `.git/hooks` on a fresh clone." "npm's status page does not reflect
advisory-endpoint health."

**Test for shareability:** would this still be true and useful if a stranger cloned the repo
tomorrow? If it is about the person, it stays in private memory. If it is about the repo, it ships.

**Never include credentials** — access details, passwords, tokens, connection strings. This is a
public repo and deletion does not remove content from git history. The pre-commit hook screens for
this, but do not rely on it.

## Steps

1. Pick a slug: lowercase, hyphenated, states the fact (`hooks-install-to-git-hooks-on-a-fresh-clone`).
   No numbers — slugs need no allocation.
2. Write `docs/gotchas/<slug>.json`:
   - `title`, `owner`, `created` (today, absolute date), `scope` (git-**tracked** paths this applies
     to; a trailing `/` means directory prefix)
   - **exactly one** of:
     - `verify` — a declarative check: `path_exists`, `file_matches`, `file_not_matches`, or
       `json_equals`. Prefer this whenever the fact is machine-checkable.
     - `expires` — an ISO review date, when it is not.
   - optional `see_also`: slugs of related entries (each must exist)
3. Write `docs/gotchas/<slug>.md` — the prose. Say what was observed, where, and what to do instead.
   Include the evidence that made you believe it.
4. Run `node scripts/gotcha-check.js` and fix anything it reports.
5. Show the user both files and ask before committing.

## Do NOT

- Do not write a shell command into `verify`. Only the four declarative types; the validator never
  executes strings from entry files.
- Do not scope to untracked paths (`.husky/`, `node_modules/`, build output) — the check uses
  `git ls-files` and will fail on every fresh clone.
- Do not summarise an entry anywhere. Discovery surfaces entries, never paraphrases; a summary layer
  drifts and looks authoritative while doing it.
```

- [ ] **Step 2: Add the `/ship` capture checkpoint**

The spec names three intake triggers; mid-session capture and recurrence are covered by the skill
above, but the **sprint-ship checkpoint** had no implementation task. Add to
`.claude/skills/ship/SKILL.md`, in its pre-merge section:

```markdown
### Capture what the sprint taught

Before opening the PR, ask: **what did this sprint teach that is not yet captured?**

Candidates are facts that are neither a bug, an ADR, nor an idea — the things that would otherwise
survive only in one agent's private memory. Check them against `docs/gotchas/`:

```bash
node scripts/gotcha-check.js --for <the paths this sprint changed>
```

If a durable fact has no entry, propose one with the `learned` skill. Propose — the maintainer
decides what lands. This is the trigger that catches what mid-session capture missed.
```

- [ ] **Step 3: Verify the skill loads and the CLI it references works**

```bash
node scripts/gotcha-check.js
node scripts/gotcha-check.js --for scripts/install-hooks.sh
```

Expected: `✅ Gotcha registry clean (6 entries).` and the discovery command naming the hooks entry.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/learned/SKILL.md .claude/skills/ship/SKILL.md
git commit -m "feat: /learned skill and the sprint-ship capture checkpoint"
```

---

## Task 12: Documentation — the philosophy, the manual, and the ADR

**Files:**
- Create: `docs/concepts/how-karmyq-learns.md`
- Modify: `scripts/generate-docs.ts` (`CONCEPT_ORDER` ~line 246, `whyKarmyq` line 585)
- Modify: `README.md`, `CONTRIBUTING.md`, `claude.md`
- Create: `docs/adr/ADR-0NN-ecosystem-knowledge-registry.md`
- Modify: `docs/adr/README.md`

**Interfaces:** none.

⚠️ **The ADR number is maintainer-allocated. Ask before writing the file.** Do not derive it from the directory listing — two lanes reading the same listing get the same answer.

- [ ] **Step 1: Write the concept page source**

Create `docs/concepts/how-karmyq-learns.md` covering: code evolves through commits, review and tests that fail when it rots, while habits and hard-won knowledge have no such mechanism; knowledge accumulating in one person's head reaches nobody, and an external contributor who forks can never receive it; the answer is a home, a review path, and a rot-check; every entry carries either a machine check or a review date, and an entry that stops being true fails the build.

- [ ] **Step 2: Wire it into the generator — the SOURCE, not the output**

In `scripts/generate-docs.ts`:
- add `'how-karmyq-learns'` to `CONCEPT_ORDER` (~line 246)
- add `'how-karmyq-learns'` to the `whyKarmyq` array (line 585), after `'open-source-and-agpl'`

**Do not edit `apps/landing/src/data/docs/nav.json`.** It is regenerated and any hand edit is lost.

- [ ] **Step 3: Regenerate and verify the output**

```bash
cd apps/landing && npm run generate-docs && cd ../..
node -e "const n=require('./apps/landing/src/data/docs/nav.json');const s=n.sections.find(x=>x.title==='Why Karmyq');console.log(s.items.map(i=>i.href))"
ls apps/landing/src/data/docs/concepts/how-karmyq-learns.json
```

Expected: `/docs/concepts/how-karmyq-learns` present in the nav; the concept JSON exists.

- [ ] **Step 4: Add the README section**

Add to `README.md`, after Quick Start — the philosophy in its own right, since most readers never click through:

```markdown
## How this project learns

Code evolves through commits, review, and tests that fail when it rots. Habits and hard-won
knowledge usually have no such mechanism, so they are learned repeatedly, by each person, at full
cost — and an external contributor can never receive them at all.

`docs/gotchas/` is where that knowledge lives here. Each entry carries either a machine check or a
review date, so an entry that stops being true fails the build instead of quietly misleading the
next person. Adding one is a pull request, like any other change.

The argument is at [How Karmyq Learns](https://karmyq.com/docs/concepts/how-karmyq-learns);
how to add an entry is in [CONTRIBUTING.md](CONTRIBUTING.md).
```

- [ ] **Step 5: Add the CONTRIBUTING authoring manual**

Add a "Recording what you learn" section to `CONTRIBUTING.md`: the sidecar pair, the `scope` rules
(tracked paths, trailing slash means prefix), `verify` vs `expires`, the four check types, evidence
on renewal, that promotion to an enforced invariant is a reviewer's call, and `node scripts/gotcha-check.js`.

- [ ] **Step 6: Update claude.md — including the instruction that caused this**

- Documentation Map: add `docs/gotchas/` as the home for operational knowledge.
- *Context Follows Directory Scope*: add — "Also read every gotcha whose `scope` matches the paths you are about to change: `node scripts/gotcha-check.js` validates them; the entries live in `docs/gotchas/`."
- **Fix `claude.md:126`.** It currently names `apps/landing/src/data/docs/` as the authoring location "each wired into `nav.json`", contradicting `claude.md:264` which says that directory is regenerated. Replace with: author `docs/concepts/<slug>.md` or `docs/guides/<slug>.md`, add the slug to the ordering arrays in `scripts/generate-docs.ts`, then regenerate — the landing data directory is output, never authored.

- [ ] **Step 7: Write the ADR (number from the maintainer) and index it**

Cover: the problem, the JSON-sidecar decision and why not YAML (no dependency, lane independence),
declarative-only verification (public repo, fork PRs, ADR-061), hermeticity (the 2026-09-03 outage
blocked every PR), promotion as a reviewer decision rather than a validator rule, and the
consequences. Add the index entry to `docs/adr/README.md`.

- [ ] **Step 8: Run the full suite and revert generated churn**

```bash
npx turbo run test --concurrency=2
git status --short apps/landing/src/data/docs   # revert timestamp/HEAD-sha churn only
```

Expected: 26/26 tasks. The drift gate now passes ADR indexing, ADR uniqueness, nav entry, and the onboarding-policy assertion.

- [ ] **Step 9: Commit**

```bash
git add docs/concepts scripts/generate-docs.ts README.md CONTRIBUTING.md claude.md docs/adr apps/landing/src/data/docs
git commit -m "docs: the philosophy, the authoring manual, and ADR-0NN"
```

---

## Task 13: Final verification and PR

**Files:** none new.

- [ ] **Step 1: Full suite, directly, not via a possibly-stale Turbo cache**

```bash
npx turbo run test --concurrency=2
cd tests && npx jest regression/ --force && cd ..
```

Expected: 26/26 tasks, 0 failures.

- [ ] **Step 2: Prove each new gate can still fail**

```bash
# registry: break a seed's verify claim
sed -i 's/hooks_dir=".git\/hooks"/hooks_dir="X"/' scripts/install-hooks.sh
cd tests && npx jest regression/sprint-127-gotcha-registry-gate.test.ts   # expect FAIL
cd .. && git checkout scripts/install-hooks.sh

# onboarding policy: regress README uniformly
cp README.md /tmp/README.bak && sed -i 's/npm ci/npm install/' README.md
cd tests && npx jest regression/doc-context-drift-gate.test.ts            # expect FAIL
cd .. && cp /tmp/README.bak README.md
```

- [ ] **Step 3: SDLC gates on the branch diff**

Run `/simplify`, `/code-review` (high — this ships a new blocking gate), and `/security-review`
(the credential screen and the declarative-only constraint are the security surface). Resolve or
justify every finding in writing.

- [ ] **Step 4: Update the handoff**

Add the Sprint 127 lane row, record what shipped, and reconcile against `gh pr list` and `git log`.

- [ ] **Step 5: Open the PR**

Copy `.github/pull_request_template.md` into `--body` and fill every section — `gh pr create` does
not apply it automatically and `pr-contract` fails without it.

- [ ] **Step 6: Commit and push**

```bash
git add -A
git commit -m "Sprint 127: ecosystem knowledge registry"
git push -u origin feature/sprint-127-knowledge-registry
```

---

## Self-Review

**Spec coverage.** Storage → T1, T9. Sidecar schema → T1. Declarative verification → T2.
Hermeticity → T2, T7. Dates/cap/evidence → T3. Scope + references + pairing → T4. Discovery →
T5, T7 (CLI), T8. Credential screening at pre-commit → T6. Failure table → T1–T4, T6. Negative
fixtures → T1–T6, promoted in T7. Fixture 17 → T8, exercised in T9 Step 7. Rollout Phase 1 seeds →
T9. Onboarding policy assertion → T10. Intake triggers: mid-session `/learned` → T11 Step 1,
sprint-ship checkpoint → T11 Step 2, recurrence → documented in the skill. Public philosophy,
CONTRIBUTING manual, `claude.md:126` fix, ADR → T12.

**Review-round corrections folded in (Codex, plan round 1).** Entry paths are repository-relative
and resolved once — an earlier draft stored absolute paths and double-joined them, so every body
read produced `C:\repo\C:\repo\...` and no sidecar could load. The staged screen reads blobs from
the index rather than the working tree, because staging a credential and then editing it out
without staging the removal bypassed the earlier version entirely. Both halves of every pair are
screened in every mode, and the credential pattern accepts quoted JSON keys — `{"password":"..."}`
returned no findings before. `verify: null`, `false`, `{}`, `[]` and `"yes"` are all rejected;
previously each satisfied "exactly one of" while asserting nothing and carrying no review date.
Malformed `renewed`/`see_also` fail instead of silently becoming empty arrays. Task 9 runs
working-tree checks, commits, then the clean-room fixture, because the clone is of `HEAD`. Task 10
extracts and compares commands rather than testing for string presence, with one fixture per
failure mode.

**Deliberately deferred:** Phases 2 and 3 (opportunistic promotion; the 81-memory audit) are not tasks — they are ongoing practice and a later sprint.

**Type consistency.** `Entry` is `{slug, jsonPath, bodyPath, data, body}` throughout. `scopeMatches` is defined in T4 and reused in T5. Every validator returns `string[]`. `REVIEW_CAP_DAYS` is defined once in T1 and consumed in T3.

**Known risk.** Task 8's clean-room fixture clones the repository and is the slowest test in the suite; its `beforeAll` carries a 120s timeout. If it proves flaky on the 8 GB Windows box under `turbo`, run it directly rather than weakening the assertion — a weaker approximation of the check that catches machine-local assumptions is worse than none.
