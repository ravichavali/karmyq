import { execFileSync, spawnSync } from 'child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import { ROOT, posixShell, scratchDirs } from './helpers/workspaces';

/**
 * Sprint 139 — BUG-076: the pre-push hook's TDD report must tell the truth.
 *
 * The hook ran `npm run test:tdd 2>&1 | tail -20` inside an `if`, so the condition was TAIL's exit
 * status: a failed WIP run, and even a missing task, printed "✓ TDD tests passed". The fix captures
 * npm's output in a unique log under the temp directory, keeps npm's exit status, and only then
 * shows the last 20 lines with the log's path. WIP never blocks a push whose required checks
 * passed; a required failure still blocks.
 *
 * Everything here is the REAL hook: copied from scripts/git-hooks, installed by the real
 * scripts/install-hooks.sh into a throwaway repository, and run by a real `git push` into a local
 * bare remote. Only the subprocess outcomes are controlled: the required-check runner is a stub
 * script with a chosen exit code, and `test:tdd` is a real npm script that prints numbered lines
 * and exits with a chosen code. Nothing contacts a network remote or pushes this checkout.
 */

// Realpathed temp dirs: a path the hook prints must compare equal to the one this test handed it.
const dirs = scratchDirs();
const scratch = dirs.make;
afterAll(dirs.cleanup);

/** A path every tool in the chain agrees on: forward slashes, Windows drive letter kept. */
const fwd = (p: string) => p.replace(/\\/g, '/');

/**
 * The hook prints the path its shell sees. Under Git for Windows that shell rewrites a Windows-style
 * TMPDIR into its own form (`/tmp/...`, since /tmp is mounted on the user's temp directory), which
 * Node cannot open as-is. cygpath — which ships beside that shell — translates it back.
 */
function nativePath(p: string): string {
  if (process.platform !== 'win32' || !p.startsWith('/')) return p;
  const sibling = join(dirname(posixShell()), 'cygpath.exe');
  for (const bin of ['cygpath', sibling]) {
    try {
      return execFileSync(bin, ['-w', p], { encoding: 'utf8' }).trim();
    } catch {
      // try the next one
    }
  }
  throw new Error(`cannot translate the hook's path ${p}: no cygpath on PATH or at ${sibling}`);
}

const LINES = 120;
const SUCCESS = /TDD tests passed/;
const WARNING = /TDD tests failed or did not run/;
const REQUIRED_GREEN = /All required checks passed/;
const LOG_LINE = /Full TDD log: (.+) \(exit status (\d+)\)/; // (.+): a temp path may contain spaces

type Push = {
  status: number | null;
  output: string;
  remoteHasMain: boolean;
  logPath?: string;
  reportedStatus?: number;
};

type Scenario = {
  required?: number; // the stub runner's exit code (unit + regression)
  tdd?: number | 'missing'; // test:tdd's exit code, or no such npm script at all
  logDir?: string | null; // TMPDIR for the hook; null leaves it unset
  failingTail?: boolean; // the hook's `tail` always fails
};

function push({ required = 0, tdd = 0, logDir, failingTail = false }: Scenario): Push {
  const remote = scratch('karmyq-s139-remote-');
  const work = scratch('karmyq-s139-work-');
  execFileSync('git', ['init', '-q', '--bare', remote]);
  execFileSync('git', ['init', '-q', '-b', 'main', work]);
  const git = (...a: string[]) => execFileSync('git', a, { cwd: work, encoding: 'utf8' });
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'test');
  git('config', 'core.hooksPath', '.git/hooks');

  const scripts: Record<string, string> = {};
  if (tdd !== 'missing') scripts['test:tdd'] = 'node fake-tdd.js';
  writeFileSync(join(work, 'package.json'), JSON.stringify({ name: 'fixture', private: true, scripts }));
  mkdirSync(join(work, 'scripts'));
  writeFileSync(
    join(work, 'scripts', 'prepush-test-runner.js'),
    `console.log('stub required checks: exit ${required}');\nprocess.exit(${required});\n`,
  );
  if (tdd !== 'missing') {
    const body = [
      `for (let i = 1; i <= ${LINES}; i++) console.log('tdd-line-' + String(i).padStart(3, '0'));`,
      `console.log('FINAL-DIAGNOSTIC exit=${tdd}');`,
      `process.exit(${tdd});`,
    ].join('\n');
    writeFileSync(join(work, 'fake-tdd.js'), body);
  }
  git('add', '.');
  git('commit', '-q', '-m', 'fixture');

  // Install AFTER the commit: the real installer also installs pre-commit, which is not under test.
  cpSync(join(ROOT, 'scripts/git-hooks'), join(work, 'scripts/git-hooks'), { recursive: true });
  cpSync(join(ROOT, 'scripts/install-hooks.sh'), join(work, 'scripts/install-hooks.sh'));
  execFileSync(posixShell(), ['scripts/install-hooks.sh'], { cwd: work, env: { ...process.env, CI: '' }, stdio: 'ignore' });
  if (!existsSync(join(work, '.git/hooks/pre-push'))) throw new Error('installer did not install pre-push');
  git('remote', 'add', 'origin', remote);

  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const k of ['SKIP_PREPUSH', 'DATABASE_URL', 'POSTGRES_HOST', 'TMPDIR', 'BASH_ENV']) delete env[k];
  if (logDir !== null) env.TMPDIR = fwd(logDir ?? scratch('karmyq-s139-logs-'));
  if (failingTail) {
    // A shell FUNCTION named tail, loaded through BASH_ENV (bash reads it before running a
    // non-interactive script such as this hook). Not a fake binary on PATH: Git for Windows'
    // cmd/git.exe prepends its own usr/bin to the hook's PATH, so a PATH entry wins only
    // sometimes, while a function always takes precedence over PATH lookup.
    const rc = join(scratch('karmyq-s139-bashenv-'), 'failing-tail.sh');
    writeFileSync(rc, 'tail() { echo "fake tail refuses" >&2; return 1; }\n');
    env.BASH_ENV = fwd(rc);
  }

  const r = spawnSync('git', ['push', 'origin', 'main'], { cwd: work, env, encoding: 'utf8' });
  const remoteHasMain = spawnSync('git', ['rev-parse', '--verify', '--quiet', 'refs/heads/main'], { cwd: remote }).status === 0;
  const output = `${r.stdout}${r.stderr}`;
  const m = output.match(LOG_LINE);
  return { status: r.status, output, remoteHasMain, logPath: m ? nativePath(m[1]) : undefined, reportedStatus: m ? Number(m[2]) : undefined };
}

/** Required green, TDD red (status 3): two cases read this one push. */
let redTddPush: Push | undefined;
const redTdd = () => (redTddPush ??= push({ required: 0, tdd: 3 }));

describe('pre-push reports the TDD tier truthfully (BUG-076)', () => {
  it('required green + TDD green: push succeeds and says the TDD tier passed', () => {
    const r = push({ required: 0, tdd: 0 });
    expect(r.output).toMatch(/Running pre-push checks/); // a hook really ran
    expect({ status: r.status, remote: r.remoteHasMain, reported: r.reportedStatus }).toEqual({ status: 0, remote: true, reported: 0 });
    expect(r.output).toMatch(SUCCESS);
    expect(r.output).not.toMatch(WARNING);
    expect(r.output).toMatch(REQUIRED_GREEN);
  }, 120_000);

  it('required green + TDD red: push still succeeds, warns, and never claims the TDD tier passed', () => {
    const r = redTdd();
    expect({ status: r.status, remote: r.remoteHasMain, reported: r.reportedStatus }).toEqual({ status: 0, remote: true, reported: 3 });
    expect(r.output).toMatch(WARNING);
    expect(r.output).not.toMatch(SUCCESS);
    expect(r.output).toMatch(REQUIRED_GREEN);
  }, 120_000);

  it('required green + no test:tdd at all: the missing task is a warning with npm\'s real status, not a pass', () => {
    const r = push({ required: 0, tdd: 'missing' });
    expect({ status: r.status, remote: r.remoteHasMain }).toEqual({ status: 0, remote: true });
    expect(r.reportedStatus).not.toBe(0);
    expect(r.output).toMatch(/Missing script/);
    expect(r.output).toMatch(WARNING);
    expect(r.output).not.toMatch(SUCCESS);
  }, 120_000);

  it('required red: the push is rejected and nothing claims the required checks passed', () => {
    const r = push({ required: 1, tdd: 0 });
    expect(r.output).toMatch(/Running pre-push checks/);
    expect(r.status).not.toBe(0);
    expect(r.remoteHasMain).toBe(false);
    expect(r.output).not.toMatch(REQUIRED_GREEN);
  }, 120_000);
});

describe('the TDD log: bounded display, complete retained file, unique path', () => {
  it('shows only the log\'s last 20 lines, and the retained log holds every line', () => {
    const r = redTdd();
    expect(r.logPath).toBeDefined();
    const log = readFileSync(r.logPath as string, 'utf8');
    const logLines = log.split(/\r?\n/).filter((l) => l.length > 0);
    for (let i = 1; i <= LINES; i++) expect(log).toContain(`tdd-line-${String(i).padStart(3, '0')}`);
    expect(log).toContain('FINAL-DIAGNOSTIC exit=3');

    const shown = logLines.slice(-20);
    for (const l of shown) expect(r.output).toContain(l);
    const numbered = (s: string[]) => s.filter((l) => /tdd-line-\d{3}/.test(l)).length;
    expect(numbered(r.output.split(/\r?\n/))).toBe(numbered(shown));
    expect(r.output).not.toContain('tdd-line-001');
  }, 120_000);

  it('puts the log under the temp directory, at a different path on every run', () => {
    const logDir = scratch('karmyq-s139-logs-');
    const a = push({ required: 0, tdd: 0, logDir });
    const b = push({ required: 0, tdd: 0, logDir });
    expect(a.logPath).toBeDefined();
    expect(b.logPath).toBeDefined();
    expect(a.logPath).not.toBe(b.logPath);
    for (const p of [a.logPath as string, b.logPath as string]) {
      expect(existsSync(p)).toBe(true);
      // Both sides canonical; lower-cased because Windows drive letters and 8.3 names vary in case.
      expect(fwd(realpathSync.native(p)).toLowerCase().startsWith(`${fwd(realpathSync.native(logDir)).toLowerCase()}/`)).toBe(true);
    }
  }, 240_000);

  it('if no log can be created, it warns and skips the report — no false success, no rejected push', () => {
    const r = push({ required: 0, tdd: 0, logDir: join(scratch('karmyq-s139-logs-'), 'does-not-exist') });
    expect({ status: r.status, remote: r.remoteHasMain }).toEqual({ status: 0, remote: true });
    expect(r.output).toMatch(/Could not create a temporary log/);
    expect(r.output).not.toMatch(SUCCESS);
    expect(r.output).toMatch(REQUIRED_GREEN);
  }, 120_000);

  it('if the tail cannot be shown, a red TDD run is still reported red and the push still succeeds', () => {
    const r = push({ required: 0, tdd: 3, failingTail: true });
    expect(r.output).toMatch(/fake tail refuses/); // the failing tail really ran
    expect({ status: r.status, remote: r.remoteHasMain, reported: r.reportedStatus }).toEqual({ status: 0, remote: true, reported: 3 });
    expect(r.output).toMatch(WARNING);
    expect(r.output).not.toMatch(SUCCESS);
  }, 120_000);
});
