/**
 * Sprint 129 (BUG-040) — the demo-health WORKFLOW, not the module it calls.
 *
 * `sprint-129-demo-health-gate.test.ts` proves the check logic can fail. It cannot prove the
 * workflow will actually *report* that failure, because the dangerous bug lives in YAML:
 *
 *   GitHub applies an implicit `success()` to every `if:`. A step gated only on
 *   `steps.check.outputs.*` is therefore SKIPPED when an earlier step fails — so a broken
 *   `npm ci`, a checkout failure, or a crashed check files nothing at all. The run goes red and
 *   nobody is told. That is the silent-signal failure BUG-035 was filed for, and
 *   `.github/workflows/expo-sdk-drift.yml` still has it at `:154`, `:232` and `:262`.
 *
 * A second, subtler shape: a check that exits 0 *without writing* `GITHUB_OUTPUT` leaves
 * `issue` as the empty string. An `issue == '1'` test reads that as "nothing to report" and stays
 * silent precisely when the check is most broken.
 *
 * ⚠️ HONEST LIMIT: the evaluator below is a MODEL of GitHub's expression semantics, not GitHub.
 * It cannot prove the workflow runs correctly on GitHub — Task E dispatches it after merge for
 * that. What it does prove is that the condition still notifies in every failure shape, so nobody
 * can quietly narrow it back to `issue == '1'`.
 */

import * as fs from 'fs';
import * as path from 'path';
// `yaml` (2.x) is what the tests workspace DECLARES; js-yaml is only a root dependency,
// so importing it here would rely on a hoist rather than a declared edge.
import { parse as parseYaml } from 'yaml';

const WORKFLOW_PATH = path.join(__dirname, '..', '..', '.github', 'workflows', 'demo-health.yml');

function loadWorkflow(): any {
  const raw = fs.readFileSync(WORKFLOW_PATH, 'utf8');
  return parseYaml(raw);
}

function job(wf: any): any {
  const jobs = wf.jobs ?? {};
  const names = Object.keys(jobs);
  expect(names).toHaveLength(1);
  return jobs[names[0]];
}

function steps(wf: any): any[] {
  return job(wf).steps ?? [];
}

function stepWithId(wf: any, id: string): any {
  const found = steps(wf).find((s) => s.id === id);
  expect(found).toBeDefined();
  return found;
}

/** A simulated GitHub step/job state. */
interface Ctx {
  jobFailed: boolean;
  outcome: string;
  outputs: Record<string, string>;
}

/**
 * Evaluate the GitHub-expression subset our conditions use.
 *
 * Deliberately refuses anything outside a small allowlist rather than trying to be a general
 * parser: if a future condition needs syntax this cannot model, the test must fail loudly instead
 * of silently approving an expression it does not understand.
 */
function evaluateCondition(expr: string, ctx: Ctx): boolean {
  const normalized = expr.replace(/\s+/g, ' ').trim();

  // Allowlist: functions, step references, string literals, boolean operators, parens.
  const allowed =
    /^[\sA-Za-z0-9_.'()!=&|]+$/.test(normalized) &&
    !/[;`${}[\]]/.test(normalized);
  if (!allowed) {
    throw new Error(
      `Condition uses syntax this test cannot model, so it cannot be verified: ${normalized}`,
    );
  }

  let js = normalized;
  js = js.replace(/\balways\(\)/g, 'true');
  js = js.replace(/\bfailure\(\)/g, String(ctx.jobFailed));
  js = js.replace(/\bsuccess\(\)/g, String(!ctx.jobFailed));
  js = js.replace(/\bcancelled\(\)/g, 'false');
  js = js.replace(/steps\.[A-Za-z0-9_-]+\.outputs\.([A-Za-z0-9_-]+)/g, (_m, name) =>
    JSON.stringify(ctx.outputs[name] ?? ''),
  );
  js = js.replace(/steps\.[A-Za-z0-9_-]+\.outcome/g, JSON.stringify(ctx.outcome));

  if (/steps\./.test(js) || /[A-Za-z_]\w*\s*\(/.test(js)) {
    throw new Error(`Unresolved reference or unmodelled function in condition: ${js}`);
  }

  // eslint-disable-next-line no-new-func
  return Boolean(new Function(`"use strict"; return (${js});`)());
}

/** The states a scheduled run can be in, and whether a human must be told. */
const STATES: Array<{ label: string; ctx: Ctx; mustNotify: boolean }> = [
  {
    label: 'green — demo healthy, stories far from deletion',
    ctx: { jobFailed: false, outcome: 'success', outputs: { issue: '0', result: '{"ok":true}' } },
    mustNotify: false,
  },
  {
    label: 'problem detected — check ran and reported issue=1',
    ctx: { jobFailed: false, outcome: 'success', outputs: { issue: '1', result: '{"ok":false}' } },
    mustNotify: true,
  },
  {
    label: 'SILENT SUCCESS — check exited 0 but wrote no output',
    ctx: { jobFailed: false, outcome: 'success', outputs: { issue: '', result: '' } },
    mustNotify: true,
  },
  {
    label: 'check step itself failed',
    ctx: { jobFailed: true, outcome: 'failure', outputs: { issue: '', result: '' } },
    mustNotify: true,
  },
  {
    label: 'EARLIER step failed — checkout/setup/npm ci — so check never ran',
    ctx: { jobFailed: true, outcome: '', outputs: {} },
    mustNotify: true,
  },
  {
    label: 'check produced a result but no issue flag',
    ctx: { jobFailed: false, outcome: 'success', outputs: { issue: '', result: '{"ok":true}' } },
    mustNotify: true,
  },
];

describe('demo-health workflow — triggers and permissions', () => {
  it('runs on a schedule and manual dispatch, never on pull_request', () => {
    const wf = loadWorkflow();
    // `on` is parsed as boolean true by YAML 1.1 unless quoted; accept either key.
    const triggers = wf.on ?? wf[true as unknown as string];
    expect(triggers).toBeDefined();
    expect(triggers.schedule).toBeDefined();
    expect('workflow_dispatch' in triggers).toBe(true);

    // A merge must never depend on karmyq.com being reachable.
    expect('pull_request' in triggers).toBe(false);
    expect('push' in triggers).toBe(false);
  });

  it('requests only the permissions it needs', () => {
    const wf = loadWorkflow();
    expect(wf.permissions).toEqual({ contents: 'read', issues: 'write' });
  });

  it('serialises runs so two checks cannot file duplicate issues', () => {
    const wf = loadWorkflow();
    expect(wf.concurrency).toBeDefined();
  });
});

describe('demo-health workflow — the check step', () => {
  it('has an id, so reporting steps can reference its outcome', () => {
    const wf = loadWorkflow();
    expect(stepWithId(wf, 'check')).toBeDefined();
  });

  it('executes exactly one remote command, and it is the read-only story probe', () => {
    // An earlier version of this test scanned the whole file for "rotate:demo-stories" and
    // "--apply". That was the wrong mechanism: both strings legitimately appear in the ISSUE BODY
    // as remediation instructions, and a substring scan cannot tell text the workflow PRINTS from
    // a command it RUNS. Assert the invariant that actually matters instead.
    const wf = loadWorkflow();
    const runs: string[] = steps(wf)
      .map((s) => s.run)
      .filter((r): r is string => typeof r === 'string');

    // Join shell line-continuations first: the probe invocation is wrapped in $(...) and split
    // across three lines, so a naive per-line scan finds nothing and would pass vacuously.
    const logicalLines = runs
      .map((r) => r.replace(/\\\n\s*/g, ' '))
      .flatMap((r) => r.split('\n'));

    const sshLines = logicalLines.filter(
      (line) => /[\s($]ssh\s/.test(line) && !/ssh-keyscan/.test(line),
    );

    expect(sshLines).toHaveLength(1);
    expect(sshLines[0]).toMatch(/probe-story-rows\.js/);

    // And nothing anywhere actually INVOKES rotation or a reset.
    //
    // The remediation snippet does mention the rotation command, inside the issue body heredoc —
    // that is data the workflow prints, not a command it runs. Distinguish them by tracking
    // heredoc state rather than by indentation: YAML block scalars are dedented on parse, so the
    // snippet has no leading whitespace to key on.
    const executed: string[] = [];
    for (const run of runs) {
      let heredoc: string | null = null;
      for (const line of run.replace(/\\\n\s*/g, ' ').split('\n')) {
        if (heredoc) {
          if (line.trim() === heredoc) heredoc = null;
          continue; // inside a heredoc: data, not execution
        }
        const opened = line.match(/<<-?\s*'?([A-Za-z_][A-Za-z0-9_]*)'?/);
        if (opened) {
          heredoc = opened[1];
          continue;
        }
        executed.push(line);
      }
    }

    expect(executed.filter((l) => /rotate:demo-stories|reset:demo|--apply/.test(l))).toEqual([]);
    // Sanity-check the scanner itself: it must still be seeing the real commands, or the
    // assertion above passes vacuously.
    expect(executed.some((l) => /node scripts\/check-demo-health\.js/.test(l))).toBe(true);
  });

  it('runs a probe that is SELECT-only', () => {
    // The read-only promise lives in the probe script, not the workflow, so assert it there.
    const probe = fs.readFileSync(
      path.join(__dirname, '..', '..', 'scripts', 'demo', 'probe-story-rows.js'),
      'utf8',
    );
    expect(probe).toMatch(/SELECT/);
    expect(probe).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER)\s/i);
  });

  it('does not ship a database URL to Actions', () => {
    const raw = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    expect(raw).not.toMatch(/secrets\.DATABASE_URL/);
  });
});

describe('demo-health workflow — the notify condition survives every failure shape', () => {
  function notifyCondition(): string {
    const wf = loadWorkflow();
    const notify = stepWithId(wf, 'notify');
    expect(typeof notify.if).toBe('string');
    return notify.if as string;
  }

  it('mentions always(), without which every other case is moot', () => {
    // A condition lacking always() is skipped outright once the job is failing, no matter what
    // else it says. This is the single highest-value assertion in the file.
    expect(notifyCondition()).toMatch(/always\(\)/);
  });

  it('does NOT gate on issue == \'1\'', () => {
    // The empty string is not '1', so an equality test goes silent on a check that wrote nothing.
    // Default to notifying; only an explicit, well-formed '0' earns silence.
    expect(notifyCondition()).not.toMatch(/outputs\.issue\s*==\s*'1'/);
  });

  it.each(STATES)('$label', ({ ctx, mustNotify }) => {
    expect(evaluateCondition(notifyCondition(), ctx)).toBe(mustNotify);
  });

  it('stays silent ONLY in the green state', () => {
    const condition = notifyCondition();
    const silent = STATES.filter((s) => !evaluateCondition(condition, s.ctx));
    expect(silent.map((s) => s.label)).toEqual([STATES[0].label]);
  });
});

describe('demo-health workflow — the evaluator itself can fail', () => {
  // A test harness that cannot fail is as useless as a gate that cannot fail.
  it('reports a narrow issue == \'1\' condition as silently skipping the dangerous states', () => {
    const naive = "always() && (steps.check.outputs.issue == '1' || failure())";

    // It does still catch outright failures...
    expect(evaluateCondition(naive, STATES[3].ctx)).toBe(true);
    // ...but goes SILENT on a check that exited 0 writing nothing — the exact regression.
    expect(evaluateCondition(naive, STATES[2].ctx)).toBe(false);
  });

  it('refuses a condition it cannot model rather than approving it', () => {
    expect(() => evaluateCondition('always() && ${{ something }}', STATES[0].ctx)).toThrow();
    expect(() => evaluateCondition('always() && hashFiles("x") != ""', STATES[0].ctx)).toThrow();
  });
});
