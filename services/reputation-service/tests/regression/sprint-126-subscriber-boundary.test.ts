/**
 * Sprint 126 — the live event boundary.
 *
 * Two things must stay true of `match_completed` delivery:
 *
 *  1. Redelivering the same job is safe. The subscriber does NOT try to deduplicate — idempotency
 *     is the projector's job, enforced by the projection identities in PostgreSQL. A subscriber-side
 *     "have I seen this?" check would be a lie, because it cannot survive a crash between the check
 *     and the write.
 *  2. The non-standing side effects — badges, provider completion rate, trust evolution — remain
 *     subscriber-owned and LIVE-only. The historical backfill must never replay them: nobody should
 *     be notified about, or badged for, help they gave eight months ago because an operator ran a
 *     projection.
 */

type Handler = (job: { data: unknown }) => Promise<unknown>;
const handlers: Record<string, Handler> = {};

jest.mock('bull', () =>
  jest.fn().mockImplementation(() => ({
    process: (nameOrFn: unknown, fn?: Handler) => {
      if (typeof nameOrFn === 'string' && fn) handlers[nameOrFn] = fn;
      else handlers.__default = nameOrFn as Handler;
    },
    on: jest.fn(),
    add: jest.fn(),
    close: jest.fn(),
  })),
);

const mockAward = jest.fn<Promise<unknown>, unknown[]>(async () => ({
  matchId: 'match-1',
  communityIds: ['community-1'],
  insertedKarmaRows: 3,
  insertedActivityRows: 2,
}));
const mockBadges = jest.fn(async () => undefined);
const mockProviderRate = jest.fn(async () => undefined);
const mockEvaluateEvolution = jest.fn(async () => undefined);
const mockQuery = jest.fn(async () => ({ rows: [], rowCount: 0 }));

jest.mock('../../src/services/standingProjector', () => ({
  awardKarmaForCompletedMatch: (...a: unknown[]) => mockAward(...(a as [])),
}));
jest.mock('../../src/services/badgeService', () => ({
  checkAndAwardBadges: (...a: unknown[]) => mockBadges(...(a as [])),
}));
jest.mock('../../src/services/providerTrustService', () => ({
  updateProviderCompletionRate: (...a: unknown[]) => mockProviderRate(...(a as [])),
}));
jest.mock('../../src/services/trustEvolutionService', () => ({
  evaluateUserEvolution: (...a: unknown[]) => mockEvaluateEvolution(...(a as [])),
  EVOLUTION_SIGNALS: { MATCH_COMPLETED: 'match_completed' },
}));
jest.mock('../../src/database/trustEvolutionDb', () => ({
  isCrossCommunityParticipant: jest.fn(async () => false),
  getDiverseCommunityCount: jest.fn(async () => 0),
}));
jest.mock('../../src/services/communityEvolutionService', () => ({
  applyCommunityEvolution: jest.fn(async () => undefined),
}));
jest.mock('../../src/database/db', () => ({
  query: (...a: unknown[]) => mockQuery(...(a as [])),
}));

const PAYLOAD = {
  match_id: 'match-1',
  request_id: 'request-1',
  requester_id: 'requester-1',
  responder_id: 'helper-1',
  completed_at: '2026-04-04T04:04:04.000Z',
};

async function deliver(payload: Record<string, unknown> = PAYLOAD) {
  const { initEventSubscriber } = require('../../src/events/subscriber');
  await initEventSubscriber();
  return handlers.match_completed({ data: { payload } });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAward.mockImplementation(async () => ({
    matchId: 'match-1',
    communityIds: ['community-1'],
    insertedKarmaRows: 3,
    insertedActivityRows: 2,
  }));
  mockQuery.mockImplementation(async () => ({ rows: [], rowCount: 0 }));
});

describe('match_completed delivery', () => {
  it('projects standing through the canonical projector', async () => {
    await deliver();

    expect(mockAward).toHaveBeenCalledTimes(1);
    expect(mockAward).toHaveBeenCalledWith(
      expect.objectContaining({
        match_id: 'match-1',
        request_id: 'request-1',
        requester_id: 'requester-1',
        responder_id: 'helper-1',
      }),
    );
  });

  it('passes the payload completion time through rather than reading a clock', async () => {
    await deliver();

    // On a retry hours later, a fresh `new Date()` here would backdate the match to the retry time
    // and make decay output falsely rich.
    expect(mockAward.mock.calls[0][0]).toMatchObject({ completed_at: '2026-04-04T04:04:04.000Z' });
  });

  it('omits the timestamp when the payload has none, letting the projector read the stored value', async () => {
    const { completed_at, ...withoutTimestamp } = PAYLOAD;
    await deliver(withoutTimestamp);

    expect(mockAward.mock.calls[0][0]).toMatchObject({ completed_at: undefined });
  });

  it('re-invokes the projector on redelivery instead of deduplicating in the subscriber', async () => {
    await deliver();
    await deliver();

    // Idempotency belongs in PostgreSQL. A subscriber-side guard cannot survive a crash between
    // the check and the write, so the correct behaviour here is to call again and let the
    // projection identities absorb it.
    expect(mockAward).toHaveBeenCalledTimes(2);
    expect(mockAward.mock.calls[0][0]).toEqual(mockAward.mock.calls[1][0]);
  });

  it('still runs the live-only side effects after projecting', async () => {
    await deliver();

    expect(mockProviderRate).toHaveBeenCalledWith('helper-1');
    expect(mockBadges).toHaveBeenCalledWith('helper-1');
  });

  it('propagates a projection failure so Bull retries the job', async () => {
    mockAward.mockImplementation(async () => {
      throw new Error('projection failed');
    });

    await expect(deliver()).rejects.toThrow('projection failed');
    // A swallowed failure would silently drop a match's standing forever.
    expect(mockBadges).not.toHaveBeenCalled();
  });
});

describe('backfill boundary', () => {
  // NOTE: an earlier version of this block asserted `projector.checkAndAwardBadges` etc. were
  // undefined — but `standingProjector` is mocked above to a single-key object, so those assertions
  // were true of the mock regardless of what the real module exports. They could not fail. The test
  // below unmocks and pins the real export list exactly, which strictly implies all of them.
  it('exposes only the projection entry points, so the backfill can reach nothing else', () => {
    jest.unmock('../../src/services/standingProjector');
    const exported = Object.keys(require('../../src/services/standingProjector'));

    expect(exported.sort()).toEqual(['awardKarmaForCompletedMatch', 'projectCompletedMatchStanding']);
  });
});
