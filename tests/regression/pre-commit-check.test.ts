import { execFileSync, spawnSync } from 'child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { ROOT, posixShell, scratchDirs } from './helpers/workspaces';

// Root regression: this enforces repo-wide process, not one service's behavior.
// Real Git index + real npm subprocess; no recursive invocation of this repo's test suite.
// Removing a gate, reading the worktree instead of the index, or losing npm's status breaks it.
const dirs = scratchDirs();
afterAll(dirs.cleanup);

function fixture(testBody = "console.log('successful test output');") {
  const cwd = dirs.make('karmyq-precommit-');
  const git = (...args: string[]) => execFileSync('git', args, { cwd, stdio: 'pipe' });
  const put = (file: string, body = '// fixture\n') => {
    mkdirSync(dirname(join(cwd, file)), { recursive: true });
    writeFileSync(join(cwd, file), body);
  };
  git('init', '-q');
  git('config', 'user.name', 'test');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'core.hooksPath', '.git/hooks');
  git('config', 'core.autocrlf', 'false'); // byte-exact worktree checks on Windows hosts too
  git('config', 'core.excludesFile', join(cwd, '.git/info/exclude').replace(/\\/g, '/'));
  put('package.json', JSON.stringify({ private: true, scripts: { test: 'node test-run.js' } }));
  put('test-run.js', testBody);
  put('services/example/CONTEXT.md');
  put('services/example/src/existing.ts');
  git('add', '.');
  git('commit', '-qm', 'fixture');
  git('update-ref', 'refs/remotes/origin/master', 'HEAD');
  const run = () => {
    // Supply POSIX utilities when launched from PowerShell; bare bash there can resolve to WSL.
    const r = spawnSync(posixShell(), ['-c', 'export PATH="/usr/bin:$PATH"; exec "${BASH:-bash}" "$1"', 'precommit', join(ROOT, 'scripts/pre-commit-check.sh').replace(/\\/g, '/')], {
      cwd, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null' },
    });
    if (r.error) throw r.error;
    return { status: r.status, output: r.stdout + r.stderr };
  };
  let revision = 0;
  const context = () => { put('services/example/CONTEXT.md', `updated ${++revision}\n`); git('add', 'services/example/CONTEXT.md'); };
  return { cwd, git, put, run, context };
}

it('is silent when npm passes', () => {
  expect(fixture().run()).toEqual({ status: 0, output: '' });
});

it('fails closed when origin/master is unavailable', () => {
  const f = fixture();
  f.git('update-ref', '-d', 'refs/remotes/origin/master');
  const r = f.run();
  expect(r.status).not.toBe(0);
  expect(r.output).toContain('origin/master');
});

it('checks source changes committed earlier on the branch, even with an empty staged diff', () => {
  const f = fixture();
  f.put('services/example/src/existing.ts', 'earlier branch change\n');
  f.git('add', '.');
  f.git('commit', '-qm', 'earlier task without context');
  const r = f.run();
  expect(r.status).not.toBe(0);
  expect(r.output).toContain('services/example/CONTEXT.md');
  f.context();
  f.git('commit', '-qm', 'context in an earlier task too');
  expect(f.run()).toEqual({ status: 0, output: '' });
});

it.each(['ts', 'tsx'])('accepts a sprint-named tracked test importing new .%s source', (extension) => {
  const f = fixture();
  f.put('tests/sprint-335-contract.test.ts', "import '../services/example/src/logic';\n");
  f.git('add', '.');
  f.git('commit', '-qm', 'tracked sprint test');
  f.put(`services/example/src/logic.${extension}`);
  f.git('add', '.');
  f.context();
  expect(f.run()).toEqual({ status: 0, output: '' });
});

it('reads staged import content, not an unstaged import in a tracked test', () => {
  const f = fixture();
  f.put('tests/sprint-335-contract.spec.tsx');
  f.git('add', '.');
  f.git('commit', '-qm', 'tracked test without the import');
  f.put('services/example/src/new.logic.ts');
  f.git('add', '.');
  f.context();
  f.put('tests/sprint-335-contract.spec.tsx', 'import "../services/example/src/new.logic";\n');
  const r = f.run();
  expect(r.status).not.toBe(0);
  expect(r.output).toContain('new.logic.ts');
  f.git('add', 'tests/sprint-335-contract.spec.tsx');
  expect(f.run()).toEqual({ status: 0, output: '' });
});

it('rejects a source modification whose CONTEXT update is only in the worktree', () => {
  const f = fixture();
  f.put('services/example/src/existing.ts', 'changed\n');
  f.git('add', 'services/example/src/existing.ts');
  f.put('services/example/CONTEXT.md', 'unstaged\n');
  const r = f.run();
  expect(r.status).not.toBe(0);
  expect(r.output).toContain('services/example/CONTEXT.md');
  f.git('add', 'services/example/CONTEXT.md');
  expect(f.run()).toEqual({ status: 0, output: '' });
});

it('requires context for source deletions too, and rejects a staged context deletion', () => {
  const f = fixture();
  f.git('rm', 'services/example/src/existing.ts', 'services/example/CONTEXT.md');
  expect(f.run().output).toContain('services/example/CONTEXT.md');
  expect(f.run().status).not.toBe(0);
});

it('rejects a new source file with no test or only an untracked test', () => {
  const f = fixture();
  f.put('services/example/src/new logic.tsx');
  f.git('add', 'services/example/src/new logic.tsx');
  f.context();
  const missing = f.run();
  expect(missing.status).not.toBe(0);
  expect(missing.output).toContain('new logic.tsx');
  f.put('tests/new logic.spec.tsx');
  expect(f.run().status).not.toBe(0);
  f.git('add', 'tests/new logic.spec.tsx');
  expect(f.run()).toEqual({ status: 0, output: '' });
});

it('does not count a staged-deleted matching test for new source', () => {
  const f = fixture();
  f.put('tests/another.spec.tsx');
  f.git('add', '.');
  f.git('commit', '-qm', 'existing matching test');
  f.git('rm', 'tests/another.spec.tsx');
  f.put('services/example/src/another.ts');
  f.git('add', 'services/example/src/another.ts');
  f.context();
  const r = f.run();
  expect(r.status).not.toBe(0);
  expect(r.output).toContain('another.ts');
});

it('requires context for each changed service, even after one service passes', () => {
  const f = fixture();
  f.put('services/example/src/existing.ts', 'changed\n');
  f.put('services/other/src/index.ts');
  f.git('add', '.');
  f.context();
  const r = f.run();
  expect(r.status).not.toBe(0);
  expect(r.output).toContain('services/other/CONTEXT.md');
  f.put('services/other/CONTEXT.md');
  f.git('add', '.');
  expect(f.run()).toEqual({ status: 0, output: '' });
});

it.each(['test.ts', 'spec.ts', 'test.tsx', 'spec.tsx'])('accepts a tracked matching .%s anywhere', (suffix) => {
  const f = fixture();
  f.put(`elsewhere/existing.${suffix}`);
  f.git('add', '.');
  f.git('commit', '-qm', 'tracked test');
  f.put('services/example/src/nested/existing.ts');
  f.git('add', '.');
  f.context();
  expect(f.run()).toEqual({ status: 0, output: '' });
});

it('exempts tests, specs, declarations and index.ts, but not index.tsx', () => {
  const f = fixture();
  for (const name of ['one.test.ts', 'two.spec.tsx', 'types.d.ts', 'index.ts']) {
    f.put(`services/example/src/${name}`);
  }
  f.git('add', '.');
  f.context();
  expect(f.run()).toEqual({ status: 0, output: '' });
  f.put('services/example/src/index.tsx');
  f.git('add', '.');
  expect(f.run().status).not.toBe(0);
  expect(f.run().output).toContain('index.tsx');
});

it('refuses a partially staged worktree before testing different contents', () => {
  const f = fixture();
  f.put('test-run.js', '// unstaged change\n');
  expect(f.run().status).not.toBe(0);
  expect(f.run().output).toMatch(/unstaged/i);
});

it('refuses an untracked file that npm would test but the commit would omit, before running npm', () => {
  const f = fixture('process.exit(9);'); // exit 9 would mean npm ran
  f.put('services/example/src/helper.ts');
  const r = f.run();
  expect(r.status).toBe(1);
  expect(r.output).toContain('untracked: services/example/src/helper.ts');
});

// Staging leaves worktree == index, so only an index snapshot sees it; the CONTEXT/test checks
// above ran on the index before npm, so new source staged by npm would skip them entirely.
const write = (file: string) => `require('fs').writeFileSync('${file}', '// regenerated\\n');`;
const stage = (file: string) => `${write(file)} require('child_process').execFileSync('git', ['add', '${file}']);`;
it.each([
  [write('services/example/CONTEXT.md'), 'modified: services/example/CONTEXT.md'],
  [write('generated.json'), 'untracked: generated.json'],
  [stage('services/example/CONTEXT.md'), 'staged: services/example/CONTEXT.md'],
  [stage('services/example/src/unchecked.ts'), 'staged: services/example/src/unchecked.ts'],
])('fails a passing npm run that changes the index or tree (case %#)', (body, listed) => {
  const r = fixture(body).run();
  expect(r.status).toBe(1);
  expect(r.output).toContain('npm test passed but changed the index or working tree');
  expect(r.output).toContain(listed);
});

// Run the recovery command the script prints, exactly as a user would, and prove it undoes only
// npm's change: work staged before the run must survive in both the index and the worktree.
it.each([
  ['rewrites a pre-staged file', write('notes.txt'), 'modified: notes.txt'],
  ['rewrites and stages a pre-staged file', stage('notes.txt'), 'staged: notes.txt'],
  ['stages new source', stage('services/example/src/unchecked.ts'), 'staged: services/example/src/unchecked.ts'],
])('printed recovery keeps work staged before the run when npm %s', (_case, body, listed) => {
  const f = fixture(body);
  f.put('notes.txt', 'HEAD bytes\n');
  f.git('add', 'notes.txt');
  f.git('commit', '-qm', 'notes at HEAD');
  f.put('notes.txt', 'USER STAGED WORK\n');
  f.git('add', 'notes.txt');
  const r = f.run();
  expect(r.status).toBe(1);
  expect(r.output).toContain(listed);
  const advice = r.output.match(/git restore ([^<\n]*)<(?:file|path)>/);
  expect(advice).not.toBeNull();
  const path = listed.split(': ')[1];
  f.git('restore', ...advice![1].trim().split(/\s+/), path);
  expect(f.git('show', ':notes.txt').toString()).toBe('USER STAGED WORK\n');
  expect(readFileSync(join(f.cwd, 'notes.txt'), 'utf8')).toBe('USER STAGED WORK\n');
  expect(f.git('status', '--porcelain').toString()).toBe('M  notes.txt\n');
});

it('reports staged and unstaged churn from one passing run together', () => {
  const r = fixture(`${stage('services/example/src/unchecked.ts')} ${write('generated.json')}`).run();
  expect(r.status).toBe(1);
  expect(r.output).toContain('staged: services/example/src/unchecked.ts');
  expect(r.output).toContain('untracked: generated.json');
});

it('preserves npm failure status and bounds noisy diagnostics', () => {
  const f = fixture(`for (let i=0;i<100;i++) console.log('FAIL case-' + i);
    for (let i=0;i<20;i++) console.log('tail-' + i);
    process.exit(7);`);
  const r = f.run();
  expect(r.status).toBe(7);
  expect(r.output).toContain('FAIL case-0');
  expect(r.output).not.toContain('FAIL case-25');
  expect(r.output).not.toContain('tail-0\n');
  expect(r.output).toContain('tail-19');
  expect(r.output.trim().split(/\r?\n/).length).toBeLessThanOrEqual(43);
});

it('fails on npm errors even without a matching diagnostic line', () => {
  const f = fixture("console.log('unexpected termination'); process.exit(3);");
  const r = f.run();
  expect(r.status).toBe(3);
  expect(r.output).toContain('unexpected termination');
});
