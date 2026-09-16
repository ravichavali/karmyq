# Lane `lanes-provenance` (PR 1 of 3): Provenance Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every commit on a `lane/*` branch declares its agent, every stage handover is a
boundary commit with verifiable trailers, and a CI check on every PR says whether a branch's
history honors that. The check runs report-only and cannot be rewritten by the PR it checks.

**Architecture:** Four small CommonJS modules under `scripts/lib/`, plus one CLI:
- `lanes-config.js` loads and validates `lanes.config.json` and matches exempt-branch globs;
- `trailers.js` parses commit trailers the way git does, with git itself as the test arbiter;
- `lane-provenance-rules.js` is a pure function from `{ branch, commits, config }` to a verdict;
- `github-compare.js` is the only HTTP code and fetches a PR's commits with author logins;
- `scripts/lane-provenance.js` wires them together.

`.github/workflows/lanes-pr.yml` runs the **base branch's** copy of the gate and config, falling back
to the PR's own copy only while master has no gate (this bootstrap PR). A `prepare-commit-msg` hook
adds `Agent:` locally, but CI enforces it regardless.

**Tech Stack:** Node 24 (`fetch`), plain CommonJS, git ≥ 2.45 `interpret-trailers`, Jest 30 +
ts-jest in the `tests` workspace (`strict: true`), `yaml` 2.9.1 (declared by `tests`), GitHub Actions.

**Spec:** [`docs/superpowers/specs/2026-09-16-lanes-stages-provenance-design.md`](../specs/2026-09-16-lanes-stages-provenance-design.md)
The sections this plan covers: *Boundary commits and trailers*, *Provenance gate*, and *Rollout*
(lane `lanes-provenance`).

---

## Global Constraints

- **Lane and branch:** `lane/lanes-provenance`, cut 2026-09-16 from `origin/master` `d35a3fad`
  (v11.56.0). Its upstream is unset, so the first push is `git push --set-upstream origin lane/lanes-provenance`.
  This lane has exactly one PR. `lanes-work-queue` and `lanes-rules` are separate later lanes on
  fresh branches, and are **out of scope** here: no `work` CLI, no issues or labels, no
  `merge-eligibility`, no audit or expiry workflows, and no `claude.md`/`AGENTS.md`/handoff-README changes.
- **This lane dogfoods its own rules.** Before Task 1, the `plan -> execute` boundary commit must
  exist (Task 0). **Every commit** this plan makes carries `Agent: <executor agent>`, typed by
  hand until Task 6's hook exists. Its PR must pass its own check.
- **No new npm dependencies.** Plain Node 24 and packages the `tests` workspace already declares
  (`yaml`, `jest`, `ts-jest`, `@types/node`). No lockfile change, so no dependency lane.
- **Fail closed.** Unavailable GitHub evidence, incomplete pagination, unlinked authors or malformed
  responses fail the check. Never echo upstream response bodies.
- **No repository-settings changes.** The new check is not added to branch protection.
- **Red means an assertion failed in a discovered test.** Import-crash red is acceptable only where
  the plan names it as the expected first red, and the next run must fail on assertions.
- **Root tests run in the tests workspace:**
  `npm exec --workspace=tests -- jest --runTestsByPath regression/<file>.test.ts --runInBand`.
- **Merge order:** this PR merges only after Sprint 131 PR B has deployed and passed its health
  check. One merge at a time. Version is derived from `origin/master` at merge time.
- **Commit shape:** the final paragraph of every commit message is the complete trailer block
  (`Agent:` plus any attribution lines, no blank lines inside). See Task 1 Step 6.
- **Windows host:** Node for JSON/HTTP probes; capture exit codes separately. Write files containing
  regexes with the Write tool (heredocs eat backslashes).

## Verified Facts (read 2026-09-16 on `lane/lanes-provenance` at `7cd9c330`)

| Fact | Evidence |
|---|---|
| Hooks live in `scripts/git-hooks/` (`pre-commit`, `pre-push`, `README.md`), mode `100644`. The installer copies them on Windows and symlinks elsewhere, with `chmod +x` | `git ls-files -s scripts/git-hooks`; `scripts/install-hooks.sh` |
| The hook-install test asserts the exact installed count `Successfully installed 2 hook(s)` | `tests/regression/sprint-123-git-hooks-installed.test.ts:211` |
| The installer's closing summary lists hooks by name | `scripts/install-hooks.sh` (final `echo` block) |
| `.gitattributes` normalizes `*.js`/`*.json`/`*.yml`/`*.md` to LF; hooks have no extension (only `* text=auto`) | `.gitattributes` |
| Existing scripts read `GITHUB_TOKEN \|\| GH_TOKEN` | `scripts/check-image-size-upstream.js:158` |
| Script gates are tested from `tests/regression/*.test.ts` via `require('../../scripts/…')` | `tests/regression/sprint-128-audit-response-contract.test.ts:4` |
| Workflow tests parse YAML with the declared `yaml` package | `tests/regression/sprint-129-demo-health-workflow.test.ts:22-27` |
| The tests workspace compiles `strict: true`, types `jest`, `node` | `tests/tsconfig.json` |
| ADR header format: `**Status:** / **Date:** / **Deciders:** / **Supersedes:** / **Related:**`; index lines `- [ADR-NNN: Title](file) — **Status**` | `docs/adr/ADR-097-ecosystem-knowledge-registry.md:1-7`; `docs/adr/README.md:135` |
| The landing generator reads every ADR into the tracked `concepts.json` and `nav.json` (so ADR-098 changes both) | `scripts/generate-docs.ts:193-208,233,636` |
| An existing PR workflow uses `pull_request` with read-only permissions | `.github/workflows/pr-contract.yml` |
| Branch commits so far: `2e5e8cf7` (`Lane`, `Agent: claude`) and `7cd9c330` (boundary `spec -> plan`, all trailers) | `git log -2 --format=%(trailers)` |
| `git interpret-trailers --parse` exists in the local git (2.45.2) | `git --version` |

**UNVERIFIED, verified in Task 8 by the PR's own run:** that `git fetch origin refs/pull/<n>/head`
works inside `actions/checkout`'s repository, and that the compare API returns `author.login` for
this repo's commits.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `lanes.config.json` | Agents, expiry days, `allowSelfMerge`, `exemptBranches` | 1 |
| `scripts/lib/lanes-config.js` | Load and validate config; `STAGES`; exempt-glob matching | 1 |
| `tests/regression/lanes-config.test.ts` | Exact config, every validation error, glob semantics | 1 |
| `scripts/lib/trailers.js` | `parseTrailers`, `trailerValues` | 2 |
| `tests/regression/lanes-trailers.test.ts` | Exact parses + agreement with `git interpret-trailers --parse` | 2 |
| `scripts/lib/lane-provenance-rules.js` | `evaluateProvenance` (pure) | 3 |
| `tests/regression/lanes-provenance-rules.test.ts` | Every legal shape, one negative per rule | 3 |
| `scripts/lib/github-compare.js` | `compareCommits` (the only HTTP) | 4 |
| `tests/regression/lanes-github-compare.test.ts` | Paging, auth, 403, malformed, incomplete, input validation | 4 |
| `scripts/lane-provenance.js` | CLI: args → config → exempt → fetch → verdict, exit codes | 5 |
| `tests/regression/lanes-provenance-cli.test.ts` | Real CLI against a recorded local API | 5 |
| `.github/workflows/lanes-pr.yml` | Base-checkout gate, bootstrap fallback, env-only inputs | 5 |
| `tests/regression/lanes-pr-workflow.test.ts` | Trigger, permissions, base checkout, no expression injection | 5 |
| `scripts/git-hooks/prepare-commit-msg` | Adds `Agent:` from `git config karmyq.agent` | 6 |
| `tests/regression/lanes-prepare-commit-msg-hook.test.ts` | Real git repos with the real hook | 6 |
| `scripts/install-hooks.sh`, `tests/regression/sprint-123-git-hooks-installed.test.ts` | Hook count and summary | 6 |
| `docs/adr/ADR-098-lanes-stages-and-provenance.md`, `docs/adr/README.md` | Decision record (**Proposed**) | 7 |
| `scripts/claude.md`, `scripts/git-hooks/README.md` | Script and hook docs | 7 |
| `apps/landing/src/data/docs/concepts.json`, `apps/landing/src/data/docs/nav.json` | Regenerated (keep the substantive ADR-098 entries only) | 7 |
| `.claude/handoff/lane-lanes-provenance.md`, `package.json` | Evidence, version | 8 |

Before **every commit**, run `.claude/skills/pre-commit-check/SKILL.md`. Stage exact paths only.
Commit messages end with `Agent: <your agent>` (and your usual attribution line).

---

## Task 0: Confirm the handover and set identity

- [ ] **Step 1: The `plan -> execute` boundary must exist**

```bash
git switch lane/lanes-provenance
git log --format='%h %s%n%(trailers:only)' -5
```

Expected: the newest commit before any Task 1 work is `lane(lanes-provenance): plan -> execute`,
with `Lane: lanes-provenance`, `Stage: plan -> execute`, `Handed-off-by: ravichavali/claude`,
`Machine:`, `Dependency-lane: none`, `Agent: claude`. The planner writes it when the maintainer
approves this plan. **If it is missing, stop**: execution has not been handed over.

- [ ] **Step 2: Record your agent and machine for this checkout**

```bash
git config karmyq.agent <claude|codex|kimi>
git config karmyq.machine <windows|mac|...>
```

Until Task 6 installs the hook, type `Agent: <agent>` as the last trailer of every commit message yourself.

---

## Task 1: Config and exempt-branch matching

**Files:** Create `lanes.config.json`, `scripts/lib/lanes-config.js`, `tests/regression/lanes-config.test.ts`

**Interfaces — Produces:**
- `STAGES: ['spec','plan','execute','verify']`;
- `validateConfig(raw) → raw` (throws `Error('invalid lanes config: <reason>; <reason>')`);
- `loadConfig(file = <repo>/lanes.config.json) → config`;
- `matchExempt(branch, patterns) → string | null`, where `**` matches anything including `/`, `*` matches anything except `/`, and every other character is literal.

- [ ] **Step 1: Write the failing test** (Write tool)

```ts
/**
 * Lane lanes-provenance (ADR-098): lanes.config.json is the only place agents, expiry and
 * exemptions are declared. A typo must fail loudly, and an exemption must match exactly what it
 * names, since "anything not called lane/*" would let a rename skip the gate.
 */
const { STAGES, validateConfig, loadConfig, matchExempt } = require('../../scripts/lib/lanes-config');

const valid = () => ({
  agents: ['claude', 'codex', 'kimi'],
  expiryDays: { spec: 7, plan: 7, execute: 3, verify: 7 },
  allowSelfMerge: true,
  exemptBranches: ['dependabot/**', 'agent/codex/sprint-131-test-readiness'],
});

describe('lanes.config.json (ADR-098)', () => {
  it('declares the four stages in order', () => {
    expect(STAGES).toEqual(['spec', 'plan', 'execute', 'verify']);
  });

  it('the checked-in config is exactly the approved one', () => {
    expect(loadConfig()).toEqual(valid());
  });

  it.each([
    ['not an object', null, 'config must be a JSON object'],
    ['no agents', { ...valid(), agents: [] }, 'agents must be a non-empty array of lowercase names'],
    ['capitalised agent', { ...valid(), agents: ['Claude'] }, 'agents must be a non-empty array of lowercase names'],
    ['repeated agent', { ...valid(), agents: ['claude', 'claude'] }, 'agents must not repeat'],
    ['expiry not an object', { ...valid(), expiryDays: 3 }, 'expiryDays must be an object'],
    ['expiry missing a stage', { ...valid(), expiryDays: { spec: 7, plan: 7, execute: 3 } }, 'expiryDays must have exactly: spec, plan, execute, verify'],
    ['expiry zero', { ...valid(), expiryDays: { spec: 7, plan: 7, execute: 0, verify: 7 } }, 'expiryDays.execute must be a positive integer'],
    ['self-merge not boolean', { ...valid(), allowSelfMerge: 'yes' }, 'allowSelfMerge must be a boolean'],
    ['empty exemption', { ...valid(), exemptBranches: [''] }, 'exemptBranches must be an array of non-empty strings'],
    ['unknown key (typo)', { ...valid(), allowSelfMerges: true }, 'unknown key "allowSelfMerges"'],
  ])('rejects %s', (_name, raw, reason) => {
    expect(() => validateConfig(raw)).toThrow(`invalid lanes config: `);
    expect(() => validateConfig(raw)).toThrow(reason);
  });

  it('matches exemptions exactly', () => {
    const patterns = ['dependabot/**', 'release/*', 'agent/codex/sprint-131-test-readiness'];
    expect(matchExempt('dependabot/npm_and_yarn/eslint/js-10.0.1', patterns)).toBe('dependabot/**');
    expect(matchExempt('release/v1', patterns)).toBe('release/*');
    expect(matchExempt('release/v1/hotfix', patterns)).toBeNull();
    expect(matchExempt('agent/codex/sprint-131-test-readiness', patterns)).toBe('agent/codex/sprint-131-test-readiness');
    expect(matchExempt('agent/codex/sprint-131-test-readiness-2', patterns)).toBeNull();
    expect(matchExempt('lane/demo', patterns)).toBeNull();
    expect(matchExempt('agentXcodex/sprint-131-test-readiness', ['agent.codex/**'])).toBeNull(); // "." is literal
  });
});
```

- [ ] **Step 2: Discovery, then red**

```bash
npm exec --workspace=tests -- jest --runTestsByPath regression/lanes-config.test.ts --listTests --runInBand
npm exec --workspace=tests -- jest --runTestsByPath regression/lanes-config.test.ts --runInBand
```

Expected: one path. The suite fails with `Cannot find module '../../scripts/lib/lanes-config'`,
the named import-crash first red. Record it.

- [ ] **Step 3: Implement** — create `lanes.config.json`:

```json
{
  "agents": ["claude", "codex", "kimi"],
  "expiryDays": { "spec": 7, "plan": 7, "execute": 3, "verify": 7 },
  "allowSelfMerge": true,
  "exemptBranches": ["dependabot/**", "agent/codex/sprint-131-test-readiness"]
}
```

Create `scripts/lib/lanes-config.js`:

```js
'use strict';

/**
 * lanes.config.json loader (ADR-098). The config is changed only by PR; this module makes a typo
 * fail loudly instead of silently disabling a rule.
 */

const fs = require('fs');
const path = require('path');

const STAGES = ['spec', 'plan', 'execute', 'verify'];
const DEFAULT_PATH = path.join(__dirname, '..', '..', 'lanes.config.json');
const KNOWN_KEYS = new Set(['agents', 'expiryDays', 'allowSelfMerge', 'exemptBranches']);
const AGENT_NAME = /^[a-z][a-z0-9-]*$/;

function validateConfig(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('invalid lanes config: config must be a JSON object');
  }
  const errors = [];
  for (const key of Object.keys(raw)) {
    if (!KNOWN_KEYS.has(key)) errors.push(`unknown key "${key}"`);
  }

  const { agents, expiryDays, allowSelfMerge, exemptBranches } = raw;
  if (!Array.isArray(agents) || agents.length === 0 || !agents.every((a) => typeof a === 'string' && AGENT_NAME.test(a))) {
    errors.push('agents must be a non-empty array of lowercase names');
  } else if (new Set(agents).size !== agents.length) {
    errors.push('agents must not repeat');
  }

  if (!expiryDays || typeof expiryDays !== 'object' || Array.isArray(expiryDays)) {
    errors.push('expiryDays must be an object');
  } else {
    if ([...Object.keys(expiryDays)].sort().join() !== [...STAGES].sort().join()) {
      errors.push(`expiryDays must have exactly: ${STAGES.join(', ')}`);
    }
    for (const stage of STAGES) {
      if (stage in expiryDays && (!Number.isInteger(expiryDays[stage]) || expiryDays[stage] < 1)) {
        errors.push(`expiryDays.${stage} must be a positive integer`);
      }
    }
  }

  if (typeof allowSelfMerge !== 'boolean') errors.push('allowSelfMerge must be a boolean');
  if (!Array.isArray(exemptBranches) || !exemptBranches.every((p) => typeof p === 'string' && p.length > 0)) {
    errors.push('exemptBranches must be an array of non-empty strings');
  }

  if (errors.length > 0) throw new Error(`invalid lanes config: ${errors.join('; ')}`);
  return raw;
}

function loadConfig(file = DEFAULT_PATH) {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    throw new Error(`invalid lanes config: ${file} is missing or not valid JSON`);
  }
  return validateConfig(raw);
}

/** `**` matches anything (including "/"), `*` anything except "/", everything else is literal. */
function globToRegExp(glob) {
  let source = '';
  for (let i = 0; i < glob.length; i++) {
    if (glob[i] === '*' && glob[i + 1] === '*') {
      source += '.*';
      i++;
    } else if (glob[i] === '*') {
      source += '[^/]*';
    } else {
      source += glob[i].replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${source}$`);
}

function matchExempt(branch, patterns) {
  return patterns.find((pattern) => globToRegExp(pattern).test(branch)) ?? null;
}

module.exports = { STAGES, validateConfig, loadConfig, matchExempt };
```

- [ ] **Step 4: Green.** Same command as Step 2. Expected: **13 passed** (1 + 1 + 10 + 1).

- [ ] **Step 5: Prove the exact-config test bites.** Temporarily change `"execute": 3` to `4` in
  `lanes.config.json` → re-run → `the checked-in config is exactly the approved one` fails → change it
  back to `3` → re-run → **13 passed**. Record the failing run.

- [ ] **Step 6: Commit**

```bash
git add lanes.config.json scripts/lib/lanes-config.js tests/regression/lanes-config.test.ts
git commit -F - <<'EOF'
feat(lanes): lanes.config.json and its validating loader

Agent: <your agent>
Co-Authored-By: <your usual attribution line, if any>
EOF
```

The **last paragraph must be the whole trailer block**: `Agent:` and every attribution line together,
no blank line between them. Two separate `-m` flags make two paragraphs, which hides `Agent:` from
git's trailer parser whenever another `-m` follows it. Later tasks write "+ `Agent:` trailer" to mean
this same shape.

---

## Task 2: Trailer parsing that agrees with git

**Files:** Create `scripts/lib/trailers.js`, `tests/regression/lanes-trailers.test.ts`

**Interfaces — Produces:** `parseTrailers(message: string) → Array<{ key, value }>` (in order;
`[]` when there is no trailer block) and `trailerValues(trailers, key) → string[]` (case-insensitive key).

- [ ] **Step 1: Write the failing test** (Write tool)

```ts
/**
 * Lane lanes-provenance (ADR-098): trailers are parsed in JS (the gate reads commit messages from
 * the GitHub API, not a checkout), but git is the arbiter of what a trailer is. Every fixture is
 * also fed to `git interpret-trailers --parse`, and the two must agree.
 */
import { execFileSync } from 'child_process';

const { parseTrailers, trailerValues } = require('../../scripts/lib/trailers');

const FIXTURES: Array<[string, string, string[]]> = [
  ['subject, body, trailer block', 'subject\n\nbody line\n\nAgent: claude\nCo-Authored-By: A <a@example.test>\n', ['Agent: claude', 'Co-Authored-By: A <a@example.test>']],
  ['a lone subject is never a trailer', 'Agent: claude\n', []],
  ['trailers straight after the subject', 'subject\n\nAgent: claude\n', ['Agent: claude']],
  ['prose in the last paragraph means no trailer block', 'subject\n\nAgent: claude\nthis line is prose\n', []],
  ['trailing blank lines are ignored', 'subject\n\nLane: demo\nStage: plan -> execute\n\n\n', ['Lane: demo', 'Stage: plan -> execute']],
  ['values keep arrows and parentheses', 'subject\n\nStage: execute (partial)\nNext: Task 4 Step 2\n', ['Stage: execute (partial)', 'Next: Task 4 Step 2']],
];

const ours = (message: string) =>
  parseTrailers(message).map((t: { key: string; value: string }) => `${t.key}: ${t.value}`);

describe('commit trailer parsing (ADR-098)', () => {
  it.each(FIXTURES)('%s', (_name, message, expected) => {
    expect(ours(message)).toEqual(expected);
  });

  it.each(FIXTURES)('agrees with git interpret-trailers: %s', (_name, message) => {
    const git = execFileSync('git', ['interpret-trailers', '--parse'], { input: message, encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
    expect(ours(message)).toEqual(git);
  });

  it('normalizes CRLF messages', () => {
    expect(ours('subject\r\n\r\nAgent: codex\r\n')).toEqual(['Agent: codex']);
  });

  it('looks keys up case-insensitively and keeps repeats', () => {
    const trailers = parseTrailers('s\n\nAgent: claude\nco-authored-by: A <a@x.test>\nCo-Authored-By: B <b@x.test>\n');
    expect(trailerValues(trailers, 'agent')).toEqual(['claude']);
    expect(trailerValues(trailers, 'Co-Authored-By')).toEqual(['A <a@x.test>', 'B <b@x.test>']);
    expect(trailerValues(trailers, 'Stage')).toEqual([]);
  });
});
```

- [ ] **Step 2: Discovery, then red.** Expected: the named import-crash first red (`Cannot find module '../../scripts/lib/trailers'`).

- [ ] **Step 3: Implement** `scripts/lib/trailers.js`:

```js
'use strict';

/**
 * Commit trailer parsing (ADR-098). Mirrors git's rule for the trailer block: the last paragraph
 * of the message, never the subject, and every line must be "Key: value". git is the arbiter;
 * tests/regression/lanes-trailers.test.ts checks agreement with `git interpret-trailers --parse`.
 */

const TRAILER_LINE = /^([A-Za-z][A-Za-z0-9-]*):[ \t]*(.*?)[ \t]*$/;

function parseTrailers(message) {
  const text = String(message).replace(/\r\n/g, '\n').replace(/\n+$/, '');
  const paragraphs = text.split(/\n[ \t]*\n/);
  if (paragraphs.length < 2) return [];
  const matches = paragraphs[paragraphs.length - 1].split('\n').map((line) => TRAILER_LINE.exec(line));
  if (matches.some((m) => !m)) return [];
  return matches.map((m) => ({ key: m[1], value: m[2] }));
}

function trailerValues(trailers, key) {
  const wanted = key.toLowerCase();
  return trailers.filter((t) => t.key.toLowerCase() === wanted).map((t) => t.value);
}

module.exports = { parseTrailers, trailerValues };
```

- [ ] **Step 4: Green.** Expected: **14 passed** (6 + 6 + 1 + 1). **If an agreement case fails, git is
  right:** change the parser (never the fixture's expectation) until both agree, and record the case in
  the handoff. Note that `split(/\n[ \t]*\n/)` over runs of 3+ newlines yields empty paragraphs; the
  "trailing blank lines" fixture guards this because they are stripped first.

- [ ] **Step 5: Commit** `feat(lanes): commit trailer parser verified against git` + `Agent:` trailer.

---

## Task 3: The provenance rules (pure)

**Files:** Create `scripts/lib/lane-provenance-rules.js`, `tests/regression/lanes-provenance-rules.test.ts`

**Interfaces:**
- Consumes: `parseTrailers`, `trailerValues` (Task 2); `STAGES`, `matchExempt` (Task 1).
- Produces: `evaluateProvenance({ branch, commits, config })`.
  - Input commits: `Array<{ sha: string, login: string | null, parents: number, message: string }>`, oldest first.
  - Returns one of:
    - `{ status: 'exempt', pattern }`;
    - `{ status: 'pass', checked, skippedMerges }`;
    - `{ status: 'fail', errors: string[], checked, skippedMerges }`, or `{ status: 'fail', errors }` for a branch-name failure.

**Error strings** (exact; `<at>` = first 8 characters of the SHA):

| Rule | Message |
|---|---|
| branch | `branch "<branch>" is neither lane/<slug> nor listed in exemptBranches` |
| agent | `<at>: missing Agent trailer (exactly one required)` · `<at>: unknown agent "<a>" (allowed: claude, codex, kimi)` |
| login | `<at>: commit author has no linked GitHub login` |
| identity | `<at>: <login/agent> follows <login/agent> with no boundary commit between them` |
| boundary | `<at>: boundary Lane "<v>" does not match branch slug "<slug>"` · `<at>: boundary is missing Machine` · `<at>: Handed-off-by "<v>" does not match commit identity "<id>"` |
| stage | `<at>: Stage "<v>" is not "<from> -> <to>" or "<stage> (partial)"` · `<at>: Stage "<v>" skips or reverses spec -> plan -> execute -> verify` · `<at>: Stage "<v>" starts from "<from>" but the lane is in "<stage>"` · `<at>: verify is recorded as issue comments, never as a commit` |
| dependency | `<at>: Dependency-lane must be taken, released or none` · `<at>: dependency lane taken twice without a release` |

- [ ] **Step 1: Write the failing test** (Write tool)

```ts
/**
 * Lane lanes-provenance (ADR-098): the provenance rules, as a pure function over commit data.
 * Every legal shape passes, and every rule has a negative case with its exact message, since a
 * rule that has never been seen to fail is not known to work.
 */
const { evaluateProvenance } = require('../../scripts/lib/lane-provenance-rules');

type Commit = { sha: string; login: string | null; parents: number; message: string };

const config = {
  agents: ['claude', 'codex', 'kimi'],
  expiryDays: { spec: 7, plan: 7, execute: 3, verify: 7 },
  allowSelfMerge: true,
  exemptBranches: ['dependabot/**', 'agent/codex/sprint-131-test-readiness'],
};

let n = 0;
beforeEach(() => {
  n = 0;
});

function commit(login: string | null, trailers: Record<string, string>, parents = 1): Commit {
  n += 1;
  const block = Object.entries(trailers).map(([k, v]) => `${k}: ${v}`).join('\n');
  return {
    sha: `${String(n).padStart(3, '0')}`.padEnd(40, 'a'),
    login,
    parents,
    message: block ? `subject ${n}\n\nbody\n\n${block}\n` : `subject ${n}\n`,
  };
}
const work = (login: string, agent: string) => commit(login, { Agent: agent });
const boundary = (login: string, agent: string, stage: string, extra: Record<string, string> = {}) =>
  commit(login, {
    Lane: 'demo',
    Stage: stage,
    'Handed-off-by': `${login}/${agent}`,
    Machine: 'windows',
    'Dependency-lane': 'none',
    Agent: agent,
    ...extra,
  });
const at = (c: Commit) => c.sha.slice(0, 8);
const run = (commits: Commit[], branch = 'lane/demo') => evaluateProvenance({ branch, commits, config });
const R = 'ravichavali';

describe('lane provenance rules (ADR-098)', () => {
  describe('legal histories pass', () => {
    it('one contributor, no handover', () => {
      expect(run([work(R, 'claude'), work(R, 'claude')])).toEqual({ status: 'pass', checked: 2, skippedMerges: 0 });
    });

    it('a handover between agents through a boundary', () => {
      const commits = [work(R, 'codex'), boundary(R, 'codex', 'plan -> execute'), work(R, 'claude')];
      expect(run(commits)).toEqual({ status: 'pass', checked: 3, skippedMerges: 0 });
    });

    it('a partial release resumed by someone else in the same stage', () => {
      const commits = [
        boundary(R, 'claude', 'plan -> execute'),
        work(R, 'codex'),
        boundary(R, 'codex', 'execute (partial)', { Next: 'Task 4 Step 2' }),
        work('alex', 'kimi'),
      ];
      // codex follows claude straight after a boundary; alex/kimi follows codex after a partial.
      expect(run(commits)).toEqual({ status: 'pass', checked: 4, skippedMerges: 0 });
    });

    it('merge commits from master are skipped, not judged', () => {
      expect(run([work(R, 'claude'), commit(R, {}, 2), work(R, 'claude')])).toEqual({ status: 'pass', checked: 2, skippedMerges: 1 });
    });

    it('dependency lane taken and released, then taken again', () => {
      const commits = [
        boundary(R, 'claude', 'plan -> execute', { 'Dependency-lane': 'taken' }),
        boundary(R, 'claude', 'execute (partial)', { 'Dependency-lane': 'released', Next: 'Task 2' }),
        boundary(R, 'claude', 'execute (partial)', { 'Dependency-lane': 'taken', Next: 'Task 3' }),
      ];
      expect(run(commits).status).toBe('pass');
    });
  });

  describe('exemptions', () => {
    it('an explicitly listed branch is exempt without judging commits', () => {
      expect(run([commit(null, {})], 'dependabot/npm_and_yarn/zod-4.6.4')).toEqual({ status: 'exempt', pattern: 'dependabot/**' });
      expect(run([], 'agent/codex/sprint-131-test-readiness')).toEqual({ status: 'exempt', pattern: 'agent/codex/sprint-131-test-readiness' });
    });

    it('a branch that is neither lane/<slug> nor listed fails, so a rename cannot skip the gate', () => {
      for (const branch of ['feature/x', 'agent/codex/sprint-131-test-readiness-2', 'lane/Bad_Slug', 'lane/']) {
        expect(run([work(R, 'claude')], branch)).toEqual({
          status: 'fail',
          errors: [`branch "${branch}" is neither lane/<slug> nor listed in exemptBranches`],
        });
      }
    });
  });

  describe('each rule can fail', () => {
    const failing = (commits: Commit[], errors: string[], branch?: string) =>
      expect(run(commits, branch)).toEqual({ status: 'fail', errors, checked: commits.filter((c) => c.parents < 2).length, skippedMerges: commits.filter((c) => c.parents > 1).length });

    it('missing Agent', () => {
      const c = commit(R, { 'Co-Authored-By': 'Claude <noreply@anthropic.com>' });
      failing([c], [`${at(c)}: missing Agent trailer (exactly one required)`]);
    });

    it('two Agent trailers', () => {
      const c = commit(R, { Agent: 'claude' });
      c.message = 'subject\n\nAgent: claude\nAgent: codex\n';
      failing([c], [`${at(c)}: missing Agent trailer (exactly one required)`]);
    });

    it('unknown agent', () => {
      const c = work(R, 'gemini');
      failing([c], [`${at(c)}: unknown agent "gemini" (allowed: claude, codex, kimi)`]);
    });

    it('unlinked author', () => {
      const c = commit(null, { Agent: 'claude' });
      failing([c], [`${at(c)}: commit author has no linked GitHub login`]);
    });

    it('agent change with no boundary', () => {
      const a = work(R, 'codex');
      const b = work(R, 'claude');
      failing([a, b], [`${at(b)}: ravichavali/claude follows ravichavali/codex with no boundary commit between them`]);
    });

    it('human change with no boundary', () => {
      const a = work(R, 'claude');
      const b = work('alex', 'claude');
      failing([a, b], [`${at(b)}: alex/claude follows ravichavali/claude with no boundary commit between them`]);
    });

    it('boundary for another lane', () => {
      const c = boundary(R, 'claude', 'plan -> execute', { Lane: 'other' });
      failing([c], [`${at(c)}: boundary Lane "other" does not match branch slug "demo"`]);
    });

    it('boundary without Machine', () => {
      const c = boundary(R, 'claude', 'plan -> execute');
      c.message = c.message.replace('Machine: windows\n', '');
      failing([c], [`${at(c)}: boundary is missing Machine`]);
    });

    it('Handed-off-by that is not the committer', () => {
      const c = boundary(R, 'claude', 'plan -> execute', { 'Handed-off-by': 'ravichavali/codex' });
      failing([c], [`${at(c)}: Handed-off-by "ravichavali/codex" does not match commit identity "ravichavali/claude"`]);
    });

    it('malformed Stage', () => {
      const c = boundary(R, 'claude', 'done');
      failing([c], [`${at(c)}: Stage "done" is not "<from> -> <to>" or "<stage> (partial)"`]);
    });

    it('skipped stage', () => {
      const c = boundary(R, 'claude', 'spec -> execute');
      failing([c], [`${at(c)}: Stage "spec -> execute" skips or reverses spec -> plan -> execute -> verify`]);
    });

    it('reversed stage', () => {
      const c = boundary(R, 'claude', 'execute -> plan');
      failing([c], [`${at(c)}: Stage "execute -> plan" skips or reverses spec -> plan -> execute -> verify`]);
    });

    it('discontinuous stage', () => {
      const a = boundary(R, 'claude', 'spec -> plan');
      const b = boundary(R, 'claude', 'spec -> plan');
      failing([a, b], [`${at(b)}: Stage "spec -> plan" starts from "spec" but the lane is in "plan"`]);
    });

    it('verify recorded as a commit', () => {
      const a = boundary(R, 'claude', 'execute -> verify');
      const b = boundary(R, 'claude', 'verify (partial)');
      failing([a, b], [
        `${at(a)}: verify is recorded as issue comments, never as a commit`,
        `${at(b)}: verify is recorded as issue comments, never as a commit`,
      ]);
    });

    it('invalid Dependency-lane value', () => {
      const c = boundary(R, 'claude', 'plan -> execute', { 'Dependency-lane': 'mine' });
      failing([c], [`${at(c)}: Dependency-lane must be taken, released or none`]);
    });

    it('dependency lane taken twice', () => {
      const a = boundary(R, 'claude', 'plan -> execute', { 'Dependency-lane': 'taken' });
      const b = boundary(R, 'claude', 'execute (partial)', { 'Dependency-lane': 'taken', Next: 'Task 2' });
      failing([a, b], [`${at(b)}: dependency lane taken twice without a release`]);
    });
  });
});
```

- [ ] **Step 2: Discovery, then red.** Expected: the named import-crash first red.

- [ ] **Step 3: Implement** `scripts/lib/lane-provenance-rules.js`:

```js
'use strict';

/**
 * Lane provenance rules (ADR-098), a pure function: commits in, verdict out. No I/O here; the
 * GitHub adapter and the CLI supply the data.
 */

const { parseTrailers, trailerValues } = require('./trailers');
const { STAGES, matchExempt } = require('./lanes-config');

const LANE_BRANCH = /^lane\/([a-z0-9][a-z0-9-]*)$/;
const FULL_STAGE = /^(spec|plan|execute|verify) -> (spec|plan|execute|verify)$/;
const PARTIAL_STAGE = /^(spec|plan|execute|verify) \(partial\)$/;
const DEPENDENCY_VALUES = new Set(['taken', 'released', 'none']);

/** The single value of a trailer, or null when it is absent or repeated. */
function single(trailers, key) {
  const values = trailerValues(trailers, key);
  return values.length === 1 ? values[0] : null;
}

function evaluateProvenance({ branch, commits, config }) {
  const pattern = matchExempt(branch, config.exemptBranches);
  if (pattern) return { status: 'exempt', pattern };

  const laneMatch = LANE_BRANCH.exec(branch);
  if (!laneMatch) {
    return { status: 'fail', errors: [`branch "${branch}" is neither lane/<slug> nor listed in exemptBranches`] };
  }
  const slug = laneMatch[1];

  const errors = [];
  let checked = 0;
  let skippedMerges = 0;
  let previous = null; // { id, boundary }
  let stage = null; // the lane's stage after the last boundary seen
  let holdsDependency = false;

  for (const commit of commits) {
    if (commit.parents > 1) {
      skippedMerges += 1;
      continue;
    }
    checked += 1;
    const at = commit.sha.slice(0, 8);
    const trailers = parseTrailers(commit.message);

    const agent = single(trailers, 'Agent');
    if (!agent) errors.push(`${at}: missing Agent trailer (exactly one required)`);
    else if (!config.agents.includes(agent)) {
      errors.push(`${at}: unknown agent "${agent}" (allowed: ${config.agents.join(', ')})`);
    }
    if (!commit.login) errors.push(`${at}: commit author has no linked GitHub login`);
    const id = agent && config.agents.includes(agent) && commit.login ? `${commit.login}/${agent}` : null;

    const isBoundary = trailerValues(trailers, 'Stage').length > 0;
    if (isBoundary) {
      const lane = single(trailers, 'Lane');
      if (lane !== slug) errors.push(`${at}: boundary Lane "${lane ?? ''}" does not match branch slug "${slug}"`);
      if (!single(trailers, 'Machine')) errors.push(`${at}: boundary is missing Machine`);
      const handedOffBy = single(trailers, 'Handed-off-by');
      if (id && handedOffBy !== id) {
        errors.push(`${at}: Handed-off-by "${handedOffBy ?? ''}" does not match commit identity "${id}"`);
      }

      const dependency = single(trailers, 'Dependency-lane');
      if (!DEPENDENCY_VALUES.has(dependency)) {
        errors.push(`${at}: Dependency-lane must be taken, released or none`);
      } else if (dependency === 'taken') {
        if (holdsDependency) errors.push(`${at}: dependency lane taken twice without a release`);
        holdsDependency = true;
      } else if (dependency === 'released') {
        holdsDependency = false;
      }

      const value = single(trailers, 'Stage') ?? '';
      const full = FULL_STAGE.exec(value);
      const partial = PARTIAL_STAGE.exec(value);
      if (!full && !partial) {
        errors.push(`${at}: Stage "${value}" is not "<from> -> <to>" or "<stage> (partial)"`);
      } else {
        const from = full ? full[1] : partial[1];
        const to = full ? full[2] : partial[1];
        if (from === 'verify' || to === 'verify') {
          errors.push(`${at}: verify is recorded as issue comments, never as a commit`);
        } else if (full && STAGES.indexOf(to) !== STAGES.indexOf(from) + 1) {
          errors.push(`${at}: Stage "${value}" skips or reverses ${STAGES.join(' -> ')}`);
        } else if (stage && from !== stage) {
          errors.push(`${at}: Stage "${value}" starts from "${from}" but the lane is in "${stage}"`);
        }
        stage = to;
      }
    }

    if (previous && previous.id && id && previous.id !== id && !previous.boundary) {
      errors.push(`${at}: ${id} follows ${previous.id} with no boundary commit between them`);
    }
    previous = { id, boundary: isBoundary };
  }

  return errors.length > 0
    ? { status: 'fail', errors, checked, skippedMerges }
    : { status: 'pass', checked, skippedMerges };
}

module.exports = { evaluateProvenance };
```

- [ ] **Step 4: Green.** Expected: **23 passed** (5 legal + 2 exemption + 16 failing-rule cases). If a
  message differs, fix the implementation to the table above, not the test.

- [ ] **Step 5: Prove the identity rule is not decorative.** Temporarily change
  `!previous.boundary` to `true` in the identity condition → the `a handover between agents through a
  boundary` case fails → restore → `git diff --quiet -- scripts/lib/lane-provenance-rules.js` (before
  staging) or re-run green. Record it.

- [ ] **Step 6: Commit** `feat(lanes): provenance rules as a pure, fully negative-tested function` + `Agent:` trailer.

---

## Task 4: GitHub compare adapter

**Files:** Create `scripts/lib/github-compare.js`, `tests/regression/lanes-github-compare.test.ts`

**Interfaces — Produces:**
- `compareCommits({ repo, base, head, token?, apiUrl?, fetchImpl? })` → `Promise<Commit[]>`, in the same `Commit` shape as Task 3.
- It throws `Error` with these messages:
  - `repo must be owner/name`;
  - `base and head must be commit SHAs`;
  - `GitHub compare unavailable: HTTP <status>`;
  - `GitHub compare unavailable: unexpected response shape`;
  - `GitHub compare unavailable: malformed commit`;
  - `GitHub compare incomplete: got <n> of <total> commits`.

- [ ] **Step 1: Write the failing test** (Write tool)

```ts
/**
 * Lane lanes-provenance (ADR-098): the only code that talks to GitHub. It is tested against a real
 * local HTTP server replaying GitHub's compare-response shape, including paging and failures, so
 * nothing about the network is mocked away.
 */
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { AddressInfo } from 'net';

const { compareCommits } = require('../../scripts/lib/github-compare');

type Handler = (req: IncomingMessage, res: ServerResponse) => void;
const BASE = 'a'.repeat(40);
const HEAD = 'b'.repeat(40);
const requests: Array<{ url: string; auth: string | undefined }> = [];
let close: () => Promise<void> = async () => undefined;

async function api(handler: Handler): Promise<string> {
  const server = createServer((req, res) => {
    requests.push({ url: req.url ?? '', auth: req.headers.authorization });
    handler(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  close = () => new Promise<void>((resolve) => server.close(() => resolve()));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

const apiCommit = (sha: string, login: string | null, message: string, parents = 1) => ({
  sha,
  author: login ? { login } : null,
  parents: Array.from({ length: parents }, (_, i) => ({ sha: `p${i}` })),
  commit: { message },
});

afterEach(async () => {
  requests.length = 0;
  await close();
});

describe('GitHub compare adapter (ADR-098)', () => {
  it('follows pages, keeps order, normalizes commits and authenticates', async () => {
    const apiUrl = await api((req, res) => {
      const page = new URL(req.url ?? '', 'http://x').searchParams.get('page');
      json(res, 200, {
        total_commits: 3,
        commits: page === '1' ? [apiCommit('c1', 'ravichavali', 'one'), apiCommit('c2', null, 'two', 2)] : [apiCommit('c3', 'alex', 'three')],
      });
    });

    const commits = await compareCommits({ repo: 'ravichavali/karmyq', base: BASE, head: HEAD, token: 'tok', apiUrl });

    expect(commits).toEqual([
      { sha: 'c1', login: 'ravichavali', parents: 1, message: 'one' },
      { sha: 'c2', login: null, parents: 2, message: 'two' },
      { sha: 'c3', login: 'alex', parents: 1, message: 'three' },
    ]);
    expect(requests.map((r) => r.url)).toEqual([
      `/repos/ravichavali/karmyq/compare/${BASE}...${HEAD}?per_page=100&page=1`,
      `/repos/ravichavali/karmyq/compare/${BASE}...${HEAD}?per_page=100&page=2`,
    ]);
    expect(requests.every((r) => r.auth === 'Bearer tok')).toBe(true);
  });

  it('fails closed on an HTTP error without echoing the body', async () => {
    const apiUrl = await api((_req, res) => json(res, 403, { message: 'PRIVATE_SENTINEL rate limited' }));
    const attempt = compareCommits({ repo: 'o/r', base: BASE, head: HEAD, apiUrl });
    await expect(attempt).rejects.toThrow('GitHub compare unavailable: HTTP 403');
    await expect(compareCommits({ repo: 'o/r', base: BASE, head: HEAD, apiUrl })).rejects.not.toThrow('PRIVATE_SENTINEL');
  });

  it('fails closed on an unexpected response shape', async () => {
    const apiUrl = await api((_req, res) => json(res, 200, { commits: 'nope' }));
    await expect(compareCommits({ repo: 'o/r', base: BASE, head: HEAD, apiUrl })).rejects.toThrow('GitHub compare unavailable: unexpected response shape');
  });

  it('fails closed on a malformed commit', async () => {
    const apiUrl = await api((_req, res) => json(res, 200, { total_commits: 1, commits: [{ sha: 'c1' }] }));
    await expect(compareCommits({ repo: 'o/r', base: BASE, head: HEAD, apiUrl })).rejects.toThrow('GitHub compare unavailable: malformed commit');
  });

  it('fails closed when pages run out before total_commits', async () => {
    const apiUrl = await api((req, res) => {
      const page = new URL(req.url ?? '', 'http://x').searchParams.get('page');
      json(res, 200, { total_commits: 3, commits: page === '1' ? [apiCommit('c1', 'r', 'm'), apiCommit('c2', 'r', 'm')] : [] });
    });
    await expect(compareCommits({ repo: 'o/r', base: BASE, head: HEAD, apiUrl })).rejects.toThrow('GitHub compare incomplete: got 2 of 3 commits');
  });

  it('validates inputs before any request', async () => {
    const apiUrl = await api((_req, res) => json(res, 200, { total_commits: 0, commits: [] }));
    await expect(compareCommits({ repo: 'o/r/../x', base: BASE, head: HEAD, apiUrl })).rejects.toThrow('repo must be owner/name');
    await expect(compareCommits({ repo: 'o/r', base: 'main', head: HEAD, apiUrl })).rejects.toThrow('base and head must be commit SHAs');
    expect(requests).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Discovery, then red.** Expected: the named import-crash first red.

- [ ] **Step 3: Implement** `scripts/lib/github-compare.js`:

```js
'use strict';

/**
 * GitHub compare adapter (ADR-098): the only HTTP in the lanes gate. It returns the commits a PR
 * adds over its base, with author logins. It fails closed and never echoes response bodies.
 */

const API_VERSION = '2022-11-28';
const REPO = /^[\w.-]+\/[\w.-]+$/;
const SHA = /^[0-9a-f]{7,40}$/i;

function normalize(raw) {
  if (!raw || typeof raw.sha !== 'string' || !Array.isArray(raw.parents) || typeof raw.commit?.message !== 'string') {
    throw new Error('GitHub compare unavailable: malformed commit');
  }
  return { sha: raw.sha, login: raw.author?.login ?? null, parents: raw.parents.length, message: raw.commit.message };
}

async function compareCommits({ repo, base, head, token, apiUrl = 'https://api.github.com', fetchImpl = fetch }) {
  if (typeof repo !== 'string' || !REPO.test(repo) || repo.split('/').some((part) => part === '.' || part === '..')) {
    throw new Error('repo must be owner/name');
  }
  if (!SHA.test(String(base)) || !SHA.test(String(head))) throw new Error('base and head must be commit SHAs');

  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': API_VERSION, 'User-Agent': 'karmyq-lanes' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const commits = [];
  let total = 0;
  for (let page = 1; ; page++) {
    const url = `${apiUrl.replace(/\/+$/, '')}/repos/${repo}/compare/${base}...${head}?per_page=100&page=${page}`;
    const res = await fetchImpl(url, { headers });
    if (!res.ok) {
      await res.body?.cancel();
      throw new Error(`GitHub compare unavailable: HTTP ${res.status}`);
    }
    const body = await res.json();
    if (!body || !Number.isInteger(body.total_commits) || !Array.isArray(body.commits)) {
      throw new Error('GitHub compare unavailable: unexpected response shape');
    }
    total = body.total_commits;
    for (const raw of body.commits) commits.push(normalize(raw));
    if (commits.length >= total || body.commits.length === 0) break;
  }
  if (commits.length !== total) throw new Error(`GitHub compare incomplete: got ${commits.length} of ${total} commits`);
  return commits;
}

module.exports = { compareCommits };
```

- [ ] **Step 4: Green.** Expected: **6 passed**. (`o/r/../x` fails the `REPO` pattern because of the second `/`. The `.`/`..` guard covers `o/..`.)

- [ ] **Step 5: Commit** `feat(lanes): fail-closed GitHub compare adapter` + `Agent:` trailer.

---

## Task 5: CLI and the PR workflow

**Files:** Create `scripts/lane-provenance.js`, `.github/workflows/lanes-pr.yml`, `tests/regression/lanes-provenance-cli.test.ts`, `tests/regression/lanes-pr-workflow.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 3 and 4.
- Produces:
  - CLI `node scripts/lane-provenance.js --repo <owner/name> --base <sha> --head <sha> --branch <name> [--config <path>]`;
  - env `GITHUB_TOKEN || GH_TOKEN`, optional `GITHUB_API_URL`;
  - exit codes `0` pass/exempt, `1` fail or evidence unavailable, `2` usage/config error;
  - output lines: `lane-provenance: exempt (branch matches "<pattern>")`, `lane-provenance: pass (<n> commits checked, <m> merge commits skipped)`, `lane-provenance: fail`, followed by `  - <error>` lines, and `lane-provenance: evidence unavailable (<message>); failing closed`.

- [ ] **Step 1: Write the failing CLI test** (Write tool)

```ts
/**
 * Lane lanes-provenance (ADR-098): the real CLI against a local server replaying GitHub's compare API.
 * Async spawn, never execFileSync, because the server lives in this process.
 */
import { spawn } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { createServer, ServerResponse } from 'http';
import { AddressInfo } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';

const CLI = join(__dirname, '..', '..', 'scripts', 'lane-provenance.js');
const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
let hits = 0;
let close: () => Promise<void> = async () => undefined;

const apiCommit = (sha: string, login: string | null, message: string) => ({
  sha, author: login ? { login } : null, parents: [{ sha: 'p' }], commit: { message },
});

async function api(status: number, body: unknown): Promise<string> {
  const server = createServer((_req, res: ServerResponse) => {
    hits += 1;
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  close = () => new Promise<void>((resolve) => server.close(() => resolve()));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

function cli(args: string[], apiUrl = 'http://127.0.0.1:9'): Promise<{ code: number | null; out: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      env: { ...process.env, GITHUB_TOKEN: 'test-token', GH_TOKEN: '', GITHUB_API_URL: apiUrl },
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => resolve({ code, out }));
  });
}

const args = (branch: string) => ['--repo', 'ravichavali/karmyq', '--base', SHA_A, '--head', SHA_B, '--branch', branch];

afterEach(async () => {
  hits = 0;
  await close();
});

describe('scripts/lane-provenance.js (ADR-098)', () => {
  it('passes a clean lane history (exit 0)', async () => {
    const url = await api(200, { total_commits: 1, commits: [apiCommit('c'.repeat(40), 'ravichavali', 's\n\nAgent: claude\n')] });
    const { code, out } = await cli(args('lane/demo'), url);
    expect(code).toBe(0);
    expect(out).toContain('lane-provenance: pass (1 commits checked, 0 merge commits skipped)');
  });

  it('fails with every error listed (exit 1)', async () => {
    const url = await api(200, { total_commits: 1, commits: [apiCommit('d'.repeat(40), null, 's\n\nbody\n')] });
    const { code, out } = await cli(args('lane/demo'), url);
    expect(code).toBe(1);
    expect(out).toContain('lane-provenance: fail');
    expect(out).toContain('  - dddddddd: missing Agent trailer (exactly one required)');
    expect(out).toContain('  - dddddddd: commit author has no linked GitHub login');
  });

  it('exempts a listed branch without calling GitHub', async () => {
    const url = await api(500, {});
    const { code, out } = await cli(args('dependabot/npm_and_yarn/zod-4.6.4'), url);
    expect(code).toBe(0);
    expect(out).toContain('lane-provenance: exempt (branch matches "dependabot/**")');
    expect(hits).toBe(0);
  });

  it('fails closed when GitHub is unavailable', async () => {
    const url = await api(502, { message: 'PRIVATE_SENTINEL' });
    const { code, out } = await cli(args('lane/demo'), url);
    expect(code).toBe(1);
    expect(out).toContain('lane-provenance: evidence unavailable (GitHub compare unavailable: HTTP 502); failing closed');
    expect(out).not.toContain('PRIVATE_SENTINEL');
  });

  it('rejects usage and config errors with exit 2', async () => {
    const missing = await cli(['--repo', 'o/r', '--base', SHA_A, '--branch', 'lane/demo']);
    expect(missing.code).toBe(2);
    expect(missing.out).toContain('--head is required');

    const dir = mkdtempSync(join(tmpdir(), 'karmyq-lanes-cfg-'));
    try {
      writeFileSync(join(dir, 'bad.json'), JSON.stringify({ agents: [] }));
      const bad = await cli([...args('lane/demo'), '--config', join(dir, 'bad.json')]);
      expect(bad.code).toBe(2);
      expect(bad.out).toContain('invalid lanes config:');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Write the failing workflow test** (Write tool)

```ts
/**
 * Lane lanes-provenance (ADR-098): lanes-pr.yml must run the BASE branch's gate and config (a PR
 * must not be able to exempt itself), and must never interpolate PR-controlled text into a shell.
 * Honest limit: this parses YAML. The PR's own run is the evidence GitHub executes it (Task 8).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';

type Step = { name?: string; uses?: string; run?: string; env?: Record<string, string>; with?: Record<string, unknown> };

const wf = parseYaml(readFileSync(join(__dirname, '..', '..', '.github', 'workflows', 'lanes-pr.yml'), 'utf8'));
const job = wf.jobs['lane-provenance'];
const steps: Step[] = job.steps;
const find = (predicate: (s: Step) => boolean) => steps.findIndex(predicate);

const checkout = find((s) => (s.uses ?? '').startsWith('actions/checkout@'));
const bootstrap = find((s) => (s.run ?? '').includes('[ ! -f scripts/lane-provenance.js ]'));
const setupNode = find((s) => (s.uses ?? '').startsWith('actions/setup-node@'));
const gate = find((s) => (s.run ?? '').includes('node scripts/lane-provenance.js'));

describe('lanes-pr.yml (ADR-098)', () => {
  it('runs on pull_request only, never pull_request_target', () => {
    expect(Object.keys(wf.on)).toEqual(['pull_request']);
    expect(wf.on.pull_request.types).toEqual(expect.arrayContaining(['opened', 'synchronize', 'reopened']));
  });

  it('asks for read-only contents and nothing more', () => {
    expect(wf.permissions).toEqual({ contents: 'read' });
    expect(job.permissions).toBeUndefined();
    expect(job.name).toBe('lane-provenance');
  });

  it('checks out the base commit first', () => {
    expect(checkout).toBe(0);
    expect(steps[checkout].with?.ref).toBe('${{ github.event.pull_request.base.sha }}');
  });

  it("uses the PR's own gate only when the base has none, and announces it", () => {
    expect(bootstrap).toBeGreaterThan(checkout);
    expect(steps[bootstrap].run).toContain('::notice::bootstrap');
    expect(steps[bootstrap].run).toContain('refs/pull/$PR_NUMBER/head');
    expect(steps[bootstrap].env).toEqual({ PR_NUMBER: '${{ github.event.pull_request.number }}' });
  });

  it('runs the gate under Node 24 with every input passed through env', () => {
    expect(setupNode).toBeGreaterThan(bootstrap);
    expect(String(steps[setupNode].with?.['node-version'])).toBe('24');
    expect(gate).toBeGreaterThan(setupNode);
    for (const flag of ['--repo "$REPO"', '--base "$BASE_SHA"', '--head "$HEAD_SHA"', '--branch "$HEAD_REF"']) {
      expect(steps[gate].run).toContain(flag);
    }
    expect(steps[gate].env).toEqual({
      GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
      REPO: '${{ github.repository }}',
      BASE_SHA: '${{ github.event.pull_request.base.sha }}',
      HEAD_SHA: '${{ github.event.pull_request.head.sha }}',
      HEAD_REF: '${{ github.head_ref }}',
    });
  });

  it('no run script interpolates an expression (branch names are attacker-controlled text)', () => {
    for (const s of steps) expect(s.run ?? '').not.toContain('${{');
  });
});
```

- [ ] **Step 3: Discovery, then red for both files.** Expected: the CLI suite shows 5 assertion
  failures (spawned `node` exits 1 with `Cannot find module`: codes and output mismatch). The workflow
  suite errors reading the missing YAML file: the named first red. Record both.

- [ ] **Step 4: Implement the CLI** `scripts/lane-provenance.js`:

```js
#!/usr/bin/env node
'use strict';

/**
 * Lane provenance gate (ADR-098). Checks that the commits a PR adds honor the lane rules: declared
 * agents, boundary commits at every handover, and valid stage trailers.
 * Exit: 0 pass or exempt · 1 fail or evidence unavailable (fail closed) · 2 usage or config error.
 */

const { loadConfig, matchExempt } = require('./lib/lanes-config');
const { evaluateProvenance } = require('./lib/lane-provenance-rules');
const { compareCommits } = require('./lib/github-compare');

const USAGE =
  'usage: node scripts/lane-provenance.js --repo <owner/name> --base <sha> --head <sha> --branch <name> [--config <path>]';
const FLAGS = { '--repo': 'repo', '--base': 'base', '--head': 'head', '--branch': 'branch', '--config': 'config' };
const REQUIRED = ['--repo', '--base', '--head', '--branch'];

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const key = FLAGS[argv[i]];
    if (!key) throw new Error(`unknown argument ${argv[i]}`);
    const value = argv[++i];
    if (value === undefined || value.startsWith('--')) throw new Error(`${argv[i - 1]} needs a value`);
    opts[key] = value;
  }
  for (const flag of REQUIRED) if (!opts[FLAGS[flag]]) throw new Error(`${flag} is required`);
  return opts;
}

async function main(argv, env) {
  let opts;
  let config;
  try {
    opts = parseArgs(argv);
    config = opts.config ? loadConfig(opts.config) : loadConfig();
  } catch (err) {
    console.error(`${err.message}\n${USAGE}`);
    return 2;
  }

  const pattern = matchExempt(opts.branch, config.exemptBranches);
  if (pattern) {
    console.log(`lane-provenance: exempt (branch matches "${pattern}")`);
    return 0;
  }

  let commits;
  try {
    commits = await compareCommits({
      repo: opts.repo,
      base: opts.base,
      head: opts.head,
      token: env.GITHUB_TOKEN || env.GH_TOKEN,
      apiUrl: env.GITHUB_API_URL || undefined,
    });
  } catch (err) {
    console.error(`lane-provenance: evidence unavailable (${err.message}); failing closed`);
    return 1;
  }

  const result = evaluateProvenance({ branch: opts.branch, commits, config });
  if (result.status === 'pass') {
    console.log(`lane-provenance: pass (${result.checked} commits checked, ${result.skippedMerges} merge commits skipped)`);
    return 0;
  }
  console.error('lane-provenance: fail');
  for (const error of result.errors) console.error(`  - ${error}`);
  return 1;
}

module.exports = { parseArgs, main };

if (require.main === module) {
  main(process.argv.slice(2), process.env).then(
    (code) => {
      process.exitCode = code;
    },
    (err) => {
      console.error(err);
      process.exitCode = 1;
    },
  );
}
```

Note: `apiUrl: env.GITHUB_API_URL || undefined` lets the adapter's default apply. Passing
`undefined` explicitly still triggers a destructuring default.

- [ ] **Step 5: Implement the workflow** `.github/workflows/lanes-pr.yml`:

```yaml
name: Lanes

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read

jobs:
  lane-provenance:
    name: lane-provenance
    runs-on: ubuntu-latest
    steps:
      # The gate and its config come from the BASE commit, so a PR cannot exempt itself by editing
      # lanes.config.json or scripts/lane-provenance.js (ADR-098).
      - name: Checkout base
        uses: actions/checkout@v7
        with:
          ref: ${{ github.event.pull_request.base.sha }}

      # Only while master has no gate yet (the PR that introduces it) does the PR's own copy run.
      - name: Use this PR's gate only if the base has none (bootstrap)
        env:
          PR_NUMBER: ${{ github.event.pull_request.number }}
        run: |
          if [ ! -f scripts/lane-provenance.js ]; then
            echo "::notice::bootstrap: base has no lane gate; running this PR's own copy"
            git fetch --no-tags --depth=1 origin "refs/pull/$PR_NUMBER/head"
            git checkout --detach FETCH_HEAD
          fi

      - name: Setup Node.js
        uses: actions/setup-node@v7
        with:
          node-version: '24'

      - name: Check lane provenance
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          REPO: ${{ github.repository }}
          BASE_SHA: ${{ github.event.pull_request.base.sha }}
          HEAD_SHA: ${{ github.event.pull_request.head.sha }}
          HEAD_REF: ${{ github.head_ref }}
        run: node scripts/lane-provenance.js --repo "$REPO" --base "$BASE_SHA" --head "$HEAD_SHA" --branch "$HEAD_REF"
```

- [ ] **Step 6: Green.** Both suites: CLI **5 passed**, workflow **6 passed**. Then try the CLI on this
  very branch against the real API (read-only, this lane's own history):

```bash
node scripts/lane-provenance.js --repo ravichavali/karmyq --base "$(git merge-base origin/master HEAD)" --head "$(git rev-parse origin/lane/lanes-provenance 2>/dev/null || git rev-parse HEAD)" --branch lane/lanes-provenance
echo "exit=$?"
```

The compare API only knows **pushed** commits, so before the first push expect
`evidence unavailable (GitHub compare unavailable: HTTP 404)`, exit 1. That is fail-closed working,
not a defect. Re-run after Task 8's push; expected then: `pass`, exit 0. Record both.

- [ ] **Step 7: Commit** `feat(lanes): provenance CLI and base-pinned PR workflow` + `Agent:` trailer.

---

## Task 6: `prepare-commit-msg` hook

**Files:**
- Create `scripts/git-hooks/prepare-commit-msg`, `tests/regression/lanes-prepare-commit-msg-hook.test.ts`
- Modify `scripts/install-hooks.sh` (summary block), `tests/regression/sprint-123-git-hooks-installed.test.ts:211`

- [ ] **Step 1: Write the failing hook test** (Write tool)

```ts
/**
 * Lane lanes-provenance (ADR-098): the prepare-commit-msg hook adds `Agent: <karmyq.agent>`. It is a
 * convenience; CI enforces the trailer regardless. Real git repositories, real hook.
 */
import { execFileSync } from 'child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const HOOK = join(__dirname, '..', '..', 'scripts', 'git-hooks', 'prepare-commit-msg');
const dirs: string[] = [];

function repo(agent?: string) {
  const dir = mkdtempSync(join(tmpdir(), 'karmyq-lanes-hook-'));
  dirs.push(dir);
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  git('init', '-q');
  git('config', 'user.name', 'Lane Tester');
  git('config', 'user.email', 'lane@example.test');
  git('config', 'commit.gpgsign', 'false');
  const hooks = join(dir, '.hooks');
  mkdirSync(hooks);
  copyFileSync(HOOK, join(hooks, 'prepare-commit-msg'));
  chmodSync(join(hooks, 'prepare-commit-msg'), 0o755);
  git('config', 'core.hooksPath', hooks);
  if (agent) git('config', 'karmyq.agent', agent);
  const agents = () => git('log', '-1', '--format=%(trailers:key=Agent,valueonly)').split('\n').filter(Boolean);
  return { git, agents };
}

afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

describe('prepare-commit-msg adds the Agent trailer (ADR-098)', () => {
  it('adds Agent from git config karmyq.agent', () => {
    const { git, agents } = repo('claude');
    git('commit', '-q', '--allow-empty', '-m', 'work');
    expect(agents()).toEqual(['claude']);
  });

  it('never overrides an Agent the author already wrote', () => {
    const { git, agents } = repo('claude');
    git('commit', '-q', '--allow-empty', '-m', 'work\n\nAgent: codex');
    expect(agents()).toEqual(['codex']);
  });

  it('joins an existing trailer block instead of starting a new one', () => {
    const { git, agents } = repo('kimi');
    git('commit', '-q', '--allow-empty', '-m', 'work\n\nCo-Authored-By: A <a@example.test>');
    expect(agents()).toEqual(['kimi']);
    expect(git('log', '-1', '--format=%(trailers:key=Co-Authored-By,valueonly)').trim()).toBe('A <a@example.test>');
  });

  it('adds nothing when karmyq.agent is unset', () => {
    const { git, agents } = repo();
    git('commit', '-q', '--allow-empty', '-m', 'work');
    expect(agents()).toEqual([]);
  });
});
```

- [ ] **Step 2: Discovery, then red.** Expected: every case fails at `copyFileSync` (ENOENT on the
  missing hook). That is the named first red. Create an empty `scripts/git-hooks/prepare-commit-msg`
  containing only `#!/bin/sh` and `exit 0`, then re-run: **3 failed / 1 passed** (`adds nothing`
  passes), which is assertion red. Record both runs.

- [ ] **Step 3: Implement** `scripts/git-hooks/prepare-commit-msg` (LF line endings):

```sh
#!/bin/sh
# prepare-commit-msg (ADR-098): add "Agent: <name>" from `git config karmyq.agent`.
# A convenience only. CI (scripts/lane-provenance.js) enforces the trailer on lane/* branches.
# An Agent the author already wrote is never overridden; merges and squashes are left alone.

msg_file="$1"
source="$2"

case "$source" in
  merge|squash) exit 0 ;;
esac

agent=$(git config --get karmyq.agent 2>/dev/null || true)
[ -z "$agent" ] && exit 0

git interpret-trailers --in-place --if-exists doNothing --trailer "Agent: $agent" "$msg_file"
```

- [ ] **Step 4: Green.** Expected: **4 passed**. If this Windows checkout wrote the hook with CRLF (the
  test fails with `$'\r': command not found`), add `scripts/git-hooks/* text eol=lf` to `.gitattributes`,
  run `git add --renormalize scripts/git-hooks`, and re-run. Record which happened.

- [ ] **Step 5: Installer count and summary.** In `scripts/install-hooks.sh`'s closing `Installed hooks:`
  block, add after the `pre-push` line:

```sh
  echo "  • prepare-commit-msg - Adds Agent: from git config karmyq.agent (ADR-098)"
```

In `tests/regression/sprint-123-git-hooks-installed.test.ts:211`, change
`/Successfully installed 2 hook\(s\)/` to `/Successfully installed 3 hook\(s\)/`. Then:

```bash
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-123-git-hooks-installed.test.ts --runInBand
npm run hooks:install
git config karmyq.agent
```

Expected: the sprint-123 suite passes with the new count, and `hooks:install` reports 3 hooks. From
this task on the hook adds `Agent:` automatically. Verify on the next real commit with `git log -1 --format=%(trailers)`.

- [ ] **Step 6: Commit** `feat(lanes): prepare-commit-msg adds the Agent trailer` (the hook now adds `Agent:`; confirm it did).

---

## Task 7: ADR-098 and documentation

**Files:**
- Create `docs/adr/ADR-098-lanes-stages-and-provenance.md`
- Modify `docs/adr/README.md`, `scripts/claude.md`, `scripts/git-hooks/README.md`, `.claude/handoff/lane-lanes-provenance.md`
- Regenerated: landing output

- [ ] **Step 1: Write ADR-098** (Write tool):

```markdown
# ADR-098: Lanes, Stages and Provenance

**Status:** Proposed
**Date:** 2026-09-16
**Deciders:** ravichavali
**Supersedes:** none yet. On acceptance (lane `lanes-rules`) it supersedes the serialization rules in `claude.md` → *Parallel Development* and `AGENTS.md` → *Lanes & Merge Authority*
**Related:** [ADR-097](ADR-097-ecosystem-knowledge-registry.md), [ADR-060](ADR-060-code-scanning-gate.md)

## Context

Karmyq is developed by contributors who each use whichever coding agent they have tokens for
(today Claude, Codex and Kimi), and work passes between them stage by stage. The rules until now
assumed one maintainer serializing two checkouts on two machines, and they fail under that model:

- **Serialization.** The maintainer was the only serializer, so no contributor could pick up work alone.
- **Branch names.** They encoded the agent (`agent/<name>/<slug>`) and were wrong within a day when a
  branch changed hands.
- **Attribution.** Commits credited to one agent carried another agent's `Co-Authored-By` trailer.
- **Lane state.** It lived in branch-local handoff files other lanes cannot see until merge.

The full design and the maintainer's decisions are in
[the design spec](../superpowers/specs/2026-09-16-lanes-stages-provenance-design.md).

## Decision

- **Git and GitHub hold the truth; files and memory only narrate it.**
- **Lanes and stages.** A lane is one unit of work: one GitHub issue, one `lane/<slug>` branch, at most
  one PR. It moves through `spec → plan → execute → verify`. A stage is claimed by one contributor
  (human/agent) at a time; first claim wins; claims are released with progress or expire.
- **Provenance.**
  - Every commit on a lane branch declares `Agent:`.
  - While the PR is unmerged, every handover is a pushed boundary commit carrying `Lane`, `Stage`,
    `Handed-off-by`, `Machine`, `Dependency-lane` and `Next`.
  - After merge, stage records are issue comments.
  - A CI check (`lane-provenance`) verifies these rules. It runs the base branch's copy of the gate and
    config, so a PR cannot exempt itself.
- **Serialization.** GitHub issues replace the maintainer as the serializer for claims and the
  dependency lane. The merger must be a different human from the executor, with `allowSelfMerge`
  covering the single-contributor phase. ADR numbers are derived by tooling; this is the last ADR
  number allocated by hand.

## Consequences

- **History becomes attributable** from the first lane onwards. Earlier history is not retro-validated.
- **Enforcement lives in CI**, where every contributor's agent is subject to it, not in agent-specific skills or local hooks.
- **Races become visible and mechanical.** Claims are assign-then-verify, not atomic, so a race is
  resolved by timeline order rather than prevented.
- **Branch protection is unchanged.** The new checks become required only by a later explicit maintainer action.

## Implementation

Three lanes, one PR each, merged one at a time:

1. `lanes-provenance`: config, trailer parser, rules, compare adapter, CLI, `lanes-pr.yml`, `prepare-commit-msg` hook, this ADR as Proposed.
2. `lanes-work-queue`: the `work` CLI, claims, the dependency lane, ADR-number derivation, `merge-eligibility`, audit and expiry workflows.
3. `lanes-rules`: the `claude.md`, `AGENTS.md` and handoff-framework rewrite; this ADR moves to Accepted.

## Alternatives considered

- **GitHub Projects v2 board:** GraphQL-only, with configuration that no PR reviews.
- **A git ledger branch** (atomic compare-and-set via push): invisible in the issue UI, and a second branch model for every contributor.
- **Issue comments processed by a workflow** (serialized by a concurrency group): unnecessary once contributors have write access.
```

- [ ] **Step 2: Index it.** In `docs/adr/README.md`, after the ADR-097 line (`:135`):

```markdown
- [ADR-098: Lanes, Stages and Provenance](ADR-098-lanes-stages-and-provenance.md) — **Proposed**
```

- [ ] **Step 3: Script and hook docs.** In `scripts/claude.md`'s entry-points table, add after the
  `image-size` row:

```markdown
| `Lanes` PR workflow (`lanes-pr.yml`) | `lane-provenance.js` | Checks a PR's commits against the lane rules (ADR-098): declared `Agent:`, a boundary commit at every human/agent change, and valid `Lane`/`Stage`/`Handed-off-by`/`Machine`/`Dependency-lane` trailers. Runs the **base** branch's gate and `lanes.config.json`. Exit 0 pass/exempt, 1 fail or evidence unavailable, 2 usage. Libraries: `lib/lanes-config.js`, `lib/trailers.js`, `lib/lane-provenance-rules.js`, `lib/github-compare.js`, each with a `tests/regression/lanes-*.test.ts` suite |
```

In `scripts/git-hooks/README.md`, add after the `pre-push` section:

```markdown
### prepare-commit-msg
**Purpose**: Adds `Agent: <name>` to commit messages (ADR-098)

**What it does**: Reads `git config karmyq.agent` and appends `Agent: <name>` as a trailer unless the
message already has one. It does nothing when the setting is unset, and nothing for merges or squashes.

**Set once per checkout**: `git config karmyq.agent <claude|codex|kimi>`

**Enforcement**: This is a convenience only. The `lane-provenance` CI check enforces the trailer on `lane/*` branches.
```

- [ ] **Step 4: Verify docs, then regenerate landing**

```bash
git add docs/adr/ADR-098-lanes-stages-and-provenance.md docs/adr/README.md scripts/claude.md scripts/git-hooks/README.md
npm run feedback:check
npm exec --workspace=tests -- jest --runTestsByPath regression/doc-context-drift-gate.test.ts --runInBand
```

Expected: the drift gate passes, including "every ADR indexed" and "no two ADRs share a number".
Before trusting number uniqueness, re-run the ADR-098 check across remote branches and open PRs
(the command in the handoff's verification references). The landing prebuild (via Task 8's
`npm test`) regenerates `apps/landing/src/data/docs/`. Keep the substantive ADR-098 change and revert
only proven timestamp/HEAD-sha churn.

- [ ] **Step 5: Commit** `docs(lanes): ADR-098 (Proposed), script and hook docs` (hook adds `Agent:`).

---

## Task 8: Gates, version, PR, and self-verification

- [ ] **Step 1: SDLC gates.** The diff is new CI plus a security-relevant workflow, so:

```
/simplify
/code-review high
/security-review
```

Questions `/security-review` must answer explicitly:
- **Bootstrap:** it runs PR code with a `contents: read` token, only while the base lacks the gate.
- **Injection:** no `${{ }}` expression is interpolated into any `run:`.
- **Adapter inputs:** `repo` and the SHAs are validated before being interpolated into the URL.
- **Response bodies:** they are never echoed.
- **`GITHUB_API_URL`:** comes from the Actions environment. A CodeQL `js/request-forgery` finding on it
  is a candidate false positive to surface to the maintainer, never loop-dismissed.

Resolve each finding or record a written justification.

- [ ] **Step 2: Full suite, forced; inspect side effects**

```bash
git status --short > "$TEMP/pre-test-status.txt"
npm test -- --concurrency=1 --force
echo "exit=$?"
git status --short
```

Expected: exit 0. Move back any unrelated promoter moves (from `<dest>` back to `<original>`, only
when the source is absent). Keep the substantive landing ADR-098 change and revert timestamp churn.

- [ ] **Step 3: Version.** Derive from refreshed `origin/master` and increment the minor. If master
  moved, merge `origin/master` into this branch first (merge commit, not rebase; the gate skips merge
  commits), then re-run Step 2.

- [ ] **Step 4: Handoff.** Update `.claude/handoff/lane-lanes-provenance.md` with dated evidence from
  every task: first reds, green counts, the mutation in Task 3 Step 5, the hook line-ending outcome,
  the drift gate, the gate outcomes, and the full-suite result. **Next task:** open the PR and confirm
  its own `lane-provenance` run.

- [ ] **Step 5: Commit and push**

```bash
git add package.json .claude/handoff/lane-lanes-provenance.md apps/landing/src/data/docs/concepts.json apps/landing/src/data/docs/nav.json
git status --short
git commit -m "chore: bump version for lane lanes-provenance, update handoff"
git push --set-upstream origin lane/lanes-provenance
```

Confirm the push ran the pre-push suite; a silent, instant push means no hook ran.

- [ ] **Step 6: Open the PR and verify the gate on itself**

Fill every section of `.github/pull_request_template.md` (Lane: `lanes-provenance`, executed by
`<human>/<agent>`). When checks finish:

```bash
gh pr checks <n>
gh run view <lanes-run-id> --log | grep -nE "bootstrap|lane-provenance: (pass|fail|exempt|evidence)"
node scripts/lane-provenance.js --repo ravichavali/karmyq --base "$(git merge-base origin/master HEAD)" --head "$(git rev-parse HEAD)" --branch lane/lanes-provenance
echo "exit=$?"
```

Expected:
- the Lanes run logs the `::notice::bootstrap` line, then `lane-provenance: pass (<n> commits checked, …)`;
- this proves the two UNVERIFIED facts (fetching `refs/pull/<n>/head` works, and compare returns author logins);
- the local CLI run against the pushed branch also passes.

If the check fails on this branch's own history, the failure is real: fix the history-producing step
or the rule, never the exemption list. Record the run link in the handoff and push that update.

Then **stop**. Report the PR number and check status. The merge follows the rules: Sprint 131 PR B
must have deployed and passed its health check first, one merge at a time, with maintainer
authorization while `allowSelfMerge` requires `--admin`.

- [ ] **Step 7: After merge (`execute -> verify`, recorded outside the merged branch)**

Watch **Deploy to Demo** through its health check. Record the `execute -> verify` handover and the
verification evidence in the handoff on the **next lane's branch** (`lane/lanes-work-queue`), as a
dated entry in trailer format. Never push to the merged branch, and never make a docs-only master push.

---

## Self-Review

**Spec coverage** (this lane's rows of the spec's *Rollout* table):
- `lanes.config.json`: Task 1 (plus the `exemptBranches` of *Provenance gate*).
- Trailer parser: Task 2.
- Pure rules covering all six gate rules plus the `verify`-as-commit and dependency cases: Task 3.
- Compare adapter, fail-closed with no body echo: Task 4.
- CLI and `lanes-pr.yml`: Task 5.
  - It adds the base-pinning the spec implies ("a PR cannot exempt itself" in CIN, and "changed only by PR").
- `prepare-commit-msg` hook in `scripts/git-hooks/`: Task 6.
- ADR-098 as Proposed: Task 7.
- Report-only (no settings change): Global Constraints.
- Dogfooding: Task 0 and Task 8 Step 6.
- **Out of this lane, per the spec:** `work`, issues/labels, `merge-eligibility`, audit and expiry, rules rewrite.

**Deliberate refinements of the spec, stated:**
1. The workflow runs the base branch's gate. The spec said "run in CI on every PR"; base-pinning is
   what stops a PR from editing its own exemption.
2. `Dependency-lane` is required on every boundary (it is in the spec's format block), and an invalid
   value fails.
3. A trailer repeated where one is expected counts as missing.
4. `scripts/claude.md` gains the `lane-provenance.js` entry here, not in `lanes-rules`: each lane documents
   the scripts it ships (spec *Rule and documentation changes*, amended 2026-09-16).

**Placeholder scan.** Values left to execution are the executor's agent name, measured counts and
run IDs, and the version, each with the command that produces it. Every code step carries literal content.

**Consistency.**
- `STAGES`, `matchExempt`, `parseTrailers`/`trailerValues`, `evaluateProvenance` and `compareCommits`
  have the same names and shapes across Tasks 1–5.
- CLI output strings match between Task 5's test, its implementation and Task 8's log grep.
- Error strings match the Task 3 table, its test and its implementation.
- Hook trailer and config key `karmyq.agent` match between Task 0, Task 6 and the README text.
