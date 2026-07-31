import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Sprint 122 PR 2 — the CI type-check step must actually type-check (ADR-088).
 *
 * `.github/workflows/ci.yml` has a step named "Run TypeScript type check" that
 * ran four `npm run type-check --workspace=… --if-present` lines. Measured
 * 2026-07-31: THREE of those four workspaces — packages/shared,
 * auth-service, community-service — declared no `type-check` script at all, so
 * `--if-present` turned them into no-ops. The step had been passing green while
 * checking nothing but apps/mobile, which was itself only added a day earlier.
 *
 * That is this PR's subject in its purest form: a named check reporting success
 * without doing the work. This gate keeps the step honest in both directions —
 * every workspace it names must declare the script, and no line may re-acquire
 * the flag that made the omission silent.
 */
const ROOT = join(__dirname, '..', '..');
const CI_YML = join(ROOT, '.github', 'workflows', 'ci.yml');

/** Every `npm run type-check --workspace=<ws>` invocation in the workflow. */
function typeCheckInvocations(): Array<{ workspace: string; line: string }> {
  const yml = readFileSync(CI_YML, 'utf8');
  return yml
    .split('\n')
    .filter((l) => l.includes('npm run type-check') && l.includes('--workspace='))
    .map((line) => ({
      workspace: line.match(/--workspace=(\S+)/)![1],
      line: line.trim(),
    }));
}

describe('CI type-check step does what its name says', () => {
  const invocations = typeCheckInvocations();

  it('the workflow still has a type-check step to gate', () => {
    expect(existsSync(CI_YML)).toBe(true);
    // A silent drop to zero invocations would make every assertion below vacuous.
    expect(invocations.length).toBeGreaterThanOrEqual(4);
  });

  it('every workspace it names declares a type-check script', () => {
    const missing = invocations
      .filter(({ workspace }) => {
        const pkg = join(ROOT, workspace, 'package.json');
        if (!existsSync(pkg)) return true;
        return !JSON.parse(readFileSync(pkg, 'utf8')).scripts?.['type-check'];
      })
      .map(({ workspace }) => workspace);

    expect(missing).toEqual([]);
  });

  it('no invocation uses --if-present, which would hide a missing script', () => {
    const silent = invocations.filter(({ line }) => line.includes('--if-present')).map(({ line }) => line);
    expect(silent).toEqual([]);
  });
});
