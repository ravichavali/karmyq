/**
 * Sprint 100 / F1 — Community pulse must tell the truth (integration).
 *
 * Two truths the pulse headline must satisfy:
 *
 *  1. "N neighbours helped each other this week" counts DISTINCT responders, not raw `matches` rows.
 *     A single neighbour who completes three exchanges this week is ONE helper, not three — the
 *     headline must never outrun the named-helper list below it. The pre-fix query used `COUNT(*)`
 *     over `requests.matches`, so this seeds one responder with three completed-this-week exchanges
 *     and asserts `helpedThisWeek === 1` (distinct), with that helper's own count shown as 3.
 *
 *  2. "N open asks" is the community-wide reachable count — every open + unexpired ask attached to
 *     the community, INCLUDING the caller's own asks (F2 reachability: the pulse number must be
 *     reachable in the open-asks view, which renders own/offered read-only). So this seeds the
 *     caller's own ask plus two from other members and asserts `openAsks === 3`. (The already-offered
 *     read-only case is covered by the Task 6 curated open-asks view test.)
 *
 * Robust-testing standard (Sprint 65+): no stubs for the logic under test (the DISTINCT lives in
 * SQL); assert exact counts against seeded rows. DB-backed like the rest of the pulse suite
 * (sprint-89/97) — runs in CI / the deploy integration step. Locally without a DB it fails on
 * connection, which is expected.
 */

import express from 'express';
import request from 'supertest';
import { query } from '../../src/database/db';
import requestsRouter from '../../src/routes/requests';

describe('Sprint 100: community pulse counts distinct helpers + reachable open asks (integration)', () => {
  let communityId: string;
  let busyHelperId: string; // completes 3 exchanges this week → ONE distinct helper, count 3
  let soloHelperId: string; // completes 1 exchange this week → second distinct helper
  let requesterId: string; // owns the asks + is the caller
  const createdRequestIds: string[] = [];
  const createdMatchIds: string[] = [];

  function appAs(userId: string, communities: Array<{ id: string; name: string; role: string }>) {
    const app = express();
    app.use(express.json());
    app.use((req: any, _res: any, next: any) => {
      req.user = { userId, email: 'u@test.com', communities };
      next();
    });
    app.use('/requests', requestsRouter);
    return app;
  }

  /** A completed-this-week exchange attached to the community, responded to by `responderId`. */
  async function seedCompletedExchange(responderId: string): Promise<void> {
    const req = await query(
      `INSERT INTO requests.help_requests (requester_id, request_type, category, title, description, status, urgency, payload)
       VALUES ($1,'generic','generic',$2,$3,'completed','medium','{}') RETURNING id`,
      [requesterId, 'S100 completed ask', 'closed this week'],
    );
    createdRequestIds.push(req.rows[0].id);
    await query(`INSERT INTO requests.request_communities (request_id, community_id) VALUES ($1,$2)`, [req.rows[0].id, communityId]);
    const match = await query(
      `INSERT INTO requests.matches (request_id, responder_id, status, completed_at)
       VALUES ($1,$2,'completed', NOW() - INTERVAL '2 days') RETURNING id`,
      [req.rows[0].id, responderId],
    );
    createdMatchIds.push(match.rows[0].id);
  }

  /** An open + unexpired ask attached to the community. Returns the request id. */
  async function seedOpenAsk(ownerId: string, title: string): Promise<string> {
    const req = await query(
      `INSERT INTO requests.help_requests (requester_id, request_type, category, title, description, status, urgency, expired, payload)
       VALUES ($1,'generic','generic',$2,$3,'open','medium',FALSE,'{}') RETURNING id`,
      [ownerId, title, 's100 open ask'],
    );
    createdRequestIds.push(req.rows[0].id);
    await query(`INSERT INTO requests.request_communities (request_id, community_id) VALUES ($1,$2)`, [req.rows[0].id, communityId]);
    return req.rows[0].id;
  }

  beforeAll(async () => {
    const mk = async (email: string, name: string) =>
      (await query(`INSERT INTO auth.users (email, name, password_hash) VALUES ($1,$2,'hash') RETURNING id`, [email, name])).rows[0].id;

    busyHelperId = await mk('s100-busy-helper@example.com', 'S100 Busy Helper');
    soloHelperId = await mk('s100-solo-helper@example.com', 'S100 Solo Helper');
    requesterId = await mk('s100-requester@example.com', 'S100 Requester');

    communityId = (
      await query(`INSERT INTO communities.communities (name, description) VALUES ($1,$2) RETURNING id`, ['S100 Pulse Truth Community', 's100 pulse truth'])
    ).rows[0].id;

    // All three are active members of the community.
    await query(
      `INSERT INTO communities.members (community_id, user_id, role, status, joined_at) VALUES
         ($1,$2,'member','active', NOW() - INTERVAL '3 days'),
         ($1,$3,'member','active', NOW() - INTERVAL '3 days'),
         ($1,$4,'member','active', NOW() - INTERVAL '3 days')`,
      [communityId, busyHelperId, soloHelperId, requesterId],
    );

    // busyHelper completes THREE exchanges this week; soloHelper completes ONE.
    await seedCompletedExchange(busyHelperId);
    await seedCompletedExchange(busyHelperId);
    await seedCompletedExchange(busyHelperId);
    await seedCompletedExchange(soloHelperId);

    // Three open + unexpired asks attached to the community: the caller's OWN ask, plus two owned by
    // other members. openAsks counts the community-wide reachable set, so the caller's own ask is
    // included (the open-asks view renders own asks read-only).
    await seedOpenAsk(requesterId, 'S100 my own open ask');
    await seedOpenAsk(soloHelperId, 'S100 other member open ask');
    await seedOpenAsk(busyHelperId, 'S100 plain open ask');
  });

  afterAll(async () => {
    await query(`DELETE FROM requests.matches WHERE id = ANY($1)`, [createdMatchIds]).catch(() => {});
    await query(`DELETE FROM requests.request_communities WHERE request_id = ANY($1)`, [createdRequestIds]).catch(() => {});
    await query(`DELETE FROM requests.help_requests WHERE id = ANY($1)`, [createdRequestIds]).catch(() => {});
    await query(`DELETE FROM communities.members WHERE community_id = $1`, [communityId]).catch(() => {});
    await query(`DELETE FROM communities.communities WHERE id = $1`, [communityId]).catch(() => {});
    await query(`DELETE FROM auth.users WHERE id = ANY($1)`, [[busyHelperId, soloHelperId, requesterId, offererId]]).catch(() => {});
  });

  it('helpedThisWeek counts distinct responders, never raw match rows', async () => {
    const member = [{ id: communityId, name: 'S100 Pulse Truth Community', role: 'member' }];
    const res = await request(appAs(requesterId, member)).get(`/requests/community/${communityId}/pulse`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;

    // Four completed matches across TWO distinct responders → 2, not 4.
    expect(data.helpedThisWeek).toBe(2);

    // The busy helper's own tally is 3 completions; the headline (2) must not exceed the named
    // helpers, and must equal the number of distinct named helpers when under the LIMIT 3 cap.
    const byName = Object.fromEntries(data.recentHelpers.map((h: { name: string; count: number }) => [h.name, h.count]));
    expect(byName['S100 Busy Helper']).toBe(3);
    expect(byName['S100 Solo Helper']).toBe(1);
    expect(data.helpedThisWeek).toBe(data.recentHelpers.length);
    expect(data.helpedThisWeek).toBeLessThanOrEqual(data.recentHelpers.length);
  });

  it('openAsks counts every community-wide open+unexpired ask (own + already-offered included)', async () => {
    const member = [{ id: communityId, name: 'S100 Pulse Truth Community', role: 'member' }];
    const res = await request(appAs(requesterId, member)).get(`/requests/community/${communityId}/pulse`);

    expect(res.status).toBe(200);
    // own ask + already-offered ask + plain ask = 3, all reachable in the open-asks view.
    expect(res.body.data.openAsks).toBe(3);
  });
});
