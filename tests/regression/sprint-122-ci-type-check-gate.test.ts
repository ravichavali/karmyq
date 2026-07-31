import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Sprint 122 PR 2 — the CI type-check step must actually type-check (ADR-088).
 *
 * `.github/workflows/ci.yml` has a step named "Run TypeScript type check" that
 * ran four `npm run type-check --workspace=… --if-present` lines. Measured
 * 2026-07-31: THREE of those four workspaces — packages/shared, auth-service,
 * community-service — declared no `type-check` script at all, so `--if-present`
 * turned them into no-ops. The step had been passing green while checking
 * nothing but apps/mobile, itself added only a day earlier.
 *
 * The first version of this gate asserted `invocations.length >= 4` rather than
 * WHICH workspaces, so swapping apps/mobile for a duplicate packages/shared
 * passed 3/3 while mobile went unchecked (reproduced in review). Counting is not
 * identity — the same mistake the lint-config gate made and had to be fixed for.
 * This version pins the exact roster, rejects duplicates, scopes parsing to the
 * named step so invocations elsewhere cannot satisfy it, and rejects the
 * suppressions that would let the step fail without failing the job.
 */
const ROOT = join(__dirname, '..', '..');
const CI_YML = join(ROOT, '.github', 'workflows', 'ci.yml');

/** Exactly the workspaces this step must type-check. Changing it is a decision. */
const EXPECTED_WORKSPACES = [
  'apps/mobile',
  'packages/shared',
  'services/auth-service',
  'services/community-service',
];

const STEP_NAME = 'Run TypeScript type check';

/**
 * The body of the named step only. Steps are `      - name: …` (six spaces), so
 * the block runs until the next sibling step or a dedent out of the steps list.
 */
function stepBody(name: string): string[] {
  const lines = readFileSync(CI_YML, 'utf8').split('\n');
  const start = lines.findIndex((l) => l.trim() === `- name: ${name}`);
  if (start === -1) throw new Error(`ci.yml has no step named "${name}"`);

  const indent = lines[start].length - lines[start].trimStart().length;
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const isSibling = line.trimStart().startsWith('- ') && line.length - line.trimStart().length === indent;
    const isDedent = line.trim() !== '' && line.length - line.trimStart().length < indent;
    if (isSibling || isDedent) break;
    body.push(line);
  }
  return body;
}

function typeCheckLines(): string[] {
  return stepBody(STEP_NAME)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('npm run type-check'));
}

const workspaceOf = (line: string) => line.match(/--workspace=(\S+)/)?.[1];

describe('CI type-check step does what its name says', () => {
  it('the named step still exists and carries every invocation', () => {
    expect(existsSync(CI_YML)).toBe(true);

    // Invocations outside the named step must not be able to satisfy this gate.
    const inStep = typeCheckLines().length;
    const inFile = readFileSync(CI_YML, 'utf8')
      .split('\n')
      .filter((l) => l.trim().startsWith('npm run type-check')).length;

    expect({ inStep, inFile }).toEqual({ inStep: EXPECTED_WORKSPACES.length, inFile: EXPECTED_WORKSPACES.length });
  });

  it('type-checks exactly the expected workspaces, with no duplicates', () => {
    const workspaces = typeCheckLines().map(workspaceOf);

    // Sorted set equality: catches a dropped workspace, an added one, and a
    // duplicate standing in for a real entry.
    expect([...workspaces].sort()).toEqual([...EXPECTED_WORKSPACES].sort());
    expect(new Set(workspaces).size).toBe(workspaces.length);
  });

  it('every workspace it names declares a type-check script', () => {
    const missing = EXPECTED_WORKSPACES.filter((ws) => {
      const pkg = join(ROOT, ws, 'package.json');
      if (!existsSync(pkg)) return true;
      return !JSON.parse(readFileSync(pkg, 'utf8')).scripts?.['type-check'];
    });

    expect(missing).toEqual([]);
  });

  it('nothing in the step can swallow a failure', () => {
    // --if-present hides a missing script; `|| true` / `|| echo` and
    // continue-on-error hide a real type error. Any of them makes the step's
    // green meaningless.
    const suppressed = stepBody(STEP_NAME)
      .map((l) => l.trim())
      .filter((l) => /--if-present|\|\||continue-on-error/.test(l));

    expect(suppressed).toEqual([]);
  });
});
