/**
 * Sprint 134 BUG-079: pg returns NUMERIC columns as strings (pg-types registers no parser for OID 1700), so the
 * community default depth weight arrives as "0.60" and a member's prior as "0.50". evaluateUserEvolution added the
 * nudge to that string ("0.600.01"), clamp() made it NaN, and the write was rejected. The mocks below return exactly
 * what pg returns; the older unit tests (tests/unit/reputation/trustEvolutionService.test.ts) return numbers, which
 * is how this hid.
 */
jest.mock('bull', () => function MockBull() {
  return { add: () => Promise.resolve(), on: () => undefined };
});

const mockUpsert = jest.fn();
const mockLog = jest.fn();
let mockPrior = '0.50';

jest.mock('../../src/database/trustEvolutionDb', () => ({
  // A member who switched evolution on: the row exists, its weights inherit the community's (NULL).
  getUserTrustConfig: async () => ({
    user_id: 'u1', community_id: 'c1', depth_weight: null, breadth_weight: null,
    cross_community_prior: mockPrior, evolution_enabled: true,
  }),
  upsertUserTrustConfig: (...a: unknown[]) => mockUpsert(...a),
  insertEvolutionLog: (...a: unknown[]) => mockLog(...a),
  getLastEvolutionForParameter: async () => null,
  getCommunityEvolutionConfig: async () => ({ community_evolution_enabled: true, cross_community_prior: '0.50' }),
  getGlobalEvolutionPreference: async () => true,
}));
// getUserEffectiveParams reads only these two fields (trustEvolutionService.ts), raw from trust_depth_weight /
// trust_breadth_weight (trustConfigDb.ts).
jest.mock('../../src/database/trustConfigDb', () => ({
  getCommunityTrustConfig: async () => ({ depth_weight: '0.60', breadth_weight: '0.40' }),
}));
jest.mock('../../src/services/effectiveParamsCache', () => ({
  invalidateEffectiveParamsCache: async () => undefined,
}));

import { evaluateUserEvolution, EVOLUTION_SIGNALS } from '../../src/services/trustEvolutionService';

beforeEach(() => {
  mockPrior = '0.50';
  mockUpsert.mockResolvedValue(undefined);
  mockLog.mockResolvedValue(undefined);
});

describe('BUG-079 trust evolution on NUMERIC strings', () => {
  it('nudges depth weight from the community default "0.60" to 0.61', async () => {
    await evaluateUserEvolution('u1', 'c1', EVOLUTION_SIGNALS.REPEAT_INTERACTION_SAME_PERSON, { triggerEventId: 'm1' });

    expect(mockUpsert.mock.calls).toEqual([['u1', 'c1', { depth_weight: 0.61 }]]);
    expect(mockLog.mock.calls).toEqual([[{
      user_id: 'u1', community_id: 'c1', parameter: 'depth_weight', old_value: 0.6, new_value: 0.61,
      trigger_signal: 'repeat_interaction_same_person', trigger_event_id: 'm1',
    }]]);
  });

  it('nudges the cross-community prior from "0.50" to 0.51', async () => {
    await evaluateUserEvolution('u1', 'c1', EVOLUTION_SIGNALS.CROSS_COMMUNITY_MATCH_COMPLETED, { triggerEventId: 'm2' });

    expect(mockUpsert.mock.calls).toEqual([['u1', 'c1', { cross_community_prior: 0.51 }]]);
    expect(mockLog.mock.calls).toEqual([[{
      user_id: 'u1', community_id: 'c1', parameter: 'cross_community_prior', old_value: 0.5, new_value: 0.51,
      trigger_signal: 'cross_community_match_completed', trigger_event_id: 'm2',
    }]]);
  });

  it('writes nothing when a string value already sits at its bound', async () => {
    mockPrior = '0.95';

    await evaluateUserEvolution('u1', 'c1', EVOLUTION_SIGNALS.CROSS_COMMUNITY_MATCH_COMPLETED, { triggerEventId: 'm3' });

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockLog).not.toHaveBeenCalled();
  });
});
