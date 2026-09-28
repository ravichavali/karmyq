/**
 * Sprint 131 D8 — cleanup-service lint gate (eslint 10 + @eslint/js 10).
 *
 * CI's lint step cannot fail (`ci.yml` and `test.yml` end it in `|| echo`), so this is the
 * only check that reddens when cleanup-service lint breaks. It runs the real eslint binary
 * this workspace resolves, in a plain `node` child with constant arguments; the probe
 * fixture is passed on stdin as data.
 *
 * A: the eslint and @eslint/js majors match (#244 left @eslint/js 10 on the hoisted eslint 9).
 * B: `eslint src` is clean, and actually linted src.
 * C: @eslint/js 10's added recommended rules are live for .ts files, so a config that stops
 *    applying `js.configs.recommended` cannot pass B by checking almost nothing.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SERVICE_DIR = path.resolve(__dirname, '../..');
const TIMEOUT_MS = 60_000;

interface PackageJson {
  version: string;
  bin?: string | Record<string, string>;
  peerDependencies?: Record<string, string>;
}

interface LintMessage {
  ruleId: string | null;
  line: number;
}

interface LintResult {
  filePath: string;
  errorCount: number;
  messages: LintMessage[];
}

function readPackage(name: string): { pkg: PackageJson; dir: string } {
  const pkgPath = require.resolve(`${name}/package.json`, { paths: [SERVICE_DIR] });
  return { pkg: JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as PackageJson, dir: path.dirname(pkgPath) };
}

function major(version: string): number {
  return Number(version.split('.')[0]);
}

function eslintBin(): string {
  const { pkg, dir } = readPackage('eslint');
  const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.eslint;
  if (!bin) throw new Error('eslint package.json has no bin.eslint');
  return path.join(dir, bin);
}

function runEslint(args: string[], input?: string) {
  const result = spawnSync(process.execPath, [eslintBin(), ...args], {
    cwd: SERVICE_DIR,
    input,
    encoding: 'utf8',
    timeout: TIMEOUT_MS,
  });
  if (result.error) throw result.error;
  return result;
}

const PROBE = [
  'export function useless(): number { let a = 0; a = 1; return a; }',
  'export function unassigned(): number | undefined { let b: number | undefined; return b; }',
  "export function rethrow(): void { try { JSON.parse('x'); } catch (err) { throw new Error(`bad: ${String(err)}`); } }",
  '',
].join('\n');

describe('Sprint 131 D8 — cleanup-service lint gate', () => {
  const eslint = readPackage('eslint').pkg;
  const eslintJs = readPackage('@eslint/js').pkg;
  const peer = eslintJs.peerDependencies?.eslint;

  it(`A: eslint and @eslint/js resolve to the same major${peer ? ` (and @eslint/js peers eslint ${peer})` : ' (@eslint/js declares no eslint peer)'}`, () => {
    expect(major(eslint.version)).toBe(major(eslintJs.version));
    if (peer !== undefined) {
      const m = /^\^(\d+)\.0\.0$/.exec(peer);
      expect(m).not.toBeNull();
      expect(Number(m![1])).toBe(major(eslint.version));
    }
  });

  it(
    'B: `eslint src` exits 0 with no errors, and lints src',
    () => {
      const res = runEslint(['--format', 'json', 'src']);
      const results = JSON.parse(res.stdout) as LintResult[];
      const errors = results.flatMap((r) =>
        r.errorCount > 0
          ? r.messages.map((m) => `${path.relative(SERVICE_DIR, r.filePath)}:${m.line} ${m.ruleId}`)
          : [],
      );
      expect(errors).toEqual([]);
      expect(res.status).toBe(0);
      const files = results.map((r) => path.relative(SERVICE_DIR, r.filePath).split(path.sep).join('/'));
      expect(files).toEqual(expect.arrayContaining(['src/jobs/expirationJob.ts', 'src/index.ts']));
    },
    TIMEOUT_MS,
  );

  it(
    "C: @eslint/js 10's added recommended rules fire on .ts",
    () => {
      const res = runEslint(['--format', 'json', '--stdin', '--stdin-filename', 'src/__eslint_probe__.ts'], PROBE);
      const results = JSON.parse(res.stdout) as LintResult[];
      const hits = results.flatMap((r) => r.messages.map((m) => `${m.line} ${m.ruleId}`));
      expect(hits).toEqual(
        expect.arrayContaining(['1 no-useless-assignment', '2 no-unassigned-vars', '3 preserve-caught-error']),
      );
    },
    TIMEOUT_MS,
  );
});
