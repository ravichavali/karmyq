/**
 * Sprint 133 PR B (ADR-100): endorsement reconcile, unit tier. The real-Postgres proofs (a)-(g) live
 * in root tests/integration/sprint-133-endorsement-trust.integration.test.ts; this file pins the pure
 * decision logic, the in-place raw_weight expression and the pair-lock transaction shape.
 */
jest.mock('bull', () => jest.fn().mockImplementation(() => ({ process: jest.fn(), on: jest.fn() })));
jest.mock('../../src/config/database', () => ({ pool: { query: jest.fn(), connect: jest.fn() } }));
jest.mock('../../src/config/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { computeRawWeight, rawWeightSql, rawWeightParams, withPairLock, normalizePair } from '../../src/database/trustEdgeDb';
import { planEndorsementWrites } from '../../src/services/endorsementReconcile';
import { handleEndorsementChanged } from '../../src/events/subscriber';
import { pool } from '../../src/config/database';

const C1 = 'c1000000-0000-4000-8000-000000000001';
const C2 = 'c2000000-0000-4000-8000-000000000002';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('planEndorsementWrites (reconcile, never increment)', () => {
  const edge = (community_id: string, endorsement_count: number) => ({ id: `edge-${community_id}`, community_id, endorsement_count });

  it('sets an existing edge to the target count and records the stored count it replaces', () => {
    expect(planEndorsementWrites([{ community_id: C1, n: 1 }], [edge(C1, 0)])).toEqual({
      updates: [{ id: `edge-${C1}`, community_id: C1, n: 1, from: 0 }], inserts: [],
    });
    expect(planEndorsementWrites([{ community_id: C1, n: 1 }], [edge(C1, 2)])).toEqual({
      updates: [{ id: `edge-${C1}`, community_id: C1, n: 1, from: 2 }], inserts: [],
    });
  });

  it('is idempotent: a target equal to the stored count writes nothing (redelivery leaves the row alone)', () => {
    expect(planEndorsementWrites([{ community_id: C1, n: 1 }], [edge(C1, 1)])).toEqual({ updates: [], inserts: [] });
  });

  it('inserts a missing edge only when the target is > 0', () => {
    expect(planEndorsementWrites([{ community_id: C1, n: 2 }, { community_id: C2, n: 0 }], [])).toEqual({
      updates: [], inserts: [{ community_id: C1, n: 2 }],
    });
  });

  it('zeroes an edge whose community no longer has any active endorsement (withdrawal, tag deletion)', () => {
    expect(planEndorsementWrites([], [edge(C1, 1), edge(C2, 0)])).toEqual({
      updates: [{ id: `edge-${C1}`, community_id: C1, n: 0, from: 1 }], inserts: [],
    });
  });

  it('caps nothing itself: the SQL already counts DISTINCT endorsers, and a target outside 0..2 is a bug', () => {
    expect(() => planEndorsementWrites([{ community_id: C1, n: 3 }], [])).toThrow(/0\.\.2/);
  });
});

describe('in-place raw_weight expression', () => {
  it('evaluates to computeRawWeight over the row columns, for every weight position', () => {
    const weights = { match_completed: 1.5, endorsement: 0.75, karma_given: 0.2, event: 3 };
    const columns = { match_completed_count: 4, endorsement_count: 2, karma_given_count: 7, event_count: 1 };
    const params = rawWeightParams(weights);
    let expr = rawWeightSql(1);
    params.forEach((value, i) => { expr = expr.split(`$${i + 1}`).join(`(${value})`); });
    for (const [column, value] of Object.entries(columns)) expr = expr.split(column).join(`(${value})`);
    expect(expr).toMatch(/^[\d\s.()+*]+$/);
    // eslint-disable-next-line no-new-func
    const evaluated = new Function(`return ${expr}`)();
    expect(evaluated).toBeCloseTo(computeRawWeight(
      { match_completed: 4, endorsement: 2, karma_given: 7, event: 1 }, weights), 10);
  });

  it('honours the parameter offset so it can be embedded after other parameters', () => {
    expect(rawWeightSql(3)).toContain('$3');
    expect(rawWeightSql(3)).toContain('$6');
    expect(rawWeightSql(3)).not.toContain('$2');
  });
});

describe('withPairLock', () => {
  const connect = (pool as any).connect as jest.Mock;
  let calls: Array<[string, unknown[] | undefined]>;
  let release: jest.Mock;
  beforeEach(() => {
    calls = [];
    release = jest.fn();
    connect.mockResolvedValue({ query: async (sql: string, params?: unknown[]) => { calls.push([sql.trim(), params]); return { rows: [] }; }, release });
  });

  it('takes the transaction-scoped advisory lock on the NORMALIZED pair before running the body, then commits', async () => {
    const result = await withPairLock(B, A, async client => { await client.query('SELECT body'); return 42; });
    expect(result).toBe(42);
    expect(calls.map(([sql]) => sql)).toEqual([
      'BEGIN',
      "SELECT pg_advisory_xact_lock(hashtextextended('trust-pair:' || $1 || ':' || $2, 0))",
      'SELECT body',
      'COMMIT',
    ]);
    const { userIdA, userIdB } = normalizePair(B, A);
    expect(calls[1][1]).toEqual([userIdA, userIdB]);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('hands the body the normalized pair, and a rollback run ends with ROLLBACK instead of COMMIT', async () => {
    const seen: unknown[] = [];
    await withPairLock(B, A, async (_client, pair) => { seen.push(pair); }, { rollback: true });
    expect(seen).toEqual([normalizePair(A, B)]);
    expect(calls.map(([sql]) => sql)).toEqual(['BEGIN', expect.stringContaining('pg_advisory_xact_lock'), 'ROLLBACK']);
  });

  it('rolls back, releases and rethrows when the body fails', async () => {
    await expect(withPairLock(A, B, async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    expect(calls.map(([sql]) => sql)).toEqual(['BEGIN', expect.stringContaining('pg_advisory_xact_lock'), 'ROLLBACK']);
    expect(release).toHaveBeenCalledTimes(1);
  });
});

describe('handleEndorsementChanged payload validation', () => {
  beforeEach(() => ((pool as any).connect as jest.Mock).mockClear());
  it.each([
    undefined, {}, { endorser_id: A }, { endorser_id: A, endorsee_id: 'nope' }, { endorser_id: A, endorsee_id: A },
  ])('rejects %j without touching the database', async payload => {
    await expect(handleEndorsementChanged(payload as any)).rejects.toThrow(/endorsement/i);
    expect((pool as any).connect).not.toHaveBeenCalled();
  });
});
