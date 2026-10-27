import express from 'express';
import request from 'supertest';
import { calculateNetworkStrength, readCurrentCommunityMetrics } from '../../src/services/communityHealthMetrics';
import { calculateCommunityHealthMetrics } from '../../src/services/healthMetricsService';
import { detectMilestones } from '../../src/services/milestoneDetector';
import healthRouter from '../../src/routes/health';

const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({ query: (...args: any[]) => mockQuery(...args) }));
jest.mock('../../src/events/publisher', () => ({ publishEvent: jest.fn() }));
jest.mock('../../src/utils/disclosureAuth', () => ({ checkAggregateAccess: jest.fn() }));
import { checkAggregateAccess } from '../../src/utils/disclosureAuth';

const app = express();
app.use((req: any, _res, next) => { req.user = { userId: 'caller' }; next(); });
app.use(healthRouter);
const result = (rows: any[]) => ({ rows, rowCount: rows.length });

describe('Sprint 134 L2 community health (BUG-070)', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    (checkAggregateAccess as jest.Mock).mockResolvedValue({ allowed: true });
  });

  it.each([
    [10, 4, 0.5, undefined, 50],
    [10, 4, 0.5, 50, 50],
    [0, 0, 0, undefined, 0],
    [1000, 1, 20, 0, 100],
    [10, 4, 0.5, -100, 50],
  ])('scores matches=%s participants=%s density=%s quality=%s as %s', (matches, participants, density, quality, expected) => {
    expect(calculateNetworkStrength(matches, participants, density, quality)).toBe(expected);
  });

  it.each([
    [10, 4, 0.5, 50, 0.4, 50],
    [1000, 1, 12, 0, 0, 100],
    [1000, 1, 12, 25, -1, 100],
    [1000, 1, 12, 25, 2, 25],
    [1000, 1, 12, 25, NaN, 100],
  ])('uses a clamped quality weight: %s/%s/%s quality=%s weight=%s → %s', (matches, participants, density, quality, weight, expected) => {
    expect(calculateNetworkStrength(matches, participants, density, quality, weight)).toBe(expected);
  });

  it('returns finite metrics with no exchanges and zero cached members', async () => {
    mockQuery.mockResolvedValueOnce(result([{ total: '0' }]))
      .mockResolvedValueOnce(result([{ requesters: '0', helpers: '0' }]))
      .mockResolvedValueOnce(result([{ current_members: 0 }]));
    expect(await readCurrentCommunityMetrics('C')).toEqual({
      total_matches_completed: 0, total_active_requesters: 0, total_active_helpers: 0,
      unique_participants: 0, network_density: 0, network_strength: 0,
    });
  });

  it('fallback projects only live metrics with default-zero quality weight', async () => {
    mockQuery.mockResolvedValueOnce(result([]))
      .mockResolvedValueOnce(result([{ total: '10' }]))
      .mockResolvedValueOnce(result([{ requesters: '2', helpers: '2' }]))
      .mockResolvedValueOnce(result([{ current_members: 20 }]));
    const response = await request(app).get('/community-health/C');
    expect(response.status).toBe(200);
    expect(response.body.data.current).toEqual({
      total_matches_completed: 10, total_active_requesters: 2, total_active_helpers: 2,
      unique_participants: 4, network_density: 0.5, network_strength: 50,
    });
  });

  it('snapshot handles PostgreSQL numeric strings without retired fields', async () => {
    mockQuery.mockResolvedValueOnce(result([{
      snapshot_date: '2026-10-27', total_matches_completed: 10, total_active_requesters: 2,
      total_active_helpers: 2, unique_participant_count: 4, network_density: '0.5000',
      growth_rate_matches: '10.00', growth_rate_participants: '-2.00',
    }]));
    const response = await request(app).get('/community-health/C');
    expect(response.status).toBe(200);
    expect(response.body.data.current).toEqual({
      total_matches_completed: 10, total_active_requesters: 2, total_active_helpers: 2,
      unique_participants: 4, network_density: 0.5, network_strength: 50,
    });
    expect(response.body.data.trend).toEqual({ matches_growth: 10, participants_growth: -2, direction: 'growing' });
  });

  it('stores the same zero-quality-weight score in the community cache', async () => {
    mockQuery.mockResolvedValueOnce(result([{ total: '10' }]))
      .mockResolvedValueOnce(result([{ requesters: '2', helpers: '2' }]))
      .mockResolvedValueOnce(result([{ current_members: 20 }]))
      .mockResolvedValueOnce(result([{ total_matches_completed: 5, unique_participant_count: 2 }]))
      .mockResolvedValue(result([]));
    await calculateCommunityHealthMetrics('C');
    const cache = mockQuery.mock.calls.find(([sql]) => sql.includes('INSERT INTO communities.health_summary'));
    expect(cache?.[1]).toEqual(['C', 10, 4, 50, 'growing', 100]);
  });

  it('denies aggregates before snapshot or fallback reads', async () => {
    (checkAggregateAccess as jest.Mock).mockResolvedValue({ allowed: false });
    const response = await request(app).get('/community-health/C');
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('AGGREGATE_NOT_AVAILABLE');
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('records match and participant milestones without resurrecting retired quality milestones', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM reputation.community_health_metrics')) return result([{
        total_matches_completed: 10, unique_participant_count: 10,
        avg_helpfulness: '5', avg_responsiveness: '5', avg_clarity: '5',
      }]);
      if (sql.includes('INSERT INTO reputation.milestone_events')) return result([{ id: 'milestone', achieved_at: 'now' }]);
      return result([]);
    });
    await detectMilestones('C');
    const types = mockQuery.mock.calls.filter(([sql]) => sql.includes('INSERT INTO reputation.milestone_events')).map(([, params]) => params[1]);
    expect(types).toEqual(['10_matches', '10_participants']);
  });
});
