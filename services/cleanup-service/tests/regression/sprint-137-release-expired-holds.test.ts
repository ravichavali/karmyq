/**
 * Sprint 137 part D (BUG-088): the hourly expiration job releases what an expired ask held.
 *
 * `releaseExpiredHolds()` (exported from src/jobs/expirationJob.ts):
 *   D1 - one transaction per flagged-expired open ask that still has a proposal (pool.connect(), the
 *        expireDibs.ts pattern): BEGIN, lock the ask FOR UPDATE, free its matched offers, reject its
 *        proposals, COMMIT, release().
 *   D2 - one autocommit guarded UPDATE through `query` freeing stranded matched offers.
 *
 * The function is read off the module as an optional member so this file COMPILES before the
 * implementation exists: every red failure is an assertion, not a TS or TypeError.
 *
 * Root jest sets resetMocks/restoreMocks, which wipes any jest.fn(impl) created at module scope or in a
 * jest.mock factory. The factories below create bare jest.fn()s; behaviour is set in beforeEach over plain
 * module variables.
 */
import { inspect } from 'util';
import pool, { query } from '../../src/database/db';
import { logger } from '../../src/utils/logger';

jest.mock('../../src/database/db', () => ({
  __esModule: true,
  query: jest.fn(),
  default: { connect: jest.fn(), query: jest.fn() },
}));

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() },
}));

type ReleaseResult = {
  asksReleased: number;
  proposalsClosed: number;
  strandedOffersFreed: number;
};
type ReleaseFn = () => Promise<ReleaseResult>;

async function loadRelease(): Promise<ReleaseFn | undefined> {
  const mod = await import('../../src/jobs/expirationJob');
  return (mod as unknown as { releaseExpiredHolds?: ReleaseFn }).releaseExpiredHolds;
}

async function run(): Promise<ReleaseResult> {
  const releaseExpiredHolds = await loadRelease();
  expect(typeof releaseExpiredHolds).toBe('function');
  return (releaseExpiredHolds as ReleaseFn)();
}

// ---- recorded world ---------------------------------------------------------------------------

type Ev =
  | { kind: 'sql'; via: 'client' | 'query'; client?: number; sql: string; params?: unknown[] }
  | { kind: 'release'; client: number };

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();

let events: Ev[] = [];
let clientCount = 0;

// Behaviour each test sets (plain variables, reset in beforeEach).
let candidates: string[] = [];
let lockEmpty: Set<string> = new Set();
let offerThrows: Set<string> = new Set();
let commitThrows: Set<string> = new Set();
let freedByAsk: Record<string, number> = {};
let rejectedByAsk: Record<string, number> = {};
let d2Count = 0;

const I1 =
  'AND o.ctid = (SELECT visible_offer.ctid FROM requests.help_offers visible_offer WHERE visible_offer.id = o.id)';
const SHARED_GUARD = "AND NOT (m.request_id = $1 AND m.status = 'proposed')";

function makeClient() {
  const id = ++clientCount;
  let askId: string | undefined;
  return {
    query: async (text: string, params?: unknown[]) => {
      const sql = norm(text);
      events.push({ kind: 'sql', via: 'client', client: id, sql, params });
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: null };
      if (sql === 'COMMIT') {
        if (askId !== undefined && commitThrows.has(askId)) throw new Error('boom-commit');
        return { rows: [], rowCount: null };
      }
      if (/FOR UPDATE/i.test(sql) && sql.includes('requests.help_requests')) {
        askId = String((params ?? [])[0]);
        return lockEmpty.has(askId)
          ? { rows: [], rowCount: 0 }
          : { rows: [{ id: askId }], rowCount: 1 };
      }
      if (sql.startsWith('UPDATE requests.help_offers')) {
        const target = String((params ?? [])[0]);
        if (offerThrows.has(target)) throw new Error('boom-offer');
        const n = freedByAsk[target] ?? 1;
        return { rows: [], rowCount: n };
      }
      if (sql.startsWith('UPDATE requests.matches')) {
        const n = rejectedByAsk[String((params ?? [])[0])] ?? 1;
        return { rows: [], rowCount: n };
      }
      return { rows: [], rowCount: 0 };
    },
    release: () => {
      events.push({ kind: 'release', client: id });
    },
  };
}

beforeEach(() => {
  events = [];
  clientCount = 0;
  candidates = [];
  lockEmpty = new Set();
  offerThrows = new Set();
  commitThrows = new Set();
  freedByAsk = {};
  rejectedByAsk = {};
  d2Count = 0;

  (pool.connect as unknown as jest.Mock).mockImplementation(async () => makeClient());
  (query as unknown as jest.Mock).mockImplementation(async (text: string, params?: unknown[]) => {
    const sql = norm(text);
    events.push({ kind: 'sql', via: 'query', sql, params });
    if (/^SELECT/i.test(sql)) {
      return { rows: candidates.map((id) => ({ id })), rowCount: candidates.length };
    }
    if (sql.startsWith('UPDATE requests.help_offers')) {
      return { rows: [], rowCount: d2Count };
    }
    return { rows: [], rowCount: 0 };
  });
});

// ---- helpers over the recorded world ----------------------------------------------------------

function label(e: Ev): string {
  if (e.kind === 'release') return 'RELEASE';
  const s = e.sql;
  if (s === 'BEGIN' || s === 'COMMIT' || s === 'ROLLBACK') return s;
  if (/FOR UPDATE/i.test(s) && s.includes('requests.help_requests')) return 'LOCK';
  if (s.startsWith('UPDATE requests.help_offers')) return 'FREE';
  if (s.startsWith('UPDATE requests.matches')) return 'REJECT';
  return `OTHER:${s}`;
}

function clientEvents(client: number): Ev[] {
  return events.filter((e) => (e.kind === 'release' ? e.client === client : e.via === 'client' && e.client === client));
}

/** The client that locked this ask, found from the lock's params. */
function clientFor(askId: string): number {
  const lock = events.find(
    (e) => e.kind === 'sql' && e.via === 'client' && label(e) === 'LOCK' && String(e.params?.[0]) === askId
  );
  return lock && lock.kind === 'sql' && lock.client !== undefined ? lock.client : -1;
}

function sequenceFor(askId: string): string[] {
  return clientEvents(clientFor(askId)).map(label);
}

const d2Events = (): Extract<Ev, { kind: 'sql' }>[] =>
  events.filter(
    (e): e is Extract<Ev, { kind: 'sql' }> =>
      e.kind === 'sql' && e.via === 'query' && e.sql.startsWith('UPDATE requests.help_offers')
  );

const FULL = ['BEGIN', 'LOCK', 'FREE', 'REJECT', 'COMMIT', 'RELEASE'];

const errorLogText = (): string =>
  inspect((logger.error as unknown as jest.Mock).mock.calls, { depth: 8 });

// ---- D1 ---------------------------------------------------------------------------------------

describe('releaseExpiredHolds - D1 per-ask transaction', () => {
  it('runs BEGIN, lock, free, reject, COMMIT, release() in that order for each of two asks', async () => {
    candidates = ['ask-1', 'ask-2'];
    freedByAsk = { 'ask-1': 2, 'ask-2': 4 };
    rejectedByAsk = { 'ask-1': 3, 'ask-2': 6 };
    d2Count = 7;

    const result = await run();

    expect((pool.connect as unknown as jest.Mock).mock.calls.length).toBe(2);
    expect(sequenceFor('ask-1')).toEqual(FULL);
    expect(sequenceFor('ask-2')).toEqual(FULL);
    expect(clientFor('ask-1')).not.toBe(clientFor('ask-2'));

    for (const id of ['ask-1', 'ask-2']) {
      const mine = clientEvents(clientFor(id));
      const lock = mine.find((e) => label(e) === 'LOCK');
      const free = mine.find((e) => label(e) === 'FREE');
      expect(lock && lock.kind === 'sql' ? lock.params : null).toEqual([id]);
      expect(free && free.kind === 'sql' ? free.params?.[0] : null).toBe(id);
    }
    expect(result).toEqual({ asksReleased: 2, proposalsClosed: 9, strandedOffersFreed: 7 });
  });

  it('release() of an ask comes after its COMMIT in the shared log, and every client is released', async () => {
    candidates = ['ask-1', 'ask-2'];
    await run();
    const releases = events.filter((e) => e.kind === 'release');
    expect(releases.length).toBe(2);
    for (const id of ['ask-1', 'ask-2']) {
      const c = clientFor(id);
      const commitIdx = events.findIndex((e) => e.kind === 'sql' && e.client === c && e.sql === 'COMMIT');
      const releaseIdx = events.findIndex((e) => e.kind === 'release' && e.client === c);
      expect(commitIdx).toBeGreaterThan(-1);
      expect(releaseIdx).toBe(commitIdx + 1);
    }
  });

  it("the free targets matched offers, honours the shared-offer guard, then the I1 version predicate", async () => {
    candidates = ['ask-1', 'ask-2'];
    await run();
    for (const id of ['ask-1', 'ask-2']) {
      const free = clientEvents(clientFor(id)).find((e) => label(e) === 'FREE');
      expect(free && free.kind === 'sql').toBe(true);
      const sql = free && free.kind === 'sql' ? free.sql : '';
      expect(sql).toContain("o.status = 'matched'");
      expect(sql).toContain("status = 'proposed' AND offer_id IS NOT NULL");
      expect(sql).toContain(SHARED_GUARD);
      expect(sql).toContain(I1);
      expect(sql.indexOf(I1)).toBeGreaterThan(sql.indexOf(SHARED_GUARD));
      expect(sql).not.toMatch(/FOR UPDATE/i);
    }
  });

  it('never issues an UPDATE requests.help_requests, through a client or through query', async () => {
    candidates = ['ask-1', 'ask-2'];
    await run();
    // The log is non-trivial: both asks produced their full set of statements.
    expect(events.length).toBeGreaterThanOrEqual(2 * FULL.length + 2);
    const requestUpdates = events.filter(
      (e) => e.kind === 'sql' && /UPDATE\s+requests\.help_requests/i.test(e.sql)
    );
    expect(requestUpdates.length).toBe(0);
  });

  it.each([
    { skipped: 'ask-1', kept: 'ask-2', rejected: { 'ask-1': 4, 'ask-2': 6 }, d2: 2,
      expected: { asksReleased: 1, proposalsClosed: 6, strandedOffersFreed: 2 } },
    { skipped: 'ask-2', kept: 'ask-1', rejected: { 'ask-1': 4, 'ask-2': 6 }, d2: 0,
      expected: { asksReleased: 1, proposalsClosed: 4, strandedOffersFreed: 0 } },
  ])('skips $skipped when its lock re-check returns no row: ROLLBACK, no UPDATE, release(), the other ask still runs',
    async ({ skipped, kept, rejected, d2, expected }) => {
      candidates = ['ask-1', 'ask-2'];
      lockEmpty = new Set([skipped]);
      rejectedByAsk = rejected;
      d2Count = d2;

      const result = await run();

      expect(sequenceFor(skipped)).toEqual(['BEGIN', 'LOCK', 'ROLLBACK', 'RELEASE']);
      expect(sequenceFor(kept)).toEqual(FULL);
      const updatesOnSkipped = clientEvents(clientFor(skipped)).filter(
        (e) => e.kind === 'sql' && /^UPDATE/i.test(e.sql)
      );
      expect(updatesOnSkipped.length).toBe(0);
      expect(result).toEqual(expected);
    });

  it('isolates a failure: the first ask offer UPDATE throws -> ROLLBACK + error log naming it; second still commits', async () => {
    candidates = ['ask-1', 'ask-2'];
    offerThrows = new Set(['ask-1']);
    rejectedByAsk = { 'ask-1': 4, 'ask-2': 6 };
    d2Count = 3;

    const result = await run();

    expect(sequenceFor('ask-1')).toEqual(['BEGIN', 'LOCK', 'FREE', 'ROLLBACK', 'RELEASE']);
    expect(sequenceFor('ask-2')).toEqual(FULL);
    expect((logger.error as unknown as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(errorLogText()).toContain('ask-1');
    expect(errorLogText()).not.toContain('ask-2');
    expect(result).toEqual({ asksReleased: 1, proposalsClosed: 6, strandedOffersFreed: 3 });
  });

  it('counts only committed work: a COMMIT that throws after a nonzero reject adds nothing', async () => {
    candidates = ['ask-1', 'ask-2'];
    commitThrows = new Set(['ask-1']);
    rejectedByAsk = { 'ask-1': 5, 'ask-2': 3 };
    d2Count = 1;

    const result = await run();

    expect(sequenceFor('ask-1')).toEqual(['BEGIN', 'LOCK', 'FREE', 'REJECT', 'COMMIT', 'ROLLBACK', 'RELEASE']);
    expect(sequenceFor('ask-2')).toEqual(FULL);
    expect(errorLogText()).toContain('ask-1');
    expect(result).toEqual({ asksReleased: 1, proposalsClosed: 3, strandedOffersFreed: 1 });
  });

  // Pins cleanup-service CONTEXT.md's "Failure" bullet: the connection checkout is outside per-ask isolation.
  it('a connection checkout failure stops the run: it propagates, the committed ask stays, later asks and D2 never run', async () => {
    candidates = ['ask-1', 'ask-2', 'ask-3'];
    d2Count = 7;
    let checkouts = 0;
    (pool.connect as unknown as jest.Mock).mockImplementation(async () => {
      checkouts += 1;
      if (checkouts === 2) throw new Error('boom-connect');
      return makeClient();
    });

    await expect(run()).rejects.toThrow('boom-connect');

    expect(sequenceFor('ask-1')).toEqual(FULL);
    expect(clientFor('ask-2')).toBe(-1);
    expect(clientFor('ask-3')).toBe(-1);
    expect(checkouts).toBe(2);
    const d2Writes = events.filter((e) => e.kind === 'sql' && e.via === 'query' && e.sql.startsWith('UPDATE requests.help_offers'));
    expect(d2Writes).toHaveLength(0);
  });
});

// ---- D2 ---------------------------------------------------------------------------------------

describe('releaseExpiredHolds - D2 stranded matched offers', () => {
  it('issues exactly one autocommit UPDATE help_offers through query, never through a client', async () => {
    candidates = ['ask-1', 'ask-2'];
    d2Count = 5;

    await run();

    const d2 = d2Events();
    expect(d2.length).toBe(1);
    const sql = d2[0].sql;
    expect(sql).toContain("o.status = 'matched'");
    expect(sql).toContain('NOT EXISTS');
    expect(sql).toContain("IN ('proposed', 'matched', 'completed')");
    expect(sql).toContain(I1);
    expect(sql.indexOf(I1)).toBeGreaterThan(sql.indexOf("IN ('proposed', 'matched', 'completed')"));
    expect(sql.indexOf("IN ('proposed', 'matched', 'completed')")).toBeGreaterThan(sql.indexOf('NOT EXISTS'));
    expect(sql).not.toMatch(/FOR UPDATE/i);

    // No client ever ran the D2 statement: client-side frees are D1's (one per ask) and carry no D2 predicate.
    const clientFrees = events.filter(
      (e) => e.kind === 'sql' && e.via === 'client' && e.sql.startsWith('UPDATE requests.help_offers')
    );
    expect(clientFrees.length).toBe(2);
    for (const e of clientFrees) {
      if (e.kind === 'sql') {
        expect(e.sql).toContain('o.id IN (SELECT offer_id FROM requests.matches');
      }
    }
    expect(clientFrees.map((e) => (e.kind === 'sql' ? e.params : null))).toEqual([['ask-1'], ['ask-2']]);
    // D2 is the unscoped statement: it carries no ask id.
    expect(sql).not.toContain('request_id = $1');
    expect(d2[0].params ?? []).toEqual([]);
    // And it is the only write through query.
    const queryWrites = events.filter((e) => e.kind === 'sql' && e.via === 'query' && !/^SELECT/i.test(e.sql));
    expect(queryWrites.length).toBe(1);
  });

  it('runs after every D1 client has been released', async () => {
    candidates = ['ask-1', 'ask-2'];
    await run();
    const d2Idx = events.findIndex(
      (e) => e.kind === 'sql' && e.via === 'query' && e.sql.startsWith('UPDATE requests.help_offers')
    );
    const releaseIdxs = events.map((e, i) => (e.kind === 'release' ? i : -1)).filter((i) => i >= 0);
    expect(releaseIdxs.length).toBe(2);
    expect(d2Idx).toBeGreaterThan(-1);
    for (const r of releaseIdxs) expect(d2Idx).toBeGreaterThan(r);
  });

  it('runs even when D1 has no candidates, and then opens no client at all', async () => {
    candidates = [];
    d2Count = 4;

    const result = await run();

    expect((pool.connect as unknown as jest.Mock).mock.calls.length).toBe(0);
    expect(d2Events().length).toBe(1);
    const queryWrites = events.filter((e) => e.kind === 'sql' && e.via === 'query' && !/^SELECT/i.test(e.sql));
    expect(queryWrites.length).toBe(1);
    expect(events.filter((e) => e.kind === 'sql' && e.via === 'query' && /^SELECT/i.test(e.sql)).length).toBe(1);
    expect(result).toEqual({ asksReleased: 0, proposalsClosed: 0, strandedOffersFreed: 4 });
  });

  it('strandedOffersFreed is exactly the D2 rowCount, independent of D1 counts', async () => {
    candidates = ['ask-1'];
    rejectedByAsk = { 'ask-1': 2 };
    d2Count = 11;

    const result = await run();

    expect(result).toEqual({ asksReleased: 1, proposalsClosed: 2, strandedOffersFreed: 11 });
  });
});
