import { execFileSync } from 'child_process';
import { cpSync, existsSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

import { ROOT, read } from './helpers/workspaces';

/**
 * A POSIX shell that actually exists on this machine.
 *
 * `sh` is on PATH under Git Bash, Linux and macOS — but NOT from PowerShell, where Git for
 * Windows puts sh.exe in `<git>/usr/bin` while only `<git>/cmd` is on PATH. The functional cases
 * below are the only ones that prove anything, so resolving the shell must never degrade into
 * skipping them: if nothing here works we throw, and the suite goes red rather than quiet.
 */
const SHELL: string = (() => {
  const candidates = ['sh'];

  if (process.platform === 'win32') {
    try {
      // .../mingw64/libexec/git-core -> the Git for Windows install root
      const gitRoot = resolve(
        execFileSync('git', ['--exec-path'], { encoding: 'utf8' }).trim(),
        '..',
        '..',
        '..'
      );
      candidates.push(join(gitRoot, 'usr', 'bin', 'sh.exe'), join(gitRoot, 'bin', 'sh.exe'));
    } catch {
      // git not on PATH is handled by the candidates below and, failing those, the throw.
    }
    candidates.push(
      'C:\\Program Files\\Git\\usr\\bin\\sh.exe',
      'C:\\Program Files (x86)\\Git\\usr\\bin\\sh.exe'
    );
  }

  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ['-c', 'exit 0'], { stdio: 'ignore' });
      return candidate;
    } catch {
      // try the next candidate
    }
  }

  throw new Error(
    `No POSIX shell found. Tried: ${candidates.join(', ')}. ` +
      'Install Git for Windows or run from a shell where `sh` resolves — these cases must not be skipped.'
  );
})();

/**
 * Sprint 123 — the git hooks were inert, and nothing said so.
 *
 * `scripts/install-hooks.sh` hardcoded `target=".git/hooks/$hook_name"`. When `core.hooksPath`
 * is set — husky sets it, and it survives husky's own removal — git reads **only** that path and
 * ignores `.git/hooks` entirely. So every hook the installer wrote was dead code:
 *
 *   - `pre-push` (unit + regression, blocking) never ran. `.husky/` had no `pre-push` at all.
 *   - `pre-commit` (governance + doc feedback loop) never ran; a stale narrower fork did.
 *
 * The symptom was a push that completed silently in seconds. Silence is exactly what a
 * fail-open mechanism looks like, which is why this is the same failure class as ADR-060 and as
 * the license gate this sprint would have shipped if it had only checked for a LICENSE file.
 *
 * ⚠️ These assertions target the **installer**, not this machine's hook directory.
 * `install-hooks.sh` deliberately exits early when `$CI` is set, so "a pre-push hook exists here"
 * would false-fail in CI. The durable invariant is that the installer resolves the active path —
 * and the functional test below proves it by running the installer for real.
 */

/**
 * Scaffold a throwaway repo, run the real installer in it, and return the repo path.
 * Shared by every functional case so a change to the installer's prerequisites lands once.
 */
type Install = { dir: string; status: number; output: string; cleanup: () => void };

function installInto(
  hooksPath: string | null,
  opts: { hooksPathFrom?: (dir: string) => string; allowFailure?: boolean } = {}
): Install {
  const dir = mkdtempSync(join(tmpdir(), 'karmyq-hooks-'));
  const cleanup = () => rmSync(dir, { recursive: true, force: true });

  try {
    execFileSync('git', ['init', '-q'], { cwd: dir });

    const resolved = opts.hooksPathFrom ? opts.hooksPathFrom(dir) : hooksPath;
    if (resolved) execFileSync('git', ['config', 'core.hooksPath', resolved], { cwd: dir });

    cpSync(join(ROOT, 'scripts/git-hooks'), join(dir, 'scripts/git-hooks'), { recursive: true });
    cpSync(join(ROOT, 'scripts/install-hooks.sh'), join(dir, 'scripts/install-hooks.sh'));
    writeFileSync(join(dir, 'package.json'), '{}'); // the installer requires a project root

    let status = 0;
    let output = '';
    try {
      // CI: '' so the installer does not take its early-exit branch inside CI runs.
      output = execFileSync(SHELL, ['scripts/install-hooks.sh'], {
        cwd: dir,
        env: { ...process.env, CI: '' },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      const e = err as { status?: number; stdout?: string; stderr?: string };
      if (!opts.allowFailure) throw err;
      status = e.status ?? 1;
      output = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    }

    return { dir, status, output, cleanup };
  } catch (err) {
    cleanup();
    throw err;
  }
}

/** The absolute path git reports for a repo — forward slashes, and on Windows a drive letter. */
const topLevel = (dir: string): string =>
  execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: dir, encoding: 'utf8' }).trim();

describe('Sprint 123 git hooks are actually installed where git reads them', () => {
  it('install-hooks.sh consults core.hooksPath and hardcodes .git/hooks nowhere', () => {
    // Deliberately only two assertions, both about behaviour rather than identifier names: the
    // functional tests below prove the resolution works, but they cannot prove the absence of a
    // SECOND, hardcoded write alongside the correct one.
    const sh = read('scripts/install-hooks.sh');

    expect(sh).toMatch(/git config --get core\.hooksPath/);
    expect(sh).not.toMatch(/target="\.git\/hooks\//);
  });

  it('pre-push actually runs the blocking suite', () => {
    expect(read('scripts/git-hooks/pre-push')).toMatch(/npm (run )?test/);
  });

  it('pre-commit runs the doc feedback loop, which the stale husky fork omitted', () => {
    expect(read('scripts/git-hooks/pre-commit')).toMatch(/feedback-loop|feedback:check/);
  });

  it('the superseded third installer refuses to run instead of fighting over the same directory', () => {
    // scripts/setup/setup-git-hooks.sh reinstalls husky, rewrites core.hooksPath, and swaps
    // pre-push for a different suite. Before this sprint the two installers targeted different
    // directories; now they would target the same one, so it has to refuse.
    const sh = read('scripts/setup/setup-git-hooks.sh');

    expect(sh).toMatch(/superseded/i);
    expect(sh).toMatch(/exit 1/);
    // The refusal must come BEFORE the husky install, or it refuses too late to matter.
    expect(sh.indexOf('exit 1')).toBeLessThan(sh.indexOf('npm install --save-dev husky'));
  });

  /**
   * The assertions that matter. A grep can be satisfied by a comment; running the installer for
   * real and finding the hook where git would look cannot.
   */
  describe.each([
    { label: 'a custom core.hooksPath', hooksPath: 'custom-hooks', landsIn: 'custom-hooks' },
    { label: 'the .git/hooks default when unset', hooksPath: null, landsIn: '.git/hooks' },
  ])('installs into $label (functional proof)', ({ hooksPath, landsIn }) => {
    it('puts both hooks there and nowhere else', () => {
      const { dir, cleanup } = installInto(hooksPath);

      try {
        expect(existsSync(join(dir, landsIn, 'pre-push'))).toBe(true);
        expect(existsSync(join(dir, landsIn, 'pre-commit'))).toBe(true);

        // ...and NOT in the other candidate directory. With the old hardcoded installer the
        // custom case landed in .git/hooks, which is exactly what this catches.
        const deadPath = landsIn === '.git/hooks' ? 'custom-hooks' : '.git/hooks';
        expect(existsSync(join(dir, deadPath, 'pre-push'))).toBe(false);
      } finally {
        cleanup();
      }
    });
  });

  it('accepts an ABSOLUTE core.hooksPath inside the repo, whatever the drive-letter case', () => {
    // Regression: the first version of the out-of-repo guard compared paths case-sensitively.
    // On Windows the two sources genuinely disagree — `git rev-parse --show-toplevel` returns
    // `C:/...` while core.hooksPath holds `c:\...` — so the guard rejected a hooks directory
    // plainly inside the repo and installed nothing. The relative-path tests above cannot see
    // this, because they never exercise the absolute branch at all.
    const { dir, cleanup } = installInto(null, {
      hooksPathFrom: (d) => {
        const abs = `${topLevel(d)}/abs-hooks`;
        // Flip the drive-letter case where there is one, reproducing the real mismatch.
        return /^[A-Za-z]:/.test(abs) ? abs[0].toLowerCase() + abs.slice(1) : abs;
      },
    });

    try {
      expect(existsSync(join(dir, 'abs-hooks/pre-push'))).toBe(true);
      expect(existsSync(join(dir, '.git/hooks/pre-push'))).toBe(false);
    } finally {
      cleanup();
    }
  });

  it('installs ONLY the hooks — never scripts/git-hooks/README.md', () => {
    // The filter used `[[ ]]`, which a real POSIX shell (dash is /bin/sh on the CI runners)
    // reports as "not found". Inside an `if` condition that failure is not fatal even under
    // `set -e`, so it silently took the ELSE branch and installed README.md as a hook. The
    // pre-existing assertions could not see it: they only checked that pre-push/pre-commit exist.
    const { dir, output, cleanup } = installInto('custom-hooks');

    try {
      expect(existsSync(join(dir, 'custom-hooks/README.md'))).toBe(false);
      expect(output).toMatch(/Successfully installed 2 hook\(s\)/);
    } finally {
      cleanup();
    }
  });

  it('REFUSES a core.hooksPath that escapes via ".." even though it is lexically inside', () => {
    // `<repo>/../<sibling>` has the repo path as a literal prefix, so the previous lexical
    // prefix test accepted it and would have installed — and `rm "$target"` deleted — outside
    // the repository.
    const outside = mkdtempSync(join(tmpdir(), 'karmyq-dotdot-'));

    const { status, output, cleanup } = installInto(null, {
      hooksPathFrom: (d) => `${topLevel(d)}/../${outside.replace(/\\/g, '/').split('/').pop()}`,
      allowFailure: true,
    });

    try {
      expect(status).not.toBe(0);
      expect(output).toMatch(/OUTSIDE this repository/);
      expect(existsSync(join(outside, 'pre-push'))).toBe(false);
    } finally {
      cleanup();
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it('REFUSES a core.hooksPath whose SYMLINK target is outside the repo', () => {
    // The link name sits inside the repo, so every lexical check passes; only resolving the link
    // reveals the escape.
    const outside = mkdtempSync(join(tmpdir(), 'karmyq-symlink-'));

    const { status, output, cleanup } = installInto(null, {
      hooksPathFrom: (d) => {
        const link = join(d, 'linked-hooks');
        // 'junction' works on Windows without developer mode or elevation; on POSIX the type
        // argument is ignored. Either way this must be a REAL link, not a copy.
        symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
        return `${topLevel(d)}/linked-hooks`;
      },
      allowFailure: true,
    });

    try {
      expect(status).not.toBe(0);
      expect(output).toMatch(/OUTSIDE this repository/);
      expect(existsSync(join(outside, 'pre-push'))).toBe(false);
    } finally {
      cleanup();
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it('REFUSES a core.hooksPath outside the repo instead of clobbering it', () => {
    // A machine-global core.hooksPath would otherwise get Karmyq's hooks written into a directory
    // every repo on the machine shares — and the installer's `rm "$target"` deletes what was
    // there first. Refusing loudly beats installing hooks that hard-exit in unrelated repos.
    const outside = mkdtempSync(join(tmpdir(), 'karmyq-outside-'));

    const { status, output, cleanup } = installInto(null, {
      hooksPathFrom: () => outside.replace(/\\/g, '/'),
      allowFailure: true,
    });

    try {
      expect(status).not.toBe(0);
      expect(output).toMatch(/OUTSIDE this repository/);
      expect(existsSync(join(outside, 'pre-push'))).toBe(false); // nothing was written
    } finally {
      cleanup();
      rmSync(outside, { recursive: true, force: true });
    }
  });
});
