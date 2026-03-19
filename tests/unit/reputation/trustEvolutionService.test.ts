// tests/unit/reputation/trustEvolutionService.test.ts
import {
  getUserEffectiveParams,
  isEvolutionEligible,
  evaluateUserEvolution,
  EVOLUTION_SIGNALS,
} from '../../../services/reputation-service/src/services/trustEvolutionService';

// Mock all DB modules — never hit real DB in unit tests
jest.mock('../../../services/reputation-service/src/database/trustEvolutionDb');
jest.mock('../../../services/reputation-service/src/database/trustConfigDb');

import * as trustEvolutionDb from '../../../services/reputation-service/src/database/trustEvolutionDb';
import * as trustConfigDb from '../../../services/reputation-service/src/database/trustConfigDb';

const mockGetUserTrustConfig = trustEvolutionDb.getUserTrustConfig as jest.MockedFunction<typeof trustEvolutionDb.getUserTrustConfig>;
const mockGetCommunityEvolutionConfig = trustEvolutionDb.getCommunityEvolutionConfig as jest.MockedFunction<typeof trustEvolutionDb.getCommunityEvolutionConfig>;
const mockGetLastEvolutionForParameter = trustEvolutionDb.getLastEvolutionForParameter as jest.MockedFunction<typeof trustEvolutionDb.getLastEvolutionForParameter>;
const mockUpsertUserTrustConfig = trustEvolutionDb.upsertUserTrustConfig as jest.MockedFunction<typeof trustEvolutionDb.upsertUserTrustConfig>;
const mockInsertEvolutionLog = trustEvolutionDb.insertEvolutionLog as jest.MockedFunction<typeof trustEvolutionDb.insertEvolutionLog>;
const mockGetCommunityTrustConfig = trustConfigDb.getCommunityTrustConfig as jest.MockedFunction<typeof trustConfigDb.getCommunityTrustConfig>;

// Field names must match what getCommunityTrustConfig (trustConfigDb.ts) actually returns.
const COMMUNITY_DEFAULTS = {
  depth_weight: 0.60,
  breadth_weight: 0.40,
  feedback_threshold: 3.0,
  min_interactions_for_bonus: 1,
  negative_allowed: false,
  carry_factor: 0.40,
  carry_cap: 59,
  carry_enabled: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCommunityTrustConfig.mockResolvedValue(COMMUNITY_DEFAULTS);
  mockGetUserTrustConfig.mockResolvedValue(null); // No user config by default
  mockGetCommunityEvolutionConfig.mockResolvedValue({
    community_evolution_enabled: true,
    cross_community_prior: 0.50,
  });
  mockGetLastEvolutionForParameter.mockResolvedValue(null); // No prior adjustments
  mockUpsertUserTrustConfig.mockResolvedValue(undefined);
  mockInsertEvolutionLog.mockResolvedValue(undefined);
});

describe('getUserEffectiveParams', () => {
  it('returns community defaults when user config has NULL weights', async () => {
    const params = await getUserEffectiveParams('user-1', 'comm-1');
    expect(params.depth_weight).toBe(0.60);
    expect(params.breadth_weight).toBe(0.40);
  });

  it('returns user override when depth_weight is set', async () => {
    mockGetUserTrustConfig.mockResolvedValue({
      user_id: 'user-1',
      community_id: 'comm-1',
      depth_weight: 0.75,
      breadth_weight: null,
      cross_community_prior: 0.50,
      evolution_enabled: true,
    });
    const params = await getUserEffectiveParams('user-1', 'comm-1');
    expect(params.depth_weight).toBe(0.75);
    expect(params.breadth_weight).toBe(0.40); // still community default
  });

  it('cross_community_prior always returned from user config', async () => {
    mockGetUserTrustConfig.mockResolvedValue({
      user_id: 'user-1',
      community_id: 'comm-1',
      depth_weight: null,
      breadth_weight: null,
      cross_community_prior: 0.72,
      evolution_enabled: true,
    });
    const params = await getUserEffectiveParams('user-1', 'comm-1');
    expect(params.cross_community_prior).toBe(0.72);
  });
});

describe('isEvolutionEligible', () => {
  it('returns false when community_evolution_enabled is false', async () => {
    mockGetCommunityEvolutionConfig.mockResolvedValue({
      community_evolution_enabled: false,
      cross_community_prior: 0.50,
    });
    mockGetUserTrustConfig.mockResolvedValue({
      user_id: 'u', community_id: 'c', depth_weight: null,
      breadth_weight: null, cross_community_prior: 0.50, evolution_enabled: true,
    });
    const eligible = await isEvolutionEligible('u', 'c', 'cross_community_prior');
    expect(eligible).toBe(false);
  });

  it('returns false when user evolution_enabled is false', async () => {
    mockGetUserTrustConfig.mockResolvedValue({
      user_id: 'u', community_id: 'c', depth_weight: null,
      breadth_weight: null, cross_community_prior: 0.50, evolution_enabled: false,
    });
    const eligible = await isEvolutionEligible('u', 'c', 'cross_community_prior');
    expect(eligible).toBe(false);
  });

  it('returns false when user has no config row (evolution_enabled defaults to false)', async () => {
    mockGetUserTrustConfig.mockResolvedValue(null);
    const eligible = await isEvolutionEligible('u', 'c', 'cross_community_prior');
    expect(eligible).toBe(false);
  });

  it('returns false when last adjustment was less than 7 days ago', async () => {
    mockGetUserTrustConfig.mockResolvedValue({
      user_id: 'u', community_id: 'c', depth_weight: null,
      breadth_weight: null, cross_community_prior: 0.50, evolution_enabled: true,
    });
    const recentDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
    mockGetLastEvolutionForParameter.mockResolvedValue(recentDate);
    const eligible = await isEvolutionEligible('u', 'c', 'cross_community_prior');
    expect(eligible).toBe(false);
  });

  it('returns true when all gates pass', async () => {
    mockGetUserTrustConfig.mockResolvedValue({
      user_id: 'u', community_id: 'c', depth_weight: null,
      breadth_weight: null, cross_community_prior: 0.50, evolution_enabled: true,
    });
    const eligible = await isEvolutionEligible('u', 'c', 'cross_community_prior');
    expect(eligible).toBe(true);
  });
});

describe('evaluateUserEvolution', () => {
  beforeEach(() => {
    // User has evolution enabled, no prior adjustments
    mockGetUserTrustConfig.mockResolvedValue({
      user_id: 'u', community_id: 'c', depth_weight: null,
      breadth_weight: null, cross_community_prior: 0.50, evolution_enabled: true,
    });
  });

  it('nudges cross_community_prior +0.02 and breadth_weight +0.01 on positive feedback', async () => {
    await evaluateUserEvolution('u', 'c', EVOLUTION_SIGNALS.CROSS_COMMUNITY_POSITIVE_FEEDBACK, {});

    // Should upsert twice (one per nudged parameter)
    expect(mockUpsertUserTrustConfig).toHaveBeenCalledWith('u', 'c', { cross_community_prior: 0.52 });
    expect(mockUpsertUserTrustConfig).toHaveBeenCalledWith('u', 'c', { breadth_weight: 0.41 });
    expect(mockInsertEvolutionLog).toHaveBeenCalledTimes(2);
  });

  it('nudges cross_community_prior -0.02 on negative feedback', async () => {
    await evaluateUserEvolution('u', 'c', EVOLUTION_SIGNALS.CROSS_COMMUNITY_NEGATIVE_FEEDBACK, {});
    expect(mockUpsertUserTrustConfig).toHaveBeenCalledWith('u', 'c', { cross_community_prior: 0.48 });
    expect(mockInsertEvolutionLog).toHaveBeenCalledTimes(1);
  });

  it('clamps cross_community_prior at upper bound (0.95)', async () => {
    mockGetUserTrustConfig.mockResolvedValue({
      user_id: 'u', community_id: 'c', depth_weight: null,
      breadth_weight: null, cross_community_prior: 0.94, evolution_enabled: true,
    });
    await evaluateUserEvolution('u', 'c', EVOLUTION_SIGNALS.CROSS_COMMUNITY_POSITIVE_FEEDBACK, {});
    // 0.94 + 0.02 = 0.96, clamped to 0.95
    expect(mockUpsertUserTrustConfig).toHaveBeenCalledWith('u', 'c', { cross_community_prior: 0.95 });
  });

  it('clamps cross_community_prior at lower bound (0.05)', async () => {
    mockGetUserTrustConfig.mockResolvedValue({
      user_id: 'u', community_id: 'c', depth_weight: null,
      breadth_weight: null, cross_community_prior: 0.06, evolution_enabled: true,
    });
    await evaluateUserEvolution('u', 'c', EVOLUTION_SIGNALS.CROSS_COMMUNITY_NEGATIVE_FEEDBACK, {});
    // 0.06 - 0.02 = 0.04, clamped to 0.05
    expect(mockUpsertUserTrustConfig).toHaveBeenCalledWith('u', 'c', { cross_community_prior: 0.05 });
  });

  it('skips a parameter if already at its bound', async () => {
    mockGetUserTrustConfig.mockResolvedValue({
      user_id: 'u', community_id: 'c', depth_weight: null,
      breadth_weight: null, cross_community_prior: 0.95, evolution_enabled: true,
    });
    await evaluateUserEvolution('u', 'c', EVOLUTION_SIGNALS.CROSS_COMMUNITY_POSITIVE_FEEDBACK, {});
    // cross_community_prior at 0.95 (upper bound) — delta +0.02 → still 0.95, skip
    // breadth_weight = community default 0.40, nudge +0.01 → 0.41, should apply
    const calls = mockUpsertUserTrustConfig.mock.calls.map((c: unknown[]) => c[2]);
    expect(calls).not.toContainEqual({ cross_community_prior: 0.95 }); // skipped (no change)
    expect(calls).toContainEqual({ breadth_weight: 0.41 });
  });

  it('logs old_value and new_value for each adjustment', async () => {
    await evaluateUserEvolution('u', 'c', EVOLUTION_SIGNALS.CROSS_COMMUNITY_NEGATIVE_FEEDBACK, { triggerEventId: 'match-123' });
    expect(mockInsertEvolutionLog).toHaveBeenCalledWith(expect.objectContaining({
      parameter: 'cross_community_prior',
      old_value: 0.50,
      new_value: 0.48,
      trigger_signal: 'cross_community_negative_feedback',
      trigger_event_id: 'match-123',
    }));
  });

  it('nudges depth_weight +0.01 on repeat_interaction_same_person', async () => {
    await evaluateUserEvolution('u', 'c', EVOLUTION_SIGNALS.REPEAT_INTERACTION_SAME_PERSON, {});
    expect(mockUpsertUserTrustConfig).toHaveBeenCalledWith('u', 'c', { depth_weight: 0.61 });
  });

  it('nudges breadth_weight +0.02 and cross_community_prior +0.01 on diverse_community_interactions', async () => {
    await evaluateUserEvolution('u', 'c', EVOLUTION_SIGNALS.DIVERSE_COMMUNITY_INTERACTIONS, {});
    expect(mockUpsertUserTrustConfig).toHaveBeenCalledWith('u', 'c', { breadth_weight: 0.42 });
    expect(mockUpsertUserTrustConfig).toHaveBeenCalledWith('u', 'c', { cross_community_prior: 0.51 });
  });

  it('does nothing when community evolution is disabled', async () => {
    mockGetCommunityEvolutionConfig.mockResolvedValue({
      community_evolution_enabled: false,
      cross_community_prior: 0.50,
    });
    await evaluateUserEvolution('u', 'c', EVOLUTION_SIGNALS.CROSS_COMMUNITY_POSITIVE_FEEDBACK, {});
    expect(mockUpsertUserTrustConfig).not.toHaveBeenCalled();
    expect(mockInsertEvolutionLog).not.toHaveBeenCalled();
  });

  it('does nothing for an unknown signal', async () => {
    await evaluateUserEvolution('u', 'c', 'unknown_signal', {});
    expect(mockUpsertUserTrustConfig).not.toHaveBeenCalled();
  });
});
