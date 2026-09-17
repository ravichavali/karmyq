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
