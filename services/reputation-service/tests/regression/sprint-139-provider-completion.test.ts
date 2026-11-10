/**
 * Sprint 139 — BUG-080: provider completion rate is completed / (completed + cancelled).
 *
 * Both recalculation paths divided completed matches by `status IN ('accepted', 'completed')`. No
 * match is ever 'accepted' in the current lifecycle (proposed → matched → completed | cancelled),
 * so the denominator equalled the numerator and every provider with one completion read 100%.
 * The maintainer chose the terminal-outcome ratio: ongoing matches are excluded, cancellations
 * count regardless of who cancelled, and no terminal history is 0.
 *
 * Only DB I/O is faked, by a small stateful store:
 *   - match aggregates are EVALUATED: the fake reads each `COUNT(*) FILTER (WHERE status ...)
 *     AS alias` out of the real SQL and counts that responder's statuses, so a wrong status list or
 *     a wrong responder binding gives a wrong number rather than a mocked right one;
 *   - provider_trust_scores is a table: writes land in it and later reads see them, so the real
 *     recalculateProviderTrustScore turns the stored rate into the persisted score. No formula is
 *     copied into this file.
 */
export {};

type Match = { responder: string; status: string };
type Score = { completion_rate?: number; response_rate?: number; trust_score?: number; avg_stars?: number };
let matches: Match[] = [];
let profiles: Array<{ id: string; user_id: string; is_active: boolean }> = [];
let reviews: Record<string, number[]> = {};
let scores: Record<string, Score> = {};
const calls: Array<{ sql: string; params: unknown[] }> = [];

const flat = (s: string) => s.replace(/\s+/g, ' ').trim();

function evaluateAggregate(sql: string, responder: string) {
  const row: Record<string, string> = {};
  const re = /COUNT\(\*\) FILTER \(WHERE status (= '([a-z_]+)'|IN \(([^)]*)\))\) AS (\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) {
    const list = m[2] ? [m[2]] : m[3].split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
    row[m[4]] = String(matches.filter((x) => x.responder === responder && list.includes(x.status)).length);
  }
  if (Object.keys(row).length === 0) throw new Error(`fake DB: unrecognized match aggregate: ${sql}`);
  return row;
}

async function fakeQuery(text: string, params: unknown[] = []) {
  const sql = flat(text);
  calls.push({ sql, params });
  if (/FROM requests\.provider_profiles/.test(sql)) {
    const active = profiles.filter((p) => p.is_active);
    if (/WHERE user_id = \$1 AND is_active = TRUE/.test(sql)) {
      const rows = active.filter((p) => p.user_id === params[0]).map(({ id }) => ({ id }));
      return { rows, rowCount: rows.length };
    }
    if (/WHERE pp\.is_active = TRUE/.test(sql)) {
      const rows = active.map(({ id, user_id }) => ({ id, user_id }));
      return { rows, rowCount: rows.length };
    }
    throw new Error(`fake DB: unrecognized profile query: ${sql}`);
  }
  if (/FROM requests\.matches WHERE responder_id = \$1$/.test(sql)) {
    return { rows: [evaluateAggregate(sql, params[0] as string)], rowCount: 1 };
  }
  if (/FROM reputation\.provider_reviews WHERE provider_id = \$1/.test(sql)) {
    const stars = reviews[params[0] as string] ?? [];
    const avg = stars.length ? String(stars.reduce((a, b) => a + b, 0) / stars.length) : null;
    return { rows: [{ avg_stars: avg, total_reviews: String(stars.length) }], rowCount: 1 };
  }
  if (/^SELECT completion_rate, response_rate FROM reputation\.provider_trust_scores WHERE provider_id = \$1$/.test(sql)) {
    const s = scores[params[0] as string];
    // pg returns NUMERIC as strings
    return s ? { rows: [{ completion_rate: String(s.completion_rate ?? 0), response_rate: String(s.response_rate ?? 0) }], rowCount: 1 } : { rows: [], rowCount: 0 };
  }
  if (/^INSERT INTO reputation\.provider_trust_scores \(provider_id, completion_rate, last_calculated\)/.test(sql)) {
    const [id, rate] = params as [string, number];
    scores[id] = { ...scores[id], completion_rate: rate };
    return { rows: [], rowCount: 1 };
  }
  if (/^INSERT INTO reputation\.provider_trust_scores \(provider_id, avg_stars, total_reviews, completion_rate, response_rate, trust_score, last_calculated\)/.test(sql)) {
    const [id, avg, , rate, resp, trust] = params as [string, number, number, number, number, number];
    // ON CONFLICT updates avg_stars, total_reviews, trust_score only; the behavioral metrics keep their row value.
    const prev = scores[id];
    scores[id] = prev
      ? { ...prev, avg_stars: avg, trust_score: trust }
      : { avg_stars: avg, completion_rate: rate, response_rate: resp, trust_score: trust };
    return { rows: [], rowCount: 1 };
  }
  throw new Error(`fake DB: unrecognized statement: ${sql}`);
}

jest.mock('../../src/database/db', () => ({
  query: (text: string, params?: unknown[]) => fakeQuery(text, params),
}));

import {
  backfillAllProviderTrustScores,
  recalculateProviderTrustScore,
  updateProviderCompletionRate,
} from '../../src/services/providerTrustService';

const H = 'helper-h';
const OTHER = 'helper-other';
const statuses = (responder: string, ...list: string[]) => list.map((status) => ({ responder, status }));
const ONGOING_AND_IRRELEVANT = ['proposed', 'matched', 'rejected', 'declined', 'accepted', 'mystery'];

beforeEach(() => {
  matches = [];
  profiles = [{ id: 'p-h-1', user_id: H, is_active: true }];
  reviews = {};
  scores = {};
  calls.length = 0;
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

describe('completion rate = completed / (completed + cancelled), via updateProviderCompletionRate', () => {
  it.each([
    ['no terminal history (only ongoing / irrelevant statuses)', [...ONGOING_AND_IRRELEVANT], 0],
    ['one completed plus every ongoing / irrelevant status', ['completed', ...ONGOING_AND_IRRELEVANT], 100],
    ['only cancelled', ['cancelled', 'cancelled'], 0],
    ['two completed, one cancelled', ['completed', 'completed', 'cancelled', 'matched', 'proposed'], 66.67],
    ['one completed, one cancelled', ['completed', 'cancelled'], 50],
  ])('%s -> %p', async (_l, list, rate) => {
    matches = statuses(H, ...list);
    await updateProviderCompletionRate(H);
    expect(scores['p-h-1'].completion_rate).toBe(rate);
  });

  it('counts only the responder\'s own history, bound as a parameter', async () => {
    matches = [...statuses(H, 'completed', 'cancelled'), ...statuses(OTHER, 'completed', 'completed', 'completed')];
    await updateProviderCompletionRate(H);
    expect(scores['p-h-1'].completion_rate).toBe(50);
    const aggregates = calls.filter((c) => /FROM requests\.matches/.test(c.sql));
    expect(aggregates.length).toBeGreaterThan(0);
    for (const a of aggregates) expect(a.params).toEqual([H]);
  });

  it('a 5-star provider with response rate 0 and rate 66.67 persists trust score 80', async () => {
    matches = statuses(H, 'completed', 'completed', 'cancelled');
    reviews = { 'p-h-1': [5, 5] };
    await updateProviderCompletionRate(H);
    expect(scores['p-h-1']).toEqual(expect.objectContaining({ completion_rate: 66.67, trust_score: 80 }));
  });

  it('every active profile of the responder gets the same history-derived rate; inactive profiles are untouched', async () => {
    profiles = [
      { id: 'p-h-1', user_id: H, is_active: true },
      { id: 'p-h-2', user_id: H, is_active: true },
      { id: 'p-h-off', user_id: H, is_active: false },
    ];
    matches = statuses(H, 'completed', 'completed', 'cancelled');
    await updateProviderCompletionRate(H);
    expect(scores['p-h-1'].completion_rate).toBe(66.67);
    expect(scores['p-h-2'].completion_rate).toBe(66.67);
    expect(scores['p-h-off']).toBeUndefined();
  });

  it('a user with no active profile writes nothing', async () => {
    profiles = [{ id: 'p-h-off', user_id: H, is_active: false }];
    matches = statuses(H, 'completed');
    await updateProviderCompletionRate(H);
    expect(scores).toEqual({});
  });
});

describe('backfillAllProviderTrustScores uses the same terminal-outcome rate', () => {
  it('rates each active provider from its own responder history and returns the count', async () => {
    profiles = [
      { id: 'p-h-1', user_id: H, is_active: true },
      { id: 'p-o-1', user_id: OTHER, is_active: true },
      { id: 'p-off', user_id: 'helper-off', is_active: false },
    ];
    matches = [
      ...statuses(H, 'completed', 'completed', 'cancelled', 'matched'),
      ...statuses(OTHER, 'cancelled', 'proposed'),
      ...statuses('helper-off', 'completed'),
    ];
    reviews = { 'p-h-1': [5] };
    await expect(backfillAllProviderTrustScores()).resolves.toBe(2);
    expect(scores['p-h-1']).toEqual(expect.objectContaining({ completion_rate: 66.67, trust_score: 80 }));
    expect(scores['p-o-1'].completion_rate).toBe(0);
    expect(scores['p-off']).toBeUndefined();
  });

  it('is still fail-fast: a provider failure rejects the manual backfill', async () => {
    profiles = [{ id: 'p-h-1', user_id: H, is_active: true }];
    matches = statuses(H, 'completed');
    const boom = new Error('reviews table locked');
    // Make the review read throw for this provider.
    reviews = new Proxy({}, { get: () => { throw boom; } }) as unknown as Record<string, number[]>;
    await expect(backfillAllProviderTrustScores()).rejects.toBe(boom);
  });
});

describe('a review recompute keeps the stored behavioral metrics', () => {
  it('recalculateProviderTrustScore reads the stored rate, never recounts matches', async () => {
    scores = { 'p-h-1': { completion_rate: 50, response_rate: 0 } };
    reviews = { 'p-h-1': [5] };
    matches = statuses(H, 'completed'); // would be 100 if it recounted
    await recalculateProviderTrustScore('p-h-1');
    expect(scores['p-h-1']).toEqual(expect.objectContaining({ completion_rate: 50, trust_score: 75 }));
    expect(calls.some((c) => /FROM requests\.matches/.test(c.sql))).toBe(false);
  });
});
