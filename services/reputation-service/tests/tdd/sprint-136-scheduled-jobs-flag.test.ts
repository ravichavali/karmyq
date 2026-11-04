/**
 * Sprint 136 (BUG-087): the CI test stack (tests/docker-compose.test.yml) sets SCHEDULED_JOBS_DISABLED="true", so
 * reputation-service's two wall-clock jobs (health metrics at 02:00, the trust-score refresh at 03:30) never fire in
 * the middle of an integration run. Only the exact string "true" disables. Absent, or any other value, keeps the jobs
 * on, so a missing or misspelled variable can never turn a production cron off.
 *
 * node-cron is mocked to count schedule() calls. sprint-131-node-cron-v4 proves the real scheduler arms them.
 */
const mockSchedule = jest.fn();
jest.mock('node-cron', () => ({
  __esModule: true,
  default: { schedule: (expr: string, fn: unknown) => mockSchedule(expr, fn) },
}));
jest.mock('../../src/database/db', () => ({ query: jest.fn() }));
jest.mock('../../src/services/karmaService', () => ({ updateTrustScore: jest.fn() }));
const mockCalculateAll = jest.fn();
jest.mock('../../src/services/healthMetricsService', () => ({
  calculateAllCommunityMetrics: () => mockCalculateAll(),
}));
const mockDetectMilestones = jest.fn();
jest.mock('../../src/services/milestoneDetector', () => ({
  detectAllCommunityMilestones: () => mockDetectMilestones(),
}));

import { initTrustScoreRefresh } from '../../src/cron/trustScoreRefresh';
import { initHealthMetricsCalculator } from '../../src/cron/healthMetricsCalculator';

const FLAGS = ['SCHEDULED_JOBS_DISABLED', 'RUN_METRICS_ON_STARTUP'] as const;
const saved = Object.fromEntries(FLAGS.map((k) => [k, process.env[k]]));
let log: jest.SpyInstance;

function setFlag(name: (typeof FLAGS)[number], value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

// The root jest config sets resetMocks, so implementations are set here, not at module scope.
beforeEach(() => {
  for (const k of FLAGS) delete process.env[k];
  mockCalculateAll.mockResolvedValue(undefined);
  mockDetectMilestones.mockResolvedValue(undefined);
  log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  for (const k of FLAGS) setFlag(k, saved[k]);
});

describe('SCHEDULED_JOBS_DISABLED="true" (the CI test stack)', () => {
  beforeEach(() => setFlag('SCHEDULED_JOBS_DISABLED', 'true'));

  it('initTrustScoreRefresh schedules nothing and logs one line saying why', () => {
    initTrustScoreRefresh();
    expect(mockSchedule).toHaveBeenCalledTimes(0);
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][0])).toMatch(/not scheduled \(SCHEDULED_JOBS_DISABLED=true\)/);
  });

  it('initHealthMetricsCalculator schedules nothing and logs one line saying why', () => {
    initHealthMetricsCalculator();
    expect(mockSchedule).toHaveBeenCalledTimes(0);
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][0])).toMatch(/not scheduled \(SCHEDULED_JOBS_DISABLED=true\)/);
  });

  it('initHealthMetricsCalculator skips the startup run too, even with RUN_METRICS_ON_STARTUP="true"', () => {
    setFlag('RUN_METRICS_ON_STARTUP', 'true');
    initHealthMetricsCalculator();
    jest.advanceTimersByTime(60_000);
    expect(mockSchedule).toHaveBeenCalledTimes(0);
    expect(mockCalculateAll).toHaveBeenCalledTimes(0);
  });
});

describe.each([
  ['absent', undefined],
  ['"false"', 'false'],
  ['"TRUE"', 'TRUE'],
  ['"1"', '1'],
  ['empty', ''],
])('SCHEDULED_JOBS_DISABLED %s keeps the jobs on', (_label, value) => {
  beforeEach(() => setFlag('SCHEDULED_JOBS_DISABLED', value));

  it("initTrustScoreRefresh schedules exactly once, at '30 3 * * *'", () => {
    initTrustScoreRefresh();
    expect(mockSchedule).toHaveBeenCalledTimes(1);
    expect(mockSchedule.mock.calls[0][0]).toBe('30 3 * * *');
  });

  it("initHealthMetricsCalculator schedules exactly once, at '0 2 * * *'", () => {
    initHealthMetricsCalculator();
    expect(mockSchedule).toHaveBeenCalledTimes(1);
    expect(mockSchedule.mock.calls[0][0]).toBe('0 2 * * *');
  });
});

// Positive control for the startup-run spy: without the flag, RUN_METRICS_ON_STARTUP still runs the calculation, so the
// zero-call assertion above can fail.
it('without the flag, RUN_METRICS_ON_STARTUP="true" still runs the startup calculation once', () => {
  setFlag('RUN_METRICS_ON_STARTUP', 'true');
  initHealthMetricsCalculator();
  expect(mockCalculateAll).toHaveBeenCalledTimes(0);
  jest.advanceTimersByTime(5_000);
  expect(mockCalculateAll).toHaveBeenCalledTimes(1);
});
