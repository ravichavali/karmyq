#!/usr/bin/env node
/**
 * Pre-push unit + regression gate: `turbo run test` with bounded parallelism and ONE narrow retry.
 *
 * Why this exists. On the Windows dev box an uncapped `npm test` runs every workspace at once and
 * each workspace's Jest starts cores-1 workers. Ordinary tests then slow down enough to hit their
 * Jest timeouts in a different workspace each run, while passing standalone. The hook used to fail
 * on that, and the workaround became skipping the hook. This runner fixes the load instead:
 *   - Turbo concurrency is capped (KARMYQ_PREPUSH_CONCURRENCY) and so is each Jest's worker pool
 *     (KARMYQ_JEST_MAX_WORKERS, applied by scripts/jest-worker-cap.js). Defaults below were
 *     measured, see the PR that introduced this file.
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
const { ENV: JEST_ENV, workerCap } = require('./jest-worker-cap');

const CONCURRENCY_ENV = 'KARMYQ_PREPUSH_CONCURRENCY';
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_JEST_WORKERS = 2;

// Jest's own wording, read from real Jest 30 output (see the regression test's fixtures). Each
// failed test gets a `● <name>` block; a timed-out test or hook carries this message inside its
// own block (printed twice there: once as the error, once in the code frame).
const TIMEOUT_RE = /Exceeded timeout of \d+ ms for a (?:test|hook)/;
const SUITE_FAILED_RE = /Test suite failed to run/;
const FAILED_TESTS_RE = /^Tests:\s+(\d+) failed/gm;
const BLOCK_START_RE = /^\s*● /;
const BLOCK_END_RE = /^(?:PASS|FAIL) |^Test Suites:|^Tests:|^Summary of all failing tests/;
const ANSI_RE = /\x1b\[[0-9;]*m/g;

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

function positiveInt(name, raw, fallback) {
  if (raw === undefined || raw === '') return fallback;
  if (!/^[1-9][0-9]*$/.test(raw)) throw new Error(`${name} must be a positive integer, got ${JSON.stringify(raw)}`);
  return Number(raw);
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
  return blocks.every((b) => TIMEOUT_RE.test(b)) ? 'timeout' : 'other';
}

function succeeded(task) {
  return Boolean(task && task.execution && task.execution.exitCode === 0);
}

/**
 * Compare the expected task graph with a run summary.
 * Returns { ok, failed: [{taskId, kind}], notRun: [taskId] }.
 */
function evaluate(expected, summary, readLog) {
  const byId = new Map((summary.tasks || []).map((t) => [t.taskId, t]));
  const failed = [];
  const notRun = [];
  for (const taskId of expected) {
    const task = byId.get(taskId);
    if (!task || !task.execution || typeof task.execution.exitCode !== 'number') {
      notRun.push(taskId);
    } else if (!succeeded(task)) {
      const isTest = taskId.endsWith('#test');
      const kind = isTest ? classifyLog(readLog(task)) : 'other';
      failed.push({ taskId, kind, logFile: task.logFile });
    }
  }
  return { ok: failed.length === 0 && notRun.length === 0, failed, notRun };
}

/** Decide what to do after the first run. Pure, so the gate's policy is unit-testable. */
function decide(first) {
  if (first.ok) return { action: 'pass' };
  const blocking = first.failed.filter((f) => f.kind !== 'timeout');
  if (blocking.length > 0) return { action: 'block', reason: 'non-timeout failure', blocking };
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
  return JSON.parse(fs.readFileSync(path.join(runsDir, fresh[0]), 'utf8'));
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
  const summarySaysOk = (summary.tasks || []).every(succeeded);
  if (turboSaysOk && !summarySaysOk) throw new Error('turbo exited 0 but its summary records a failed task');
  if (!turboSaysOk && summarySaysOk && (summary.tasks || []).length > 0) {
    log(`note: turbo exited ${code} although every summarized task succeeded; the task graph check decides`);
  }
  return { code, summary };
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

function main({ turbo = realTurbo, cwd = process.cwd(), env = process.env, log = console.log } = {}) {
  const readLog = (task) => {
    try {
      return task.logFile ? fs.readFileSync(path.join(cwd, task.logFile), 'utf8') : undefined;
    } catch {
      return undefined; // unreadable log => classifyLog says 'other' => blocks
    }
  };
  try {
    // Inside the try: an invalid setting must block with a message, not crash the hook.
    const concurrency = positiveInt(CONCURRENCY_ENV, env[CONCURRENCY_ENV], DEFAULT_CONCURRENCY);
    const runEnv = { ...env };
    if (workerCap(env) === undefined) runEnv[JEST_ENV] = String(DEFAULT_JEST_WORKERS);
    const ctx = { cwd, env: runEnv, log };
    log(`pre-push tests: turbo concurrency ${concurrency}, jest workers ${runEnv[JEST_ENV]}`);
    const expected = expectedTasks(turbo, ctx);
    const common = ['--continue=dependencies-successful', '--output-logs=full'];
    const first = summarizedRun(turbo, [...common, `--concurrency=${concurrency}`], ctx);
    const firstEval = evaluate(expected, first.summary, readLog);
    const decision = decide(firstEval);

    if (decision.action === 'pass') {
      log('✓ every task in the test graph succeeded');
      return 0;
    }
    if (decision.action === 'block') {
      log('❌ blocking failure(s), no retry:');
      for (const f of decision.blocking) log(`   ${f.taskId}${f.logFile ? `  (log: ${f.logFile})` : ''}`);
      for (const t of firstEval.notRun) log(`   ${t}  (did not run)`);
      return 1;
    }

    const kept = preserveLogs(firstEval.failed, cwd);
    log('⚠️  first run failed ONLY on Jest timeouts (or tasks that never ran). This is the load');
    log('   flake this runner exists for, but it could also be a real hang. Retrying once, serially:');
    for (const t of decision.retry) log(`   ${t}`);
    if (kept.length) log(`   first-run logs kept: ${kept.join(', ')}`);

    const filters = [...new Set(decision.retry.map(packageOf))].map((p) => `--filter=${p}`);
    const second = summarizedRun(turbo, [...common, '--concurrency=1', ...filters], ctx);
    const retryEval = evaluate(decision.retry, second.summary, readLog);
    if (!retryEval.ok) {
      log('❌ retry did not clear the failure(s). Blocking. First-run and retry evidence:');
      for (const f of retryEval.failed) log(`   ${f.taskId} failed again (${f.kind})`);
      for (const t of retryEval.notRun) log(`   ${t} did not run on retry`);
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

module.exports = { classifyLog, evaluate, decide, main, positiveInt, CONCURRENCY_ENV };

if (require.main === module) {
  process.exitCode = main();
}
