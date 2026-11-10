import { execFileSync } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

/**
 * Workspace enumeration shared by the repo-wide gates in tests/regression/.
 *
 * Extracted in Sprint 122 PR 4: the tier-parity gate (PR 2) and the jest
 * toolchain gate had byte-identical copies of this scan. Two gates disagreeing
 * about what "every workspace" means is exactly how one of them goes quietly
 * vacuous, so there is one definition.
 *
 * Not a `*.test.ts` file, so jest's `testMatch` never collects it as a suite.
 */
export const ROOT = join(__dirname, '..', '..', '..');

export type Workspace = { ws: string; dir: string };

/** Every npm workspace: services/*, apps/*, packages/* with a package.json, plus `tests`. */
export function allWorkspaces(): Workspace[] {
  const out: Workspace[] = [];
  for (const root of ['services', 'apps', 'packages']) {
    const rootDir = join(ROOT, root);
    if (!existsSync(rootDir)) continue;
    for (const name of readdirSync(rootDir)) {
      if (name === 'node_modules') continue;
      const dir = join(rootDir, name);
      if (!statSync(dir).isDirectory()) continue;
      if (existsSync(join(dir, 'package.json'))) out.push({ ws: `${root}/${name}`, dir });
    }
  }
  out.push({ ws: 'tests', dir: join(ROOT, 'tests') });
  return out;
}

/** Read a repo-relative path. */
export const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');

/**
 * Tracked paths matching git pathspecs — the live arbiter, never a directory glob.
 *
 * `execFileSync`, not `execSync`: on Windows `execSync` routes through `cmd.exe`, which does not
 * strip single quotes, so a quoted glob reaches git as a literal and matches nothing. A silently
 * empty list is how a discovery-based gate goes vacuously green.
 */
export function tracked(...pathspecs: string[]): string[] {
  return execFileSync('git', ['ls-files', ...pathspecs], { cwd: ROOT, encoding: 'utf8' })
    .split(/\r?\n/)
    .filter((p) => p && !p.includes('node_modules'));
}

/**
 * Every service directory, from `services/registry.json` — the documented single source of truth.
 * A hand-written list here is the false-green shape CLAUDE.md Discipline 5 forbids: a service
 * added later would simply not be checked, and no assertion would notice.
 */
export function allServicePaths(): string[] {
  const registry = JSON.parse(read('services/registry.json'));
  return Object.values(registry.services as Record<string, { path: string }>).map((s) => s.path);
}

/**
 * A POSIX shell that actually exists on this machine (memoized).
 *
 * `sh` is on PATH under Git Bash, Linux and macOS — but NOT from PowerShell, where Git for
 * Windows puts sh.exe in `<git>/usr/bin` while only `<git>/cmd` is on PATH. The functional hook
 * cases are the only ones that prove anything, so resolving the shell must never degrade into
 * skipping them: if nothing here works we throw, and the suite goes red rather than quiet.
 * Used by the Sprint 123 installer gate and the Sprint 139 pre-push report gate.
 */
let shellCache: string | undefined;
export function posixShell(): string {
  if (shellCache) return shellCache;
  const candidates = ['sh'];

  if (process.platform === 'win32') {
    try {
      // .../mingw64/libexec/git-core -> the Git for Windows install root
      const gitRoot = resolve(execFileSync('git', ['--exec-path'], { encoding: 'utf8' }).trim(), '..', '..', '..');
      candidates.push(join(gitRoot, 'usr', 'bin', 'sh.exe'), join(gitRoot, 'bin', 'sh.exe'));
    } catch {
      // git not on PATH is handled by the candidates below and, failing those, the throw.
    }
    candidates.push('C:\\Program Files\\Git\\usr\\bin\\sh.exe', 'C:\\Program Files (x86)\\Git\\usr\\bin\\sh.exe');
  }

  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ['-c', 'exit 0'], { stdio: 'ignore' });
      shellCache = candidate;
      return candidate;
    } catch {
      // try the next candidate
    }
  }

  throw new Error(
    `No POSIX shell found. Tried: ${candidates.join(', ')}. ` +
      'Install Git for Windows or run from a shell where `sh` resolves — these cases must not be skipped.'
  );
}

/** A Jest test file name, as every gate here recognises one. */
export const TEST_FILE_RE = /\.(test|spec)\.[jt]sx?$/;

/**
 * Throwaway temp directories for a test file: `make(prefix)` creates one, `cleanup()` (call it from
 * `afterAll`) removes them all. Realpathed, because Jest realpaths `rootDir` and git/mktemp report
 * real paths: on macOS `tmpdir()` is `/var/...` -> `/private/var/...`, and on Windows TEMP can be an
 * 8.3 short path, so an un-realpathed dir never compares equal to what a tool prints.
 */
export function scratchDirs(): { make: (prefix: string) => string; cleanup: () => void } {
  const made: string[] = [];
  return {
    make: (prefix) => {
      const d = realpathSync.native(mkdtempSync(join(tmpdir(), prefix)));
      made.push(d);
      return d;
    },
    cleanup: () => {
      for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
    },
  };
}

/** Build output contains copies of test files; never count them as sources. */
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', '.next', '.expo', '.turbo']);

/** Every `*.test|spec.[jt]sx?` file under `dir` (absolute paths), skipping build output. */
export function testFilesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) found.push(...testFilesUnder(full));
    } else if (TEST_FILE_RE.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

/**
 * Jest's CLI entry, run directly under `node`. Deliberately NOT `npx jest` in a template string:
 * CodeQL flagged that as js/command-line-injection (critical, alert #571) because the args are read
 * out of a workspace's package.json and interpolated into a shell command. Passing argv to
 * execFileSync/spawn means no shell is involved at all. `npx.cmd` is not an option either — Node 24
 * on Windows refuses to spawn a .cmd without a shell (the CVE-2024-27980 fix).
 */
export const JEST_BIN = join(ROOT, 'node_modules', 'jest', 'bin', 'jest.js');

/**
 * Expand a workspace script (default `test`) into the jest argv lists it runs, in order.
 * Handles `npm run X && npm run Y` one level deep, which is the only composition shape this repo
 * uses. A part that is not jest is skipped, so callers that need every part to be jest compare the
 * result's length with the number of `&&` parts.
 */
export function jestInvocations(pkg: { scripts?: Record<string, string> }, script = 'test'): string[][] {
  const scripts = pkg.scripts || {};
  const top = scripts[script];
  if (!top) return [];

  const args: string[][] = [];
  for (const part of top.split('&&').map((s) => s.trim())) {
    const viaNpm = part.match(/^npm run (\S+)/);
    const resolved = viaNpm ? scripts[viaNpm[1]] : part;
    if (!resolved) throw new Error(`${script} script references missing script: ${part}`);
    const jest = resolved.match(/^jest\b\s*(.*)$/);
    // Split into argv here so the invocation never becomes a shell string.
    // Every test script in this repo uses plain whitespace-separated flags.
    if (jest) args.push(jest[1].split(/\s+/).filter(Boolean));
  }
  return args;
}
