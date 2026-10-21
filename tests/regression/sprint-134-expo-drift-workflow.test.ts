/**
 * Sprint 134 PR E — the expo-sdk-drift WORKFLOW reports every failure shape (docs/IDEAS.md 2026-09-13).
 *
 * GitHub applies an implicit `success()` to every `if:` that calls no status function. The
 * reporting steps were gated only on `steps.check.outputs.*`, so a failed checkout, setup-node or
 * `npm ci` skipped all of them: the run went red and no issue was filed. That is the silent-signal
 * failure BUG-035 was filed for, and `sprint-129-demo-health-workflow.test.ts` pins the fixed
 * shape next door. This file pins the same shape here, by step NAME, not line.
 *
 * ⚠️ HONEST LIMIT: `evaluateCondition` is a MODEL of GitHub's expression semantics. A dispatched
 * run on the PR branch is the live arbiter (plan Task E9).
 */

import { execFileSync } from 'child_process';
import { parse as parseYaml } from 'yaml';
import { Ctx, evaluateCondition } from './helpers/workflowConditions';
import { read } from './helpers/workspaces';

const FILE_ISSUE = 'File or update the drift issue';
const CLOSE_STALE = 'Close stale drift issues when the gate is green';
const FAIL_RUN = 'Fail the run when drift is present';

/** Today's (pre-fix) conditions. Each must be rejected by the assertions below. */
const BROKEN = {
  [FILE_ISSUE]: "steps.check.outputs.issue == '1'",
  [CLOSE_STALE]: "steps.check.outputs.status == '0'",
};

const WORKFLOW = parseYaml(read('.github/workflows/expo-sdk-drift.yml'));

function step(name: string): any {
  const jobs = Object.values(WORKFLOW.jobs ?? {}) as any[];
  expect(jobs).toHaveLength(1);
  const found = (jobs[0].steps ?? []).filter((s: any) => s.name === name);
  expect(found).toHaveLength(1);
  return found[0];
}

function condition(name: string): string {
  const cond = step(name).if;
  expect(typeof cond).toBe('string');
  return cond as string;
}

/** The states a scheduled run can be in. Only GREEN is silent. */
const GREEN = 'green: gate ran clean';
const DRIFT = 'drift: gate ran and reported issue=1';
const NO_ISSUE_FLAG = 'gate wrote status=0 but no issue flag';
const EARLIER_FAILED = 'EARLIER step failed (checkout/setup-node/npm ci), so check never ran';
const STATES: Array<{ label: string; ctx: Ctx; mustNotify: boolean }> = [
  {
    label: GREEN,
    ctx: { jobFailed: false, outcome: 'success', outputs: { status: '0', issue: '0', result: 'eyJvayI6dHJ1ZX0=' } },
    mustNotify: false,
  },
  {
    label: DRIFT,
    ctx: { jobFailed: false, outcome: 'success', outputs: { status: '1', issue: '1', result: 'eyJvayI6ZmFsc2V9' } },
    mustNotify: true,
  },
  {
    label: 'SILENT SUCCESS: check exited 0 but wrote no output',
    ctx: { jobFailed: false, outcome: 'success', outputs: {} },
    mustNotify: true,
  },
  {
    label: NO_ISSUE_FLAG,
    ctx: { jobFailed: false, outcome: 'success', outputs: { status: '0', issue: '', result: 'eyJvayI6dHJ1ZX0=' } },
    mustNotify: true,
  },
  {
    label: 'check step itself failed',
    ctx: { jobFailed: true, outcome: 'failure', outputs: {} },
    mustNotify: true,
  },
  {
    label: EARLIER_FAILED,
    ctx: { jobFailed: true, outcome: '', outputs: {} },
    mustNotify: true,
  },
];
const state = (label: string): Ctx => STATES.find((s) => s.label === label)!.ctx;
const firing = (cond: string): string[] => STATES.filter((s) => evaluateCondition(cond, s.ctx)).map((s) => s.label);

describe('expo-sdk-drift workflow: the file-issue step notifies on every failure shape', () => {
  it('calls always(), without which every other case is moot', () => {
    expect(condition(FILE_ISSUE)).toMatch(/always\(\)/);
  });

  it.each(STATES)('$label', ({ ctx, mustNotify }) => {
    expect(evaluateCondition(condition(FILE_ISSUE), ctx)).toBe(mustNotify);
  });

  it('stays silent ONLY in the green state', () => {
    const cond = condition(FILE_ISSUE);
    const silent = STATES.filter((s) => !evaluateCondition(cond, s.ctx));
    expect(silent.map((s) => s.label)).toEqual([GREEN]);
  });
});

describe('expo-sdk-drift workflow: the close step closes ONLY on a clean gate', () => {
  it('requires the check to have succeeded AND an explicit issue=0', () => {
    expect(condition(CLOSE_STALE)).toMatch(/steps\.check\.outcome\s*==\s*'success'/);
    expect(condition(CLOSE_STALE)).toMatch(/steps\.check\.outputs\.issue\s*==\s*'0'/);
  });

  it('closes in the green state and in no other', () => {
    expect(firing(condition(CLOSE_STALE))).toEqual([GREEN]);
  });
});

describe('expo-sdk-drift workflow: the fail step keeps a nonzero gate status red', () => {
  it('is pinned to the gate status, unchanged', () => {
    expect(condition(FAIL_RUN)).toBe("steps.check.outputs.status != '0'");
  });

  it('fails the run on drift and not on green', () => {
    expect(evaluateCondition(condition(FAIL_RUN), state(DRIFT))).toBe(true);
    expect(evaluateCondition(condition(FAIL_RUN), state(GREEN))).toBe(false);
  });
});

describe('expo-sdk-drift workflow: reporting survives the check never running', () => {
  it('scopes every gh call to the repository, which is not inferable without a checkout', () => {
    for (const name of [FILE_ISSUE, CLOSE_STALE]) {
      expect(step(name).env?.GH_REPO).toBe('${{ github.repository }}');
    }
  });

  /** The inline renderer that turns RESULT into the issue's details section. */
  const renderer = (() => {
    const match = (step(FILE_ISSUE).run as string).match(/details=\$\(node -e '([\s\S]*?)'\)/);
    return match ? match[1] : '';
  })();

  function render(result: string): { status: number; out: string } {
    try {
      const out = execFileSync(process.execPath, ['-e', renderer], {
        env: { ...process.env, RESULT: result },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return { status: 0, out };
    } catch (error: any) {
      return { status: error.status ?? 1, out: error.stdout ?? '' };
    }
  }

  it('renders a real payload', () => {
    expect(renderer).not.toBe('');
    const payload = { ok: false, errors: [], blocking: [{ package: 'expo', installed: '57.0.1', expoPins: '~57.0.2' }], cleared: [], stale: [], mismatched: [] };
    const { status, out } = render(Buffer.from(JSON.stringify(payload)).toString('base64'));
    expect(status).toBe(0);
    expect(out).toContain('- expo@57.0.1 — Expo expects ~57.0.2');
  });

  it('fails on an empty payload, so the fallback is what fires', () => {
    expect(renderer).not.toBe('');
    expect(render('').status).not.toBe(0);
  });

  it('shields the renderer and falls back to a body naming the check as incomplete', () => {
    const run = step(FILE_ISSUE).run as string;
    expect(run).toMatch(/set \+e\s*\n\s*details=\$\(node -e/);
    expect(run).toMatch(/render_status=\$\?/);
    expect(run).toMatch(/if \[ "\$render_status" -ne 0 \] \|\| \[ -z "\$details" \]; then/);
    expect(run).toMatch(/did not run to completion/);
    expect(run).toMatch(/\$RUN_URL/);
  });
});

describe('expo-sdk-drift workflow: the assertions reject the pre-fix conditions', () => {
  it('the old file-issue condition goes silent when an earlier step failed', () => {
    expect(evaluateCondition(BROKEN[FILE_ISSUE], state(EARLIER_FAILED))).toBe(false);
  });

  it('the old close condition closes on a gate that wrote no issue flag', () => {
    expect(firing(BROKEN[CLOSE_STALE])).toEqual([GREEN, NO_ISSUE_FLAG]);
  });

  it("the model applies GitHub's implicit success() to a condition with no status function", () => {
    expect(evaluateCondition("always() && steps.check.outputs.issue != '0'", state(EARLIER_FAILED))).toBe(true);
    expect(evaluateCondition("steps.check.outputs.issue != '0'", state(EARLIER_FAILED))).toBe(false);
  });
});
