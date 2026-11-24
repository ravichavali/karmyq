/**
 * Sprint 145 (BUG-106, ADR-102): the live-role helper takes an optional query client, following
 * src/database/trustEdgeDb.ts's `db: Queryable = pool`. Invitation acceptance passes its checked-out
 * transaction client so the inviter's authority is read inside the locked transaction; every existing
 * caller keeps the pool default. The explicit-client calls go through Reflect.apply so this file also
 * compiles against the pre-Sprint-145 two-argument signature (the red run).
 */
const mockPoolQuery = jest.fn();
jest.mock('../../src/config/database', () => ({ pool: { query: (...a: any[]) => mockPoolQuery(...a) } }));

import { getLiveRole, isLiveAdmin } from '../../src/database/liveRole';

const C = 'c1450000-0000-4000-8000-00000000000c';
const U = 'a1450000-0000-4000-8000-00000000000a';
const LIVE_ROLE_SQL = /SELECT role FROM communities\.members\s+WHERE community_id = \$1 AND user_id = \$2 AND status = 'active'/;

const withClient = (client: { query: jest.Mock }, communityId: unknown, userId: unknown) =>
  Reflect.apply(getLiveRole, undefined, [communityId, userId, client]) as Promise<string | null>;

beforeEach(() => {
  mockPoolQuery.mockReset();
  mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });
});

describe('Sprint 145 getLiveRole with an explicit transaction client', () => {
  it('reads the active row through the supplied client and never touches the pool', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [{ role: 'moderator' }], rowCount: 1 }) };
    await expect(withClient(client, C, U)).resolves.toBe('moderator');
    expect(client.query).toHaveBeenCalledTimes(1);
    expect(client.query.mock.calls[0][0]).toMatch(LIVE_ROLE_SQL);
    expect(client.query.mock.calls[0][1]).toEqual([C, U]);
    expect(mockPoolQuery).not.toHaveBeenCalled();
  });

  it('answers null through the client when the caller has no active row (removed, left, or another community)', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await expect(withClient(client, C, U)).resolves.toBeNull();
    expect(client.query).toHaveBeenCalledTimes(1);
    expect(mockPoolQuery).not.toHaveBeenCalled();
  });

  it('answers null without any query for a malformed community id, even with a client', async () => {
    const client = { query: jest.fn() };
    await expect(withClient(client, 'not-a-uuid', U)).resolves.toBeNull();
    expect(client.query).not.toHaveBeenCalled();
    expect(mockPoolQuery).not.toHaveBeenCalled();
  });
});

describe('Sprint 145 getLiveRole default (pool) is unchanged for existing callers', () => {
  it('reads the active row from the pool when no client is passed', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ role: 'admin' }], rowCount: 1 });
    await expect(getLiveRole(C, U)).resolves.toBe('admin');
    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
    expect(mockPoolQuery.mock.calls[0][0]).toMatch(LIVE_ROLE_SQL);
    expect(mockPoolQuery.mock.calls[0][1]).toEqual([C, U]);
  });

  it('answers null from the pool for a foreign or inactive membership', async () => {
    await expect(getLiveRole(C, U)).resolves.toBeNull();
    await expect(isLiveAdmin(C, U)).resolves.toBe(false);
    expect(mockPoolQuery).toHaveBeenCalledTimes(2);
  });
});
