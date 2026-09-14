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

/**
 * The lines a run-script actually EXECUTES.
 *
 * Joins shell line-continuations — the probe invocation is wrapped in `$(...)` and split across
 * three lines, so a naive per-line scan finds nothing and passes vacuously — then drops heredoc
 * bodies, because content between `<<EOF` and its terminator is data the script prints, not a
 * command it runs. Indentation cannot tell them apart: YAML block scalars are dedented on parse.
 */
function executedLines(runs: string[]): string[] {
  const out: string[] = [];
  for (const run of runs) {
    let heredoc: string | null = null;
    for (const line of run.replace(/\\\n\s*/g, ' ').split('\n')) {
      if (heredoc) {
        if (line.trim() === heredoc) heredoc = null;
        continue;
      }
      const opened = line.match(/<<-?\s*'?([A-Za-z_][A-Za-z0-9_]*)'?/);
      if (opened) {
        heredoc = opened[1];
        continue;
      }
      out.push(line);
    }
  }
  return out;
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

    // One parse for both assertions — see executedLines(). The ssh check previously used a weaker
    // continuation-only parse; sharing the heredoc-aware one strengthens it for free.
    const executed = executedLines(runs);

    const sshLines = executed.filter(
      (line) => /[\s($]ssh\s/.test(line) && !/ssh-keyscan/.test(line),
    );

    expect(sshLines).toHaveLength(1);
    expect(sshLines[0]).toMatch(/probe-story-rows\.js/);

    // And nothing anywhere actually INVOKES rotation or a reset. The remediation snippet does
    // mention the rotation command, but inside the issue body heredoc — data the workflow prints,
    // not a command it runs — which executedLines has already excluded.
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

  it('re-validates the payload BEFORE exporting the verdict', () => {
    // Otherwise a corrupted payload paired with a stale issue=0 skips notification AND satisfies
    // the close-stale condition, silently closing an open issue.
    const run = stepWithId(loadWorkflow(), 'check').run as string;
    expect(run).toMatch(/check-demo-health\.js --verify/);
    // The validated verdict must be what reaches GITHUB_OUTPUT.
    const verifyAt = run.indexOf('--verify');
    const exportAt = run.lastIndexOf('issue=$issue" >> "$GITHUB_OUTPUT');
    expect(verifyAt).toBeGreaterThan(-1);
    expect(exportAt).toBeGreaterThan(verifyAt);
  });

  it('does not ship a database URL to Actions', () => {
    const raw = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    expect(raw).not.toMatch(/secrets\.DATABASE_URL/);
  });
});

describe('demo-health workflow — reporting survives the checkout itself failing', () => {
  // always() selects the notify step when an earlier step fails — including checkout. In that case
  // the repo is not on disk, so the renderer script does not exist. Under `bash -e` a failing
  // command substitution aborts the step, which would have meant NO issue filed in exactly the
  // scenario always() exists to cover. (Introduced when the renderer was extracted from an inline
  // `node -e`, which needed no repo file.)

  function notifyRun(): string {
    const wf = loadWorkflow();
    return stepWithId(wf, 'notify').run as string;
  }

  it('does not let a missing renderer abort before the issue is filed', () => {
    const run = notifyRun();
    // The renderer invocation must be shielded and its failure handled.
    expect(run).toMatch(/set \+e[\s\S]*render-health-issue\.js/);
    expect(run).toMatch(/render_status/);
  });

  it('falls back to a body that names the demo state as unknown', () => {
    const run = notifyRun();
    expect(run).toMatch(/render_status.*-ne 0.*\|\|.*-z "\$details"|-z "\$details".*\|\|.*render_status/s);
    expect(run).toMatch(/unknown/i);
  });

  it('scopes every gh call to the repository, which is not inferable without a checkout', () => {
    const wf = loadWorkflow();
    for (const id of ['notify', 'close_stale']) {
      const step = stepWithId(wf, id);
      expect(step.env).toBeDefined();
      expect(step.env.GH_REPO).toBeDefined();
    }
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

describe('demo-host scripts — enable-demo cannot corrupt the env file', () => {
  const script = fs.readFileSync(
    path.join(__dirname, '..', '..', 'scripts', 'demo', 'enable-demo.sh'),
    'utf8',
  );

  it('guarantees a terminal newline before appending the flag', () => {
    // publishDemoConfig leaves the file untouched when it has nothing to append, so .env.demo can
    // legitimately end without a newline. A bare `>>` then welds the flag onto the last line:
    //   JWT_SECRET=abc123DEMO_SESSION_ENABLED=true
    // corrupting the secret AND losing the flag in one write.
    expect(script).toMatch(/tail -c 1/);
    const guardAt = script.indexOf('tail -c 1');
    const appendAt = script.indexOf("printf 'DEMO_SESSION_ENABLED=true");
    expect(guardAt).toBeGreaterThan(-1);
    expect(appendAt).toBeGreaterThan(guardAt);
  });

  it('validates the staged file BEFORE it replaces the live one', () => {
    // Checking after `mv` is loud but too late: the bad edit is already committed, with nothing to
    // roll back to.
    const validateAt = script.lastIndexOf('refusing to publish');
    const mvAt = script.indexOf('mv "$tmp" "$ENV_FILE"');
    expect(validateAt).toBeGreaterThan(-1);
    expect(mvAt).toBeGreaterThan(validateAt);
  });

  it('refuses to publish a staged file that lost lines', () => {
    expect(script).toMatch(/wc -l < "\$tmp"/);
  });
});

describe('demo-health probe — the public-issue contract is enforced, not just claimed', () => {
  // probe-story-rows.js states in its header that its output "carries NO story UUIDs, no persona
  // email and no token: the result is rendered into a PUBLIC GitHub issue". The first version
  // enforced that with a deny-list — any message not matching /:\/\/|password|secret/ passed
  // through — which let ordinary pg failures publish internal detail verbatim on a PUBLIC repo:
  // internal Docker addresses, container hostnames, the DB role, and in the malformed-id case the
  // configured story UUID itself. A deny-list cannot enforce that contract; only an allow-list can.
  /**
   * Strip comments before asserting. These files DOCUMENT the old deny-list in prose, so a raw
   * source scan matches the very text explaining why the pattern was removed — an assertion that
   * cannot tell code from commentary is worse than none.
   */
  function codeOnly(file: string): string {
    return fs
      .readFileSync(path.join(__dirname, '..', '..', file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .map((l: string) => l.replace(/\/\/.*$/, ''))
      .join('\n');
  }

  const probe = codeOnly('scripts/demo/probe-story-rows.js');

  it('never interpolates a driver error MESSAGE into its output', () => {
    expect(probe).not.toMatch(/error\.message/);
  });

  it('emits an error CODE instead', () => {
    expect(probe).toMatch(/error\.code/);
  });

  it('does not rely on a deny-list of substrings', () => {
    // The exact pattern that failed: it redacted only 1 of 6 realistic pg failure messages.
    expect(probe).not.toMatch(/password\|secret/);
  });

  it('the health check does not leak JSON.parse input either', () => {
    // Node embeds a snippet of the parsed input in JSON.parse error messages, and that input is
    // probe output bound for the same public issue body.
    expect(codeOnly('scripts/check-demo-health.js')).not.toMatch(/unparseable.*error\.message/);
  });
});
