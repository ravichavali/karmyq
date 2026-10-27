import { calculateAllCommunityMetrics } from '../../src/services/healthMetricsService';
import { detectAllCommunityMilestones } from '../../src/services/milestoneDetector';

const mockQuery = jest.fn();
const mockTrust = jest.fn();
jest.mock('../../src/database/db', () => ({ query: (...args: any[]) => mockQuery(...args) }));
jest.mock('../../src/events/publisher', () => ({ publishEvent: jest.fn() }));
jest.mock('../../src/services/communityTrustService', () => ({
  calculateCommunityTrustScore: (...args: any[]) => mockTrust(...args),
}));

const rows = (values: any[]) => ({ rows: values, rowCount: values.length });
const failure = new Error('community source unavailable');
let errorLog: jest.SpyInstance;
beforeEach(() => {
  mockQuery.mockReset(); mockTrust.mockReset().mockResolvedValue(0);
  errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => errorLog.mockRestore());

it.each(['metrics', 'trust'])('continues both later health snapshots after a %s failure', async (phase) => {
  mockQuery.mockImplementation(async (sql: string, params: any[] = []) => {
    if (sql.includes('SELECT id FROM communities.communities')) return rows([{ id: 'bad' }, { id: 'later-1' }, { id: 'later-2' }]);
    if (sql.includes('COUNT(*) AS total')) {
      if (phase === 'metrics' && params[0] === 'bad') throw failure;
      return rows([{ total: '1' }]);
    }
    if (sql.includes('COUNT(DISTINCT r.requester_id)')) return rows([{ requesters: '1', helpers: '1' }]);
    if (sql.includes('SELECT current_members')) return rows([{ current_members: 5 }]);
    return rows([]);
  });
  if (phase === 'trust') mockTrust.mockImplementation(async (community: string) => {
    if (community === 'bad') throw failure;
    return 0;
  });

  await expect(calculateAllCommunityMetrics()).resolves.toBeUndefined();
  const snapshots = mockQuery.mock.calls.filter(([sql]) => sql.includes('INSERT INTO reputation.community_health_metrics'));
  expect(snapshots.map(([, params]) => params[0])).toEqual(phase === 'trust' ? ['bad', 'later-1', 'later-2'] : ['later-1', 'later-2']);
  expect(mockTrust.mock.calls.map(([community]) => community)).toEqual(phase === 'trust' ? ['bad', 'later-1', 'later-2'] : ['later-1', 'later-2']);
  expect(errorLog).toHaveBeenCalledWith('[healthMetrics] Failed for bad:', failure);
});

it('continues both later milestone communities after a source failure', async () => {
  mockQuery.mockImplementation(async (sql: string, params: any[] = []) => {
    if (sql.includes('SELECT id FROM communities.communities')) return rows([{ id: 'bad' }, { id: 'later-1' }, { id: 'later-2' }]);
    if (sql.includes('FROM reputation.community_health_metrics')) {
      if (params[0] === 'bad') throw failure;
      return rows([{ total_matches_completed: 10, unique_participant_count: 10 }]);
    }
    if (sql.includes('INSERT INTO reputation.milestone_events')) return rows([{ id: 'milestone', achieved_at: 'now' }]);
    return rows([]);
  });
  await expect(detectAllCommunityMilestones()).resolves.toBeUndefined();
  const milestones = mockQuery.mock.calls.filter(([sql]) => sql.includes('INSERT INTO reputation.milestone_events'));
  expect(milestones.map(([, params]) => [params[0], params[1]])).toEqual([
    ['later-1', '10_matches'], ['later-1', '10_participants'],
    ['later-2', '10_matches'], ['later-2', '10_participants'],
  ]);
  expect(errorLog).toHaveBeenCalledWith('[milestones] Failed for bad:', failure);
});

it.each([calculateAllCommunityMetrics, detectAllCommunityMilestones])('still rejects when active-community enumeration fails (%p)', async (run) => {
  mockQuery.mockRejectedValue(failure);
  await expect(run()).rejects.toBe(failure);
});
