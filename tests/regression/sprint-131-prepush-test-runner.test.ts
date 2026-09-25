import { execFileSync, spawn, spawnSync } from 'child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';

import { ROOT, allWorkspaces, read } from './helpers/workspaces';

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
  timeout: `test('slow', () => new Promise((r) => setTimeout(r, 400)), 100);\ntest('fine', () => {});\n`,
  twoTimeouts: `test('a', () => new Promise((r) => setTimeout(r, 400)), 100);\ntest('b', () => new Promise((r) => setTimeout(r, 400)), 100);\n`,
  hookTimeout: `beforeAll(() => new Promise((r) => setTimeout(r, 400)), 100);\ntest('a', () => {});\ntest('b', () => {});\n`,
  assertion: `test('bad', () => { expect(1).toBe(2); });\n`,
  timeoutPlusAssertion: `test('slow', () => new Promise((r) => setTimeout(r, 400)), 100);\ntest('bad', () => { expect(1).toBe(2); });\n`,
  suiteBroken: `test('x', () => {\n`,
  passing: `test('ok', () => { expect(1).toBe(1); });\n`,
  timeoutWithConsole: `test('slow', async () => { console.log('Exceeded budget, still waiting'); await new Promise((r) => setTimeout(r, 400)); }, 100);\n`,
  multiFileTimeouts: {
    one: `test('slow one', () => new Promise((r) => setTimeout(r, 400)), 100);\n`,
    two: `test('slow two', () => new Promise((r) => setTimeout(r, 400)), 100);\n`,
  },
  // Jest prints the afterEach error as a second block for the same test.
  timeoutPlusAfterEachAssertion: `afterEach(() => { expect(1).toBe(2); });\ntest('slow', () => new Promise((r) => setTimeout(r, 400)), 100);\n`,
  // An assertion failure whose printed value merely CONTAINS Jest's timeout wording.
  assertionQuotingTimeout: `test('msg', () => { expect('Exceeded timeout of 100 ms for a test.').toBe('x'); });\n`,
  multiFileMixed: {
    one: `test('slow', () => new Promise((r) => setTimeout(r, 400)), 100);\n`,
    two: `test('bad', () => { expect(1).toBe(2); });\n`,
  },
};

const jestOutput: Record<string, string> = {};

beforeAll(async () => {
  const dir = scratch('karmyq-prepush-jest-');
  const jestBin = require.resolve('jest/bin/jest', { paths: [ROOT] });
  // The fixture Jest runs are independent, so they run concurrently: this suite blocks every push.
  await Promise.all(
    Object.entries(FIXTURES).map(([name, src]) => {
      const sub = join(dir, name);
      mkdirSync(sub);
      const files = typeof src === 'string' ? { [name]: src } : src;
      for (const [file, body] of Object.entries(files)) writeFileSync(join(sub, `${file}.spec.js`), body);
      const config = JSON.stringify({ rootDir: sub, testEnvironment: 'node', testMatch: ['**/*.spec.js'], transform: {} });
      // --colors: the classifier must see through the ANSI codes a real terminal run carries.
      const child = spawn(process.execPath, [jestBin, '--config', config, '--colors', '--ci', '--runInBand'], {
        cwd: sub,
        env: { ...process.env, KARMYQ_JEST_MAX_WORKERS: '' },
      });
      let out = '';
      child.stdout.on('data', (d) => (out += d));
      child.stderr.on('data', (d) => (out += d));
      return new Promise<void>((resolve) => child.on('close', () => { jestOutput[name] = out; resolve(); }));
    })
  );
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
    ['timeoutPlusAfterEachAssertion', 'other'],
    ['assertionQuotingTimeout', 'other'],
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

function runScenario(scenario: Scenario) {
  const dir = scratch('karmyq-prepush-run-');
  installFakeTurbo(dir, scenario);
  const lines: string[] = [];
  const code = runner.main({ cwd: dir, log: (l: string) => lines.push(l) });
  const calls = turboCalls(dir).filter((a) => !a.includes('--dry=json'));
  return { code, calls, output: lines.join('\n'), dir };
}

const BUILD = 'pkg-a#build';
const TEST_A = 'pkg-a#test';
const TEST_B = 'pkg-b#test';
const GRAPH = [BUILD, TEST_A, TEST_B];
// A function: jestOutput is only filled once beforeAll has run Jest.
const timedOut = () => ({ exitCode: 1, log: jestOutput.timeout });
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
    expect(r.calls[0]).toContain('--continue=dependencies-successful');
    // turbo.json's concurrency governs the first run, exactly as for `npm test`; no flag overrides it.
    expect(r.calls[0].filter((a) => a.startsWith('--concurrency'))).toEqual([]);
  });

  it('retries a timeout-only failure once, serially, filtered to that package, and passes if it clears', () => {
    const r = runScenario({
      dry: GRAPH,
      runs: [
        { code: 1, tasks: { [BUILD]: ok, [TEST_A]: timedOut(), [TEST_B]: ok } },
        { code: 0, tasks: { [BUILD]: ok, [TEST_A]: ok } },
      ],
    });
    expect(r.code).toBe(0);
    expect(r.calls).toHaveLength(2);
    expect(r.calls[1]).toContain('--concurrency=1');
    expect(r.calls[1].filter((a) => a.startsWith('--filter='))).toEqual(['--filter=pkg-a']);
    // The first run's evidence survives the retry, and the report says a retry happened.
    expect(readFileSync(join(r.dir, '.turbo/prepush/first-run-pkg-a_test.log'), 'utf8')).toBe(jestOutput.timeout);
    expect(r.output).toMatch(/passed after one serial retry of: pkg-a#test/);
  });

  it('blocks when the retry times out again', () => {
    const r = runScenario({
      dry: GRAPH,
      runs: [
        { code: 1, tasks: { [BUILD]: ok, [TEST_A]: timedOut(), [TEST_B]: ok } },
        { code: 1, tasks: { [BUILD]: ok, [TEST_A]: timedOut() } },
      ],
    });
    expect(r.code).toBe(1);
    expect(r.calls).toHaveLength(2); // exactly one retry, never a second
  });

  // Rows name a fixture rather than holding its output: an it.each table is built at collection
  // time, before beforeAll has run Jest, so `jestOutput.assertion` here would be undefined and
  // every row would silently test "missing log" instead.
  it.each([
    ['an assertion failure', 'assertion'],
    ['a timeout alongside an assertion failure', 'timeoutPlusAssertion'],
    ['a timeout in one file and an assertion in another', 'multiFileMixed'],
    ['a suite that failed to run', 'suiteBroken'],
    ['an unknown failure with an empty log', ''],
    ['a failed test whose log file is missing', undefined],
  ])('blocks on %s without retrying', (_label, fixture) => {
    const log = fixture ? jestOutput[fixture] : fixture;
    if (fixture) expect(log).toMatch(/Tests:.*failed|Test suite failed to run/); // real Jest output is really there
    const r = runScenario({ dry: GRAPH, runs: [{ code: 1, tasks: { [BUILD]: ok, [TEST_A]: { exitCode: 1, log }, [TEST_B]: ok } }] });
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

  it('retries a task that never ran alongside a timeout, and requires it to succeed', () => {
    // pkg-b timed out and pkg-a was cancelled: both are unfinished, both are retried.
    const first: Step = { code: 1, tasks: { [BUILD]: ok, [TEST_A]: {}, [TEST_B]: timedOut() } };

    const cleared = runScenario({ dry: GRAPH, runs: [first, { code: 0, tasks: { [BUILD]: ok, [TEST_A]: ok, [TEST_B]: ok } }] });
    expect(cleared.code).toBe(0);
    expect(cleared.calls[1].filter((a) => a.startsWith('--filter=')).sort()).toEqual(['--filter=pkg-a', '--filter=pkg-b']);

    const stillMissing = runScenario({ dry: GRAPH, runs: [first, { code: 0, tasks: { [BUILD]: ok, [TEST_B]: ok } }] });
    expect(stillMissing.code).toBe(1);
  });

  it.each([
    ['a task that never ran while nothing failed', { code: 1, tasks: { [BUILD]: ok, [TEST_A]: {}, [TEST_B]: ok } }],
    ['a task missing from the summary altogether', { code: 0, tasks: { [BUILD]: ok, [TEST_A]: ok } }],
    // turbo failed before any task ran: every task "never ran". Retrying would re-run the whole
    // suite serially and hide that turbo itself failed.
    ['a failed turbo run whose summary lists no tasks', { code: 1, tasks: {} }],
  ])('blocks without retrying on %s', (_label, step) => {
    const r = runScenario({ dry: GRAPH, runs: [step as Step] });
    expect(r.code).toBe(1);
    expect(r.calls).toHaveLength(1);
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
    for (const k of ['SKIP_PREPUSH', 'DATABASE_URL', 'POSTGRES_HOST', 'TURBO_CONCURRENCY', 'KARMYQ_JEST_MAX_WORKERS']) delete env[k];
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
async function resolvedMaxWorkers(cwd: string, configPath: string, cap = '3'): Promise<number | undefined> {
  const src = `Promise.resolve(require(${JSON.stringify(configPath)}))
    .then((c) => (typeof c === 'function' ? c() : c))
    .then((c) => process.stdout.write(JSON.stringify({ maxWorkers: c.maxWorkers ?? null })))
    .catch((e) => { process.stderr.write(String(e && e.stack || e)); process.exit(2); });`;
  const r = spawnSync(process.execPath, ['-e', src], {
    cwd,
    env: { ...process.env, KARMYQ_JEST_MAX_WORKERS: cap },
    encoding: 'utf8',
  });
  if (r.status !== 0) throw new Error(`${cwd}: config did not load: ${r.stderr}`);
  return JSON.parse(r.stdout).maxWorkers ?? undefined;
}

describe('the Jest worker cap', () => {
  it('defaults to 2 workers, applies a valid override, keeps a pinned value, and refuses a bad one', () => {
    expect(cap.DEFAULT_WORKERS).toBe(2);
    expect(cap.withWorkerCap({ a: 1 }, {})).toEqual({ a: 1, maxWorkers: 2 });
    expect(cap.withWorkerCap({ a: 1 }, { KARMYQ_JEST_MAX_WORKERS: '' })).toEqual({ a: 1, maxWorkers: 2 });
    expect(cap.withWorkerCap({ a: 1 }, { KARMYQ_JEST_MAX_WORKERS: '3' })).toEqual({ a: 1, maxWorkers: 3 });
    expect(cap.withWorkerCap({ maxWorkers: 1 }, { KARMYQ_JEST_MAX_WORKERS: '3' })).toEqual({ maxWorkers: 1 });
    for (const bad of ['0', '-1', '2.5', '50%', 'two', ' 3']) {
      expect(() => cap.withWorkerCap({}, { KARMYQ_JEST_MAX_WORKERS: bad })).toThrow(/positive integer/);
    }
  });

  it('every workspace that runs Jest either applies the cap or runs serially', async () => {
    const testing = allWorkspaces()
      .map(({ ws, dir }) => ({ ws, dir, scripts: (JSON.parse(read(`${ws}/package.json`)).scripts || {}) as Record<string, string> }))
      .filter((w) => w.scripts.test);
    // EVERY jest config a workspace carries (jest.config.js, jest.integration.config.js, ...), not
    // just the default one: a script can select any of them with --config. A config is bounded if
    // it applies the cap, or pins its own maxWorkers (tests/jest.integration.config.js pins 1).
    const capped: string[] = [];
    const pinned: string[] = [];
    const serial: string[] = [];
    const neither: string[] = [];
    for (const { ws, dir, scripts } of testing) {
      const configs = readdirSync(dir).filter((f) => /^jest(\.[\w-]+)?\.config\.js$/.test(f));
      for (const c of configs) {
        const label = `${ws}/${c}`;
        if ((await resolvedMaxWorkers(dir, join(dir, c), '3')) === 3) capped.push(label);
        else if ((await resolvedMaxWorkers(dir, join(dir, c), '')) !== undefined) pinned.push(label);
        else neither.push(label);
      }
      if (configs.length === 0) {
        const jestCalls = Object.values(scripts).filter((s) => /\bjest\b/.test(s) && !/--watch/.test(s));
        (jestCalls.length > 0 && jestCalls.every((s) => /--runInBand/.test(s)) ? serial : neither).push(ws);
      }
    }

    expect(neither).toEqual([]);
    expect(serial).toEqual(['services/geocoding-service']);
    expect(pinned).toEqual(['tests/jest.integration.config.js']);
    expect(testing.length).toBeGreaterThan(10); // discovery found the real workspaces
    expect(capped).toHaveLength(testing.length - 1); // one default config per workspace but geocoding
  }, 120_000);

  it('the config check fails for a jest config that does not apply the cap', async () => {
    const dir = scratch('karmyq-prepush-config-');
    writeFileSync(join(dir, 'jest.config.js'), "module.exports = { testEnvironment: 'node' };\n");
    expect(await resolvedMaxWorkers(dir, join(dir, 'jest.config.js'))).toBeUndefined();
  });

  it('turbo passes the cap through to every task (strict env mode strips it otherwise)', () => {
    // Global, not per task: the hook's test:tdd step and any future task get it too. Read from
    // turbo's own resolution of the config, not from turbo.json's text.
    const dry = JSON.parse(
      execFileSync(process.execPath, [require.resolve('turbo/bin/turbo', { paths: [ROOT] }), 'run', 'test', '--dry=json'], {
        cwd: ROOT,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      })
    );
    expect(dry.envMode).toBe('strict');
    expect(dry.globalCacheInputs.environmentVariables.specified.passThroughEnv).toContain('KARMYQ_JEST_MAX_WORKERS');
  }, 180_000);
});

describe('the Turbo concurrency cap', () => {
  it("turbo.json bounds every `npm test` at 4 tasks, overridable with TURBO_CONCURRENCY", () => {
    expect(JSON.parse(read('turbo.json')).concurrency).toBe('4');
  });

  /**
   * turbo.json's text proves nothing on its own: this runs the repo's own turbo on a throwaway
   * three-package monorepo whose tasks record start and end times, and checks that the config's
   * concurrency serializes them and that the env override lifts it. Overlap, not wall time, so
   * machine load cannot flip the result.
   */
  it("the repo's turbo honours turbo.json concurrency, and TURBO_CONCURRENCY overrides it", () => {
    const dir = scratch('karmyq-prepush-turbo-');
    const write = (rel: string, body: string) => {
      mkdirSync(dirname(join(dir, rel)), { recursive: true });
      writeFileSync(join(dir, rel), body);
    };
    write('package.json', JSON.stringify({ name: 'root', private: true, packageManager: 'npm@10.8.2', workspaces: ['pkgs/*'] }));
    write('package-lock.json', JSON.stringify({ name: 'root', lockfileVersion: 3, requires: true, packages: { '': { name: 'root', workspaces: ['pkgs/*'] } } }));
    const task = `node -e "const fs=require('fs');const s=Date.now();setTimeout(()=>fs.writeFileSync('span.json',JSON.stringify([s,Date.now()])),700)"`;
    for (const name of ['a', 'b', 'c']) write(`pkgs/${name}/package.json`, JSON.stringify({ name, scripts: { span: task } }));
    write('turbo.json', JSON.stringify({ concurrency: '1', tasks: { span: { cache: false } } }));
    execFileSync('git', ['init', '-q'], { cwd: dir });
    const bin = require.resolve('turbo/bin/turbo', { paths: [ROOT] });

    const overlaps = (env: NodeJS.ProcessEnv): boolean => {
      execFileSync(process.execPath, [bin, 'run', 'span'], { cwd: dir, env: { ...env, TURBO_TELEMETRY_DISABLED: '1' }, stdio: 'ignore' });
      const spans = ['a', 'b', 'c'].map((n) => JSON.parse(readFileSync(join(dir, 'pkgs', n, 'span.json'), 'utf8')) as [number, number]);
      return spans.some(([s1, e1], i) => spans.some(([s2, e2], j) => i !== j && s1 < e2 && s2 < e1));
    };
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.TURBO_CONCURRENCY;
    expect(overlaps(env)).toBe(false); // config "1": strictly one task at a time
    expect(overlaps({ ...env, TURBO_CONCURRENCY: '3' })).toBe(true); // the override lifts it
  }, 120_000);
});
