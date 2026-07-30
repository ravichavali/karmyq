import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Sprint 122 PR 2 — turbo `test` cache-key truthfulness (ADR-088).
 *
 * turbo.json declared `test/**` (singular) while every workspace stores tests
 * in `tests/` (plural). Measured on 2026-07-30, NO `#test` task in the
 * monorepo hashed a single test file: karmyq-auth-service#test hashed 15
 * inputs, all `src/**` plus package.json, and mobile / tests / geocoding
 * hashed exactly one file each (package.json). Editing a test therefore
 * replayed a cached pass.
 *
 * This gate asserts the inputs are real. It shells out to turbo deliberately:
 * asserting on turbo.json's text would only prove the config was edited, not
 * that Turbo hashes what we think it hashes.
 */
const ROOT = join(__dirname, '..', '..');

type DryRun = { tasks: Array<{ taskId: string; inputs: Record<string, string> }> };

let dry: DryRun;

beforeAll(() => {
  const raw = execSync('npx turbo run test --dry=json', {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  dry = JSON.parse(raw);
}, 180_000);

const inputsOf = (taskId: string): string[] => {
  const task = dry.tasks.find((t) => t.taskId === taskId);
  if (!task) throw new Error(`no such turbo task: ${taskId} (have: ${dry.tasks.map((t) => t.taskId).join(', ')})`);
  return Object.keys(task.inputs || {});
};

describe('turbo test-task inputs are honest', () => {
  it('the three tasks that hashed exactly one file now hash their real sources', () => {
    // Regression floor: each of these hashed ONLY package.json on 2026-07-30.
    for (const taskId of ['@karmyq/mobile#test', '@karmyq/tests#test', 'geocoding-service#test']) {
      const inputs = inputsOf(taskId);
      expect(inputs.length).toBeGreaterThan(1);
      expect(inputs).toContain('package.json');
    }
  });

  it('every test task hashes at least one actual test file', () => {
    const testTasks = dry.tasks.filter((t) => t.taskId.endsWith('#test'));
    expect(testTasks.length).toBeGreaterThan(10); // 15 workspaces declare a test task

    // Turbo reports input paths relative to each PACKAGE root, not the repo
    // root, and this repo has three test layouts:
    //   services/*, apps/*   -> tests/{unit,regression,tdd,integration}/
    //   packages/shared      -> src/**/__tests__/   (no tests/ dir at all)
    //   the `tests` package  -> its own root IS tests/, so its paths are bare
    //                           (regression/..., unit/..., e2e/...)
    // Matching the filename is therefore the layout-agnostic way to say
    // "the cache key includes the tests".
    const isTestFile = (p: string) => /\.(test|spec)\.[jt]sx?$/.test(p);

    const blind = testTasks
      .filter((t) => {
        // messaging-service declares no test script and has zero test files —
        // a real gap, logged as a bug, but not a cache-key lie.
        if (t.taskId.includes('messaging-service')) return false;
        return !Object.keys(t.inputs || {}).some(isTestFile);
      })
      .map((t) => t.taskId);

    expect(blind).toEqual([]);
  });

  it('a workspace jest config is part of its own test cache key', () => {
    const withConfig: Array<[string, string]> = [
      ['karmyq-auth-service', 'services/auth-service'],
      ['@karmyq/mobile', 'apps/mobile'],
      ['@karmyq/tests', 'tests'],
      ['karmyq-frontend', 'apps/frontend'],
    ];

    for (const [taskName, dir] of withConfig) {
      expect(existsSync(join(ROOT, dir, 'jest.config.js'))).toBe(true);
      expect(inputsOf(`${taskName}#test`)).toContain('jest.config.js');
    }
  });

  it('turbo.json does not reinstate a hand-maintained input list for test', () => {
    const turbo = JSON.parse(readFileSync(join(ROOT, 'turbo.json'), 'utf8'));
    expect(turbo.tasks.test.inputs).toEqual(['$TURBO_DEFAULT$']);
  });
});
