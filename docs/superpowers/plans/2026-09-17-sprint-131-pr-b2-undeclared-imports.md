# Sprint 131 PR B2 — Every Workspace Declares What It Imports (BUG-046) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every npm workspace declares every package its tracked source imports. Runtime code declares
it in `dependencies`/`peerDependencies`; test and tooling code may also use `devDependencies`. One
repo-wide blocking gate replaces the messaging-only gate, so no workspace can regress.

**Architecture:** A root regression gate (`tests/regression/sprint-131-workspace-declarations.test.ts`)
takes its import sets from a TypeScript AST walk (`ts.createSourceFile` + `forEachChild`). It reads
tracked files (`git ls-files`), path aliases from each workspace's `tsconfig.json`, and resolved versions
from `package-lock.json`, so there are no hand-written import lists. Declarations are added at root's
exact ranges. Every added range is already satisfied by the hoisted version the lockfile resolves, so
the lockfile changes **only** in the workspace nodes (surgical splice), with **no new package nodes and
no version change**.

**Tech Stack:** Jest 30 (tests workspace), `typescript` 5.9.3 (`createSourceFile`, `readConfigFile`),
`semver`, npm 11.19.0 lockfile v3, Turborepo.

**Spec:** [Sprint 131 design](../specs/2026-09-15-sprint-131-maintenance-design.md) (dependency and
upgrade sections). Scope source: `docs/BUGS.md` BUG-046 (maintainer decision 2026-09-16), widened by
the maintainer on 2026-09-17 (see *Scope decisions*). Sprint plan:
[2026-09-15-sprint-131-maintenance.md](2026-09-15-sprint-131-maintenance.md). Predecessor pattern:
[PR B plan, Task 3](2026-09-16-sprint-131-pr-b-test-readiness.md).

## Global Constraints

- **Branch:** `agent/claude/sprint-131-undeclared-imports`, cut from `origin/master` `d2edb286` (v11.57.0). Never commit on the merged PR A/B branches.
- **Dependency lane:** held by **Claude** (executor). Executing this plan holds the lane; reviewing it does not. Confirm in `.claude/handoff/CURRENT_HANDOFF.md` before any manifest edit.
- **Surgical lock edits only:** splice `package-lock.json` workspace nodes in place, then prove with strict `npx -y npm@11.19.0 ci`. Never `npm install --workspace`, `npm dedupe`, or lockfile regeneration.
- **No upgrades:** every added range equals root's range (or, where root doesn't declare it, the range the repo already uses: `@jest/globals ^30.4.1` as shared/tests declare it; `jest-cli ^30.5.1` following the tests workspace's `jest`). The gate's range check must stay green against the **unchanged** resolved versions.
- **No new lock package nodes.** A splice diff that touches anything outside `packages["<workspace>"]` nodes is a stop-and-investigate.
- **No application code changes.** Manifests, lockfile, one gate, docs.
- **Root regression commands run in the tests workspace:** `npm exec --workspace=tests -- jest --runTestsByPath regression/<file>.test.ts --runInBand`. A zero-test or config-error exit is not red.
- **`$SCRATCH`** in commands below means the executing session's scratchpad directory (set `SCRATCH=<path>` in each Bash call). Probe outputs and `declare-b2.js` live there, never in the repo.
- **Windows host:** use `node -e` for JSON checks (no `jq`); capture exit codes separately (never trust `| tail`); no local Docker, so Docker proof comes from the PR's CI runs.
- **Landing docs churn:** `npm test` regenerates `apps/landing/src/data/docs/`. Commit only content changes that come from edited `CONTEXT.md` files; revert timestamp/HEAD-sha churn.
- **Version:** derive from `origin/master` at merge time (11.57.0 today → 11.58.0). No merge without explicit per-PR maintainer authorization, and no merge while another deploy is in flight.

## Scope decisions (maintainer, 2026-09-17)

Re-measured in the planning chat with the gate's own logic (AST prototype in the planning scratchpad) over
every tracked `.ts/.tsx/.js/.jsx/.mjs/.cjs` file in all 15 workspaces:

1. **BUGS.md's table is confirmed exactly** for the 8 services (runtime scope).
2. **`packages/shared` included** ("Include in B2"): its compiled runtime imports `jsonwebtoken`
   (`middleware/auth.ts:2`, value use `jwt.verify` at :103), `bull` (`events/publisher.ts:1`, `new Queue`
   at :10) and `pg` (`middleware/dbContext.ts:2`, used **only as a type**: `pool: Pool` at :22/:64/:83/:107/:125).
   `jsonwebtoken`/`bull` → `dependencies`; `pg` → `peerDependencies`. The consumer constructs and passes the
   `Pool`, which is the same contract as shared's Express peer (`packages/shared/CONTEXT.md` "Express 5 peer
   contract"). The peer guarantees the **runtime** package at consumers only; `Pool`'s **types** come from
   `@types/pg` (shared `devDependencies`, hoisted), so never cite the peer as what makes shared's types resolve.
   Shared's build excludes **three** `api/` files (`packages/shared/tsconfig.json:25-27`; ADR-028;
   `apps/frontend/Dockerfile:25-27` deletes them). Two import undeclared packages and are the gate's **only**
   allowlist entries: `api/client.ts` (axios) and `api/mobile-storage.ts` (`@react-native-async-storage/async-storage`,
   **no lock node at all**). `api/web-storage.ts` imports only a relative file, so it needs no entry; a future package
   import there would turn the gate red, which is correct.
3. **Test/tooling scope gated and fixed now** ("Gate it and fix all now"): notification, reputation and
   social-graph tests; frontend TDD tests; the `tests` workspace.

### Verified facts (re-check in Task 1 Step 1; stop if any differ)

| Fact | Source |
|---|---|
| Root ranges: `bcryptjs ^2.4.3`, `bull ^4.11.5`, `cors ^2.8.5`, `dotenv ^16.3.1`, `express ^5.2.1`, `express-rate-limit ^8.2.2`, `ioredis ^5.11.1`, `jsonwebtoken ^9.0.2`, `pg ^8.23.0`, `winston ^3.18.3`, `axios ^1.20.0` | root `package.json` `dependencies` |
| Lock resolves hoisted: bcryptjs 2.4.3, bull 4.16.5, cors 2.8.6, dotenv 16.6.1, express 5.2.1, express-rate-limit 8.5.2, ioredis 5.11.1, jsonwebtoken 9.0.3, pg 8.23.0, winston 3.19.0, axios 1.20.0, @jest/globals 30.5.1, jest-cli 30.5.1; `node_modules/@karmyq/shared` is `{"resolved":"packages/shared","link":true}` | `package-lock.json` `packages["node_modules/*"]` |
| No touched workspace has a nested node for any added package (nested `express-rate-limit`/`zod` exist only under `packages/shared` and `services/geocoding-service`, which get neither added) | `package-lock.json` |
| `@jest/globals ^30.4.1` is the range `packages/shared` and `tests` already declare; `jest ^30.5.1` is what `tests` declares (→ `jest-cli ^30.5.1`) | `packages/shared/package.json`, `tests/package.json` |
| All 11 touched manifests and the lockfile are LF and round-trip byte-exact through `JSON.stringify(x, null, 2) + '\n'`; every `dependencies`/`devDependencies`/`peerDependencies` object is already key-sorted, and each field this plan extends already exists | planning measurement |
| Every workspace's lock node mirrors its manifest's three dependency fields today (0 mismatches) | planning measurement |
| `tests/regression/helpers/workspaces.ts` exports `ROOT`, `allWorkspaces()`, `read()`, `tracked()` | that file |
| Turbo today: `@karmyq/tests#build <- []`, `@karmyq/tests#test <- ["@karmyq/tests#build"]` (no shared build edge) | `npx turbo run test --filter=@karmyq/tests --dry=json` |
| Only references to the messaging gate outside its own plan: `docs/BUGS.md:582`, `docs/BUGS.md:1093`, `services/messaging-service/CONTEXT.md:370` (+ its generated landing JSON), `CURRENT_HANDOFF.md` | `git grep sprint-131-messaging-declarations` |

### Measured inventory (unique `workspace: package (file)` entries)

| State | Runtime-scope violations | Dev-scope violations |
|---|---|---|
| Today | **95** | **94** |
| After Task 2 (8 services declared) | **3** (shared: bull, jsonwebtoken, pg) | **14** (frontend @jest/globals ×3, shared jsonwebtoken ×1, tests axios ×7, @karmyq/shared ×2, jest-cli ×1) |
| After Task 3 | **0** | **0** |

### Declarations to add

| Workspace | `dependencies` | `devDependencies` | `peerDependencies` |
|---|---|---|---|
| services/auth-service | cors ^2.8.5, dotenv ^16.3.1, express ^5.2.1, jsonwebtoken ^9.0.2, pg ^8.23.0 | — | — |
| services/cleanup-service | cors, dotenv, express, express-rate-limit ^8.2.2, jsonwebtoken, pg, winston ^3.18.3 | — | — |
| services/community-service | cors, dotenv, express, jsonwebtoken, pg | — | — |
| services/notification-service | bull ^4.11.5, cors, dotenv, express, pg | jsonwebtoken ^9.0.2 | — |
| services/reputation-service | bull, cors, dotenv, express, ioredis ^5.11.1, pg | jsonwebtoken | — |
| services/request-service | cors, dotenv, express, jsonwebtoken, pg | — | — |
| services/simulation-service | bcryptjs ^2.4.3 | — | — |
| services/social-graph-service | bull, cors, express, pg | @jest/globals ^30.4.1, jsonwebtoken | — |
| packages/shared | bull, jsonwebtoken | — | pg ^8.23.0 |
| apps/frontend | — | @jest/globals ^30.4.1 | — |
| tests | — | @karmyq/shared *, axios ^1.20.0, jest-cli ^30.5.1 | — |

(Unlisted ranges repeat the root range above.) Test-only use of a package that the service now declares
at runtime (e.g. `express` in auth tests) needs nothing further.

**Downstream effect, intended:** a root-only major bump (D1 dotenv #226, deferred ioredis #245, deferred
bcryptjs #243) now fails this gate's range check in those workspaces. The D-series PRs must bump the
workspace declarations with root. Say so in the PR body.

## File map

| File | Responsibility | Task |
|---|---|---|
| `tests/regression/sprint-131-workspace-declarations.test.ts` | Repo-wide gate: imports ⇒ declarations (runtime/dev scopes), allowlist not stale, ranges satisfied by lock, lock mirrors manifests | Create (1) |
| `tests/regression/sprint-131-messaging-declarations.test.ts` | Subsumed by the new gate | Delete (3) |
| 8 × `services/*/package.json` | Declarations | Modify (2) |
| `packages/shared/package.json`, `apps/frontend/package.json`, `tests/package.json` | Declarations | Modify (3) |
| `package-lock.json` | Workspace nodes only | Splice (2, 3) |
| 8 × `services/*/CONTEXT.md`, `packages/shared/CONTEXT.md`, `services/messaging-service/CONTEXT.md` | Record declarations / gate rename | Modify (4) |
| `docs/BUGS.md` | BUG-046 → fixed; gate path references | Modify (4) |
| `docs/guides/testing-guide.md` | How the declarations gate works and how to satisfy it | Modify (4) |
| `apps/landing/src/data/docs/services/*.json` | Regenerated from CONTEXT.md (content only) | Regenerate (4) |
| `.claude/handoff/CURRENT_HANDOFF.md`, root `package.json` version | Close-out | Modify (5) |

---

## Task 1: The repo-wide declarations gate, proven red and proven able to fail

**Files:**
- Create: `tests/regression/sprint-131-workspace-declarations.test.ts`

**Interfaces:**
- Consumes: `ROOT`, `allWorkspaces(): {ws, dir}[]`, `read(rel): string`, `tracked(...pathspecs): string[]` from `tests/regression/helpers/workspaces.ts`.
- Produces: test names used as red/green signals by Tasks 2–3:
  `runtime imports are declared in dependencies or peerDependencies`,
  `test and tooling imports are declared in any dependency field`.

- [ ] **Step 1: Confirm the lane, the base and the facts; capture baselines**

```bash
git status --short && git branch --show-current && git log --oneline -1 origin/master
```
Expected: clean tree, branch `agent/claude/sprint-131-undeclared-imports`, `origin/master` `d2edb286`. If
master moved, stop and report (the facts must be re-derived on the new base).

Re-verify the resolved versions:
```bash
node -e "const P=require('./package-lock.json').packages;for(const n of ['bcryptjs','bull','cors','dotenv','express','express-rate-limit','ioredis','jsonwebtoken','pg','winston','axios','@jest/globals','jest-cli','@karmyq/shared'])console.log(n,JSON.stringify(P['node_modules/'+n]?.version??P['node_modules/'+n]))"
```
Expected exactly the *Verified facts* versions (and the link object for `@karmyq/shared`). Any difference → stop.

Capture the `npm ls` baseline (BUG-047 makes it exit 1 today). Keep only **dependency problems**: the
`npm error A complete log of this run can be found in: …-debug-0.log` line carries a timestamp, so two
identical runs differ on it and a raw `grep "^npm error"` comparison always reports a false difference
(measured 2026-09-17: two consecutive runs on the unchanged tree differed by exactly that line).

```bash
lsproblems () { grep -E "^npm error (code|invalid|missing|extraneous|peer dep)" "$1" | sort; }
npx -y npm@11.19.0 ls --all > "$SCRATCH/ls-before.out" 2> "$SCRATCH/ls-before.err"; echo "exit $?"
lsproblems "$SCRATCH/ls-before.err" > "$SCRATCH/ls-before.errors"; cat "$SCRATCH/ls-before.errors"
```
Expected: exit 1, and on 2026-09-17 the baseline was `code ELSPROBLEMS`, three `invalid` lines
(`picomatch@2.3.2`, `color-string@2.1.4`, `ms@2.0.0`) and one `missing: @react-native/metro-config@*,
required by react-native-worklets@0.10.1` — **not** picomatch alone. Whatever it prints is the baseline;
record it verbatim in the handoff and keep the file for Task 3. Define `lsproblems` again in that Bash call.

- [ ] **Step 2: Write the gate**

Create `tests/regression/sprint-131-workspace-declarations.test.ts` with the Write tool:

```ts
/**
 * Sprint 131 PR B2 (BUG-046): every workspace declares every package it imports.
 *
 * Replaces sprint-131-messaging-declarations (PR B), which covered one service. Eight services,
 * packages/shared, apps/frontend and the tests workspace imported packages they never declared,
 * alive only because root declares them and npm hoists. A root-only bump (Sprint 131 D1: dotenv 17)
 * would silently change or de-hoist what those workspaces run.
 *
 * Nothing here is a hand-written list of imports:
 * - imports come from a TypeScript AST walk over TRACKED files, so strings and
 *   comments that merely look like `from "x"` are not imports;
 * - path aliases (`@/`) come from each workspace's tsconfig `paths`;
 * - resolved versions come from package-lock.json.
 *
 * Scopes: a file that never ships (tests, __tests__/__mocks__, *.test/*.spec, jest/eslint/playwright
 * config, the whole tests workspace) may satisfy an import from devDependencies. Everything else is
 * runtime and needs dependencies or peerDependencies, because the Dockerfiles install --omit=dev.
 */
import { join } from 'path';
import { builtinModules } from 'module';
import * as semver from 'semver';
import * as ts from 'typescript';

import { ROOT, allWorkspaces, read, tracked } from './helpers/workspaces';

const FIELDS = ['dependencies', 'devDependencies', 'peerDependencies'] as const;
type Manifest = Partial<Record<(typeof FIELDS)[number], Record<string, string>>>;
type LockNode = Manifest & { version?: string; link?: boolean };

const lock: { packages: Record<string, LockNode> } = JSON.parse(read('package-lock.json'));

const DEV_ONLY =
  /^(tests|e2e)\/|(^|\/)__(tests|mocks)__\/|\.(test|spec)\.[cm]?[jt]sx?$|^(jest|eslint|playwright)\.(config|setup)\.[cm]?[jt]s$/;

/**
 * Runtime-scope imports that are knowingly undeclared, keyed per file. Every entry must still be a
 * violation (see the stale-entry test), so this list can only shrink.
 */
const ALLOWLIST: Record<string, string> = {
  'packages/shared: axios (api/client.ts)':
    'excluded from the shared build (packages/shared/tsconfig.json exclude, ADR-028); never compiled or shipped',
  'packages/shared: @react-native-async-storage/async-storage (api/mobile-storage.ts)':
    'excluded from the shared build (packages/shared/tsconfig.json exclude, ADR-028); never compiled or shipped',
};

const packageName = (spec: string): string =>
  spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];

function pathAliases(ws: string): string[] {
  if (tracked(`${ws}/tsconfig.json`).length === 0) return [];
  const { config, error } = ts.readConfigFile(join(ROOT, ws, 'tsconfig.json'), ts.sys.readFile);
  if (error) throw new Error(`${ws}/tsconfig.json: ${ts.flattenDiagnosticMessageText(error.messageText, '\n')}`);
  return Object.keys(config?.compilerOptions?.paths ?? {})
    .map((pattern) => pattern.replace(/\*$/, ''))
    .filter(Boolean);
}

const SCRIPT_KIND: Record<string, ts.ScriptKind> = {
  '.ts': ts.ScriptKind.TS,
  '.tsx': ts.ScriptKind.TSX,
  '.js': ts.ScriptKind.JS,
  '.jsx': ts.ScriptKind.JSX,
  '.mjs': ts.ScriptKind.JS,
  '.cjs': ts.ScriptKind.JS,
};

/**
 * Every module specifier in one file, from a real AST walk.
 *
 * NOT ts.preProcessFile: its lightweight scanner misses `require()` inside a template interpolation
 * (measured 2026-09-17), which would let an undeclared package through silently. The walk is a strict
 * superset of the pre-processor over this repo, and costs ~1.4s for all 1021 tracked files. It also covers
 * type-only positions (`import('pkg').T`, `typeof import('pkg')`), which the pre-processor drops.
 */
export function specifiersOf(file: string, source: string): string[] {
  const kind = SCRIPT_KIND[file.slice(file.lastIndexOf('.'))] ?? ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, false, kind);
  const found = new Set<string>();
  const literal = (node?: ts.Node): string | undefined =>
    node && ts.isStringLiteralLike(node) ? node.text : undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const spec = literal(node.moduleSpecifier);
      if (spec) found.add(spec);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      const spec = literal(node.moduleReference.expression);
      if (spec) found.add(spec);
    } else if (ts.isImportTypeNode(node) && node.argument && ts.isLiteralTypeNode(node.argument)) {
      // Type queries: `type T = import('pkg').X`, `typeof import('pkg')`, `Map<string, import('pkg').X>`.
      const spec = literal(node.argument.literal);
      if (spec) found.add(spec);
    } else if (ts.isCallExpression(node)) {
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const spec = literal(node.arguments[0]);
      if ((isRequire || isDynamicImport) && spec) found.add(spec);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return [...found];
}

type Import = { key: string; name: string; devOnly: boolean };

function importsOf(ws: string): Import[] {
  const aliases = pathAliases(ws);
  const files = tracked(...['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].map((ext) => `${ws}/*.${ext}`)).filter(
    (file) => !/(^|\/)(dist|\.next|build)\//.test(file),
  );
  const seen = new Map<string, Import>();
  for (const file of files) {
    const rel = file.slice(ws.length + 1);
    const devOnly = ws === 'tests' || DEV_ONLY.test(rel);
    for (const spec of specifiersOf(file, read(file))) {
      if (/^[./]/.test(spec) || spec.startsWith('node:') || aliases.some((alias) => spec.startsWith(alias))) continue;
      const name = packageName(spec);
      if (builtinModules.includes(name)) continue;
      const key = `${ws}: ${name} (${rel})`;
      seen.set(key, { key, name, devOnly });
    }
  }
  return [...seen.values()];
}

const workspaces = allWorkspaces().map(({ ws }) => ({
  ws,
  pkg: JSON.parse(read(`${ws}/package.json`)) as Manifest,
  imports: importsOf(ws),
}));

function undeclared(devOnly: boolean): string[] {
  return workspaces.flatMap(({ pkg, imports }) =>
    imports
      .filter((i) => i.devOnly === devOnly)
      .filter(
        (i) =>
          !pkg.dependencies?.[i.name] &&
          !pkg.peerDependencies?.[i.name] &&
          !(devOnly && pkg.devDependencies?.[i.name]),
      )
      .map((i) => i.key),
  );
}

describe('every workspace declares what it imports (Sprint 131 PR B2, BUG-046)', () => {
  it('scans every workspace, and no scan is vacuous', () => {
    expect(workspaces.filter((w) => w.imports.length === 0).map((w) => w.ws)).toEqual([]);
    const names = (ws: string) => workspaces.find((w) => w.ws === ws)?.imports.map((i) => i.name) ?? [];
    expect(names('services/messaging-service')).toContain('socket.io');
    expect(names('apps/frontend')).toContain('next');
    expect(names('apps/mobile')).toContain('expo-router');
    expect(names('packages/shared')).toContain('jsonwebtoken');
    expect(names('tests')).toContain('semver');
  });

  it('finds every import form, including the ones ts.preProcessFile misses', () => {
    // Regression: preProcessFile returned [] for a require() inside a template interpolation, and an AST
    // walk without isImportTypeNode returned [] for type queries (both measured 2026-09-17), so an
    // undeclared package could hide in either. Each case is a whole file.
    const cases: Array<[string, string, string[]]> = [
      ['x.ts', "import a from 'left-pad';", ['left-pad']],
      ['x.ts', "export { a } from 'left-pad';", ['left-pad']],
      ['x.ts', "import a = require('left-pad');", ['left-pad']],
      ['x.ts', "const a = require('left-pad');", ['left-pad']],
      ['x.ts', 'const s = `${require("left-pad")}`;', ['left-pad']],
      ['x.ts', 'const s = `${`${require("left-pad")}`}`;', ['left-pad']],
      ['x.ts', "const p = import('left-pad');", ['left-pad']],
      ['x.ts', "type Leak = import('left-pad').T;", ['left-pad']],
      ['x.ts', "const x: typeof import('left-pad') = y;", ['left-pad']],
      ['x.ts', "type M = Map<string, import('left-pad').T>;", ['left-pad']],
      ['x.tsx', "const C = () => <div>{require('left-pad')}</div>;", ['left-pad']],
      ['x.ts', 'const a = require(someVariable);', []],
      ['x.ts', "// require('left-pad')\nconst s = \"require('left-pad')\";", []],
    ];
    for (const [file, source, expected] of cases) {
      expect([file, source, specifiersOf(file, source)]).toEqual([file, source, expected]);
    }
  });

  it('reads path aliases from tsconfig, so `@/…` is never mistaken for a package', () => {
    expect(pathAliases('apps/frontend')).toEqual(['@/']);
    expect(pathAliases('apps/mobile')).toEqual(expect.arrayContaining(['@/', '@/components/']));
  });

  it('runtime imports are declared in dependencies or peerDependencies', () => {
    expect(undeclared(false).filter((key) => !(key in ALLOWLIST))).toEqual([]);
  });

  it('test and tooling imports are declared in any dependency field', () => {
    expect(undeclared(true)).toEqual([]);
  });

  it('every allowlist entry is still a violation, so the allowlist cannot go stale', () => {
    const violations = new Set(undeclared(false));
    expect(Object.keys(ALLOWLIST).filter((key) => !violations.has(key))).toEqual([]);
  });

  it('every declared range is satisfied by the version the lockfile resolves', () => {
    const unsatisfied = workspaces.flatMap(({ ws, pkg }) =>
      FIELDS.flatMap((field) =>
        Object.entries(pkg[field] ?? {}).flatMap(([name, range]) => {
          // npm resolves from the workspace first, then the hoisted root copy.
          const node = lock.packages[`${ws}/node_modules/${name}`] ?? lock.packages[`node_modules/${name}`];
          if (node?.link) return []; // workspace package (e.g. @karmyq/shared "*")
          return node?.version && semver.satisfies(node.version, range)
            ? []
            : [`${ws} ${field}: ${name}@${range} resolves ${node?.version}`];
        }),
      ),
    );
    expect(unsatisfied).toEqual([]);
  });

  it("each workspace's lockfile node mirrors its manifest", () => {
    const drift = workspaces.flatMap(({ ws, pkg }) =>
      FIELDS.filter(
        (field) => JSON.stringify(lock.packages[ws]?.[field] ?? {}) !== JSON.stringify(pkg[field] ?? {}),
      ).map((field) => `${ws} ${field}`),
    );
    expect(drift).toEqual([]);
  });
});
```

- [ ] **Step 3: Run it red and read the failure lists**

```bash
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-131-workspace-declarations.test.ts --runInBand > "$SCRATCH/gate-red.txt" 2>&1; echo "exit $?"
grep -E "✓|✕|Tests:" "$SCRATCH/gate-red.txt"
```
Expected: exit 1; **2 failed / 6 passed**. The failures are exactly `runtime imports are declared…` and
`test and tooling imports are declared…`. Count the entries in each received array (lines matching
`^\s+"(services|apps|packages|tests)`): **95** under the runtime test and **94** under the dev test.
Spot-check that `"services/simulation-service: bcryptjs (src/fixtures/curatedDemo/resetCoordinator.ts)"`
is in the **runtime** list (a `src/fixtures/` file ships) and no `@/` specifier appears anywhere.
A "No tests found" or TS compile error is **not** red. Fix the harness first.

- [ ] **Step 4: Prove each passing assertion can fail (one injection per assertion, each reverted)**

Run the Step 3 command after each injection, confirm the named failure, then revert and confirm
`git status --short` shows only the new gate file.

1. **Runtime scope:** append `import 'left-pad';` to `services/messaging-service/src/index.ts`. Expect the runtime
   test to list `services/messaging-service: left-pad (src/index.ts)`. Revert: `git checkout -- services/messaging-service/src/index.ts`.
2. **Type-query scope:** append ``type Leak = import('left-pad').Foo;`` to `services/messaging-service/src/index.ts`.
   Expect the same runtime entry. A type-only import still needs a declaration: `tsc` resolves it, and the package is
   absent from a `--omit=dev` image. Revert with `git checkout --`.
3. **Dev scope:** append `import 'left-pad';` to `services/messaging-service/tests/regression/messageService.test.ts`.
   Expect `services/messaging-service: left-pad (tests/regression/messageService.test.ts)` under the **dev** test and
   not the runtime test. Revert with `git checkout --`.
4. **A devDependency does not satisfy runtime:** in `services/messaging-service/package.json` move `"cors": "^2.8.5"`
   from `dependencies` to `devDependencies`. Expect the runtime test to list `services/messaging-service: cors (src/index.ts)`
   **and** the mirror test to list `services/messaging-service dependencies` and `… devDependencies`. Revert with `git checkout --`.
5. **Ranges:** set messaging's `"pg"` to `"^9.0.0"`. Expect `services/messaging-service dependencies: pg@^9.0.0 resolves 8.23.0`
   (plus mirror drift). Revert with `git checkout --`.
6. **Stale allowlist:** add `'packages/shared: left-pad (api/client.ts)': 'probe',` to `ALLOWLIST`. Expect the stale-entry
   test to list that key. Remove the line by hand.
7. **Discovery:** temporarily change `names('apps/frontend')).toContain('next')` to `toContain('nextx')`. Expect that test to fail. Restore.

- [ ] **Step 5: Commit the red gate**

```bash
git add tests/regression/sprint-131-workspace-declarations.test.ts
git commit -F- <<'EOF'
test(gates): repo-wide declare-what-you-import gate (BUG-046), red

Imports come from a TypeScript AST walk over tracked files (preProcessFile
misses require() in a template interpolation; type queries need
isImportTypeNode), aliases from tsconfig paths,
resolution from package-lock.json. Red: 2 failed / 6 passed, 95 runtime
and 94 dev-scope violations, matching the planning inventory. Each passing
assertion was proven able to fail by a reverted injection.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```
(Not pushed. The pre-push suite would block on this commit alone, which is expected until Task 3.)

---

## Task 2: Declare the eight services' imports; splice their lock nodes

**Files:**
- Modify: `services/{auth,cleanup,community,notification,reputation,request,simulation,social-graph}-service/package.json`
- Splice: `package-lock.json` (those eight `packages["services/*"]` nodes only)
- Scratchpad (not the repo): `declare-b2.js`

**Interfaces:**
- Consumes: the Task 1 gate and its test names.
- Produces: `declare-b2.js <phase>` (`services` | `rest`), reused by Task 3.

- [ ] **Step 1: Read local context**

Skim the `.claude/README.md` for each of the eight services for any manifest rules. Then run
`node scripts/gotcha-check.js --for package-lock.json services/auth-service/package.json packages/shared/package.json apps/frontend/package.json tests/package.json`
(planning found none; re-run in case one landed).

- [ ] **Step 2: Write the declaration + splice script**

Create `$SCRATCH/declare-b2.js` with the Write tool:

```js
// Usage (repo root): node declare-b2.js services|rest
// Adds declarations to EXISTING manifest fields (key-sorted), then copies each changed field into the
// workspace's package-lock.json node. Refuses anything that isn't a pure addition.
const fs = require('fs');

const R = {
  bull: '^4.11.5', cors: '^2.8.5', dotenv: '^16.3.1', express: '^5.2.1', jsonwebtoken: '^9.0.2', pg: '^8.23.0',
};
const PHASES = {
  services: {
    'services/auth-service': { dependencies: { cors: R.cors, dotenv: R.dotenv, express: R.express, jsonwebtoken: R.jsonwebtoken, pg: R.pg } },
    'services/cleanup-service': { dependencies: { cors: R.cors, dotenv: R.dotenv, express: R.express, 'express-rate-limit': '^8.2.2', jsonwebtoken: R.jsonwebtoken, pg: R.pg, winston: '^3.18.3' } },
    'services/community-service': { dependencies: { cors: R.cors, dotenv: R.dotenv, express: R.express, jsonwebtoken: R.jsonwebtoken, pg: R.pg } },
    'services/notification-service': { dependencies: { bull: R.bull, cors: R.cors, dotenv: R.dotenv, express: R.express, pg: R.pg }, devDependencies: { jsonwebtoken: R.jsonwebtoken } },
    'services/reputation-service': { dependencies: { bull: R.bull, cors: R.cors, dotenv: R.dotenv, express: R.express, ioredis: '^5.11.1', pg: R.pg }, devDependencies: { jsonwebtoken: R.jsonwebtoken } },
    'services/request-service': { dependencies: { cors: R.cors, dotenv: R.dotenv, express: R.express, jsonwebtoken: R.jsonwebtoken, pg: R.pg } },
    'services/simulation-service': { dependencies: { bcryptjs: '^2.4.3' } },
    'services/social-graph-service': { dependencies: { bull: R.bull, cors: R.cors, express: R.express, pg: R.pg }, devDependencies: { '@jest/globals': '^30.4.1', jsonwebtoken: R.jsonwebtoken } },
  },
  rest: {
    'packages/shared': { dependencies: { bull: R.bull, jsonwebtoken: R.jsonwebtoken }, peerDependencies: { pg: R.pg } },
    'apps/frontend': { devDependencies: { '@jest/globals': '^30.4.1' } },
    tests: { devDependencies: { '@karmyq/shared': '*', axios: '^1.20.0', 'jest-cli': '^30.5.1' } },
  },
};

const phase = PHASES[process.argv[2]];
if (!phase) throw new Error('usage: node declare-b2.js services|rest');

const readLf = (path) => {
  const raw = fs.readFileSync(path, 'utf8');
  if (raw.includes('\r\n')) throw new Error(`${path} is CRLF; stop and investigate`);
  if (JSON.stringify(JSON.parse(raw), null, 2) + '\n' !== raw) throw new Error(`${path} does not round-trip; stop`);
  return JSON.parse(raw);
};
const sortKeys = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

const lock = readLf('package-lock.json');
for (const [ws, fields] of Object.entries(phase)) {
  const path = `${ws}/package.json`;
  const pkg = readLf(path);
  const node = lock.packages[ws];
  for (const [field, adds] of Object.entries(fields)) {
    if (!pkg[field] || !node?.[field]) throw new Error(`${ws} lacks an existing ${field} (manifest or lock node)`);
    for (const [name, range] of Object.entries(adds)) {
      for (const f of ['dependencies', 'devDependencies', 'peerDependencies']) {
        if (pkg[f]?.[name]) throw new Error(`${ws} already declares ${name} in ${f}`);
      }
      pkg[field][name] = range;
    }
    pkg[field] = sortKeys(pkg[field]); // reassigning an existing key keeps its position
    node[field] = pkg[field];
  }
  fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
}
fs.writeFileSync('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
console.log('declared', Object.keys(phase).join(', '));
```

- [ ] **Step 3: Apply the services phase and inspect the diff**

```bash
node "$SCRATCH/declare-b2.js" services
git diff --stat
```
Expected: exactly the 8 service manifests and `package-lock.json`. Then prove the diff is pure addition
(a removed line may only reappear with a trailing comma, when an entry was appended after it):
```bash
node -e "
const d=require('child_process').execFileSync('git',['diff','-U0','--','services','package-lock.json'],{encoding:'utf8'}).split('\n');
const plus=d.filter(l=>/^\+[^+]/.test(l)).map(l=>l.slice(1)), minus=d.filter(l=>/^-[^-]/.test(l)).map(l=>l.slice(1));
const bad=minus.filter(m=>!plus.includes(m+','));
console.log('added',plus.length,'removed',minus.length,'unexplained removals',bad);
process.exit(bad.length?1:0)"; echo "exit $?"
```
Expected: exit 0, **no unexplained removals**. Added lines: **84 + removed** (42 declarations × 2 files, plus
one re-commaed copy of each removed line). Every hunk in `package-lock.json` must sit inside a
`"services/<name>-service": {` node. Check with `git diff -- package-lock.json` and read it. Anything else → `git checkout -- .` and investigate.

- [ ] **Step 4: Strict install must accept the lock unchanged**

```bash
git hash-object package-lock.json > "$SCRATCH/lock-hash-before"
npx -y npm@11.19.0 ci > "$SCRATCH/ci-services.log" 2>&1; echo "exit $?"
git hash-object package-lock.json | diff - "$SCRATCH/lock-hash-before" && echo "lock untouched by ci"
```
Expected: exit 0 and `lock untouched by ci`. A non-zero exit → read the log. Do **not** "fix" it with any install
command; stop and report.

- [ ] **Step 5: Run the gate — services green, shared/frontend/tests still red**

Run the Task 1 Step 3 command. Expected: **2 failed / 6 passed**, now with **3** runtime entries (all `packages/shared`:
bull, jsonwebtoken, pg) and **14** dev entries (none under `services/`). The range and mirror tests pass.
Any `services/` entry left → the script table missed it. Fix the table, `git checkout -- .`, re-run from Step 3.

- [ ] **Step 6: Commit**

```bash
git add services/*/package.json package-lock.json
git commit -F- <<'EOF'
fix(deps): declare imported packages in eight services (BUG-046)

auth, cleanup, community, notification, reputation, request, simulation and
social-graph imported packages they never declared, surviving on root hoisting.
Declared at root's exact ranges; every range is already satisfied by the
resolved hoisted version, so the lock changes only in the eight workspace
nodes (no new package nodes, no version change). Strict npm@11.19.0 ci exit 0
without rewriting the lock. Gate: runtime 95 -> 3, dev 94 -> 14 (remaining
entries are shared, frontend and tests: next commit).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```
The pre-commit hook runs `scripts/analyze-services.js` when service manifests change. If it modifies
`services/dependency-graph.md`/`services/impact-analysis.md`, include those generated files in this commit
(`git add` + `git commit --amend --no-edit` is fine here: local, unpushed).

---

## Task 3: Declare shared, frontend and tests imports; retire the messaging gate

**Files:**
- Modify: `packages/shared/package.json`, `apps/frontend/package.json`, `tests/package.json`
- Splice: `package-lock.json` (`packages["packages/shared"]`, `packages["apps/frontend"]`, `packages["tests"]` only)
- Delete: `tests/regression/sprint-131-messaging-declarations.test.ts`

**Interfaces:**
- Consumes: `declare-b2.js rest` (Task 2), the gate (Task 1).

- [ ] **Step 1: Read local context**

Read `packages/claude.md`, `packages/shared/CONTEXT.md` ("Express 5 peer contract"), `apps/frontend/claude.md`
and `tests/claude.md`. Note `.npmrc` `legacy-peer-deps=true`: `apps/frontend` already consumes shared without
providing its Express peer, and `pg` joins that same known, silenced gap. Do not "fix" it here.

- [ ] **Step 2: Apply the rest phase, inspect the diff**

```bash
node "$SCRATCH/declare-b2.js" rest
git diff --stat
```
Expected: `packages/shared/package.json`, `apps/frontend/package.json`, `tests/package.json`, `package-lock.json`.
Run the Task 2 Step 3 pure-addition check with the pathspec `packages apps tests package-lock.json`.
Expected: no unexplained removals. There are 7 declarations × 2 files, and the lock hunks sit only inside the
`"packages/shared"`, `"apps/frontend"` and `"tests"` nodes.

- [ ] **Step 3: Strict install, lock untouched, `npm ls` no worse**

Run Task 2 Step 4 (logging to `ci-rest.log`). Expected: exit 0 and `lock untouched by ci`. `apps/*` resolution is where
Windows installs have half-resolved before, so read the log for warnings about `apps/frontend`.

```bash
lsproblems () { grep -E "^npm error (code|invalid|missing|extraneous|peer dep)" "$1" | sort; }
npx -y npm@11.19.0 ls --all > "$SCRATCH/ls-after.out" 2> "$SCRATCH/ls-after.err"; echo "exit $?"
lsproblems "$SCRATCH/ls-after.err" | diff "$SCRATCH/ls-before.errors" - && echo "npm ls dependency problems unchanged"
```
Expected: `npm ls dependency problems unchanged` (exit code still 1 from BUG-047). A new problem line (e.g. an unmet `pg` peer
under `apps/frontend`) → stop and report it with the line; do not suppress it.

- [ ] **Step 4: The gate goes fully green**

Run the Task 1 Step 3 command. Expected: exit 0, **8 passed**.

- [ ] **Step 5: Retire the messaging-only gate and prove nothing it checked is lost**

Everything `sprint-131-messaging-declarations.test.ts` asserted is now covered repo-wide. Its import scan,
production-scope check, range satisfaction and lock mirror all carry over. Its "shares root ranges exactly" check is deliberately
**not** carried over: eleven existing declarations differ from root (measured 2026-09-17, basis: every workspace's
`dependencies` + `devDependencies` against root `dependencies` + `devDependencies`; counting shared's
`peerDependencies.express ^5.0.0` too makes it twelve), e.g. `simulation dotenv ^16.3.0`,
`geocoding express-rate-limit ^7.0.0` nested, `shared zod ^3.22.4` nested, several on purpose; and the range-satisfaction check already fails whenever a root bump leaves a
workspace range behind, which is the protection that matters. Record that reasoning in the commit.

```bash
git rm tests/regression/sprint-131-messaging-declarations.test.ts
git grep -n "sprint-131-messaging-declarations" -- ':!docs/superpowers/plans/2026-09-16-sprint-131-pr-b-test-readiness.md'
```
Expected remaining hits: `docs/BUGS.md` ×2, `services/messaging-service/CONTEXT.md`, its landing JSON, and the handoff.
Task 4 updates the first two and the CONTEXT file. The JSON regenerates. The handoff is historical.

Re-run injection 1 from Task 1 Step 4 (the `left-pad` import into messaging `src/index.ts`) against the green gate to
prove messaging is still covered after the deletion. Expect exactly that one runtime entry, then revert.

- [ ] **Step 6: Turbo now builds shared before the tests workspace**

```bash
npx turbo run test --filter=@karmyq/tests --dry=json > "$SCRATCH/turbo-after.json" 2>/dev/null; echo "exit $?"
node -e "const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));console.log(j.tasks.map(t=>t.taskId+' <- '+JSON.stringify(t.dependencies)).join('\n'))" "$SCRATCH/turbo-after.json"
```
Expected: the task list now includes `@karmyq/shared#build`, and `@karmyq/tests#build <- ["@karmyq/shared#build"]`
(before: `[]`). That is the correct build order for the two root regression tests importing `@karmyq/shared`.
Record it for the PR body.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/package.json apps/frontend/package.json tests/package.json package-lock.json
git commit -F- <<'EOF'
fix(deps): declare shared, frontend and tests imports; retire messaging gate (BUG-046)

packages/shared: bull and jsonwebtoken (runtime value imports) as dependencies;
pg as a peerDependency, because middleware/dbContext uses Pool only as a
parameter type and the consumer constructs it (same contract as Express).
api/client.ts and api/mobile-storage.ts stay allowlisted: two of the three
api/ files tsconfig excludes from the build (ADR-028); web-storage.ts imports
no package.
apps/frontend: @jest/globals (tdd tests). tests: @karmyq/shared, axios,
jest-cli. Lock changes only in those three workspace nodes; strict
npm@11.19.0 ci exit 0 without rewriting it; npm ls errors unchanged (BUG-047).
Turbo now builds @karmyq/shared before @karmyq/tests.

The repo-wide gate is green (8/8) and subsumes
sprint-131-messaging-declarations. Its root-range equality check is dropped on
purpose: range satisfaction already fails when a root bump strands a
workspace range, and several existing ranges differ from root legitimately.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

## Task 4: Documentation

**Files:**
- Modify: 8 service `CONTEXT.md`, `packages/shared/CONTEXT.md`, `services/messaging-service/CONTEXT.md`, `docs/BUGS.md`, `docs/guides/testing-guide.md`
- Regenerate: `apps/landing/src/data/docs/services/*.json` (content only)

- [ ] **Step 1: Service CONTEXT.md sections**

Append to each of the 8 service `CONTEXT.md` files (at the end, matching the dated-section style), with that
service's own package list from the *Declarations to add* table:

```markdown
## Sprint 131 PR B2 — declared imports (2026-09-17)

Now declares `<runtime packages>` in `dependencies`<, and `<test packages>` in `devDependencies`> at root's exact
ranges (BUG-046). They were imported but undeclared, resolving only through root hoisting. Resolved versions are
unchanged. `tests/regression/sprint-131-workspace-declarations.test.ts` fails on any undeclared import, and fails
its range check if root bumps a major without this manifest, so a root dependency bump (e.g. D1 dotenv 17) must
bump this manifest in the same PR.

No endpoint, payload, event or schema change.
```

- [ ] **Step 2: Shared CONTEXT.md**

Add a section after "Express 5 peer contract":

```markdown
## Declared imports (Sprint 131 PR B2, 2026-09-17)

`bull` (`events/publisher.ts`) and `jsonwebtoken` (`middleware/auth.ts`) are now `dependencies` at root's ranges.
**`pg` is a `peerDependency` (`^8.23.0`)**: `middleware/dbContext.ts` uses `Pool` only as a parameter type, and the
consuming service constructs the pool. This is the same single-provider contract as Express above. As with Express,
`apps/frontend` doesn't provide it, and `.npmrc` `legacy-peer-deps=true` silences that. The peer covers the runtime
package only: the `Pool` type resolves from `@types/pg` (this package's `devDependencies`).

This package's build excludes three `api/` files (`tsconfig.json` `exclude`, ADR-028). Two of them, `api/client.ts`
(axios) and `api/mobile-storage.ts` (`@react-native-async-storage/async-storage`), still import undeclared packages, so
they are the only allowlist entries in `tests/regression/sprint-131-workspace-declarations.test.ts`. That gate fails if they
stop being violations, so delete an entry when its file is fixed or removed.
```

- [ ] **Step 3: Messaging CONTEXT.md reference**

In `services/messaging-service/CONTEXT.md` (Sprint 131 PR B section, "Declarations" paragraph), replace
`` `tests/regression/sprint-131-messaging-declarations.test.ts` fails on any undeclared import. `` with
`` `tests/regression/sprint-131-workspace-declarations.test.ts` (repo-wide since PR B2) fails on any undeclared import. ``

- [ ] **Step 4: BUGS.md**

- `docs/BUGS.md:582` (BUG-034 entry): same filename replacement as Step 3.
- BUG-046 heading: `open` → `fixed`. Replace the "Caveats… **UNVERIFIED**" paragraph with a **Resolution** paragraph.
  It must state the re-measurement (TypeScript AST walk, tracked files, tsconfig aliases; 95 runtime + 94 dev-scope
  violations; the 8-service table confirmed), the widened scope (shared runtime incl. the `pg` peer; test/tooling scope
  in notification/reputation/social-graph, frontend, tests), the 2 allowlisted build-excluded shared files, the gate
  path, and "no resolved version changed". Also update the line-1093 messaging gate reference.

- [ ] **Step 5: Testing guide**

Add to `docs/guides/testing-guide.md`, before "Don't trust a suspiciously-green run after deletes or renames":

```markdown
## Declare what you import — the workspace declarations gate

`tests/regression/sprint-131-workspace-declarations.test.ts` (blocking) reads every tracked source file in every
workspace and fails when a file imports a package its own `package.json` doesn't declare. Root hoisting makes an
undeclared import work locally until a root bump de-hoists or changes it.

- **Shipping code** (anything not in `tests/`, `e2e/`, `__tests__/`, `__mocks__/`, a `*.test.*`/`*.spec.*` file, or a
  jest/eslint/playwright config) must use `dependencies` or `peerDependencies`. Images install with `--omit=dev`.
- **Tests and tooling** may use `devDependencies`.
- Use root's exact range when root declares the package. The gate also fails when a declared range isn't satisfied
  by the version `package-lock.json` resolves, so bumping a root major means bumping every workspace that declares it.
- After editing a manifest, splice the same field into that workspace's `package-lock.json` node and prove it with
  `npx -y npm@11.19.0 ci` (see CLAUDE.md "Workspace dependencies"). The gate checks that the two mirror each other.
- The range check covers **every** existing declaration in every workspace, not just the ones your diff adds. If it goes
  red on a change that doesn't touch that manifest, your change moved a resolved version in `package-lock.json` and
  stranded someone else's range. Fix that range in the same PR; the gate is not reporting a regression in your own code.
- Path aliases come from `tsconfig.json` `paths`. Only a file that is really never built belongs on the gate's allowlist.
```

- [ ] **Step 6: Regenerate landing docs, keep content diffs only**

```bash
npm run feedback:check
npm test -- --concurrency=1 --force > "$SCRATCH/npm-test-docs.log" 2>&1; echo "exit $?"
git status --short
```
Expected: exit 0. `apps/landing/src/data/docs/services/<9 services>.json` and the shared/testing-guide JSON (if generated)
show **content** changes matching Steps 1–5. Revert pure timestamp/HEAD-sha churn (`architecture.json` generated time,
`build.json` sha/dates) with `git checkout -- <file>`. If the TDD promoter moved any unrelated `tests/tdd/*` file,
restore it (`git checkout -- <old path>` and delete the new copy). Note that `feedback:check` reads only
`git diff --cached`, so run it again after staging.

- [ ] **Step 7: Process review and commit**

Invoke the `pre-commit-check` skill (process-reviewer + tests + feedback loop). Resolve findings. Then:
```bash
git add services/*/CONTEXT.md packages/shared/CONTEXT.md docs/BUGS.md docs/guides/testing-guide.md apps/landing/src/data/docs
npm run feedback:check
git commit -F- <<'EOF'
docs: record declared imports and the repo-wide declarations gate (BUG-046)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```
Confirm that no new guide, onboarding workflow, ADR, registry or nginx change is needed: no behavior, endpoint, schema,
event or service-dependency change. `services/registry.json` `dependencies` lists services/infrastructure, not npm
packages. State this in the PR body.

---

## Task 5: Gates, version, push, PR, CI evidence, handoff

This diff touches 11 manifests, the lockfile and a blocking repo-wide gate, so calibrate the gates **high**.

- [ ] **Step 1: SDLC gates on the branch diff**

`/simplify` (one pass), then `/code-review high`, then `/security-review`. For the security review, confirm the lock
diff adds no `resolved`/`integrity` lines, and the gate executes nothing from the files it scans (`createSourceFile` only
parses). Resolve findings or dismiss them with written justification in the handoff. Re-run `/code-review` on the final
diff if the first pass led to code changes.

- [ ] **Step 2: Full blocking suite, forced; inspect what it moved**

```bash
npm test -- --concurrency=1 --force > "$SCRATCH/npm-test-final.log" 2>&1; echo "exit $?"
grep -E "Tasks:|Failed:" "$SCRATCH/npm-test-final.log"; git status --short
```
Expected: exit 0, all Turbo tasks successful (27/27 at PR B; the count may rise by one for `@karmyq/shared#build` in the
tests pipeline, so report the real number). Revert landing churn and any promoter moves as in Task 4 Step 6. A lone red
in a different workspace each run is the known Turbo parallel-timeout flake: re-run that package alone before debugging.

- [ ] **Step 3: Version from live master**

```bash
git fetch origin && git show origin/master:package.json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).version))"
```
If `11.57.0`, set root `package.json` `version` to `11.58.0` (Edit tool, that line only). Do not touch the lockfile's
root `version` field. If master moved, merge `origin/master` (merge commit, never rebase) and re-run Task 3 Step 3's
`npm ci` proof and the gate before bumping.

- [ ] **Step 4: Handoff, then push and open the PR**

Update `.claude/handoff/CURRENT_HANDOFF.md` **before** pushing. Mark B2 in progress with the PR, record the gate results
(red counts, injections, green), the npm ci and `npm ls` evidence, the Turbo edge, the gate findings, and next = CI evidence
→ merge authorization → B3. Commit (`chore: bump version to 11.58.0 for Sprint 131 PR B2, update handoff`), then:

```bash
git push -u origin agent/claude/sprint-131-undeclared-imports
```
A push that returns instantly and silently means no hook ran (see CLAUDE.md Discipline 3). Stop and check `core.hooksPath`.

Open the PR with `gh pr create` (body in a quoted heredoc; follow `pr-contract.yml` headers; check
`.github/pull_request_template.md`). Include: scope (BUG-046 + the two 2026-09-17 widenings), declarations table,
"no resolved version changed / no new lock package nodes", the Turbo edge, the downstream D-series effect (root bumps must
bump workspace declarations), docs touched, and the attribution footer.

- [ ] **Step 5: CI evidence from logs, not ticks**

For the PR head, confirm from job logs:
- **Install:** the CI `npm ci` step succeeded (strict lock acceptance on Linux).
- **Test Backend Services / root regression:** `PASS … regression/sprint-131-workspace-declarations.test.ts` with 8 tests.
- **Lint & Type Check:** success.
- **Test Docker Build:** the auth-service and frontend images built (their Dockerfiles `npm install` against the changed
  manifests), and the healthcheck wait reported Healthy.
- **Integration Tests:** success.
- **Code Scanning Gate / dependency audit (ADR-059):** success. Expect no new advisories, because no resolved version changed. A red audit
  on this diff means an advisory published mid-flight (see memory), not this change.

Record run IDs and the lines in the handoff (commit on the branch, before asking for merge authorization).

- [ ] **Step 6: Merge only on explicit authorization**

Check that no master run is in flight and that no other non-Dependabot PR is merging. Ask the maintainer for merge authorization. On an explicit
"authorize", run `gh pr merge <N> --squash --admin`, verify `state == MERGED`, then watch the master CI/CD run through **Deploy to Demo**
(health verified, no rollback). Smoke: `POST https://karmyq.com/api/auth/login` (Node fetch) → 200. Then update the handoff:
B2 shipped, next = B3 (Expo drift; re-run `npx expo install --check` first), then D1. Archive nothing (the sprint continues).

---

## Self-review notes (planning)

- **Spec coverage:** BUG-046's two decisions (declare in 8 services at root ranges with surgical splice + strict ci;
  generalize the gate with an allowlist) → Tasks 2 and 1/3. Both 2026-09-17 widenings → Task 3. Docs feedback loop → Task 4.
  The four SDLC gates, version and merge discipline → Task 5.
- **Gate honesty:** each passing assertion has its own injection (Task 1 Step 4). The allowlist has a stale check. Discovery
  asserts per-workspace non-emptiness plus known imports, not a total count. The dropped root-equality check is justified in writing.
- **Red verified in planning (re-run after each scanner change):** the literal Task 1 gate code, extracted from this
  file into a temporary `tests/regression/` copy, ran **2 failed / 6 passed of 8** with **95** runtime and **94** dev
  entries. Those counts are identical across all three scanner versions (`preProcessFile`, the AST walk, and the AST walk
  with `isImportTypeNode`), so neither fix changed a measurement: the repo contains no type-position `import()` today and
  only 4 missed `require()` literals, all aliases, relative paths or builtins. Two injections into
  `services/messaging-service/src/index.ts` each produced exactly `services/messaging-service: left-pad (src/index.ts)`:
  `` const leak = `${require("left-pad")}`; `` (invisible to `preProcessFile`) and `type Leak = import("left-pad").Foo;`
  (invisible to an AST walk without `isImportTypeNode`). Copies and injections were reverted. The post-Task-2 (3/14) and
  green (0/0) counts come from the same logic applied to in-memory manifests, so they are **not yet executed**, and
  strict `npm ci` remains unverified until Task 2.
- **Known limits (state in the PR):** the walk sees static specifiers only — not `require.resolve('x')`,
  `jest.mock('x')` without a matching import, or a computed specifier (`require(name)`). A locally shadowed
  `require` parameter would be reported as an import (no such case in the repo today). `jsx`/`js` files outside tracked source aren't scanned. The `DEV_ONLY` path rule is a convention, so a
  shipping file placed under a `tests/` directory would be under-checked.
