/**
 * Sprint 139 — BUG-080 follow-through (approved decision 7): the existing 03:30 job also refreshes
 * provider metrics, so a cancellation — which triggers no provider refresh of its own — is
 * reflected by the next successful nightly run, even for a provider who never completes again.
 *
 * Contracts pinned here:
 *   - refreshAllProviderTrustScores() walks EVERY active provider profile (not only owners with an
 *     active membership), one at a time, catches and logs a per-profile failure, keeps going, and
 *     returns exact { evaluated, failed } counts. Failing to enumerate rejects: zero work is never
 *     reported as a healthy sweep.
 *   - runDailyTrustScoreRefresh() runs the personal phase and then the provider phase in separate
 *     try/catch blocks: a personal failure does not suppress providers, and a provider failure
 *     does not escape or undo personal work. It is the ONE callback initTrustScoreRefresh schedules,
 *     still once, at '30 3 * * *', still behind SCHEDULED_JOBS_DISABLED.
 *
 * Only transports are faked: the SQL executor, the personal-score calculator and node-cron.
 */
export {};

const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({ query: (...a: unknown[]) => mockQuery(...a) }));

const mockUpdateTrustScore = jest.fn();
jest.mock('../../src/services/karmaService', () => ({
  updateTrustScore: (...a: unknown[]) => mockUpdateTrustScore(...a),
}));

const mockSchedule = jest.fn();
jest.mock('node-cron', () => ({
  __esModule: true,
  default: { schedule: (expr: string, fn: unknown) => mockSchedule(expr, fn) },
}));

import * as cronModule from '../../src/cron/trustScoreRefresh';
import * as providerModule from '../../src/services/providerTrustService';

const flat = (s: unknown) => String(s).replace(/\s+/g, ' ').trim();
const sqls = () => mockQuery.mock.calls.map(([s, p]) => ({ sql: flat(s), params: p as unknown[] }));

type Profile = { id: string; user_id: string };
let providerRows: Profile[];
let memberRows: Array<{ user_id: string; community_id: string }>;
let failRateFor: Set<string>;
let failEnumeration: 'providers' | 'members' | null;

function route(text: string, params: unknown[] = []) {
  const sql = flat(text);
  if (/FROM communities\.members/.test(sql)) {
    if (failEnumeration === 'members') return Promise.reject(new Error('members table unavailable'));
    return Promise.resolve({ rows: memberRows, rowCount: memberRows.length });
  }
  if (/FROM requests\.provider_profiles pp WHERE pp\.is_active = TRUE/.test(sql)) {
    if (failEnumeration === 'providers') return Promise.reject(new Error('profiles table unavailable'));
    return Promise.resolve({ rows: providerRows, rowCount: providerRows.length });
  }
  if (/FROM requests\.matches WHERE responder_id = \$1$/.test(sql)) {
    if (failRateFor.has(params[0] as string)) return Promise.reject(new Error(`rate read failed for ${params[0]}`));
    return Promise.resolve({ rows: [{ completed_matches: '1', terminal_matches: '2' }], rowCount: 1 });
  }
  if (/FROM reputation\.provider_reviews/.test(sql)) return Promise.resolve({ rows: [{ avg_stars: null, total_reviews: '0' }], rowCount: 1 });
  if (/^SELECT completion_rate, response_rate FROM reputation\.provider_trust_scores/.test(sql)) {
    return Promise.resolve({ rows: [{ completion_rate: '50', response_rate: '0' }], rowCount: 1 });
  }
  if (/^INSERT INTO reputation\.provider_trust_scores/.test(sql)) return Promise.resolve({ rows: [], rowCount: 1 });
  return Promise.reject(new Error(`unrouted statement: ${sql}`));
}

let errorSpy: jest.SpyInstance;
let logSpy: jest.SpyInstance;
beforeEach(() => {
  providerRows = [
    { id: 'p1', user_id: 'u1' },
    { id: 'p2', user_id: 'u2' },
    { id: 'p3', user_id: 'u3' },
  ];
  memberRows = [{ user_id: 'm1', community_id: 'c1' }];
  failRateFor = new Set();
  failEnumeration = null;
  mockQuery.mockImplementation(route);
  mockUpdateTrustScore.mockResolvedValue(undefined);
  delete process.env.SCHEDULED_JOBS_DISABLED;
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

/** Whether any console.error argument carries `text` — as an Error's message, a string, or inside a logged object. */
const errorLogged = (text: string) =>
  errorSpy.mock.calls.some((c) =>
    c.some((a: unknown) => (a instanceof Error ? a.message : typeof a === 'object' ? JSON.stringify(a) ?? '' : String(a)).includes(text)),
  );
const FULL_SCORE_WRITE = /^INSERT INTO reputation\.provider_trust_scores \(provider_id, avg_stars/;

const refreshAll = () => (providerModule as any).refreshAllProviderTrustScores as () => Promise<{ evaluated: number; failed: number }>;
const runDaily = () => (cronModule as any).runDailyTrustScoreRefresh as () => Promise<void>;

describe('the new exports exist', () => {
  it('providerTrustService exports refreshAllProviderTrustScores and the cron module exports runDailyTrustScoreRefresh', () => {
    expect(typeof (providerModule as any).refreshAllProviderTrustScores).toBe('function');
    expect(typeof (cronModule as any).runDailyTrustScoreRefresh).toBe('function');
  });
});

describe('refreshAllProviderTrustScores', () => {
  it('enumerates active provider profiles directly — not through community memberships', async () => {
    await refreshAll()();
    const enumeration = sqls().find((s) => /FROM requests\.provider_profiles pp/.test(s.sql));
    expect(enumeration?.sql).toMatch(/WHERE pp\.is_active = TRUE/);
    expect(enumeration?.sql).not.toMatch(/communities\.members/);
    expect(sqls().some((s) => /FROM communities\.members/.test(s.sql))).toBe(false);
  });

  it('one failing profile is logged and counted; the others are refreshed, sequentially, in order', async () => {
    failRateFor = new Set(['u2']);
    await expect(refreshAll()()).resolves.toEqual({ evaluated: 2, failed: 1 });
    const rateReads = sqls().filter((s) => /FROM requests\.matches/.test(s.sql)).map((s) => s.params[0]);
    expect(rateReads).toEqual(['u1', 'u2', 'u3']);
    const writes = sqls().filter((s) => /^INSERT INTO reputation\.provider_trust_scores \(provider_id, completion_rate/.test(s.sql));
    expect(writes.map((w) => w.params[0])).toEqual(['p1', 'p3']);
    // Sequential, not merely ordered: u2's rate read starts only after p1's refresh has fully finished
    // (its last statement is the full score write). A Promise.all over the profiles fails this.
    const all = sqls();
    const p1Done = all.findIndex((s) => FULL_SCORE_WRITE.test(s.sql) && s.params[0] === 'p1');
    const u2Read = all.findIndex((s) => /FROM requests\.matches/.test(s.sql) && s.params[0] === 'u2');
    expect(p1Done).toBeGreaterThanOrEqual(0);
    expect(u2Read).toBeGreaterThan(p1Done);
    expect(errorLogged('p2')).toBe(true);
  });

  it('an empty enumeration is a zero-count success', async () => {
    providerRows = [];
    await expect(refreshAll()()).resolves.toEqual({ evaluated: 0, failed: 0 });
  });

  it('a failed enumeration rejects instead of reporting an empty sweep', async () => {
    failEnumeration = 'providers';
    await expect(refreshAll()()).rejects.toThrow('profiles table unavailable');
  });
});

describe('runDailyTrustScoreRefresh: two independent phases', () => {
  it('runs the personal phase, then the provider phase', async () => {
    await runDaily()();
    expect(mockUpdateTrustScore).toHaveBeenCalledWith('m1', 'c1');
    const order = sqls().map((s) => (/communities\.members/.test(s.sql) ? 'personal' : /provider_profiles pp/.test(s.sql) ? 'providers' : null)).filter(Boolean);
    expect(order).toEqual(['personal', 'providers']);
    expect(sqls().filter((s) => /^INSERT INTO reputation\.provider_trust_scores \(provider_id, completion_rate/.test(s.sql))).toHaveLength(3);
  });

  it('a personal enumeration failure still runs the provider phase, and is logged', async () => {
    failEnumeration = 'members';
    await expect(runDaily()()).resolves.toBeUndefined();
    expect(sqls().filter((s) => /^INSERT INTO reputation\.provider_trust_scores \(provider_id, completion_rate/.test(s.sql))).toHaveLength(3);
    expect(errorLogged('members table unavailable')).toBe(true);
  });

  it('a provider enumeration failure is logged and does not escape, after personal work completed', async () => {
    failEnumeration = 'providers';
    await expect(runDaily()()).resolves.toBeUndefined();
    expect(mockUpdateTrustScore).toHaveBeenCalledWith('m1', 'c1');
    expect(errorLogged('profiles table unavailable')).toBe(true);
  });

  it('logs each phase\'s totals', async () => {
    failRateFor = new Set(['u3']);
    await runDaily()();
    const lines = logSpy.mock.calls.map((c) => String(c[0]));
    expect(lines.some((l) => /1 evaluated, 0 failed/.test(l))).toBe(true); // personal
    expect(lines.some((l) => /provider/i.test(l) && /2 evaluated, 1 failed/.test(l))).toBe(true);
  });
});

describe('the existing schedule carries both phases', () => {
  it('schedules exactly one callback at 30 3 * * *, runs nothing at startup, and that callback reaches the provider phase', async () => {
    cronModule.initTrustScoreRefresh();
    expect(mockQuery).not.toHaveBeenCalled(); // no startup sweep: scheduling alone does no work
    expect(mockUpdateTrustScore).not.toHaveBeenCalled();
    expect(mockSchedule).toHaveBeenCalledTimes(1);
    const [expr, handler] = mockSchedule.mock.calls[0] as [string, () => Promise<void>];
    expect(expr).toBe('30 3 * * *');
    await expect(handler()).resolves.toBeUndefined();
    expect(mockUpdateTrustScore).toHaveBeenCalledWith('m1', 'c1');
    expect(sqls().some((s) => /FROM requests\.provider_profiles pp WHERE pp\.is_active = TRUE/.test(s.sql))).toBe(true);
  });

  it('the scheduled callback survives a personal failure and still refreshes providers', async () => {
    cronModule.initTrustScoreRefresh();
    const [, handler] = mockSchedule.mock.calls[0] as [string, () => Promise<void>];
    failEnumeration = 'members';
    await expect(handler()).resolves.toBeUndefined();
    expect(sqls().filter((s) => /^INSERT INTO reputation\.provider_trust_scores \(provider_id, completion_rate/.test(s.sql))).toHaveLength(3);
  });

  it('the scheduled callback logs a provider failure and does not let it escape, after the personal phase ran', async () => {
    cronModule.initTrustScoreRefresh();
    const [, handler] = mockSchedule.mock.calls[0] as [string, () => Promise<void>];
    failEnumeration = 'providers';
    await expect(handler()).resolves.toBeUndefined();
    expect(mockUpdateTrustScore).toHaveBeenCalledWith('m1', 'c1');
    expect(errorLogged('profiles table unavailable')).toBe(true);
  });

  it('SCHEDULED_JOBS_DISABLED=true schedules neither phase and runs nothing at startup', () => {
    process.env.SCHEDULED_JOBS_DISABLED = 'true';
    cronModule.initTrustScoreRefresh();
    expect(mockSchedule).not.toHaveBeenCalled();
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockUpdateTrustScore).not.toHaveBeenCalled();
  });
});
