import { spawn } from 'child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'fs';
import { join, relative, sep } from 'path';

import { JEST_BIN, ROOT, TEST_FILE_RE, allWorkspaces, jestInvocations, scratchDirs, testFilesUnder } from './helpers/workspaces';

/**
 * Sprint 139 — BUG-092: the WIP tier must not block, in the two services whose default `test`
 * script was a bare `jest` that also collected tests/tdd/ (and, for cleanup, tests/integration/).
 *
 * The tier-parity gate (sprint-122) proves COVERAGE — every blocking file runs — and deliberately
 * tolerates extra files. This gate proves the other half: the default selection is EXACTLY the
 * blocking tiers, so a red WIP test cannot fail a push, while a red blocking test still does.
 *
 * Evidence is real wherever it is read: the commands are expanded from each workspace's live
 * package.json, Jest itself is asked what it would run (`--listTests`), and the execution cases run
 * Jest over temporary copies of the workspace's real package.json and jest config with one marker
 * test per tier. Each marker writes a file when it runs, so "it ran" is observed, not inferred.
 */
const SERVICES = ['services/cleanup-service', 'services/simulation-service'] as const;
const BLOCKING = ['unit', 'regression'] as const;
const ALL_TIERS = ['unit', 'regression', 'tdd', 'integration'] as const;
type Tier = (typeof ALL_TIERS)[number];

const rel = (base: string, p: string) => relative(base, p).split(sep).join('/');
const readPkg = (dir: string) => JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));

/** The jest argv lists a script runs; throws if any `&&` part is not jest (nothing may hide). */
function strictInvocations(dir: string, script: string): string[][] {
  const pkg = readPkg(dir);
  const raw: string | undefined = pkg.scripts?.[script];
  if (!raw) throw new Error(`${rel(ROOT, dir)} has no "${script}" script`);
  const invocations = jestInvocations(pkg, script);
  if (invocations.length !== raw.split('&&').length) {
    throw new Error(`${rel(ROOT, dir)} "${script}" has a part that is not jest: ${raw}`);
  }
  return invocations;
}

type Run = { code: number | null; out: string; stdout: string };
/** Run a Node CLI (jest, turbo) by its bin path, never through a shell; keep merged and stdout-only output. */
function runNode(bin: string, cwd: string, args: string[], env: NodeJS.ProcessEnv = process.env): Promise<Run> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [bin, ...args], { cwd, env });
    let out = '';
    let stdout = '';
    child.stdout.on('data', (d) => { out += d; stdout += d; });
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => resolve({ code, out, stdout }));
  });
}
const runJest = (cwd: string, args: string[]) => runNode(JEST_BIN, cwd, args);

/** Jest's own answer to "which files would this script run", repo-relative to `base`. */
async function listedBy(dir: string, script: string, base: string): Promise<string[]> {
  const files: string[] = [];
  for (const args of strictInvocations(dir, script)) {
    const { code, out } = await runJest(dir, [...args, '--listTests']);
    if (code !== 0) throw new Error(`jest --listTests failed in ${dir} (${code}):\n${out}`);
    files.push(
      ...out
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => TEST_FILE_RE.test(l))
        .map((l) => rel(base, l)),
    );
  }
  return [...new Set(files)].sort();
}

/** Run a script the way npm runs `a && b`: in order, stopping at the first nonzero exit. */
async function runScript(dir: string, script: string): Promise<Run> {
  let out = '';
  for (const args of strictInvocations(dir, script)) {
    const r = await runJest(dir, args);
    out += r.out;
    if (r.code !== 0) return { code: r.code, out, stdout: '' };
  }
  return { code: 0, out, stdout: '' };
}

// ---------------------------------------------------------------------------------------------
// Temporary workspace copies
// ---------------------------------------------------------------------------------------------

const scratch = scratchDirs();
afterAll(scratch.cleanup);

/**
 * A throwaway copy of the workspace's real package.json + jest config (and the root jest config
 * they extend), with one marker test per tier. node_modules is a junction to the repo's, so the
 * copy resolves ts-jest exactly as the real workspace does. The prefix avoids every tier name so
 * a substring `--testPathPatterns` cannot match the temp path itself.
 */
function tempWorkspace(ws: string, failing: Tier[] = []): string {
  const root = scratch.make('karmyq-s139-boundary-'); // realpathed: Jest prints --listTests from the real rootDir
  copyFileSync(join(ROOT, 'jest.config.js'), join(root, 'jest.config.js'));
  mkdirSync(join(root, 'scripts'));
  copyFileSync(join(ROOT, 'scripts', 'jest-worker-cap.js'), join(root, 'scripts', 'jest-worker-cap.js'));
  symlinkSync(join(ROOT, 'node_modules'), join(root, 'node_modules'), 'junction');

  const dir = join(root, ws);
  mkdirSync(dir, { recursive: true });
  for (const f of ['package.json', 'jest.config.js', 'tsconfig.json']) {
    if (existsSync(join(ROOT, ws, f))) copyFileSync(join(ROOT, ws, f), join(dir, f));
  }
  for (const tier of ALL_TIERS) {
    const tierDir = join(dir, 'tests', tier);
    mkdirSync(tierDir, { recursive: true });
    const outcome = failing.includes(tier) ? 'fail' : 'pass';
    writeFileSync(
      join(tierDir, `s139-marker-${tier}.test.ts`),
      [
        "import { writeFileSync } from 'fs';",
        "import { join } from 'path';",
        '',
        `test('s139 ${tier} marker', () => {`,
        `  writeFileSync(join(__dirname, '..', '..', 'ran-${tier}'), '');`,
        `  expect('${outcome}').toBe('pass');`,
        '});',
        '',
      ].join('\n'),
    );
  }
  return dir;
}

const ran = (dir: string): Tier[] => ALL_TIERS.filter((t) => existsSync(join(dir, `ran-${t}`)));
const markerPath = (tier: Tier) => `tests/${tier}/s139-marker-${tier}.test.ts`;

// ---------------------------------------------------------------------------------------------

describe.each(SERVICES)('%s: the default test script selects exactly the blocking tiers', (ws) => {
  const dir = join(ROOT, ws);

  it('real tree: default `test` lists every unit/ and regression/ file and nothing else', async () => {
    const onDisk = BLOCKING.flatMap((t) => testFilesUnder(join(dir, 'tests', t)))
      .map((p) => rel(ROOT, p))
      .sort();
    expect(onDisk.length).toBeGreaterThan(0);
    expect(await listedBy(dir, 'test', ROOT)).toEqual(onDisk);
  }, 120_000);

  it('real tree: explicit `test:tdd` lists every tests/tdd file', async () => {
    const wip = testFilesUnder(join(dir, 'tests', 'tdd')).map((p) => rel(ROOT, p)).sort();
    expect(await listedBy(dir, 'test:tdd', ROOT)).toEqual(wip);
  }, 120_000);

  it('marker copy: default lists the unit and regression markers only; test:tdd lists the tdd marker only', async () => {
    const copy = tempWorkspace(ws);
    expect(await listedBy(copy, 'test', copy)).toEqual([markerPath('regression'), markerPath('unit')]);
    expect(await listedBy(copy, 'test:tdd', copy)).toEqual([markerPath('tdd')]);
  }, 120_000);

  it('marker copy: a red tdd marker does not fail the default test, and the blocking markers really ran', async () => {
    const copy = tempWorkspace(ws, ['tdd']);
    const r = await runScript(copy, 'test');
    expect({ code: r.code, ran: ran(copy) }).toEqual({ code: 0, ran: ['unit', 'regression'] });
  }, 120_000);

  it('marker copy: the same red tdd marker fails an explicit test:tdd run, which runs only it', async () => {
    const copy = tempWorkspace(ws, ['tdd']);
    const r = await runScript(copy, 'test:tdd');
    expect({ failed: r.code !== 0, ran: ran(copy) }).toEqual({ failed: true, ran: ['tdd'] });
    expect(r.out).toMatch(/s139 tdd marker/);
  }, 120_000);

  it.each(BLOCKING)('marker copy: a red %s marker fails the default test', async (tier) => {
    const copy = tempWorkspace(ws, [tier]);
    const r = await runScript(copy, 'test');
    expect(r.code).not.toBe(0);
    expect(ran(copy)).toContain(tier);
    expect(ran(copy)).not.toContain('tdd');
    expect(ran(copy)).not.toContain('integration');
  }, 120_000);
});

/**
 * Suites that were blocking only BECAUSE the old bare `jest` swept tests/tdd/ in. Narrowing the
 * default must not silently drop them, so each was promoted to regression/ in the same change and
 * is pinned here by name. simulation's demo-env-file suite (17 tests) has blocked pushes since #313.
 */
const PROTECTED: Record<string, string[]> = {
  'services/simulation-service': ['sprint-134-demo-env-file.test.ts'],
};
const unprotected = (listed: string[], names: string[]) =>
  names.filter((n) => !listed.some((p) => p.startsWith('tests/regression/') && p.endsWith(`/${n}`)));

describe('suites promoted out of WIP keep blocking', () => {
  it.each(Object.entries(PROTECTED))('%s: default test runs %p from regression/', async (ws, names) => {
    const dir = join(ROOT, ws);
    const listed = (await listedBy(dir, 'test', ROOT)).map((p) => p.slice(ws.length + 1));
    expect(unprotected(listed, names)).toEqual([]);
  }, 120_000);

  it('the protection check fails when the suite is returned to tests/tdd/', async () => {
    const ws = 'services/simulation-service';
    const copy = tempWorkspace(ws);
    const [name] = PROTECTED[ws];
    copyFileSync(join(ROOT, ws, 'tests', 'regression', name), join(copy, 'tests', 'tdd', name));
    expect(await listedBy(copy, 'test:tdd', copy)).toContain(`tests/tdd/${name}`);
    expect(unprotected(await listedBy(copy, 'test', copy), [name])).toEqual([name]);
  }, 120_000);
});

// ---------------------------------------------------------------------------------------------
// BUG-076: the root `test:tdd` really runs every workspace's WIP tier, after its build
// ---------------------------------------------------------------------------------------------

const TURBO_BIN = require.resolve('turbo/bin/turbo', { paths: [ROOT] });
const TURBO_ENV = { ...process.env, TURBO_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1' };

/** The root script's argv, from the live root package.json; it must be a plain turbo call. */
function rootTddArgs(): string[] {
  const script: string = readPkg(ROOT).scripts['test:tdd'];
  const argv = script.trim().split(/\s+/);
  if (argv[0] !== 'turbo') throw new Error(`root test:tdd is not a turbo call: ${script}`);
  return argv.slice(1);
}

const runTurbo = (cwd: string, args: string[]) => runNode(TURBO_BIN, cwd, args, TURBO_ENV);

type DryTask = {
  taskId: string;
  command: string;
  dependencies: string[];
  resolvedTaskDefinition: { cache: boolean; outputs: string[]; dependsOn: string[] };
};
async function dryRun(cwd: string, task: string): Promise<DryTask[]> {
  const { code, out, stdout } = await runTurbo(cwd, ['run', task, '--dry=json']);
  if (code !== 0) throw new Error(`turbo run ${task} --dry=json failed (${code}):\n${out.slice(0, 2000)}`);
  // stdout only: turbo writes warnings (e.g. no lockfile) to stderr, and two pipes have no order.
  return JSON.parse(stdout.slice(stdout.indexOf('{'))).tasks;
}

describe('root test:tdd: turbo discovers every WIP task, uncached, after its build', () => {
  it('the root script runs turbo test:tdd and keeps going past a failure', () => {
    expect(rootTddArgs()).toEqual(['run', 'test:tdd', '--continue=always']);
  });

  it('every workspace with a test:tdd script is a real, uncached task that depends on its own build', async () => {
    const tasks = await dryRun(ROOT, 'test:tdd');
    const byId = new Map(tasks.map((t) => [t.taskId, t]));
    const tddPkgs = allWorkspaces()
      .map(({ dir }) => readPkg(dir))
      .filter((pkg) => pkg.scripts?.['test:tdd']);
    const expected = tddPkgs.map((pkg) => pkg.name as string).sort();
    expect(expected).toEqual(expect.arrayContaining(['@karmyq/cleanup-service', '@karmyq/simulation-service']));

    const tdd = tasks.filter((t) => t.taskId.endsWith('#test:tdd') && t.command !== '<NONEXISTENT>');
    expect(tdd.map((t) => t.taskId.replace(/#test:tdd$/, '')).sort()).toEqual(expected);
    for (const t of tdd) {
      const pkg = t.taskId.replace(/#test:tdd$/, '');
      expect({ task: t.taskId, cache: t.resolvedTaskDefinition.cache, outputs: t.resolvedTaskDefinition.outputs }).toEqual({
        task: t.taskId,
        cache: false,
        outputs: [],
      });
      expect({ task: t.taskId, deps: t.dependencies }).toEqual({ task: t.taskId, deps: expect.arrayContaining([`${pkg}#build`]) });
    }
    // The build prerequisite reaches the shared package, whose dist/ the logger subpath resolves to,
    // for every WIP task whose workspace declares @karmyq/shared.
    const consumers = tddPkgs.filter((pkg) => pkg.dependencies?.['@karmyq/shared']).map((pkg) => pkg.name as string);
    expect(consumers).toEqual(expect.arrayContaining(['@karmyq/cleanup-service', '@karmyq/simulation-service']));
    for (const name of consumers) {
      expect({ build: `${name}#build`, deps: byId.get(`${name}#build`)?.dependencies }).toEqual({
        build: `${name}#build`,
        deps: expect.arrayContaining(['@karmyq/shared#build']),
      });
    }
  }, 180_000);
});

/**
 * A throwaway monorepo driven by the LIVE turbo.json and the LIVE root test:tdd argv: a real copy
 * of packages/shared with NO dist/ (clean outputs), and three consumers. `failTdd` makes a consumer's
 * test:tdd fail after writing its marker; `failBuild` makes its build fail.
 */
function tempMonorepo(opts: { failTdd?: string[]; failBuild?: string[] } = {}): string {
  const root = scratch.make('karmyq-s139-turbo-');
  copyFileSync(join(ROOT, 'turbo.json'), join(root, 'turbo.json'));
  const rootPkg = readPkg(ROOT);
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ name: 'fixture', private: true, workspaces: ['packages/*', 'services/*'], packageManager: rootPkg.packageManager }),
  );
  symlinkSync(join(ROOT, 'node_modules'), join(root, 'node_modules'), 'junction');

  const shared = join(root, 'packages', 'shared');
  cpSync(join(ROOT, 'packages', 'shared'), shared, {
    recursive: true,
    filter: (src) => !/[\\/](node_modules|dist|coverage)([\\/]|$)/.test(src.slice(join(ROOT, 'packages', 'shared').length)),
  });
  if (existsSync(join(ROOT, 'packages', 'shared', 'node_modules'))) {
    symlinkSync(join(ROOT, 'packages', 'shared', 'node_modules'), join(shared, 'node_modules'), 'junction');
  }

  for (const name of ['svc-a', 'svc-b', 'svc-c']) {
    const dir = join(root, 'services', name);
    mkdirSync(join(dir, 'node_modules', '@karmyq'), { recursive: true });
    symlinkSync(shared, join(dir, 'node_modules', '@karmyq', 'shared'), 'junction');
    const buildExit = opts.failBuild?.includes(name) ? 1 : 0;
    const tddExit = opts.failTdd?.includes(name) ? 1 : 0;
    writeFileSync(join(dir, 'build.js'), `require('fs').appendFileSync('built', 'x');\nprocess.exit(${buildExit});\n`);
    writeFileSync(
      join(dir, 'tdd.js'),
      [
        "const { createLogger } = require('@karmyq/shared/utils/logger');",
        `if (typeof createLogger('${name}').info !== 'function') process.exit(9);`,
        "require('fs').appendFileSync('ran-tdd', 'x');",
        `process.exit(${tddExit});`,
        '',
      ].join('\n'),
    );
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name, private: true, dependencies: { '@karmyq/shared': '*' }, scripts: { build: 'node build.js', 'test:tdd': 'node tdd.js' } }),
    );
  }
  return root;
}
const count = (f: string) => (existsSync(f) ? readFileSync(f, 'utf8').length : 0);

describe('root test:tdd in a clean-output monorepo (live turbo.json, live argv)', () => {
  // One fixture (one cold shared build per push): svc-a's WIP task fails, svc-b passes, svc-c's BUILD fails.
  const svc = (name: string, file: string) => join(root, 'services', name, file);
  let root: string;
  let first: Run;
  beforeAll(async () => {
    root = tempMonorepo({ failTdd: ['svc-a'], failBuild: ['svc-c'] });
    expect(existsSync(join(root, 'packages', 'shared', 'dist'))).toBe(false); // clean outputs
    first = await runTurbo(root, rootTddArgs());
  }, 240_000);

  it('the graph builds shared before each consumer\'s WIP task', async () => {
    const tasks = await dryRun(root, 'test:tdd');
    const deps = Object.fromEntries(tasks.map((t) => [t.taskId, t.dependencies]));
    expect(deps['svc-a#test:tdd']).toEqual(['svc-a#build']);
    expect(deps['svc-a#build']).toEqual(['@karmyq/shared#build']);
  }, 180_000);

  it('shared is built from nothing, a failing WIP task does not stop the others, and the aggregate is nonzero', () => {
    expect(first.code).not.toBe(0);
    expect(existsSync(join(root, 'packages', 'shared', 'dist', 'utils', 'logger.js'))).toBe(true);
    expect(count(svc('svc-a', 'ran-tdd'))).toBe(1);
    expect(count(svc('svc-b', 'ran-tdd'))).toBe(1); // resolved the real logger and passed
  });

  it('a failing build is reported as a build failure while the other WIP reports still run', () => {
    expect(first.out).toMatch(/svc-c#build/);
    expect(count(svc('svc-b', 'ran-tdd'))).toBe(1);
  });

  it('a rerun executes the WIP tasks again (uncached), and stays nonzero', async () => {
    const second = await runTurbo(root, rootTddArgs());
    expect(second.code).not.toBe(0);
    expect(count(svc('svc-a', 'ran-tdd'))).toBe(2);
    expect(count(svc('svc-b', 'ran-tdd'))).toBe(2);
  }, 240_000);
});
