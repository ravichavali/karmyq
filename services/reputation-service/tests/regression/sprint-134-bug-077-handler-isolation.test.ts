/**
 * Sprint 134 BUG-077: in the match_completed handler, only a karma projection failure may fail the job. Karma commits
 * first in its own transaction and replays idempotently (ADR-096); a rethrow from a later step made Bull re-run the
 * whole job ten times and skipped every step after it. Badges and the provider completion rate are recomputed from
 * history on the helper's next completion, so each logs its own failure and the handler carries on.
 */
// A module, not a script: without an import or export these declarations are globals and collide with
// sprint-126-subscriber-boundary.test.ts's identically named ones (TS6200), which a warm ts-jest cache hides.
export {};

type Handler = (job: { data: unknown }) => Promise<unknown>;
const handlers: Record<string, Handler> = {};

// A plain constructor, not jest.fn(impl): the root config's resetMocks would wipe the implementation.
jest.mock('bull', () => function MockBull() {
  return {
    process: (nameOrFn: unknown, fn?: Handler) => {
      if (typeof nameOrFn === 'string' && fn) handlers[nameOrFn] = fn;
      else handlers.__default = nameOrFn as Handler;
    },
    on: () => undefined,
    add: () => undefined,
    close: () => undefined,
  };
});

const mockAward = jest.fn();
const mockProviderRate = jest.fn();
const mockBadges = jest.fn();
const mockEvaluateEvolution = jest.fn();
const mockQuery = jest.fn();

jest.mock('../../src/services/standingProjector', () => ({
  awardKarmaForCompletedMatch: (...a: unknown[]) => mockAward(...a),
}));
jest.mock('../../src/services/providerTrustService', () => ({
  updateProviderCompletionRate: (...a: unknown[]) => mockProviderRate(...a),
}));
jest.mock('../../src/services/badgeService', () => ({
  checkAndAwardBadges: (...a: unknown[]) => mockBadges(...a),
}));
jest.mock('../../src/services/trustEvolutionService', () => ({
  evaluateUserEvolution: (...a: unknown[]) => mockEvaluateEvolution(...a),
  EVOLUTION_SIGNALS: {
    CROSS_COMMUNITY_MATCH_COMPLETED: 'cross_community_match_completed',
    REPEAT_INTERACTION_SAME_PERSON: 'repeat_interaction_same_person',
    DIVERSE_COMMUNITY_INTERACTIONS: 'diverse_community_interactions',
  },
}));
jest.mock('../../src/database/trustEvolutionDb', () => ({
  isCrossCommunityParticipant: async () => false,
  getDiverseCommunityCount: async () => 0,
}));
jest.mock('../../src/services/communityEvolutionService', () => ({
  applyCommunityEvolution: async () => undefined,
}));
jest.mock('../../src/database/db', () => ({
  query: (...a: unknown[]) => mockQuery(...a),
}));

const PAYLOAD = {
  match_id: 'match-1',
  request_id: 'request-1',
  requester_id: 'requester-1',
  responder_id: 'helper-1',
  completed_at: '2026-10-29T10:00:00.000Z',
};

async function deliver() {
  const { initEventSubscriber } = require('../../src/events/subscriber');
  await initEventSubscriber();
  return handlers.match_completed({ data: { payload: PAYLOAD } });
}

let errors: jest.SpyInstance;

beforeEach(() => {
  mockAward.mockResolvedValue({ matchId: 'match-1', communityIds: ['community-1'], insertedKarmaRows: 3, insertedActivityRows: 2 });
  mockProviderRate.mockResolvedValue(undefined);
  mockBadges.mockResolvedValue([]);
  mockEvaluateEvolution.mockResolvedValue(undefined);
  // The evolution block's own reads: the helper's request community, and a third completed exchange with this requester.
  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM requests.request_communities rc')) return { rows: [{ community_id: 'community-1' }] };
    if (sql.includes('COUNT(*) AS cnt')) return { rows: [{ cnt: '3' }] };
    throw new Error(`unexpected query: ${sql}`);
  });
  errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

const evolutionRan = () => expect(mockEvaluateEvolution).toHaveBeenCalledWith(
  'helper-1', 'community-1', 'repeat_interaction_same_person', { triggerEventId: 'match-1' });
const karmaBlamed = () => errors.mock.calls.some(([first]) => String(first).includes('Failed to award karma'));

describe('BUG-077 match_completed side-effect isolation', () => {
  it('finishes the job when the badge check fails, logs it as a badge failure, and still runs trust evolution', async () => {
    const failure = new Error('badge insert failed');
    mockBadges.mockRejectedValue(failure);

    await expect(deliver()).resolves.toBeUndefined();

    evolutionRan();
    expect(errors).toHaveBeenCalledWith('[badges] badge check failed, skipping:', 'match-1', failure);
    expect(karmaBlamed()).toBe(false);
  });

  it('finishes the job when the provider completion rate fails, and still runs badges and trust evolution', async () => {
    const failure = new Error('provider update failed');
    mockProviderRate.mockRejectedValue(failure);

    await expect(deliver()).resolves.toBeUndefined();

    expect(mockBadges).toHaveBeenCalledWith('helper-1');
    evolutionRan();
    expect(errors).toHaveBeenCalledWith('[provider-trust] completion rate update failed, skipping:', 'match-1', failure);
    expect(karmaBlamed()).toBe(false);
  });

  // Preservation: passes against the old handler too. Only karma may fail the job, and it fails before any side effect.
  it('still fails the job on a karma projection failure, before any side effect', async () => {
    mockAward.mockRejectedValue(new Error('projection failed'));

    await expect(deliver()).rejects.toThrow('projection failed');

    expect(mockProviderRate).not.toHaveBeenCalled();
    expect(mockBadges).not.toHaveBeenCalled();
    expect(mockEvaluateEvolution).not.toHaveBeenCalled();
  });
});
