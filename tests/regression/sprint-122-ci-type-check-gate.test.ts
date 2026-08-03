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

/**
 * The step must also be UNCONDITIONAL and FAIL-FAST. Three further bypasses were
 * found in review after the roster was pinned, each of which left all earlier
 * assertions green:
 *   - `if: false` on the step — skipped entirely, nothing type-checked.
 *   - `shell: bash {0}` — a custom template drops GitHub's implicit
 *     `-eo pipefail`, so an early failure followed by a later success yields a
 *     green step (the exit code is the LAST command's).
 *   - `continue-on-error: true` on the enclosing job — the job reports success
 *     regardless.
 * See https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax
 */
const REQUIRED_SHELL = 'shell: bash';

/**
 * The exact script each type-checked workspace must run. Presence is not
 * semantics — `"echo skipped"` and `"tsc --noEmit || true"` are both truthy and
 * both type-check nothing. All four workspaces run this identical command today.
 */
const EXPECTED_TYPE_CHECK = 'tsc --noEmit';

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

/**
 * The body of the job containing the named step: from its `  <job>:` key (two
 * spaces) to the next one. Job-level `continue-on-error` / `if` can neutralise a
 * perfectly-formed step, so the gate has to see them.
 */
function enclosingJobBody(): string[] {
  const lines = readFileSync(CI_YML, 'utf8').split('\n');
  const stepIdx = lines.findIndex((l) => l.trim() === `- name: ${STEP_NAME}`);
  if (stepIdx === -1) throw new Error(`ci.yml has no step named "${STEP_NAME}"`);

  const isJobKey = (l: string) => /^ {2}[A-Za-z0-9_-]+:\s*$/.test(l);
  let start = -1;
  for (let i = stepIdx; i >= 0; i--) {
    if (isJobKey(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) throw new Error('could not locate the job containing the type-check step');

  const rest = lines.slice(start + 1);
  const end = rest.findIndex(isJobKey);
  return end === -1 ? rest : rest.slice(0, end);
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

  it('every workspace it names runs exactly the expected type-check', () => {
    // Truthiness is not semantics. `"type-check": "echo skipped"` and
    // `"tsc --noEmit || true"` both satisfy a presence check while type-checking
    // nothing, so the workflow reports green having verified nothing (both
    // reproduced in review). Pin the command itself: all four workspaces run the
    // identical script today, and a workspace that genuinely needs different
    // flags must change EXPECTED_TYPE_CHECK deliberately, in review.
    const actual = EXPECTED_WORKSPACES.map((ws) => {
      const pkg = join(ROOT, ws, 'package.json');
      const script = existsSync(pkg)
        ? JSON.parse(readFileSync(pkg, 'utf8')).scripts?.['type-check']
        : '<no package.json>';
      return [ws, script ?? '<missing>'];
    });

    expect(actual).toEqual(EXPECTED_WORKSPACES.map((ws) => [ws, EXPECTED_TYPE_CHECK]));
  });

  it('the expected script is itself a real, unsuppressed type-check', () => {
    // Closes the loop: without this, loosening EXPECTED_TYPE_CHECK to
    // `tsc --noEmit || true` would make every workspace "match" and the gate
    // would go green again — the same presence-vs-semantics hole one level up.
    expect(EXPECTED_TYPE_CHECK).toMatch(/^tsc\b/);
    expect(EXPECTED_TYPE_CHECK).toContain('--noEmit');
    expect(EXPECTED_TYPE_CHECK).not.toMatch(/\|\||&&|;|\becho\b|\btrue\b|\bexit\b/);
  });

  it('the step is unconditional — no `if:` can skip it', () => {
    // `if: false` skips the step entirely; every other assertion here still
    // passes because the lines are all still present in the file.
    const conditionals = stepBody(STEP_NAME)
      .map((l) => l.trim())
      .filter((l) => /^if:/.test(l));

    expect(conditionals).toEqual([]);
  });

  it('the step declares fail-fast shell semantics', () => {
    // Must be exactly `shell: bash` (which GitHub expands to
    // `--noprofile --norc -eo pipefail`). A custom template such as
    // `shell: bash {0}` drops those flags, so an early failure followed by a
    // later success produces a GREEN step.
    const shells = stepBody(STEP_NAME)
      .map((l) => l.trim())
      .filter((l) => l.startsWith('shell:'));

    expect(shells).toEqual([REQUIRED_SHELL]);
  });

  it('the enclosing job cannot suppress its own failure', () => {
    // Job-level keys sit at four spaces; a step's own `if:` is at eight and is
    // legitimate on unrelated steps, so match the indent exactly rather than
    // flagging every `if:` in the job.
    const suppressing = enclosingJobBody().filter((l) => /^ {4}(continue-on-error|if):/.test(l));

    expect(suppressing).toEqual([]);
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
