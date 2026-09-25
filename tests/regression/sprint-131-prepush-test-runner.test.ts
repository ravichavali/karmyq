import { execFileSync, spawnSync } from 'child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';

import { ROOT, read } from './helpers/workspaces';

/**
 * Sprint 131 process PR: the pre-push unit + regression gate runs through
 * scripts/prepush-test-runner.js instead of a bare `npm test`.
 *
 * Uncapped, `turbo run test` on the Windows dev box runs every workspace at once with cores-1 Jest
 * workers each. Ordinary tests then hit their Jest timeouts (38 timeout messages in one measured
 * run) and pass standalone. The runner caps both layers and retries a TIMEOUT-ONLY failure once,
 * serially. These tests pin the part that must never weaken: everything else still blocks.
 *
 * Evidence is real wherever the gate reads it:
 *   - the classifier is fed genuine Jest output from fixture suites, not hand-written strings;
 *   - Turbo is replaced by a controlled child process that writes real summary and log files, and
 *     the runner launches it through its production code path (require.resolve + spawnSync);
 *   - the hook is exercised by a real `git push` into a throwaway bare repository.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const runner = require(join(ROOT, 'scripts/prepush-test-runner.js'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cap = require(join(ROOT, 'scripts/jest-worker-cap.js'));

const tempDirs: string[] = [];
const scratch = (prefix: string): string => {
  const d = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(d);
  return d;
};
afterAll(() => {
  for (const d of tempDirs) rmSync(d, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------------------------
// Real Jest output
// ---------------------------------------------------------------------------------------------

// One entry per scenario; a Record is several spec files run together in one Jest invocation.
const FIXTURES: Record<string, string | Record<string, string>> = {
  timeout: `test('slow', () => new Promise((r) => setTimeout(r, 3000)), 100);\ntest('fine', () => {});\n`,
  twoTimeouts: `test('a', () => new Promise((r) => setTimeout(r, 3000)), 100);\ntest('b', () => new Promise((r) => setTimeout(r, 3000)), 100);\n`,
  hookTimeout: `beforeAll(() => new Promise((r) => setTimeout(r, 3000)), 100);\ntest('a', () => {});\ntest('b', () => {});\n`,
  assertion: `test('bad', () => { expect(1).toBe(2); });\n`,
  timeoutPlusAssertion: `test('slow', () => new Promise((r) => setTimeout(r, 3000)), 100);\ntest('bad', () => { expect(1).toBe(2); });\n`,
  suiteBroken: `test('x', () => {\n`,
  passing: `test('ok', () => { expect(1).toBe(1); });\n`,
  timeoutWithConsole: `test('slow', async () => { console.log('Exceeded budget, still waiting'); await new Promise((r) => setTimeout(r, 3000)); }, 100);\n`,
  multiFileTimeouts: {
    one: `test('slow one', () => new Promise((r) => setTimeout(r, 3000)), 100);\n`,
    two: `test('slow two', () => new Promise((r) => setTimeout(r, 3000)), 100);\n`,
  },
  multiFileMixed: {
    one: `test('slow', () => new Promise((r) => setTimeout(r, 3000)), 100);\n`,
    two: `test('bad', () => { expect(1).toBe(2); });\n`,
  },
};

const jestOutput: Record<string, string> = {};

beforeAll(() => {
  const dir = scratch('karmyq-prepush-jest-');
  const jestBin = require.resolve('jest/bin/jest', { paths: [ROOT] });
  for (const [name, src] of Object.entries(FIXTURES)) {
    const sub = join(dir, name);
    mkdirSync(sub);
    const files = typeof src === 'string' ? { [name]: src } : src;
    for (const [file, body] of Object.entries(files)) writeFileSync(join(sub, `${file}.spec.js`), body);
    const config = JSON.stringify({ rootDir: sub, testEnvironment: 'node', testMatch: ['**/*.spec.js'], transform: {} });
    // --colors: the classifier must see through the ANSI codes a real terminal run carries.
    const r = spawnSync(process.execPath, [jestBin, '--config', config, '--colors', '--ci'], {
      cwd: sub,
      encoding: 'utf8',
      env: { ...process.env, KARMYQ_JEST_MAX_WORKERS: '' },
    });
    jestOutput[name] = `${r.stdout}${r.stderr}`;
  }
}, 120_000);

describe('classifyLog reads genuine Jest output', () => {
  it.each([
    ['timeout', 'timeout'],
    ['twoTimeouts', 'timeout'],
    ['hookTimeout', 'timeout'],
    ['assertion', 'other'],
    ['timeoutPlusAssertion', 'other'],
    ['suiteBroken', 'other'],
    ['timeoutWithConsole', 'timeout'],
    ['multiFileTimeouts', 'timeout'],
    ['multiFileMixed', 'other'],
  ])('%s -> %s', (fixture, expected) => {
    expect(jestOutput[fixture]).toMatch(/Tests:/); // the fixture really ran
    expect(runner.classifyLog(jestOutput[fixture])).toBe(expected);
  });

  it('treats a passing log, an empty log and a missing log as not-a-timeout', () => {
    expect(runner.classifyLog(jestOutput.passing)).toBe('other');
    expect(runner.classifyLog('')).toBe('other');
    expect(runner.classifyLog(undefined)).toBe('other');
  });
});

// ---------------------------------------------------------------------------------------------
// A controlled stand-in for turbo, launched through the runner's real spawn path
// ---------------------------------------------------------------------------------------------

type TaskState = { exitCode?: number; log?: string; absent?: boolean };
type Step = { code: number; noSummary?: boolean; tasks: Record<string, TaskState> };
// placeholders: tasks turbo's dry run lists with command "<NONEXISTENT>" (a package with no script
// for that task). A real run summary omits them, as on this repo's mobile/tests/geocoding builds.
type Scenario = { dry: string[]; placeholders?: string[]; runs: Step[] };

const FAKE_TURBO = `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const cwd = process.cwd();
const args = process.argv.slice(2);
const scenario = JSON.parse(fs.readFileSync(path.join(cwd, 'scenario.json'), 'utf8'));
const callsFile = path.join(cwd, 'turbo-calls.jsonl');
fs.appendFileSync(callsFile, JSON.stringify(args) + '\\n');
if (args.includes('--dry=json')) {
  const placeholders = (scenario.placeholders || []).map((taskId) => ({ taskId, command: '<NONEXISTENT>' }));
  process.stdout.write(JSON.stringify({ tasks: [...scenario.dry.map((taskId) => ({ taskId, command: 'jest' })), ...placeholders] }));
  process.exit(0);
}
const runIndex = fs.readFileSync(callsFile, 'utf8').trim().split('\\n')
  .map((l) => JSON.parse(l)).filter((a) => !a.includes('--dry=json')).length - 1;
const step = scenario.runs[runIndex];
if (!step) process.exit(97);
const tasks = [];
for (const [taskId, t] of Object.entries(step.tasks)) {
  if (t.absent) continue;
  const logFile = path.join('logs', taskId.replace(/[^A-Za-z0-9._-]/g, '_') + '.log');
  if (t.log !== undefined) {
    fs.mkdirSync(path.join(cwd, 'logs'), { recursive: true });
    fs.writeFileSync(path.join(cwd, logFile), t.log);
  }
  const entry = { taskId, logFile };
  if (typeof t.exitCode === 'number') entry.execution = { exitCode: t.exitCode };
  tasks.push(entry);
}
if (!step.noSummary) {
  const runs = path.join(cwd, '.turbo', 'runs');
  fs.mkdirSync(runs, { recursive: true });
  fs.writeFileSync(path.join(runs, 'run-' + runIndex + '.json'), JSON.stringify({ tasks }));
}
process.exit(step.code);
`;

function installFakeTurbo(dir: string, scenario: Scenario): void {
  mkdirSync(join(dir, 'node_modules/turbo/bin'), { recursive: true });
  writeFileSync(join(dir, 'node_modules/turbo/package.json'), '{"name":"turbo","version":"0.0.0-fake"}');
  writeFileSync(join(dir, 'node_modules/turbo/bin/turbo'), FAKE_TURBO);
  writeFileSync(join(dir, 'scenario.json'), JSON.stringify(scenario));
}

const turboCalls = (dir: string): string[][] => {
  const file = join(dir, 'turbo-calls.jsonl');
  if (!existsSync(file)) return []; // the runner stopped before starting turbo at all
  return readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
};

function runScenario(scenario: Scenario, env: Record<string, string> = {}) {
  const dir = scratch('karmyq-prepush-run-');
  installFakeTurbo(dir, scenario);
  const lines: string[] = [];
  const code = runner.main({ cwd: dir, env: { ...process.env, ...env }, log: (l: string) => lines.push(l) });
  const calls = turboCalls(dir).filter((a) => !a.includes('--dry=json'));
  return { code, calls, output: lines.join('\n'), dir };
}

const BUILD = 'pkg-a#build';
const TEST_A = 'pkg-a#test';
const TEST_B = 'pkg-b#test';
const GRAPH = [BUILD, TEST_A, TEST_B];
const ok = { exitCode: 0, log: 'Tests:       3 passed, 3 total\n' };

describe('runner policy, end to end through a child process', () => {
  it('passes when every task in the graph succeeds, without a retry', () => {
    // With a script-less placeholder in the graph, exactly as the real repo has: the first real
    // run of this runner blocked every push by waiting for placeholders that never execute.
    const r = runScenario({
      dry: GRAPH,
      placeholders: ['pkg-c#build'],
      runs: [{ code: 0, tasks: { [BUILD]: ok, [TEST_A]: ok, [TEST_B]: ok } }],
    });
    expect(r.code).toBe(0);
    expect(r.calls).toHaveLength(1);
    expect(r.calls[0]).toEqual(expect.arrayContaining(['--continue=dependencies-successful', '--concurrency=4']));
  });

  it('retries a timeout-only failure once, serially, filtered to that package, and passes if it clears', () => {
    const timedOut = { exitCode: 1, log: jestOutput.timeout };
    const r = runScenario({
      dry: GRAPH,
      runs: [
        { code: 1, tasks: { [BUILD]: ok, [TEST_A]: timedOut, [TEST_B]: ok } },
        { code: 0, tasks: { [BUILD]: ok, [TEST_A]: ok } },
      ],
    });
    expect(r.code).toBe(0);
    expect(r.calls).toHaveLength(2);
    expect(r.calls[1]).toEqual(expect.arrayContaining(['--concurrency=1', '--filter=pkg-a']));
    expect(r.calls[1].filter((a) => a.startsWith('--filter='))).toEqual(['--filter=pkg-a']);
    // The first run's evidence survives the retry, and the report says a retry happened.
    expect(existsSync(join(r.dir, '.turbo/prepush/first-run-pkg-a_test.log'))).toBe(true);
    expect(readFileSync(join(r.dir, '.turbo/prepush/first-run-pkg-a_test.log'), 'utf8')).toBe(jestOutput.timeout);
    expect(r.output).toMatch(/passed after one serial retry of: pkg-a#test/);
  });

  it('blocks when the retry times out again', () => {
    const timedOut = { exitCode: 1, log: jestOutput.timeout };
    const r = runScenario({
      dry: GRAPH,
      runs: [
        { code: 1, tasks: { [BUILD]: ok, [TEST_A]: timedOut, [TEST_B]: ok } },
        { code: 1, tasks: { [BUILD]: ok, [TEST_A]: timedOut } },
      ],
    });
    expect(r.code).toBe(1);
    expect(r.calls).toHaveLength(2); // exactly one retry, never a second
  });

  it.each([
    ['an assertion failure', jestOutput.assertion],
    ['a timeout alongside an assertion failure', jestOutput.timeoutPlusAssertion],
    ['a suite that failed to run', jestOutput.suiteBroken],
    ['an unknown failure with an empty log', ''],
  ])('blocks on %s without retrying', (_label, log) => {
    const r = runScenario({ dry: GRAPH, runs: [{ code: 1, tasks: { [BUILD]: ok, [TEST_A]: { exitCode: 1, log }, [TEST_B]: ok } }] });
    expect(r.code).toBe(1);
    expect(r.calls).toHaveLength(1);
  });

  it('blocks on a failed test whose log file is missing', () => {
    const r = runScenario({ dry: GRAPH, runs: [{ code: 1, tasks: { [BUILD]: ok, [TEST_A]: { exitCode: 1 }, [TEST_B]: ok } }] });
    expect(r.code).toBe(1);
    expect(r.calls).toHaveLength(1);
  });

  it('blocks on a build failure, even when its dependent test never started', () => {
    const r = runScenario({
      dry: GRAPH,
      runs: [{ code: 1, tasks: { [BUILD]: { exitCode: 2, log: jestOutput.timeout }, [TEST_A]: { absent: true }, [TEST_B]: ok } }],
    });
    expect(r.code).toBe(1);
    expect(r.calls).toHaveLength(1);
  });

  it('treats a task that never ran as unfinished: retried, and required to succeed', () => {
    const cancelled = { dry: GRAPH, runs: [{ code: 1, tasks: { [BUILD]: ok, [TEST_A]: {}, [TEST_B]: ok } }] } as Scenario;

    const cleared = runScenario({ ...cancelled, runs: [...cancelled.runs, { code: 0, tasks: { [BUILD]: ok, [TEST_A]: ok } }] });
    expect(cleared.code).toBe(0);
    expect(cleared.calls[1]).toEqual(expect.arrayContaining(['--filter=pkg-a']));

    const stillMissing = runScenario({ ...cancelled, runs: [...cancelled.runs, { code: 0, tasks: { [BUILD]: ok } }] });
    expect(stillMissing.code).toBe(1);
  });

  it('blocks when a task from the graph is missing from the summary altogether and does not appear on retry', () => {
    const r = runScenario({
      dry: GRAPH,
      runs: [
        { code: 0, tasks: { [BUILD]: ok, [TEST_A]: ok } },
        { code: 0, tasks: { [BUILD]: ok } },
      ],
    });
    expect(r.code).toBe(1);
  });

  it('blocks when turbo writes no run summary', () => {
    const r = runScenario({ dry: GRAPH, runs: [{ code: 0, noSummary: true, tasks: {} }] });
    expect(r.code).toBe(1);
    expect(r.output).toMatch(/no single run summary/);
  });

  it('blocks when turbo exits 0 but its summary records a failure', () => {
    const r = runScenario({ dry: GRAPH, runs: [{ code: 0, tasks: { [BUILD]: ok, [TEST_A]: { exitCode: 1, log: jestOutput.timeout }, [TEST_B]: ok } }] });
    expect(r.code).toBe(1);
    expect(r.calls).toHaveLength(1);
  });

  it('blocks when the turbo process itself crashes', () => {
    const r = runScenario({ dry: GRAPH, runs: [] }); // the stand-in exits 97 with no summary
    expect(r.code).toBe(1);
  });

  it('blocks on an invalid concurrency setting instead of guessing', () => {
    const r = runScenario({ dry: GRAPH, runs: [{ code: 0, tasks: { [BUILD]: ok, [TEST_A]: ok, [TEST_B]: ok } }] }, {
      KARMYQ_PREPUSH_CONCURRENCY: 'lots',
    });
    expect(r.code).toBe(1);
    expect(r.output).toMatch(/KARMYQ_PREPUSH_CONCURRENCY must be a positive integer/);
    expect(turboCalls(r.dir)).toEqual([]); // refused before running anything
  });
});

// ---------------------------------------------------------------------------------------------
// The installed hook rejects a real push
// ---------------------------------------------------------------------------------------------

describe('the pre-push hook enforces the runner on a real git push', () => {
  const push = (scenario: Scenario) => {
    const remote = scratch('karmyq-prepush-remote-');
    const work = scratch('karmyq-prepush-work-');
    execFileSync('git', ['init', '-q', '--bare', remote]);
    execFileSync('git', ['init', '-q', '-b', 'main', work]);
    const git = (...a: string[]) => execFileSync('git', a, { cwd: work, encoding: 'utf8' });
    git('config', 'user.email', 'test@example.invalid');
    git('config', 'user.name', 'test');
    git('config', 'core.hooksPath', '.git/hooks');

    for (const f of ['scripts/prepush-test-runner.js', 'scripts/jest-worker-cap.js', 'scripts/promote-tdd-tests.js']) {
      mkdirSync(dirname(join(work, f)), { recursive: true });
      cpSync(join(ROOT, f), join(work, f));
    }
    writeFileSync(join(work, 'package.json'), JSON.stringify({ name: 'fixture', private: true, scripts: { 'test:tdd': 'node -e ""' } }));
    installFakeTurbo(work, scenario);
    cpSync(join(ROOT, 'scripts/git-hooks/pre-push'), join(work, '.git/hooks/pre-push'));
    chmodSync(join(work, '.git/hooks/pre-push'), 0o755);
    writeFileSync(join(work, '.gitignore'), 'node_modules/\n.turbo/\nlogs/\nturbo-calls.jsonl\n');
    git('add', '.');
    git('commit', '-q', '-m', 'fixture');
    git('remote', 'add', 'origin', remote);

    const env: NodeJS.ProcessEnv = { ...process.env };
    for (const k of ['SKIP_PREPUSH', 'DATABASE_URL', 'POSTGRES_HOST', 'KARMYQ_PREPUSH_CONCURRENCY', 'KARMYQ_JEST_MAX_WORKERS']) delete env[k];
    const r = spawnSync('git', ['push', 'origin', 'main'], { cwd: work, env, encoding: 'utf8' });
    const remoteHasMain = spawnSync('git', ['rev-parse', '--verify', '--quiet', 'refs/heads/main'], { cwd: remote }).status === 0;
    return { status: r.status, output: `${r.stdout}${r.stderr}`, remoteHasMain };
  };

  it('rejects the push when a test fails, and the remote never receives the ref', () => {
    const r = push({ dry: [TEST_A], runs: [{ code: 1, tasks: { [TEST_A]: { exitCode: 1, log: jestOutput.assertion } } }] });
    expect(r.output).toMatch(/Running pre-push checks/); // a hook really ran
    expect(r.status).not.toBe(0);
    expect(r.remoteHasMain).toBe(false);
  }, 120_000);

  it('accepts the push when the runner passes', () => {
    const r = push({ dry: [TEST_A], runs: [{ code: 0, tasks: { [TEST_A]: ok } }] });
    expect(r.output).toMatch(/Running pre-push checks/);
    expect(r.status).toBe(0);
    expect(r.remoteHasMain).toBe(true);
  }, 120_000);
});

// ---------------------------------------------------------------------------------------------
// The caps actually reach every Jest the gate starts
// ---------------------------------------------------------------------------------------------

/**
 * Resolve a workspace's jest config the way Jest does: in a plain Node process, from the workspace
 * directory (next/jest finds the app from the cwd, and its config loader needs a real dynamic
 * import, which Jest's sandbox refuses), awaiting an async config. Returns maxWorkers.
 */
async function resolvedMaxWorkers(cwd: string, configPath: string): Promise<number | undefined> {
  const src = `Promise.resolve(require(${JSON.stringify(configPath)}))
    .then((c) => (typeof c === 'function' ? c() : c))
    .then((c) => process.stdout.write(JSON.stringify({ maxWorkers: c.maxWorkers ?? null })))
    .catch((e) => { process.stderr.write(String(e && e.stack || e)); process.exit(2); });`;
  const r = spawnSync(process.execPath, ['-e', src], {
    cwd,
    env: { ...process.env, KARMYQ_JEST_MAX_WORKERS: '3' },
    encoding: 'utf8',
  });
  if (r.status !== 0) throw new Error(`${cwd}: config did not load: ${r.stderr}`);
  return JSON.parse(r.stdout).maxWorkers ?? undefined;
}

describe('the Jest worker cap', () => {
  it('leaves a config untouched when unset, applies a valid value, and refuses a bad one', () => {
    expect(cap.withWorkerCap({ a: 1 }, {})).toEqual({ a: 1 });
    expect(cap.withWorkerCap({ a: 1 }, { KARMYQ_JEST_MAX_WORKERS: '' })).toEqual({ a: 1 });
    expect(cap.withWorkerCap({ a: 1 }, { KARMYQ_JEST_MAX_WORKERS: '3' })).toEqual({ a: 1, maxWorkers: 3 });
    expect(cap.withWorkerCap({ maxWorkers: 1 }, { KARMYQ_JEST_MAX_WORKERS: '3' })).toEqual({ maxWorkers: 1 });
    for (const bad of ['0', '-1', '2.5', '50%', 'two', ' 3']) {
      expect(() => cap.withWorkerCap({}, { KARMYQ_JEST_MAX_WORKERS: bad })).toThrow(/positive integer/);
    }
  });

  it('every workspace that runs Jest either applies the cap or runs serially', async () => {
    const workspaces: string[] = JSON.parse(read('package.json')).workspaces;
    const dirs = workspaces.flatMap((glob) => {
      if (!glob.endsWith('/*')) return [glob];
      const base = glob.slice(0, -2);
      return require('fs').readdirSync(join(ROOT, base)).map((d: string) => `${base}/${d}`);
    }).filter((d: string) => existsSync(join(ROOT, d, 'package.json')));

    const testing = dirs.filter((d) => JSON.parse(read(`${d}/package.json`)).scripts?.test);
    const capped: string[] = [];
    const serial: string[] = [];
    const neither: string[] = [];
    for (const d of testing) {
      const configPath = join(ROOT, d, 'jest.config.js');
      if (existsSync(configPath)) {
        ((await resolvedMaxWorkers(join(ROOT, d), configPath)) === 3 ? capped : neither).push(d);
      } else {
        const scripts: Record<string, string> = JSON.parse(read(`${d}/package.json`)).scripts;
        const jestCalls = Object.values(scripts).filter((s) => /\bjest\b/.test(s) && !/--watch/.test(s));
        (jestCalls.length > 0 && jestCalls.every((s) => /--runInBand/.test(s)) ? serial : neither).push(d);
      }
    }

    expect(neither).toEqual([]);
    expect(serial).toEqual(['services/geocoding-service']);
    expect(testing.length).toBeGreaterThan(10); // discovery found the real workspaces
    expect(capped).toHaveLength(testing.length - 1);
  }, 120_000);

  it('the config check fails for a jest config that does not apply the cap', async () => {
    const dir = scratch('karmyq-prepush-config-');
    writeFileSync(join(dir, 'jest.config.js'), "module.exports = { testEnvironment: 'node' };\n");
    expect(await resolvedMaxWorkers(dir, join(dir, 'jest.config.js'))).toBeUndefined();
  });

  it('turbo passes the cap through to every test task (strict env mode strips it otherwise)', () => {
    const dry = JSON.parse(
      execFileSync(process.execPath, [require.resolve('turbo/bin/turbo', { paths: [ROOT] }), 'run', 'test', '--dry=json'], {
        cwd: ROOT,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      })
    );
    const testTasks = dry.tasks.filter((t: { taskId: string }) => t.taskId.endsWith('#test'));
    expect(testTasks.length).toBeGreaterThanOrEqual(15);
    const missing = testTasks
      .filter((t: { environmentVariables: { specified: { passThroughEnv: string[] | null } } }) =>
        !(t.environmentVariables.specified.passThroughEnv || []).includes('KARMYQ_JEST_MAX_WORKERS'))
      .map((t: { taskId: string }) => t.taskId);
    expect(missing).toEqual([]);
  }, 180_000);
});
