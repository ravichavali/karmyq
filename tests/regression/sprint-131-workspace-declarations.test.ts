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
 * Scopes: a file that never ships (tests, __tests__/__mocks__, *.test/*.spec, build-tooling config,
 * the whole tests workspace) may satisfy an import from devDependencies. Everything else is runtime
 * and needs dependencies — or, for a library in packages/, a peerDependency — because the
 * Dockerfiles install --omit=dev.
 *
 * Known limits, all deliberate and none with a live instance today:
 * - A type-only import counts as RUNTIME. TypeScript erases it, so strictly it could be a
 *   devDependency; this gate stays conservative because `tsc` must still resolve it and the
 *   over-requirement is a declaration, not a shipped package (shared's `pg` is a peer, not a dep).
 *   The cost is that a future build-time-only `import type` is pushed into `dependencies`.
 * - Only STATIC specifiers are seen. `require.resolve('pkg')`, `jest.mock('pkg')` without a
 *   matching import, and any computed specifier (`require(name)`) are invisible.
 * - A locally shadowed `require` parameter would be reported as an import.
 * - The dev/runtime split is a path convention, so a shipping file placed under a `tests/`
 *   directory would be under-checked.
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

/**
 * Paths that never ship, so a devDependency satisfies them.
 *
 * The build-tooling configs matter as much as the test paths: `next`, `postcss`, `tailwind`,
 * `babel`, `metro` and pm2's `ecosystem` configs run on a build machine, never inside a
 * `--omit=dev` image, so requiring them to declare at runtime scope would push build-only packages
 * into production `dependencies`. Seven such files exist today: `next.config.js` and
 * `postcss.config.js` in both `apps/frontend` and `apps/landing`, `babel.config.js` and
 * `metro.config.js` in `apps/mobile`, and `ecosystem.config.js` in `services/simulation-service`.
 */
const DEV_ONLY =
  /^(tests|e2e)\/|(^|\/)__(tests|mocks)__\/|\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)(jest|eslint|playwright|next|postcss|tailwind|babel|metro|ecosystem)\.(config|setup)\.[cm]?[jt]sx?$/;

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

/**
 * Declarations knowingly stranded off root's hoisted copy, keyed `ws field: name@range`. Every entry
 * must still be a divergence (see the stale-entry test), so this list can only shrink.
 *
 * These are deliberate holdbacks, not accidents: shared and geocoding stayed on express-rate-limit 7
 * and shared on zod 3 while root moved ahead.
 */
const DIVERGENCE_ALLOWLIST: Record<string, string> = {
  'packages/shared dependencies: express-rate-limit@^7.1.5':
    'deliberately held at 7 while root is on 8; npm nests 7.5.1 under this workspace',
  'packages/shared dependencies: zod@^3.22.4':
    'deliberately held at 3 while root is on 4; npm nests 3.25.76 under this workspace',
  'services/geocoding-service dependencies: express-rate-limit@^7.0.0':
    'deliberately held at 7 while root is on 8; npm nests 7.5.1 under this workspace',
};

const packageName = (spec: string): string =>
  spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];

const SOURCE_EXTS = ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'];
const GENERATED = /(^|\/)(dist|\.next|build)\//;

/**
 * One `git ls-files` for the whole repo, bucketed per workspace in JS.
 *
 * A spawn costs ~41ms on Windows regardless of how narrow the pathspec is, and the previous shape
 * (one spawn per workspace in importsOf, another in pathAliases) cost 30 spawns / ~1.2s — more than
 * parsing all 987 files. Git is still the arbiter of what is tracked; only the extension and prefix
 * filtering moved into JS. Verified to select exactly the same 987 files, with the same
 * workspace assignment, as the per-workspace pathspecs it replaces.
 *
 * There is deliberately NO "skip files whose text lacks import/require" prefilter: 5 of the 103
 * files that would skip contain `export … from '…'`, which is a real import this gate must see, so
 * a barrel re-exporting an undeclared package would pass invisibly. The ~60ms is not worth that.
 */
const trackedPaths = tracked();
const trackedSet = new Set(trackedPaths);
const sourceFiles = trackedPaths.filter(
  (file) => SOURCE_EXTS.includes(file.slice(file.lastIndexOf('.') + 1)) && !GENERATED.test(file),
);

function pathAliases(ws: string): string[] {
  // `ts.readConfigFile` does not resolve `extends`; no workspace keeps its `paths` in a base config
  // today (apps/mobile extends expo/tsconfig.base but declares its own).
  if (!trackedSet.has(`${ws}/tsconfig.json`)) return [];
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
 * superset of the pre-processor over this repo, and costs ~1.2s for the 987 workspace source files it
 * scans (1020 are tracked repo-wide; this gate never sees scripts/, infrastructure/ or root files). It also covers
 * type-only positions (`import('pkg').T`, `typeof import('pkg')`), which the pre-processor drops.
 */
function specifiersOf(file: string, source: string): string[] {
  const kind = SCRIPT_KIND[file.slice(file.lastIndexOf('.'))] ?? ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, false, kind);
  const found = new Set<string>();
  const add = (node?: ts.Node): void => {
    if (node && ts.isStringLiteralLike(node)) found.add(node.text);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      add(node.moduleSpecifier);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      add(node.moduleReference.expression);
    } else if (ts.isImportTypeNode(node) && node.argument && ts.isLiteralTypeNode(node.argument)) {
      // Type queries: `type T = import('pkg').X`, `typeof import('pkg')`, `Map<string, import('pkg').X>`.
      add(node.argument.literal);
    } else if (ts.isCallExpression(node)) {
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      if (isRequire || isDynamicImport) add(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return [...found];
}

type Import = { key: string; name: string; devOnly: boolean };

function importsOf(ws: string): Import[] {
  const aliases = pathAliases(ws);
  const files = sourceFiles.filter((file) => file.startsWith(`${ws}/`));
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

/**
 * Declared ranges that root's HOISTED copy no longer satisfies.
 *
 * Deliberately ignores the workspace-nested node that the range-satisfaction test below consults.
 * That test cannot detect a de-hoist: when a root bump strands a workspace range, npm's answer is to
 * nest a satisfying older copy under that workspace, so satisfaction still holds and the check stays
 * green (live proof: root hoists express-rate-limit 8.5.2 while packages/shared and
 * services/geocoding-service each run a nested 7.5.1). Comparing against root's hoisted version is
 * what actually fails when a root-only major bump would strand a workspace.
 */
function strandedFromRoot(): Array<{ key: string; detail: string }> {
  const rootPkg = JSON.parse(read('package.json')) as Manifest;
  const rootDeclares = { ...rootPkg.dependencies, ...rootPkg.devDependencies };
  return workspaces.flatMap(({ ws, pkg }) =>
    FIELDS.flatMap((field) =>
      Object.entries(pkg[field] ?? {}).flatMap(([name, range]) => {
        if (!rootDeclares[name]) return []; // root doesn't declare it, so there is nothing to strand from
        const hoisted = lock.packages[`node_modules/${name}`];
        if (!hoisted?.version) return [];
        const key = `${ws} ${field}: ${name}@${range}`;
        return semver.satisfies(hoisted.version, range)
          ? []
          : [{ key, detail: `${key} vs root-hoisted ${hoisted.version}` }];
      }),
    ),
  );
}

/**
 * A `peerDependency` only counts as a runtime declaration for a LIBRARY workspace (`packages/*`).
 *
 * `.npmrc` sets `legacy-peer-deps=true`, so npm never installs a peer — the consumer provides it.
 * That is a real contract for a package others depend on (shared's `express` and `pg`), but for a
 * service or app, which is a leaf that ships its own image, nothing downstream provides anything.
 * Accepting a peer there would let a workspace satisfy this gate while the import still resolved
 * purely through root hoisting, which is precisely BUG-046.
 */
const peerCountsAsRuntime = (ws: string): boolean => ws.startsWith('packages/');

function undeclared(devOnly: boolean): string[] {
  return workspaces.flatMap(({ ws, pkg, imports }) =>
    imports
      .filter((i) => i.devOnly === devOnly)
      .filter(
        (i) =>
          !pkg.dependencies?.[i.name] &&
          !(peerCountsAsRuntime(ws) && pkg.peerDependencies?.[i.name]) &&
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

  it("a root bump cannot silently strand a workspace: root's hoisted copy satisfies every range it also declares", () => {
    const stranded = strandedFromRoot()
      .filter(({ key }) => !(key in DIVERGENCE_ALLOWLIST))
      .map(({ detail }) => detail);
    expect(stranded).toEqual([]);
  });

  it('every divergence-allowlist entry is still a divergence, so that allowlist cannot go stale', () => {
    const stranded = new Set(strandedFromRoot().map(({ key }) => key));
    expect(Object.keys(DIVERGENCE_ALLOWLIST).filter((key) => !stranded.has(key))).toEqual([]);
  });

  it("each workspace's lockfile node mirrors its manifest", () => {
    // Reports the differing entries, not just the field: CLAUDE.md mandates hand-splicing
    // package-lock.json, so this fires on a typo or a missed entry and a bare "<ws> <field>" would
    // leave you reconstructing the diff by hand. Key order matters too (JSON.stringify comparison),
    // so a reordered field is reported even when the entries match.
    const drift = workspaces.flatMap(({ ws, pkg }) =>
      FIELDS.flatMap((field) => {
        const inLock = lock.packages[ws]?.[field] ?? {};
        const inManifest = pkg[field] ?? {};
        if (JSON.stringify(inLock) === JSON.stringify(inManifest)) return [];
        const names = [...new Set([...Object.keys(inLock), ...Object.keys(inManifest)])].sort();
        const differing = names
          .filter((name) => inLock[name] !== inManifest[name])
          .map((name) => `${name}: lock ${inLock[name] ?? '(absent)'} vs manifest ${inManifest[name] ?? '(absent)'}`);
        return [`${ws} ${field}: ${differing.length ? differing.join(', ') : 'same entries, different key order'}`];
      }),
    );
    expect(drift).toEqual([]);
  });
});
