import { spawn } from 'child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, relative, sep } from 'path';

import { JEST_BIN, ROOT, jestInvocations, testFilesUnder } from './helpers/workspaces';

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

type Run = { code: number | null; out: string };
function runJest(cwd: string, args: string[]): Promise<Run> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [JEST_BIN, ...args], { cwd, env: process.env });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => resolve({ code, out }));
  });
}

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
        .filter((l) => /\.(test|spec)\.[jt]sx?$/.test(l))
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
    if (r.code !== 0) return { code: r.code, out };
  }
  return { code: 0, out };
}

// ---------------------------------------------------------------------------------------------
// Temporary workspace copies
// ---------------------------------------------------------------------------------------------

const tempDirs: string[] = [];
afterAll(() => {
  for (const d of tempDirs) rmSync(d, { recursive: true, force: true });
});

/**
 * A throwaway copy of the workspace's real package.json + jest config (and the root jest config
 * they extend), with one marker test per tier. node_modules is a junction to the repo's, so the
 * copy resolves ts-jest exactly as the real workspace does. The prefix avoids every tier name so
 * a substring `--testPathPatterns` cannot match the temp path itself.
 */
function tempWorkspace(ws: string, failing: Tier[] = []): string {
  // Realpathed because Jest realpaths rootDir (jest-config normalize) and prints --listTests from
  // there: on macOS tmpdir() is /var/... -> /private/var/..., and on Windows TEMP may be an 8.3 path.
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'karmyq-s139-boundary-')));
  tempDirs.push(root);
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
    expect(ran(copy)).not.toEqual(expect.arrayContaining(['tdd']));
    expect(ran(copy)).not.toEqual(expect.arrayContaining(['integration']));
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
