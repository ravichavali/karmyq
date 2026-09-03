/**
 * Sprint 126 — transaction routing and projector-safe activity writes.
 *
 * The standing projector must write every row for one match atomically: a partial projection is
 * worse than none, because the unique projection indexes would then make the retry a no-op on the
 * rows that landed and the match could never be completed. Reputation's database helpers all call
 * the module-level `query()`, so rather than thread an optional client through every one of them,
 * `withTransaction` publishes a checked-out client through `AsyncLocalStorage` and `query()` picks
 * it up automatically.
 *
 * These tests assert the routing itself — which client each call lands on, and what happens on
 * commit, rollback, and nesting. The pg Pool is mocked because that is the only way to observe
 * WHICH connection a query used; the schema-level guarantees are proved against real PostgreSQL in
 * tests/integration/sprint-126-standing-schema.integration.test.ts.
 */

type QueryResult = { rows: unknown[]; rowCount: number };
type QueryFn = (sql?: unknown, params?: unknown) => Promise<QueryResult>;

const ok = async (): Promise<QueryResult> => ({ rows: [], rowCount: 0 });

const mockClient = {
  query: jest.fn<Promise<QueryResult>, [unknown?, unknown?]>(ok as QueryFn),
  release: jest.fn(),
};
const mockPoolQuery = jest.fn<Promise<QueryResult>, [unknown?, unknown?]>(ok as QueryFn);
const mockConnect = jest.fn(async (): Promise<typeof mockClient> => mockClient);

jest.mock('pg', () => ({
  Pool: jest.fn(() => ({
    query: mockPoolQuery,
    connect: mockConnect,
  })),
}));

// updateTrustScore is the deliberate present-state exception and has its own coverage; stubbing it
// keeps these tests on the projection itself rather than on the trust calculator's fan-out.
const mockUpdateTrustScore = jest.fn(async () => undefined);
jest.mock('../../src/services/karmaService', () => ({
  updateTrustScore: (...args: unknown[]) => mockUpdateTrustScore(...(args as [])),
}));

import { query, withTransaction } from '../../src/database/db';

beforeEach(() => {
  // clearAllMocks() wipes recorded calls AND the implementations these mocks were built with, so
  // every one of them has to be re-armed or the next test sees `undefined` from query().
  jest.clearAllMocks();
  mockClient.query.mockImplementation(ok as QueryFn);
  mockPoolQuery.mockImplementation(ok as QueryFn);
  mockConnect.mockImplementation(async () => mockClient);
});

/** SQL text of every call made on the transaction client, in order. */
function clientSql(): string[] {
  return mockClient.query.mock.calls.map((c) => String(c[0]));
}

describe('query() routing', () => {
  it('uses the pool when there is no active transaction', async () => {
    await query('SELECT 1');
    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('routes every nested call to the SAME checked-out client inside a transaction', async () => {
    await withTransaction(async () => {
      await query('SELECT a');
      await query('SELECT b');
      await query('SELECT c');
    });

    // Not one of the three reached the pool.
    expect(mockPoolQuery).not.toHaveBeenCalled();
    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(clientSql()).toEqual(['BEGIN', 'SELECT a', 'SELECT b', 'SELECT c', 'COMMIT']);
  });

  it('routes calls made from nested helper functions, not just direct ones', async () => {
    const helper = async () => query('SELECT nested');
    const outer = async () => {
      await query('SELECT outer');
      await helper();
    };

    await withTransaction(outer);

    expect(mockPoolQuery).not.toHaveBeenCalled();
    expect(clientSql()).toContain('SELECT nested');
  });

  it('returns to the pool after the transaction ends', async () => {
    await withTransaction(async () => {
      await query('SELECT inside');
    });
    await query('SELECT after');

    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
    expect(mockPoolQuery).toHaveBeenCalledWith('SELECT after', undefined);
  });

  it('keeps concurrent transactions isolated from each other', async () => {
    const clientA = { query: jest.fn<Promise<QueryResult>, [unknown?, unknown?]>(ok as QueryFn), release: jest.fn() };
    const clientB = { query: jest.fn<Promise<QueryResult>, [unknown?, unknown?]>(ok as QueryFn), release: jest.fn() };
    mockConnect
      .mockImplementationOnce(async () => clientA as never)
      .mockImplementationOnce(async () => clientB as never);

    await Promise.all([
      withTransaction(async () => {
        await new Promise((r) => setTimeout(r, 5));
        await query('SELECT from-a');
      }),
      withTransaction(async () => {
        await query('SELECT from-b');
      }),
    ]);

    expect(clientA.query.mock.calls.map((c) => String(c[0]))).toContain('SELECT from-a');
    expect(clientA.query.mock.calls.map((c) => String(c[0]))).not.toContain('SELECT from-b');
    expect(clientB.query.mock.calls.map((c) => String(c[0]))).toContain('SELECT from-b');
    expect(clientB.query.mock.calls.map((c) => String(c[0]))).not.toContain('SELECT from-a');
  });
});

describe('withTransaction() lifecycle', () => {
  it('commits and releases on success, and returns the work result', async () => {
    const result = await withTransaction(async () => 'projected');

    expect(result).toBe('projected');
    expect(clientSql()).toEqual(['BEGIN', 'COMMIT']);
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back, releases, and rethrows when the work throws', async () => {
    const boom = new Error('activity write failed');

    await expect(
      withTransaction(async () => {
        await query('INSERT INTO reputation.karma_records');
        throw boom;
      }),
    ).rejects.toThrow('activity write failed');

    expect(clientSql()).toEqual([
      'BEGIN',
      'INSERT INTO reputation.karma_records',
      'ROLLBACK',
    ]);
    expect(clientSql()).not.toContain('COMMIT');
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it('releases the client even when ROLLBACK itself fails', async () => {
    mockClient.query.mockImplementation(async (sql?: unknown): Promise<QueryResult> => {
      if (String(sql) === 'ROLLBACK') throw new Error('connection lost');
      return { rows: [], rowCount: 0 };
    });

    await expect(withTransaction(async () => { throw new Error('original'); })).rejects.toThrow();
    // A leaked connection here would exhaust the pool (max 5) after five failures.
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it('joins an outer transaction instead of opening a nested one', async () => {
    await withTransaction(async () => {
      await query('SELECT outer');
      await withTransaction(async () => {
        await query('SELECT inner');
      });
    });

    // One connection, one BEGIN, one COMMIT — a nested BEGIN would commit the outer work early.
    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(clientSql().filter((s) => s === 'BEGIN')).toHaveLength(1);
    expect(clientSql().filter((s) => s === 'COMMIT')).toHaveLength(1);
    expect(clientSql()).toEqual(['BEGIN', 'SELECT outer', 'SELECT inner', 'COMMIT']);
  });

  it('propagates a failure from an inner transaction to the outer rollback', async () => {
    await expect(
      withTransaction(async () => {
        await withTransaction(async () => {
          throw new Error('inner failed');
        });
      }),
    ).rejects.toThrow('inner failed');

    expect(clientSql()).toContain('ROLLBACK');
    expect(clientSql()).not.toContain('COMMIT');
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });
});

describe('recordActivity — projector-safe activity writes', () => {
  const USER = 'user-1';
  const COMMUNITY = 'community-1';
  const MATCH = 'match-1';
  const OCCURRED = new Date('2026-02-02T02:02:02.000Z');

  /** Answers the community-settings lookup so the tracker gets past its enabled-types gate. */
  function armSettings(activityTypes: string[] = ['complete_offer']) {
    const respond = async (sql?: unknown): Promise<QueryResult> => {
      if (/FROM communities\.settings/i.test(String(sql))) {
        return { rows: [{ activity_types: activityTypes }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    mockPoolQuery.mockImplementation(respond);
    mockClient.query.mockImplementation(respond);
  }

  function poolSql(): string[] {
    return mockPoolQuery.mock.calls.map((c) => String(c[0]));
  }

  it('writes the activity row with ON CONFLICT DO NOTHING so a replay is a no-op', async () => {
    armSettings();
    const { recordActivity } = require('../../src/utils/activityTracker');

    await recordActivity(USER, COMMUNITY, 'complete_offer', MATCH);

    const insert = poolSql().find((s) => /INSERT INTO reputation\.activity_log/i.test(s));
    expect(insert).toBeDefined();
    expect(insert).toMatch(/ON CONFLICT\s+DO NOTHING/i);
  });

  it('stamps the supplied occurrence time rather than the clock', async () => {
    armSettings();
    const { recordActivity } = require('../../src/utils/activityTracker');

    await recordActivity(USER, COMMUNITY, 'complete_offer', MATCH, { occurredAt: OCCURRED });

    const insertCall = mockPoolQuery.mock.calls.find((c) =>
      /INSERT INTO reputation\.activity_log/i.test(String(c[0])),
    );
    expect(insertCall).toBeDefined();
    // Historical rows carry the match's real completion time; NOW() would make decay and
    // recent-activity output falsely rich.
    expect(String(insertCall![0])).toMatch(/created_at/i);
    expect(insertCall![1]).toContain(OCCURRED);
  });

  it('upserts last_activity_at with GREATEST so a replay cannot move it backwards', async () => {
    armSettings();
    const { recordActivity } = require('../../src/utils/activityTracker');

    await recordActivity(USER, COMMUNITY, 'complete_offer', MATCH, { occurredAt: OCCURRED });

    const write = poolSql().find((s) => /INTO reputation\.trust_scores/i.test(s));
    expect(write).toBeDefined();
    expect(write).toMatch(/GREATEST/i);
    // Must be an UPSERT, not an UPDATE: during a backfill of an empty table a bare UPDATE matches
    // zero rows, and updateTrustScore then inserts the row with last_activity_at defaulting to
    // CURRENT_TIMESTAMP — stamping historical activity as happening today.
    expect(write).toMatch(/ON CONFLICT \(user_id, community_id\) DO UPDATE/i);
    // The historical timestamp is the value written, not a clock read.
    const call = mockPoolQuery.mock.calls.find((c) => /INTO reputation\.trust_scores/i.test(String(c[0])));
    expect((call![1] as unknown[])[2]).toEqual(OCCURRED);
  });

  it('swallows errors for ordinary callers, so activity logging cannot break the main flow', async () => {
    armSettings();
    mockPoolQuery.mockImplementation(async (sql?: unknown): Promise<QueryResult> => {
      if (/FROM communities\.settings/i.test(String(sql))) {
        return { rows: [{ activity_types: ['complete_offer'] }], rowCount: 1 };
      }
      throw new Error('activity insert exploded');
    });
    const { recordActivity } = require('../../src/utils/activityTracker');

    // Returns 0 rather than throwing: the caller's main flow must not break on a logging failure.
    await expect(recordActivity(USER, COMMUNITY, 'complete_offer', MATCH)).resolves.toBe(0);
  });

  it('RETHROWS when required, so a failed activity write rolls the match transaction back', async () => {
    armSettings();
    mockPoolQuery.mockImplementation(async (sql?: unknown): Promise<QueryResult> => {
      if (/FROM communities\.settings/i.test(String(sql))) {
        return { rows: [{ activity_types: ['complete_offer'] }], rowCount: 1 };
      }
      throw new Error('activity insert exploded');
    });
    const { recordActivity } = require('../../src/utils/activityTracker');

    await expect(
      recordActivity(USER, COMMUNITY, 'complete_offer', MATCH, { required: true }),
    ).rejects.toThrow('activity insert exploded');
  });

  it('participates in an open transaction rather than writing outside it', async () => {
    armSettings();
    const { recordActivity } = require('../../src/utils/activityTracker');

    await withTransaction(async () => {
      await recordActivity(USER, COMMUNITY, 'complete_offer', MATCH, { required: true });
    });

    // A row written on the pool here would survive a rollback of the match it belongs to.
    expect(mockPoolQuery).not.toHaveBeenCalled();
    expect(clientSql().some((s) => /INSERT INTO reputation\.activity_log/i.test(s))).toBe(true);
  });
});

describe('projectCompletedMatchStanding', () => {
  const MATCH_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
  const REQUEST_ID = 'bbbbbbbb-0000-4000-8000-000000000001';
  const REQUESTER = 'cccccccc-0000-4000-8000-000000000001';
  const HELPER = 'dddddddd-0000-4000-8000-000000000001';
  const COMPLETED_AT = new Date('2026-05-05T05:05:05.000Z');

  interface Scenario {
    facts?: Record<string, unknown> | null;
    candidates?: Array<Record<string, unknown>>;
    fallback?: Array<Record<string, unknown>>;
    activityTypes?: string[];
    failActivityInsert?: boolean;
    karmaInsertRowCount?: number;
  }

  const DEFAULT_FACTS: Record<string, unknown> = {
    request_id: REQUEST_ID,
    requester_id: REQUESTER,
    responder_id: HELPER,
    status: 'completed',
    completed_at: COMPLETED_AT,
    request_type: 'generic',
  };

  function candidateRow(
    community_id: string,
    prior_helper_karma = 0,
    helper_helps_before = 0,
  ): Record<string, unknown> {
    return {
      community_id,
      karma_split_helper: 60,
      karma_split_requestor: 40,
      enabled_request_types: null,
      prior_helper_karma,
      helper_helps_before,
    };
  }

  function fallbackRow(community_id: string): Record<string, unknown> {
    return {
      community_id,
      karma_split_helper: 60,
      karma_split_requestor: 40,
      enabled_request_types: null,
    };
  }

  /** Answers every query the projector issues, in whatever order it issues them. */
  function arm(scenario: Scenario = {}) {
    const facts = scenario.facts === undefined ? DEFAULT_FACTS : scenario.facts;
    const candidates = scenario.candidates ?? [candidateRow('community-1')];
    const fallback = scenario.fallback ?? [];
    const activityTypes = scenario.activityTypes ?? ['complete_request', 'complete_offer'];
    const failActivityInsert = scenario.failActivityInsert ?? false;
    const karmaInsertRowCount = scenario.karmaInsertRowCount ?? 1;

    const respond = async (sql?: unknown): Promise<QueryResult> => {
      const text = String(sql);
      if (/pg_advisory_xact_lock/i.test(text)) return { rows: [{}], rowCount: 1 };
      if (/FROM requests\.matches m/i.test(text)) {
        return facts ? { rows: [facts], rowCount: 1 } : { rows: [], rowCount: 0 };
      }
      if (/FROM requests\.request_communities rc/i.test(text)) {
        // The candidate query joins members; the fallback query orders and limits.
        return /communities\.members/i.test(text)
          ? { rows: candidates, rowCount: candidates.length }
          : { rows: fallback, rowCount: fallback.length };
      }
      if (/INSERT INTO reputation\.karma_records/i.test(text)) {
        return { rows: [], rowCount: karmaInsertRowCount };
      }
      if (/FROM communities\.settings/i.test(text)) {
        return { rows: [{ activity_types: activityTypes }], rowCount: 1 };
      }
      if (/INSERT INTO reputation\.activity_log/i.test(text)) {
        if (failActivityInsert) throw new Error('activity_log write failed');
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };

    mockPoolQuery.mockImplementation(respond);
    mockClient.query.mockImplementation(respond);
  }

  function project(overrides: Record<string, unknown> = {}, options: Record<string, unknown> = {}) {
    const { projectCompletedMatchStanding } = require('../../src/services/standingProjector');
    return projectCompletedMatchStanding(
      { matchId: MATCH_ID, requestId: REQUEST_ID, requesterId: REQUESTER, helperId: HELPER, ...overrides },
      { mode: 'live', allowRequestCommunityFallback: true, ...options },
    );
  }

  /** Parameter arrays of every karma insert issued, in order. */
  function karmaInserts(): unknown[][] {
    return mockClient.query.mock.calls
      .filter((c) => /INSERT INTO reputation\.karma_records/i.test(String(c[0])))
      .map((c) => c[1] as unknown[]);
  }

  function candidateQuerySql(): string | undefined {
    return clientSql().find(
      (s) => /FROM requests\.request_communities rc/i.test(s) && /communities\.members/i.test(s),
    );
  }

  describe('input validation and authoritative facts', () => {
    it.each([
      ['matchId', { matchId: '' }],
      ['requestId', { requestId: '' }],
      ['requesterId', { requesterId: '' }],
      ['helperId', { helperId: '' }],
    ])('rejects a missing %s before touching the database', async (_name, override) => {
      arm();
      await expect(project(override)).rejects.toThrow(/requires matchId/);
      expect(mockConnect).not.toHaveBeenCalled();
    });

    it('takes an advisory lock before reading the match', async () => {
      arm();
      await project();

      const sql = clientSql();
      const lockAt = sql.findIndex((s) => /pg_advisory_xact_lock/i.test(s));
      const readAt = sql.findIndex((s) => /FROM requests\.matches m/i.test(s));
      expect(lockAt).toBeGreaterThan(-1);
      // Lock first, inside the transaction — otherwise two concurrent deliveries of the same match
      // both read "not yet projected" and race.
      expect(sql[0]).toBe('BEGIN');
      expect(lockAt).toBeLessThan(readAt);
    });

    it('rejects an unknown match', async () => {
      arm({ facts: null });
      await expect(project()).rejects.toThrow(/Match not found/);
    });

    it('refuses a match that is not completed', async () => {
      arm({ facts: { ...DEFAULT_FACTS, status: 'proposed', completed_at: null } });
      await expect(project()).rejects.toThrow(/not completed/);
    });

    it('refuses a completed match with no completion timestamp', async () => {
      arm({ facts: { ...DEFAULT_FACTS, completed_at: null } });
      await expect(project()).rejects.toThrow(/no completed_at/);
    });

    it.each([
      ['helper', { responder_id: 'someone-else' }, /helper mismatch/],
      ['requester', { requester_id: 'someone-else' }, /requester mismatch/],
      ['request', { request_id: 'another-request' }, /belongs to request/],
    ] as Array<[string, Record<string, unknown>, RegExp]>)(
      'rejects a payload whose %s disagrees with the stored match',
      async (_n, patch, expected) => {
        arm({ facts: { ...DEFAULT_FACTS, ...patch } });
        // An event payload is a message; the database is the record. Trusting the payload here
        // would let a malformed event award someone else's karma.
        await expect(project()).rejects.toThrow(expected);
      },
    );

    it('rolls back without writing when the match is invalid', async () => {
      arm({ facts: null });
      await expect(project()).rejects.toThrow();
      expect(clientSql()).toContain('ROLLBACK');
      expect(karmaInserts()).toHaveLength(0);
    });
  });

  describe('projected rows', () => {
    it('writes provided, received, and first-help for a first exchange', async () => {
      arm();
      const result = await project();

      expect(karmaInserts().map((p) => p[3])).toEqual([
        'Provided help',
        'Received help',
        'First help in community',
      ]);
      expect(result.communityIds).toEqual(['community-1']);
      expect(result.insertedKarmaRows).toBe(3);
    });

    it('stamps every row with the STORED completion time, not the clock', async () => {
      arm();
      await project();

      for (const params of karmaInserts()) {
        expect(params[5]).toEqual(COMPLETED_AT);
        expect(params[4]).toBe(MATCH_ID);
      }
    });

    it('prefers the stored completion time over a caller-supplied one', async () => {
      arm();
      await project({ completedAt: new Date('2030-01-01T00:00:00.000Z') });

      // A caller-supplied timestamp is only a hint; a wrong one must not rewrite real history.
      for (const params of karmaInserts()) {
        expect(params[5]).toEqual(COMPLETED_AT);
      }
    });

    it('writes every karma row with ON CONFLICT DO NOTHING', async () => {
      arm();
      await project();

      const inserts = mockClient.query.mock.calls
        .filter((c) => /INSERT INTO reputation\.karma_records/i.test(String(c[0])))
        .map((c) => String(c[0]));
      expect(inserts).toHaveLength(3);
      for (const sql of inserts) expect(sql).toMatch(/ON CONFLICT\s+DO NOTHING/i);
    });

    it('awards at most three communities when four are eligible, highest prior karma first', async () => {
      arm({
        candidates: [
          candidateRow('community-a', 1),
          candidateRow('community-b', 90),
          candidateRow('community-c', 40),
          candidateRow('community-d', 70),
        ],
      });
      const result = await project();

      expect(result.communityIds).toEqual(['community-b', 'community-d', 'community-c']);
      expect(new Set(karmaInserts().map((p) => p[1]))).toEqual(
        new Set(['community-b', 'community-d', 'community-c']),
      );
    });

    it.each([
      [9, '10 exchanges milestone', 25],
      [49, '50 exchanges milestone', 50],
      [99, '100 exchanges milestone', 100],
    ] as Array<[number, string, number]>)(
      'awards the milestone at %s prior helps, from history strictly before this match',
      async (helpsBefore, reason, points) => {
        arm({ candidates: [candidateRow('community-1', 10, helpsBefore)] });
        await project();

        const bonus = karmaInserts().find((p) => p[3] === reason);
        expect(bonus).toBeDefined();
        expect(Number(bonus![2])).toBe(points);
        expect(bonus![0]).toBe(HELPER);
      },
    );

    it('awards no bonus on an ordinary non-milestone exchange', async () => {
      arm({ candidates: [candidateRow('community-1', 10, 6)] });
      await project();

      expect(karmaInserts().map((p) => p[3])).toEqual(['Provided help', 'Received help']);
    });

    it('derives milestone rank from strictly-before history, so a replay is stable', async () => {
      // helper_helps_before excludes THIS match's own row, so the answer does not change once that
      // row exists — counting inclusively would award a different milestone on the second run.
      arm({ candidates: [candidateRow('community-1', 10, 0)] });
      await project();
      expect(karmaInserts().map((p) => p[3])).toContain('First help in community');

      jest.clearAllMocks();
      mockConnect.mockImplementation(async () => mockClient);
      arm({ candidates: [candidateRow('community-1', 10, 0)], karmaInsertRowCount: 0 });
      const replay = await project();
      expect(karmaInserts().map((p) => p[3])).toContain('First help in community');
      expect(replay.insertedKarmaRows).toBe(0);
    });
  });

  describe('as-of boundary in SQL', () => {
    it('bounds prior karma and prior helps strictly before (completed_at, match_id)', async () => {
      arm();
      await project();

      const sql = candidateQuerySql();
      expect(sql).toBeDefined();
      // Both LATERAL aggregates must carry the same strict boundary, or replaying an old match
      // would see karma from matches that had not happened yet.
      const boundaries = sql!.match(
        /src\.completed_at < \$5 OR \(src\.completed_at = \$5 AND src\.id < \$6::uuid\)/g,
      );
      expect(boundaries).toHaveLength(2);
      // uuid comparison, not `id::text` — text `<` uses the database collation, which is exactly
      // the environment-sensitivity compareReplayKeys rejects localeCompare for. Byte order and
      // canonical-lowercase-hex string order agree, so the TS and SQL tie-breaks still match.
      expect(sql).not.toMatch(/src\.id::text/);
      expect(sql).toMatch(/JOIN requests\.matches src ON src\.id = kr\.related_entity_id/);
    });

    it('passes the stored completion time and match id as the boundary parameters', async () => {
      arm();
      await project();

      const call = mockClient.query.mock.calls.find(
        (c) =>
          /FROM requests\.request_communities rc/i.test(String(c[0])) &&
          /communities\.members/i.test(String(c[0])),
      );
      const params = call![1] as unknown[];
      expect(params[4]).toEqual(COMPLETED_AT);
      expect(params[5]).toBe(MATCH_ID);
    });

    it('requires BOTH participants to be active members of a candidate community', async () => {
      arm();
      await project();

      const sql = candidateQuerySql()!;
      // A claim-only or single-sided check would award karma in a community one party had left.
      expect(sql).toMatch(/cm_req\.user_id = \$2 AND cm_req\.status = 'active'/);
      expect(sql).toMatch(/cm_help\.user_id = \$3 AND cm_help\.status = 'active'/);
    });

    it('reads the typed enabled_request_types column that exists in community_configs', async () => {
      arm();
      await project();

      const sql = candidateQuerySql()!;
      expect(sql).toMatch(/cc\.enabled_request_types\s+AS enabled_request_types/i);
      expect(sql).not.toMatch(/cc\.config\s*->/i);
    });
  });

  describe('community fallback boundary', () => {
    it('falls back to one stable request community for LIVE delivery', async () => {
      arm({ candidates: [], fallback: [fallbackRow('fallback-1')] });
      const result = await project();

      expect(result.communityIds).toEqual(['fallback-1']);
      const fallbackSql = clientSql().find(
        (s) => /FROM requests\.request_communities rc/i.test(s) && !/communities\.members/i.test(s),
      );
      // ORDER BY, not a bare LIMIT 1: an unordered pick could award the same match in a different
      // community on each retry, which the projection indexes would not catch.
      expect(fallbackSql).toMatch(/ORDER BY rc\.community_id/i);
    });

    it('fails closed in HISTORICAL mode instead of inventing a community', async () => {
      arm({ candidates: [], fallback: [fallbackRow('fallback-1')] });
      const result = await project({}, { mode: 'historical', allowRequestCommunityFallback: true });

      expect(result.communityIds).toEqual([]);
      expect(result.insertedKarmaRows).toBe(0);
      expect(karmaInserts()).toHaveLength(0);
    });

    it('writes nothing when live fallback is not permitted and no community is eligible', async () => {
      arm({ candidates: [] });
      const result = await project({}, { mode: 'live', allowRequestCommunityFallback: false });

      expect(result.communityIds).toEqual([]);
      expect(karmaInserts()).toHaveLength(0);
    });
  });

  describe('atomicity and side-effect boundary', () => {
    it('performs every write on one transaction client, never the pool', async () => {
      arm();
      await project();

      expect(mockPoolQuery).not.toHaveBeenCalled();
      expect(mockConnect).toHaveBeenCalledTimes(1);
      const sql = clientSql();
      expect(sql[0]).toBe('BEGIN');
      expect(sql[sql.length - 1]).toBe('COMMIT');
    });

    it('rolls the whole match back when a required activity write fails', async () => {
      arm({ failActivityInsert: true });

      await expect(project()).rejects.toThrow(/activity_log write failed/);
      // Karma without its activity counterpart is a partial projection, and the projection indexes
      // would make the retry a no-op on the karma that already landed.
      expect(clientSql()).toContain('ROLLBACK');
      expect(clientSql()).not.toContain('COMMIT');
    });

    it('records activity for both participants with the historical timestamp', async () => {
      arm();
      const result = await project();

      const activityCalls = mockClient.query.mock.calls.filter((c) =>
        /INSERT INTO reputation\.activity_log/i.test(String(c[0])),
      );
      expect(activityCalls).toHaveLength(2);
      for (const call of activityCalls) {
        expect((call[1] as unknown[])[4]).toEqual(COMPLETED_AT);
      }
      expect(result.insertedActivityRows).toBe(2);
    });

    it('touches trust_scores rows in ONE deterministic (community, user) order', async () => {
      arm({ candidates: [candidateRow('community-b', 5, 3), candidateRow('community-a', 9, 3)] });
      await project();

      // Every write that locks a trust_scores row, in the order it was issued.
      const locked = mockClient.query.mock.calls
        .filter((c) => /INTO reputation\.trust_scores/i.test(String(c[0])))
        .map((c) => {
          const params = c[1] as unknown[];
          return `${String(params[1])}|${String(params[0])}`;
        });

      // These locks are held until the match transaction commits. Two concurrent matches that share
      // both participants with swapped roles would deadlock (40P01) under a helper-then-requester
      // order; sorting means they can only ever queue.
      expect(locked).toEqual([...locked].sort());
      expect(locked.length).toBeGreaterThan(1);
    });

    it('refreshes the trust cache for both participants', async () => {
      arm();
      await project();

      expect(mockUpdateTrustScore).toHaveBeenCalledTimes(2);
      expect(mockUpdateTrustScore).toHaveBeenCalledWith(HELPER, 'community-1');
      expect(mockUpdateTrustScore).toHaveBeenCalledWith(REQUESTER, 'community-1');
    });

    it('does NOT replay badges, provider metrics, notifications, or trust evolution', async () => {
      arm();
      await project();

      const allSql = clientSql().join(' | ');
      // Those are live-only subscriber concerns. Replaying them for a historical match would
      // notify people about help they received months ago.
      expect(allSql).not.toMatch(/reputation\.badges/i);
      expect(allSql).not.toMatch(/provider_trust_scores|provider_profiles/i);
      expect(allSql).not.toMatch(/notifications\./i);
      expect(allSql).not.toMatch(/user_trust_evolution_log/i);
    });

    it('reports a fully replayed match as zero rows written, not an error', async () => {
      arm({ karmaInsertRowCount: 0 });
      const result = await project();

      expect(result.insertedKarmaRows).toBe(0);
      expect(result.communityIds).toEqual(['community-1']);
      expect(clientSql()).toContain('COMMIT');
    });
  });

  describe('awardKarmaForCompletedMatch compatibility wrapper', () => {
    it('maps the snake_case event payload onto the projector input', async () => {
      arm();
      const { awardKarmaForCompletedMatch } = require('../../src/services/standingProjector');

      const result = await awardKarmaForCompletedMatch({
        match_id: MATCH_ID,
        request_id: REQUEST_ID,
        requester_id: REQUESTER,
        responder_id: HELPER,
      });

      expect(result.matchId).toBe(MATCH_ID);
      expect(result.communityIds).toEqual(['community-1']);
      expect(result.insertedKarmaRows).toBe(3);
    });

    it('keeps the live fallback available to event delivery', async () => {
      arm({ candidates: [], fallback: [fallbackRow('fallback-1')] });
      const { awardKarmaForCompletedMatch } = require('../../src/services/standingProjector');

      const result = await awardKarmaForCompletedMatch({
        match_id: MATCH_ID,
        request_id: REQUEST_ID,
        requester_id: REQUESTER,
        responder_id: HELPER,
      });
      expect(result.communityIds).toEqual(['fallback-1']);
    });
  });
});
