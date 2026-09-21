/**
 * Sprint 131 D2 — node-cron 3 → 4 (#228), exercised against the REAL library.
 *
 * `sprint-126-trust-score-refresh.test.ts` mocks node-cron, so it proves which expression and handler
 * we pass but not that the installed scheduler accepts them, arms them, or calls the handler back.
 * A major bump is exactly where those diverge: v4 ships its own types, reshapes `schedule`'s options
 * and passes a context argument to the task. These tests leave node-cron unmocked and read the armed
 * tasks back out of its own registry (`getTasks`), so the scheduler is the arbiter, not a shadow list.
 */

const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

const mockUpdateTrustScore = jest.fn<Promise<void>, [string, string]>();
jest.mock('../../src/services/karmaService', () => ({
  updateTrustScore: (u: string, c: string) => mockUpdateTrustScore(u, c),
}));

const mockCalculateAll = jest.fn();
jest.mock('../../src/services/healthMetricsService', () => ({
  calculateAllCommunityMetrics: () => mockCalculateAll(),
}));

const mockDetectMilestones = jest.fn();
jest.mock('../../src/services/milestoneDetector', () => ({
  detectAllCommunityMilestones: () => mockDetectMilestones(),
}));

import cron, { ScheduledTask } from 'node-cron';
import { initTrustScoreRefresh } from '../../src/cron/trustScoreRefresh';
import { initHealthMetricsCalculator } from '../../src/cron/healthMetricsCalculator';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Run `init` and return exactly the tasks it registered with the real scheduler. */
function tasksRegisteredBy(init: () => void): ScheduledTask[] {
  const before = new Set(cron.getTasks().keys());
  init();
  return [...cron.getTasks().entries()].filter(([id]) => !before.has(id)).map(([, task]) => task);
}

/** Started, and next due at hh:mm:00 local within the coming day (getNextRun is null once stopped). */
function expectArmedDailyAt(task: ScheduledTask, hours: number, minutes: number): void {
  const next = task.getNextRun();
  expect(next).not.toBeNull();
  expect([next!.getHours(), next!.getMinutes(), next!.getSeconds()]).toEqual([hours, minutes, 0]);
  const msAway = next!.getTime() - Date.now();
  expect(msAway).toBeGreaterThan(0);
  expect(msAway).toBeLessThanOrEqual(DAY_MS);
}

// Root jest config sets resetMocks, so mock calls and implementations are cleared between tests.
afterEach(async () => {
  for (const task of cron.getTasks().values()) await task.destroy();
});

describe('node-cron v4 wiring (real scheduler)', () => {
  it('arms the trust-score refresh daily at 03:30 local and runs the canonical sweep', async () => {
    const tasks = tasksRegisteredBy(initTrustScoreRefresh);

    expect(tasks).toHaveLength(1);
    const [task] = tasks;
    expect(task.getPattern()).toBe('30 3 * * *');

    // v4's schedule() must still auto-start.
    expectArmedDailyAt(task, 3, 30);

    // The scheduler, not the test, invokes the handler (v4 passes it a context argument).
    mockQuery.mockResolvedValueOnce({ rows: [{ user_id: 'u1', community_id: 'c1' }] });
    await task.execute();
    expect(mockUpdateTrustScore).toHaveBeenCalledTimes(1);
    expect(mockUpdateTrustScore).toHaveBeenCalledWith('u1', 'c1');
  });

  it('arms the health-metrics calculator daily at 02:00 local and runs both steps', async () => {
    const tasks = tasksRegisteredBy(initHealthMetricsCalculator);

    expect(tasks).toHaveLength(1);
    const [task] = tasks;
    expect(task.getPattern()).toBe('0 2 * * *');

    expectArmedDailyAt(task, 2, 0);

    await task.execute();
    expect(mockCalculateAll).toHaveBeenCalledTimes(1);
    expect(mockDetectMilestones).toHaveBeenCalledTimes(1);
  });

  it('resolves when the sweep fails, so a bad night never surfaces as a scheduler failure', async () => {
    const [task] = tasksRegisteredBy(initTrustScoreRefresh);

    mockQuery.mockRejectedValueOnce(new Error('database unreachable'));

    await expect(task.execute()).resolves.toBeUndefined();
    expect(mockUpdateTrustScore).not.toHaveBeenCalled();
  });
});
