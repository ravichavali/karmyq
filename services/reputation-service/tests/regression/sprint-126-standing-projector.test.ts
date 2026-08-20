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

  it('advances last_activity_at with GREATEST so a replay cannot move it backwards', async () => {
    armSettings();
    const { recordActivity } = require('../../src/utils/activityTracker');

    await recordActivity(USER, COMMUNITY, 'complete_offer', MATCH, { occurredAt: OCCURRED });

    const update = poolSql().find((s) => /UPDATE reputation\.trust_scores/i.test(s));
    expect(update).toBeDefined();
    expect(update).toMatch(/GREATEST/i);
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

    await expect(recordActivity(USER, COMMUNITY, 'complete_offer', MATCH)).resolves.toBeUndefined();
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
