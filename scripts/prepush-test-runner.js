#!/usr/bin/env node
/**
 * Pre-push unit + regression gate: `turbo run test` plus ONE narrow retry.
 *
 * Parallelism is bounded for every caller of `npm test`, not here: turbo.json's `concurrency` caps
 * Turbo (override: TURBO_CONCURRENCY) and scripts/jest-worker-cap.js caps each Jest (override:
 * KARMYQ_JEST_MAX_WORKERS). Uncapped, the 8-core / 7.6 GB Windows dev box hit Jest timeouts in a
 * different workspace each run while every suite passed standalone, and the workaround became
 * skipping the hook. The caps removed those timeouts in every measured run; this runner covers a
 * timeout that happens anyway:
 *   - A task whose ONLY failures are Jest timeouts is re-run once, alone, serially. A timeout can
 *     also be a real hang, which is why the retry is a single serial attempt and a second timeout
 *     blocks.
 *
 * What still blocks, always:
 *   - any failure that is not provably timeout-only: assertions, "Test suite failed to run",
 *     build failures, a missing or unreadable log;
 *   - any task from the dry-run graph that did not succeed by the end, including tasks that were
 *     cancelled or never started;
 *   - missing, unreadable or contradictory evidence: no run summary, or a Turbo exit code that
 *     disagrees with the summary.
 *
 * The first run's output is never discarded: failing task logs are copied to .turbo/prepush/
 * before the retry overwrites them, and the report names both runs.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Jest's own wording, read from real Jest 30 output (see the regression test's fixtures). Each
// error of a failed test gets its own `● <name>` block. A timeout block's FIRST message line is
// this error; matching it anywhere would accept an assertion whose printed value quotes it.
const TIMEOUT_FIRST_LINE_RE = /^\s*thrown: "Exceeded timeout of \d+ ms for a (?:test|hook)\./;
const SUITE_FAILED_RE = /Test suite failed to run/;
const FAILED_TESTS_RE = /^Tests:\s+(\d+) failed/gm;
const BLOCK_START_RE = /^\s*● /;
const BLOCK_END_RE = /^(?:PASS|FAIL) |^Test Suites:|^Tests:|^Summary of all failing tests/;
const ANSI_RE = /\x1b\[[0-9;]*m/g;

/** A failure block whose first message line is Jest's timeout error. */
function isTimeoutBlock(block) {
  const firstMessage = block.split('\n').slice(1).find((l) => l.trim() !== '');
  return firstMessage !== undefined && TIMEOUT_FIRST_LINE_RE.test(firstMessage);
}

/** The `● name` failure blocks of a Jest log, minus console-output blocks. */
function failureBlocks(lines) {
  const blocks = [];
  let current = null;
  for (const line of lines) {
    if (BLOCK_START_RE.test(line)) {
      current = /^\s*● Console\b/.test(line) ? null : [line];
      if (current) blocks.push(current);
    } else if (BLOCK_END_RE.test(line)) {
      current = null;
    } else if (current) {
      current.push(line);
    }
  }
  return blocks.map((b) => b.join('\n'));
}

/**
 * Classify one task's log. 'timeout' only when Jest reports failed tests, every failure block
 * is a timeout, and there is a block for every failed test. Anything we cannot prove is 'other'
 * (blocking): a suite that failed to run, an assertion, a failure with no block, no log at all.
 */
function classifyLog(text) {
  if (typeof text !== 'string') return 'other';
  const clean = text.replace(ANSI_RE, '');
  if (SUITE_FAILED_RE.test(clean)) return 'other';
  let failedTests = 0;
  for (const m of clean.matchAll(FAILED_TESTS_RE)) failedTests += Number(m[1]);
  if (failedTests === 0) return 'other';
  const blocks = failureBlocks(clean.split(/\r?\n/));
  // >= because Jest may repeat every block under "Summary of all failing tests".
  if (blocks.length < failedTests) return 'other';
  return blocks.every(isTimeoutBlock) ? 'timeout' : 'other';
}

const succeeded = (task) => task.execution?.exitCode === 0;

/**
 * Compare the expected task graph with a run summary.
 * Returns { ok, failed: [{taskId, kind}], notRun: [taskId] }.
 */
function evaluate(expected, summary, readLog) {
  const byId = new Map(summary.tasks.map((t) => [t.taskId, t]));
  const failed = [];
  const notRun = [];
  for (const taskId of expected) {
    const task = byId.get(taskId);
    if (typeof task?.execution?.exitCode !== 'number') {
      notRun.push(taskId);
    } else if (task.execution.exitCode !== 0) {
      const isTest = taskId.endsWith('#test');
      const kind = isTest ? classifyLog(readLog(task)) : 'other';
      failed.push({ taskId, kind, logFile: task.logFile });
    }
  }
  return { ok: failed.length === 0 && notRun.length === 0, failed, notRun };
}

/** Decide what to do after the first run: pass, block, or retry the timeout-only tasks. */
function decide(first) {
  if (first.ok) return { action: 'pass' };
  if (first.failed.some((f) => f.kind !== 'timeout')) return { action: 'block' };
  // Tasks that never ran are only retried ALONGSIDE a proven timeout. With nothing failed, a task
  // that did not run is contradictory evidence (e.g. turbo failed before starting anything), and
  // a serial rerun of the whole graph would hide that.
  if (first.failed.length === 0) return { action: 'block' };
  const retry = [...first.failed.map((f) => f.taskId), ...first.notRun];
  return { action: 'retry', retry };
}

function packageOf(taskId) {
  return taskId.slice(0, taskId.lastIndexOf('#'));
}

/** Real Turbo, launched through its JS entry point with an argv array (no shell string). */
function realTurbo(args, { cwd, env, capture }) {
  const bin = require.resolve('turbo/bin/turbo', { paths: [cwd] });
  const r = spawnSync(process.execPath, [bin, ...args], {
    cwd,
    env,
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  if (r.error) throw r.error;
  return { code: r.status, stdout: r.stdout || '' };
}

function summaryFiles(runsDir) {
  return fs.existsSync(runsDir) ? fs.readdirSync(runsDir).filter((f) => f.endsWith('.json')) : [];
}

function newSummary(runsDir, before) {
  const fresh = summaryFiles(runsDir).filter((f) => !before.has(f));
  if (fresh.length !== 1) return null; // none, or ambiguous: refuse to guess
  const file = path.join(runsDir, fresh[0]);
  const summary = JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.rmSync(file); // ~0.5 MB per push otherwise; the verdict and any failing logs are reported
  summary.tasks = summary.tasks || [];
  return summary;
}

/**
 * One summarized Turbo run. Throws on missing or contradictory evidence; callers treat a throw
 * as a block.
 */
function summarizedRun(turbo, args, { cwd, env, log }) {
  const runsDir = path.join(cwd, '.turbo', 'runs');
  const before = new Set(summaryFiles(runsDir));
  const { code } = turbo(['run', 'test', '--summarize', ...args], { cwd, env });
  let summary;
  try {
    summary = newSummary(runsDir, before);
  } catch (e) {
    throw new Error(`run summary unreadable: ${e.message}`);
  }
  if (!summary) throw new Error('no single run summary was written for this run; refusing to guess');
  const turboSaysOk = code === 0;
  const summarySaysOk = summary.tasks.every(succeeded);
  if (turboSaysOk && !summarySaysOk) throw new Error('turbo exited 0 but its summary records a failed task');
  if (!turboSaysOk && summarySaysOk && summary.tasks.length > 0) {
    log(`note: turbo exited ${code} although every summarized task succeeded; the task graph check decides`);
  }
  return summary;
}

function expectedTasks(turbo, { cwd, env }) {
  const { code, stdout } = turbo(['run', 'test', '--dry=json'], { cwd, env, capture: true });
  if (code !== 0) throw new Error(`turbo --dry=json exited ${code}`);
  // A package with no script for a task still appears in the dry-run graph as a placeholder with
  // command "<NONEXISTENT>"; it never executes and a real run summary omits it entirely.
  const tasks = JSON.parse(stdout).tasks
    .filter((t) => t.command !== '<NONEXISTENT>')
    .map((t) => t.taskId);
  if (tasks.length === 0) throw new Error('turbo --dry=json listed no tasks');
  return tasks;
}

function preserveLogs(failed, cwd) {
  const dir = path.join(cwd, '.turbo', 'prepush');
  fs.rmSync(dir, { recursive: true, force: true }); // only this push's evidence, never an older one
  fs.mkdirSync(dir, { recursive: true });
  const kept = [];
  for (const f of failed) {
    if (!f.logFile) continue;
    const src = path.join(cwd, f.logFile);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(dir, `first-run-${f.taskId.replace(/[^A-Za-z0-9._-]/g, '_')}.log`);
    fs.copyFileSync(src, dest);
    kept.push(path.relative(cwd, dest));
  }
  return kept;
}

function report(log, evaluation, heading) {
  log(heading);
  for (const f of evaluation.failed) log(`   ${f.taskId}  (${f.kind}${f.logFile ? `, log: ${f.logFile}` : ''})`);
  for (const t of evaluation.notRun) log(`   ${t}  (did not run)`);
}

function main({ turbo = realTurbo, cwd = process.cwd(), env = process.env, log = console.log } = {}) {
  const readLog = (task) => {
    try {
      return task.logFile ? fs.readFileSync(path.join(cwd, task.logFile), 'utf8') : undefined;
    } catch {
      return undefined; // unreadable log => classifyLog says 'other' => blocks
    }
  };
  try {
    const ctx = { cwd, env, log };
    const expected = expectedTasks(turbo, ctx);
    const common = ['--continue=dependencies-successful', '--output-logs=full'];
    // No --concurrency on the first run: turbo.json's default (or TURBO_CONCURRENCY) governs, the
    // same bound every `npm test` gets. The retry's --concurrency=1 overrides it.
    const first = summarizedRun(turbo, common, ctx);
    const firstEval = evaluate(expected, first, readLog);
    const decision = decide(firstEval);

    if (decision.action === 'pass') {
      log('✓ every task in the test graph succeeded');
      return 0;
    }
    if (decision.action === 'block') {
      report(log, firstEval, '❌ blocking failure(s), no retry:');
      return 1;
    }

    const kept = preserveLogs(firstEval.failed, cwd);
    log('⚠️  first run failed ONLY on Jest timeouts (or tasks that never ran). This is the load');
    log('   flake this runner exists for, but it could also be a real hang. Retrying once, serially:');
    for (const t of decision.retry) log(`   ${t}`);
    if (kept.length) log(`   first-run logs kept: ${kept.join(', ')}`);

    const filters = [...new Set(decision.retry.map(packageOf))].map((p) => `--filter=${p}`);
    const second = summarizedRun(turbo, [...common, '--concurrency=1', ...filters], ctx);
    const retryEval = evaluate(decision.retry, second, readLog);
    if (!retryEval.ok) {
      report(log, retryEval, '❌ retry did not clear the failure(s). Blocking:');
      return 1;
    }
    log(`✓ passed after one serial retry of: ${decision.retry.join(', ')}`);
    log('  (first run timed out under load; say so if you cite this run as evidence)');
    return 0;
  } catch (e) {
    log(`❌ pre-push test gate could not establish a result: ${e.message}`);
    return 1;
  }
}

module.exports = { classifyLog, main };

if (require.main === module) {
  process.exitCode = main();
}
