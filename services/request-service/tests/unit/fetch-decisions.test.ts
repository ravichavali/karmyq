/**
 * Sprint 85 / ADR-066 — fetchDecisions ownership + role mapping (unit).
 *
 * Locks WHO owes each decision so the "needs your response" band never shows an unactionable row:
 *   - a dib is owed by the PROVIDER (member_role 'responder'); the requester only waits
 *   - a provider offer is owed by the REQUESTER (request owner; member_role 'requester')
 *   - a proposed match: requester accepts/declines, responder withdraws
 *   - a matched exchange: mark-done only while this member hasn't already confirmed
 *
 * fetchDecisions runs three queries in order (matches → dibs → offers); we mock them in sequence.
 */

const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({ query: (...args: any[]) => mockQuery(...args) }));
jest.mock('../../src/events/publisher', () => ({ publishEvent: jest.fn(), initEventPublisher: jest.fn(), getEventQueue: jest.fn() }));

import { fetchDecisions } from '../../src/routes/requests';

const USER = 'user-1';
const noReq = {} as any;

function seq(matches: any[], dibs: any[], offers: any[]) {
  mockQuery
    .mockResolvedValueOnce({ rows: matches })
    .mockResolvedValueOnce({ rows: dibs })
    .mockResolvedValueOnce({ rows: offers });
}

beforeEach(() => mockQuery.mockReset());

describe('fetchDecisions — dibs are owed by the provider, not the requester', () => {
  it('emits a dib as member_role=responder with the requester as counterparty', async () => {
    seq([], [{ id: 'dib-1', request_id: 'r1', title: 'Ride to PDX', requester_name: 'Rana', community_name: 'Hawthorne', created_at: 't' }], []);

    const items = await fetchDecisions(noReq, USER);

    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('decision');
    expect(items[0].data).toMatchObject({
      subject_id: 'dib-1',
      subject_kind: 'dibs',
      member_role: 'responder',
      counterparty_name: 'Rana',
      actions: ['accept_dibs', 'decline_dibs'],
    });
    // The dibs query must filter on the provider, not the requester (no unactionable rows).
    const dibsSql = mockQuery.mock.calls[1][0] as string;
    expect(dibsSql).toMatch(/d\.provider_user_id\s*=\s*\$1/);
    expect(dibsSql).toMatch(/d\.expires_at\s*>\s*NOW\(\)/); // expired dibs (would 410) excluded
  });
});

describe('fetchDecisions — provider offers are owed by the request owner', () => {
  it('emits a provider offer as member_role=requester, subject_kind=offer', async () => {
    seq([], [], [{ id: 'offer-9', request_id: 'r2', title: 'Plumbing', provider_name: 'Pat', community_name: 'Alberta', created_at: 't' }]);

    const items = await fetchDecisions(noReq, USER);

    expect(items).toHaveLength(1);
    expect(items[0].data).toMatchObject({
      subject_id: 'offer-9',
      subject_kind: 'offer',
      member_role: 'requester',
      counterparty_name: 'Pat',
      actions: ['accept_offer', 'decline_offer'],
    });
    const offerSql = mockQuery.mock.calls[2][0] as string;
    expect(offerSql).toMatch(/provider\.offers/);
    expect(offerSql).toMatch(/hr\.requester_id\s*=\s*\$1/);
  });
});

describe('fetchDecisions — match role mapping', () => {
  const match = (over: any) => ({ id: 'm1', request_id: 'r', requester_id: 'x', responder_id: 'y', status: 'proposed', admin_proposed: false, requester_done_at: null, responder_done_at: null, title: 'T', requester_name: 'Req', responder_name: 'Resp', community_name: 'C', ...over });

  it('a proposed match: the requester accepts/declines; the responder owes nothing here (S86)', async () => {
    seq([match({ requester_id: USER })], [], []);
    let items = await fetchDecisions(noReq, USER);
    expect(items[0].data).toMatchObject({ member_role: 'requester', actions: ['accept_offer', 'decline_offer'], counterparty_name: 'Resp' });

    // S86 UX: the responder's own proposed offer is awaiting the requester — it's not a decision they
    // owe (it lives in the Helping tab with a Withdraw action), so the band shows no row for it.
    mockQuery.mockReset();
    seq([match({ responder_id: USER })], [], []);
    items = await fetchDecisions(noReq, USER);
    expect(items).toHaveLength(0);
  });

  it('S108: an admin-proposed match the member responds to IS a decision the responder owes', async () => {
    // admin_proposed = TRUE means the matchmaker suggested THIS member as helper; the member owes the
    // accept/decline (matches.ts:306 authorizes the responder), so it must surface in the band as a
    // responder-role match decision — unlike a self-offer (admin_proposed = FALSE), which is awaiting
    // the requester and stays out of the band.
    seq([match({ responder_id: USER, admin_proposed: true })], [], []);
    const items = await fetchDecisions(noReq, USER);
    expect(items).toHaveLength(1);
    expect(items[0].data).toMatchObject({
      subject_id: 'm1',
      subject_kind: 'match',
      member_role: 'responder',
      actions: ['accept_offer', 'decline_offer'],
      counterparty_name: 'Req',
    });
  });

  it('S108: a self-offer (admin_proposed = FALSE) responder match stays out of the decision band', async () => {
    seq([match({ responder_id: USER, admin_proposed: false })], [], []);
    const items = await fetchDecisions(noReq, USER);
    expect(items).toHaveLength(0);
  });

  it('S108: the REQUESTER of an admin-proposed match owes no decision (only the suggested helper can accept)', async () => {
    // matches.ts:306 authorizes only the responder to accept an admin-proposed match — surfacing an
    // accept/decline to the requester would be a 403 they cannot action. The requester only waits.
    seq([match({ requester_id: USER, admin_proposed: true })], [], []);
    const items = await fetchDecisions(noReq, USER);
    expect(items).toHaveLength(0);
  });

  it('S108: the decisions SELECT projects m.admin_proposed (the discriminator)', async () => {
    seq([match({ requester_id: USER })], [], []);
    await fetchDecisions(noReq, USER);
    const matchSql = mockQuery.mock.calls[0][0] as string;
    expect(matchSql).toMatch(/m\.admin_proposed/);
  });

  it('enriches each decision with request context for the inline expand (description + payload_type)', async () => {
    // category='moving' → payload_type 'moving_help' (ADR-067 map); description passes through.
    seq([match({ requester_id: USER, description: 'Need a hand Saturday', payload: { num_helpers_needed: 2 }, category: 'moving' })], [], []);
    const items = await fetchDecisions(noReq, USER);
    expect(items[0].data).toMatchObject({
      description: 'Need a hand Saturday',
      payload_type: 'moving_help',
      payload: { num_helpers_needed: 2 },
    });
  });

  it('a matched exchange owes mark-done only until this member has confirmed', async () => {
    // requester hasn't confirmed → owes mark_done
    seq([match({ requester_id: USER, status: 'matched', requester_done_at: null })], [], []);
    let items = await fetchDecisions(noReq, USER);
    expect(items[0].data.actions).toEqual(['mark_done']);

    // requester already confirmed → no decision
    mockQuery.mockReset();
    seq([match({ requester_id: USER, status: 'matched', requester_done_at: 'done' })], [], []);
    items = await fetchDecisions(noReq, USER);
    expect(items).toHaveLength(0);
  });
});
