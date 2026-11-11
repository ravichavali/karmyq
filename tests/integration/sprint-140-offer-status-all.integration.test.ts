/**
 * Sprint 140 (BUG-099): GET /offers?status=all lists every readable status, and nothing else changes. Real JWT,
 * request service over HTTP, real PostgreSQL. Missing infrastructure is a failure, never a skip.
 *
 * Proofs:
 * - `all` returns active, matched and withdrawn offers together, for the owner and for another current member.
 * - Sprint 139's expiry scoping still applies under `all`: the owner sees their own expired active offer, another
 *   member does not (and vice versa); expired matched/withdrawn history stays listed.
 * - Omitting status still means `active` (the control), and an explicit status still narrows.
 * - The audience is still an outer AND: pending, former and unrelated users see nothing under `all`.
 * - The community filter still narrows under `all`: the owner's offer in a second community is not listed.
 *
 * Fails before (REASONED, not run: no PostgreSQL on the Windows box; CI runs this against the fixed code). Before
 * Sprint 140, `status=all` was bound as the literal status 'all', so every `all` list was empty. The default,
 * explicit-status and audience cases are controls that pass before too.
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { createPool, ServiceUrls } from '../fixtures';

describe('Sprint 140 offers status=all (BUG-099)', () => {
  const pool = createPool();
  // O and M are current members who both own offers; P is pending; F is a former member; U is unrelated.
  const O = randomUUID(), M = randomUUID(), P = randomUUID(), F = randomUUID(), U = randomUUID();
  const users = [O, M, P, F, U];
  const Cm = randomUUID(), Other = randomUUID();
  const communities = [Cm, Other];
  const offers: string[] = [];
  const ids: Record<string, string> = {};

  const bearer = (id: string) => `Bearer ${jwt.sign({ userId: id, email: `${id}@karmyq.test`, communities: [] }, process.env.JWT_SECRET || 'dev-secret-key')}`;
  /** The fixture offers a caller sees in community Cm, by name, sorted. */
  async function seen(as: string, status?: string): Promise<string[]> {
    const res = await request(ServiceUrls.REQUEST)
      .get(`/offers?community_id=${Cm}&limit=200${status ? `&status=${status}` : ''}`)
      .set('Authorization', bearer(as));
    expect({ status: res.status, success: res.body.success }).toEqual({ status: 200, success: true });
    expect(res.body.data.count).toBe(res.body.data.offers.length);
    const byId = new Map(Object.entries(ids).map(([name, id]) => [id, name]));
    return res.body.data.offers.map((o: { id: string }) => byId.get(o.id)).filter(Boolean).sort();
  }

  /** expires: 'future' (+30 days) or 'past' (-1 day; a day's margin holds whatever the session time zone). */
  async function offer(name: string, owner: string, community: string, status: string, expires: 'future' | 'past', flagged: boolean) {
    const id = randomUUID();
    await pool.query(`INSERT INTO requests.help_offers (id,community_id,offerer_id,title,description,category,status,expired,expires_at)
      VALUES ($1,$2,$3,$4,'Fixture','generic',$5::varchar,$6::boolean,
              CASE $7::text WHEN 'future' THEN NOW() + INTERVAL '30 days' ELSE NOW() - INTERVAL '1 day' END)`,
    [id, community, owner, `Sprint 140 ${name}`, status, flagged, expires]);
    offers.push(id);
    ids[name] = id;
  }

  beforeAll(async () => {
    await pool.query('SELECT 1');
    expect((await request(ServiceUrls.REQUEST).get('/health')).status).toBe(200);
    for (const id of users) {
      await pool.query('INSERT INTO auth.users(id,name,email,password_hash) VALUES ($1,$2,$3,$4)',
        [id, `Sprint 140 ${id.slice(0, 8)}`, `${id}@karmyq.test`, 'not-a-login']);
    }
    for (const id of communities) {
      await pool.query('INSERT INTO communities.communities(id,name,description,creator_id) VALUES ($1,$2,$3,$4)',
        [id, `Sprint 140 ${id}`, 'Fixture', O]);
    }
    const membership: Array<[string, string, string]> = [
      [O, Cm, 'active'], [M, Cm, 'active'], [P, Cm, 'pending'], [F, Cm, 'removed'], [O, Other, 'active'],
    ];
    for (const [user, community, status] of membership) {
      await pool.query(`INSERT INTO communities.members(user_id,community_id,role,status) VALUES ($1,$2,'member',$3)`,
        [user, community, status]);
    }

    await offer('ownerActiveLive', O, Cm, 'active', 'future', false);
    await offer('ownerActiveExpired', O, Cm, 'active', 'past', true);
    await offer('ownerMatched', O, Cm, 'matched', 'future', false);
    await offer('ownerWithdrawnExpired', O, Cm, 'withdrawn', 'past', true);
    await offer('memberActiveLive', M, Cm, 'active', 'future', false);
    await offer('memberActiveExpired', M, Cm, 'active', 'past', true);
    await offer('ownerOtherCommunity', O, Other, 'matched', 'future', false);
  });

  afterAll(async () => {
    try {
      await pool.query('DELETE FROM requests.help_offers WHERE id = ANY($1::uuid[])', [offers]);
      await pool.query('DELETE FROM communities.members WHERE community_id = ANY($1::uuid[])', [communities]);
      await pool.query('DELETE FROM communities.communities WHERE id = ANY($1::uuid[])', [communities]);
      await pool.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [users]);
    } finally {
      await pool.end();
    }
  }, 120_000);

  it('all, as the owner: every status together, own expired active offer included, the member\'s expired one not', async () => {
    expect(await seen(O, 'all')).toEqual([
      'memberActiveLive', 'ownerActiveExpired', 'ownerActiveLive', 'ownerMatched', 'ownerWithdrawnExpired',
    ]);
  });

  it('all, as another current member: the mirror image — own expired active offer, never the owner\'s', async () => {
    expect(await seen(M, 'all')).toEqual([
      'memberActiveExpired', 'memberActiveLive', 'ownerActiveLive', 'ownerMatched', 'ownerWithdrawnExpired',
    ]);
  });

  it('omitting status still means active (the default), and an explicit status still narrows', async () => {
    expect(await seen(O)).toEqual(['memberActiveLive', 'ownerActiveExpired', 'ownerActiveLive']);
    expect(await seen(M, 'active')).toEqual(['memberActiveExpired', 'memberActiveLive', 'ownerActiveLive']);
    expect(await seen(O, 'matched')).toEqual(['ownerMatched']);
    expect(await seen(M, 'withdrawn')).toEqual(['ownerWithdrawnExpired']);
  });

  it.each([
    ['pending', P],
    ['former', F],
    ['unrelated', U],
  ])('all, as a %s user: nothing (the audience is still an outer AND)', async (_label, viewer) => {
    expect(await seen(viewer, 'all')).toEqual([]);
  });
});
