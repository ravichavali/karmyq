/**
 * Sprint 131 D6 — the request-validation contract across the zod 3 → 4 move.
 *
 * PRESERVED: custom messages (P2) and the error.format() tree / issue paths (P3).
 * INTENTIONAL (see docs/superpowers/plans/2026-09-24-sprint-131-pr-d6-zod-4.md):
 *   I1 string min/max count code points (not UTF-16 units, not graphemes) ·
 *   I2 .datetime() requires seconds · I3 z.number() rejects ±Infinity ·
 *   I4 zod 4 default messages/codes · I5 .int() requires a safe integer.
 * Rows tagged I* are expected to FAIL under zod 3; that is the proof they are real.
 */
import { validateRequest } from '../index';
import { SelfCommunityReputationSchema } from '../../reputationDisclosure';

const D = 'Please help me with this thing today';
const generic = { title: 'Need some help', description: D, request_type: 'generic' };
const ride = {
  title: 'Need some help',
  description: D,
  request_type: 'ride',
  payload: {
    origin: { address: '1 Main St', lat: 1, lng: 2 },
    destination: { address: '2 Main St', lat: 1, lng: 2 },
    seats_needed: 2,
    departure_time: '2026-10-01T10:00:00Z',
  },
};
const borrow = {
  title: 'Need some help',
  description: D,
  request_type: 'borrow',
  payload: { item_category: 'tools', item_description: 'A drill please', duration_days: 3 },
};
const service = {
  title: 'Need some help',
  description: D,
  request_type: 'service',
  payload: { service_category: 'tutoring' },
};
const event = {
  title: 'Need some help',
  description: D,
  request_type: 'event',
  payload: {
    event_type: 'community_cleanup',
    event_date: '2026-10-01T10:00:00Z',
    event_duration_hours: 2,
    location: { address: 'Park' },
    participants_needed: 5,
  },
};
const withPayload = (body: any, patch: Record<string, unknown>) => ({ ...body, payload: { ...body.payload, ...patch } });
const issues = (body: unknown) => {
  const r = validateRequest(body);
  return r.success ? 'ok' : r.error.issues.map((i) => [i.path.join('.'), i.code, i.message]);
};

describe('preserved', () => {
  it.each([['generic', generic], ['ride', ride], ['borrow', borrow], ['service', service], ['event', event]])(
    'a valid %s body is accepted', (_n, body) => expect(validateRequest(body).success).toBe(true));
  it('P2: custom min message', () =>
    expect(issues({ ...generic, title: 'abc' })).toEqual([['title', 'too_small', 'Title must be at least 5 characters']]));
  // P2 asserts PATH + CUSTOM MESSAGE only. The code changed (invalid_string → invalid_format);
  // that is I4, tested separately below. Asserting the code here would fail under zod 3.
  const pathAndMessage = (body: unknown) => {
    const r = validateRequest(body);
    return r.success ? 'ok' : r.error.issues.map((i) => [i.path.join('.'), i.message]);
  };
  it('P2: custom datetime message', () =>
    expect(pathAndMessage(withPayload(ride, { departure_time: '2026-10-01' })))
      .toEqual([['payload.departure_time', 'Must be valid ISO datetime string']]));
  it('I5 boundary: MAX_SAFE_INTEGER count is accepted in both majors', () =>
    expect(validateRequest(withPayload(event, { roles: [{ role_name: 'Lead', count: Number.MAX_SAFE_INTEGER }] })).success).toBe(true));
  it('I1 boundary: 51 emoji role_name is rejected in both majors', () =>
    expect(validateRequest(withPayload(event, { roles: [{ role_name: '😀'.repeat(51), count: 1 }] })).success).toBe(false));
  it('I1: a ZWJ family (5 code points) passes min(2) in both majors', () =>
    expect(validateRequest(withPayload(event, { roles: [{ role_name: '👨‍👩‍👧', count: 1 }] })).success).toBe(true));
  it('P3: format() tree', () => {
    const r = validateRequest({ ...generic, title: 'abc' });
    expect(r.success).toBe(false);
    expect(r.error!.format()).toEqual({ _errors: [], title: { _errors: ['Title must be at least 5 characters'] } });
  });
  it('offset datetimes stay rejected in both majors', () =>
    expect(validateRequest(withPayload(ride, { departure_time: '2026-10-01T10:00:00+01:00' })).success).toBe(false));
});

const selfCommunityReputation = (score: number) => ({
  scope: { type: 'community', community_id: '75648739-6e64-4d8b-b594-0fd70f609d2d', community_name: 'Riverside' },
  reputation: { score, scale_min: 0, scale_max: 100, tier: 'active', calculated_at: '2026-09-24T00:00:00Z' },
  karma: { current: 10, trend: 'stable', half_life_days: 90, calculated_at: '2026-09-24T00:00:00Z' },
  activity: { recent_helps: 1, recent_requests: 1, window_days: 30 },
});

describe('intentional (fail under zod 3 by design)', () => {
  const rows: [string, unknown, unknown][] = [
    ['I1 title', { ...generic, title: '😀😀😀' }, [['title', 'too_small', 'Title must be at least 5 characters']]],
    ['I1 description', { ...generic, description: '😀😀😀😀😀' }, [['description', 'too_small', 'Description must be at least 10 characters']]],
    ['I1 role_name', withPayload(event, { roles: [{ role_name: '😀', count: 1 }] }),
      [['payload.roles.0.role_name', 'too_small', 'Too small: expected string to have >=2 characters']]],
    ['I2 departure_time', withPayload(ride, { departure_time: '2026-10-01T10:00Z' }),
      [['payload.departure_time', 'invalid_format', 'Must be valid ISO datetime string']]],
    ['I2 return_date', withPayload(borrow, { return_date: '2026-10-01T10:00Z' }),
      [['payload.return_date', 'invalid_format', 'Invalid ISO datetime']]],
    ['I2 recurring.end_date', withPayload(event, { recurring: { end_date: '2026-12-01T00:00Z' } }),
      [['payload.recurring.end_date', 'invalid_format', 'Invalid ISO datetime']]],
    ['I3 budget max', withPayload(service, { budget_range: { max: Infinity } }),
      [['payload.budget_range.max', 'invalid_type', 'Invalid input: expected number, received Infinity']]],
    ['I1′ role_name max(50), 30 emoji now accepted', withPayload(event, { roles: [{ role_name: '😀'.repeat(30), count: 1 }] }), 'ok'],
    ['I5 count 1e20', withPayload(event, { roles: [{ role_name: 'Lead', count: 1e20 }] }),
      [['payload.roles.0.count', 'too_big', 'Too big: expected int to be <=9007199254740991']]],
    ['I5 count 2**53', withPayload(event, { roles: [{ role_name: 'Lead', count: 2 ** 53 }] }),
      [['payload.roles.0.count', 'too_big', 'Too big: expected int to be <=9007199254740991']]],
    ['I4 datetime code', withPayload(ride, { departure_time: '2026-10-01' }),
      [['payload.departure_time', 'invalid_format', 'Must be valid ISO datetime string']]],
    ['I4 missing title', { description: D, request_type: 'generic' },
      [['title', 'invalid_type', 'Invalid input: expected string, received undefined']]],
    ['I4 bad urgency', { ...generic, urgency: 'urgent' },
      [['urgency', 'invalid_value', 'Invalid option: expected one of "low"|"medium"|"high"|"critical"']]],
  ];
  it.each(rows)('%s', (_n, body, expected) => expect(issues(body)).toEqual(expected));
  // P3's format() test lives in "preserved": the tree shape and custom message are identical in both majors.

  it('I3: an in-process projection rejects a non-finite score', () => {
    // Validator behaviour only: this does not prove disclosureAuth.ts's producers stay finite.
    expect(SelfCommunityReputationSchema.safeParse(selfCommunityReputation(50)).success).toBe(true);
    expect(SelfCommunityReputationSchema.safeParse(selfCommunityReputation(Infinity)).success).toBe(false);
  });
});
