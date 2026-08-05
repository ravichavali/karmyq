import { execFileSync } from 'child_process';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, relative, sep } from 'path';

import { ROOT, allWorkspaces } from './helpers/workspaces';

/**
 * Sprint 122 PR 2 — tier coverage (ADR-088).
 *
 * `--passWithNoTests` is not itself the defect: it only changes behavior when
 * ZERO tests match, and ADR-029 justifies it for tiers that are legitimately
 * empty. The real hazard is a blocking tier that HAS files on disk which its
 * jest invocation never matches — a moved directory, a drifted testMatch, a
 * broken testPathPattern — reporting green while running nothing.
 *
 * The invariant is therefore COVERAGE, not equality, and it is tier-agnostic:
 * every file in a workspace's unit/ and regression/ directories must appear in
 * what its `test` script actually tells jest to run. Extra files listed (a bare
 * `jest` also picking up tdd/ and integration/) are fine.
 *
 * Two layouts are both legitimate and both must pass:
 *   - tiered scripts:  "test": "npm run test:unit && npm run test:regression"
 *   - bare jest:       "test": "jest"   (cleanup, simulation, landing, mobile)
 */
const TIERS = ['unit', 'regression'] as const;

/**
 * Tier directories live at <ws>/tests/<tier> everywhere EXCEPT the `tests`
 * workspace itself, where they are <ws>/<tier>. Getting this wrong makes the
 * gate silently vacuous on the repo's largest suite, so resolve both.
 */
function tierDir(wsDir: string, tier: string): string | null {
  for (const candidate of [join(wsDir, 'tests', tier), join(wsDir, tier)]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** Build output contains copies of test files; never count them as sources. */
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', '.next', '.expo', '.turbo']);

function testFilesUnder(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) found.push(...testFilesUnder(full));
    } else if (/\.(test|spec)\.[jt]sx?$/.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

/** The subset of workspaces that actually keep a unit/ or regression/ tier. */
function workspacesWithTiers(): Array<{ ws: string; dir: string }> {
  return allWorkspaces().filter(({ dir }) => TIERS.some((t) => tierDir(dir, t)));
}

/**
 * Expand a workspace's `test` script into the jest argument strings it runs.
 * Handles `npm run X && npm run Y` one level deep, which is the only
 * composition shape this repo uses.
 */
function jestInvocations(pkg: { scripts?: Record<string, string> }): string[][] {
  const scripts = pkg.scripts || {};
  const top = scripts.test;
  if (!top) return [];

  const args: string[][] = [];
  for (const part of top.split('&&').map((s) => s.trim())) {
    const viaNpm = part.match(/^npm run (\S+)/);
    const resolved = viaNpm ? scripts[viaNpm[1]] : part;
    if (!resolved) throw new Error(`test script references missing script: ${part}`);
    const jest = resolved.match(/^jest\b\s*(.*)$/);
    // Split into argv here so the invocation never becomes a shell string.
    // Every test script in this repo uses plain whitespace-separated flags.
    if (jest) args.push(jest[1].split(/\s+/).filter(Boolean));
  }
  return args;
}

/**
 * Ask jest itself which files a given invocation would run.
 *
 * Memoized: the coverage cases and the "silently runs none" sweep ask the same
 * (workspace, args) questions, and each miss costs an `npx jest` spawn — around
 * a second on Windows, paid on every push. The tree cannot change mid-run, so
 * caching within the process is free of correctness cost.
 */
const listedCache = new Map<string, string[]>();

/**
 * Jest's CLI entry, run directly under `node`. Deliberately NOT `npx jest` in a
 * template string: CodeQL flagged that as js/command-line-injection (critical,
 * alert #571) because the args are read out of a workspace's package.json and
 * interpolated into a shell command. Passing argv to execFileSync means no
 * shell is involved at all. `npx.cmd` is not an option either — Node 24 on
 * Windows refuses to spawn a .cmd without a shell (the CVE-2024-27980 fix).
 */
const JEST_BIN = join(ROOT, 'node_modules', 'jest', 'bin', 'jest.js');

function listed(wsDir: string, jestArgs: string[]): string[] {
  const key = `${wsDir} ${jestArgs.join(' ')}`;
  const hit = listedCache.get(key);
  if (hit) return hit;

  const out = execFileSync(process.execPath, [JEST_BIN, ...jestArgs, '--listTests'], {
    cwd: wsDir,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  const files = out
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /\.(test|spec)\.[jt]sx?$/.test(l));

  listedCache.set(key, files);
  return files;
}

const norm = (p: string) => relative(ROOT, p).split(sep).join('/');

describe('tier coverage: npm test runs every blocking test on disk', () => {
  const workspaces = workspacesWithTiers();

  it('can find the jest CLI it shells out to', () => {
    // If this moves, every coverage case below would fail with an opaque spawn
    // error instead of naming the real problem.
    expect(existsSync(JEST_BIN)).toBe(true);
  });

  it('finds every workspace that has a unit/ or regression/ directory', () => {
    const names = workspaces.map((w) => w.ws).sort();
    expect(names).toEqual([
      'apps/frontend',
      'apps/landing',
      'apps/mobile',
      'services/auth-service',
      'services/cleanup-service',
      'services/community-service',
      'services/geocoding-service',
      'services/messaging-service',
      'services/notification-service',
      'services/reputation-service',
      'services/request-service',
      'services/simulation-service',
      'services/social-graph-service',
      'tests',
    ]);
  });

  it.each(workspacesWithTiers())('$ws runs every unit/ and regression/ file it has', ({ ws, dir }) => {
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));

    const onDisk = TIERS.flatMap((t) => {
      const d = tierDir(dir, t);
      return d ? testFilesUnder(d) : [];
    }).map(norm);

    const invocations = jestInvocations(pkg);

    if (invocations.length === 0) {
      // No jest invocation at all is acceptable ONLY with nothing to run.
      // services/messaging-service is the sole such workspace (0 test files) —
      // a real gap, logged in docs/BUGS.md, but not a cache-key or tier lie.
      expect({ ws, uncovered: onDisk }).toEqual({ ws, uncovered: [] });
      return;
    }

    const seen = new Set(invocations.flatMap((args) => listed(dir, args)).map(norm));
    const uncovered = onDisk.filter((f) => !seen.has(f));

    expect({ ws, uncovered }).toEqual({ ws, uncovered: [] });
  }, 300_000);

  it('no workspace that has test files silently runs none of them', () => {
    // The general form of the invariant, covering workspaces the tier cases
    // cannot reach. packages/shared keeps its 11 suites (156 tests) under
    // src/**/__tests__/ with roots:['<rootDir>/src'] — a layout with no
    // unit/ or regression/ directory at all, so every assertion above skips
    // the package that 6 services and apps/frontend consume.
    //
    // This is also the assertion that catches a mis-scoped probe: during
    // baselining, `npx jest --testPathPattern='(unit|regression)/'` reported
    // "0 matches" in packages/shared and looked like a pass.
    const silent = allWorkspaces()
      .filter(({ dir }) => testFilesUnder(dir).length > 0)
      .filter(({ dir }) => {
        const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
        const invocations = jestInvocations(pkg);
        if (invocations.length === 0) return true;
        return invocations.flatMap((args) => listed(dir, args)).length === 0;
      })
      .map(({ ws }) => ws);

    // messaging-service is absent from this list because it has zero test
    // files — a real gap tracked in docs/BUGS.md, not a silent-run defect.
    expect(silent).toEqual([]);
  }, 300_000);

  it('apps/mobile does not claim it has no tests', () => {
    const mobile = join(ROOT, 'apps', 'mobile');
    const cfg = readFileSync(join(mobile, 'jest.config.js'), 'utf8');
    expect(testFilesUnder(join(mobile, 'tests')).length).toBeGreaterThan(0);
    expect(cfg).not.toMatch(/passWithNoTests/);
  });
});
