import { execFileSync } from 'child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

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

const ROOT = join(__dirname, '..', '..');
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');

describe('Sprint 123 git hooks are actually installed where git reads them', () => {
  it('install-hooks.sh resolves the ACTIVE hooks path instead of hardcoding .git/hooks', () => {
    const sh = read('scripts/install-hooks.sh');

    expect(sh).toMatch(/git config --get core\.hooksPath/);
    expect(sh).not.toMatch(/target="\.git\/hooks\//);
    expect(sh).toMatch(/target="\$hooks_dir\//);
  });

  it('pre-push actually runs the blocking suite', () => {
    expect(read('scripts/git-hooks/pre-push')).toMatch(/npm (run )?test/);
  });

  it('pre-commit runs the doc feedback loop, which the stale husky fork omitted', () => {
    expect(read('scripts/git-hooks/pre-commit')).toMatch(/feedback-loop|feedback:check/);
  });

  it('no stale .husky/pre-commit fork is tracked — scripts/git-hooks is the single source', () => {
    const husky = execFileSync('git', ['ls-files', '.husky'], { cwd: ROOT, encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);

    expect(husky).toEqual([]);
  });

  /**
   * The assertion that matters. A grep can be satisfied by a comment; running the installer
   * against a custom `core.hooksPath` and finding the hook there cannot.
   */
  it('installs into a custom core.hooksPath (functional proof)', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'karmyq-hooks-'));

    try {
      execFileSync('git', ['init', '-q'], { cwd: tmp });
      execFileSync('git', ['config', 'core.hooksPath', 'custom-hooks'], { cwd: tmp });

      cpSync(join(ROOT, 'scripts/git-hooks'), join(tmp, 'scripts/git-hooks'), { recursive: true });
      cpSync(join(ROOT, 'scripts/install-hooks.sh'), join(tmp, 'scripts/install-hooks.sh'));
      writeFileSync(join(tmp, 'package.json'), '{}'); // the installer requires a project root

      // CI: '' so the installer does not take its early-exit branch inside CI runs.
      execFileSync('sh', ['scripts/install-hooks.sh'], {
        cwd: tmp,
        env: { ...process.env, CI: '' },
        encoding: 'utf8',
      });

      expect(existsSync(join(tmp, 'custom-hooks/pre-push'))).toBe(true);
      expect(existsSync(join(tmp, 'custom-hooks/pre-commit'))).toBe(true);
      // ...and NOT the dead path the old installer wrote to.
      expect(existsSync(join(tmp, '.git/hooks/pre-push'))).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('falls back to .git/hooks when core.hooksPath is unset (functional proof)', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'karmyq-hooks-default-'));

    try {
      execFileSync('git', ['init', '-q'], { cwd: tmp });
      // core.hooksPath deliberately NOT set — the fresh-clone case.

      cpSync(join(ROOT, 'scripts/git-hooks'), join(tmp, 'scripts/git-hooks'), { recursive: true });
      cpSync(join(ROOT, 'scripts/install-hooks.sh'), join(tmp, 'scripts/install-hooks.sh'));
      writeFileSync(join(tmp, 'package.json'), '{}');

      execFileSync('sh', ['scripts/install-hooks.sh'], {
        cwd: tmp,
        env: { ...process.env, CI: '' },
        encoding: 'utf8',
      });

      expect(existsSync(join(tmp, '.git/hooks/pre-push'))).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
