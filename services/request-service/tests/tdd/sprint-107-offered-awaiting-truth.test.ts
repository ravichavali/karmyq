/**
 * Sprint 107 / BUG-023 — Home's "offered-awaiting" preview and Helping must share one backend
 * predicate. The canonical endpoint returns distinct open, unexpired asks where the caller has a
 * proposed responder match, and `view=home` must report the same count + preview ids.
 *
 * DB-backed like the surrounding request-service TDD suite. Locally without PostgreSQL it fails on
 * connection; CI/deploy integration runs it against a database.
 */

import express from 'express';
import request from 'supertest';
import { query } from '../../src/database/db';
import requestsRouter from '../../src/routes/requests';

describe('Sprint 107 / BUG-023 offered-awaiting truth (integration)', () => {
  let helperId: string;
  let requesterId: string;
  let communityId: string;
  let askA: string;
  let askB: string;
  let matchedAsk: string;
  let expiredAsk: string;
  const createdRequestIds: string[] = [];
  const createdMatchIds: string[] = [];

  function appAs(userId: string) {
    const app = express();
    app.use(express.json());
    app.use((req: any, _res: any, next: any) => {
      req.user = {
        userId,
        email: 's107-helper@example.com',
        communities: [{ id: communityId, name: 'S107 Offered Awaiting', role: 'member' }],
      };
      next();
    });
    app.use('/requests', requestsRouter);
    return app;
  }

  async function seedAsk(title: string, opts: { status?: string; expired?: boolean } = {}): Promise<string> {
    const req = await query(
      `INSERT INTO requests.help_requests (requester_id, request_type, category, title, description, status, urgency, expired, payload)
       VALUES ($1,'generic','generic',$2,$3,$4,'medium',$5,'{}') RETURNING id`,
      [requesterId, title, 's107 offered awaiting', opts.status ?? 'open', opts.expired ?? false],
    );
    const id = req.rows[0].id;
    createdRequestIds.push(id);
    await query(`INSERT INTO requests.request_communities (request_id, community_id) VALUES ($1,$2)`, [id, communityId]);
    return id;
  }

  async function seedMatch(requestId: string, status = 'proposed'): Promise<string> {
    const match = await query(
      `INSERT INTO requests.matches (request_id, responder_id, status) VALUES ($1,$2,$3) RETURNING id`,
      [requestId, helperId, status],
    );
    createdMatchIds.push(match.rows[0].id);
    return match.rows[0].id;
  }

  beforeAll(async () => {
    const helper = await query(
      `INSERT INTO auth.users (email, name, password_hash) VALUES ($1,$2,'hash') RETURNING id`,
      ['s107-helper@example.com', 'S107 Helper'],
    );
    helperId = helper.rows[0].id;
    const requester = await query(
      `INSERT INTO auth.users (email, name, password_hash) VALUES ($1,$2,'hash') RETURNING id`,
      ['s107-requester@example.com', 'S107 Requester'],
    );
    requesterId = requester.rows[0].id;
    const community = await query(
      `INSERT INTO communities.communities (name, description) VALUES ($1,$2) RETURNING id`,
      ['S107 Offered Awaiting', 'offered awaiting truth'],
    );
    communityId = community.rows[0].id;
    await query(
      `INSERT INTO communities.members (community_id, user_id, role, status)
       VALUES ($1,$2,'member','active'), ($1,$3,'member','active')`,
      [communityId, helperId, requesterId],
    );

    askA = await seedAsk('Need to borrow camping gear');
    askB = await seedAsk('Carpool to Saturday Market');
    matchedAsk = await seedAsk('Closed request should not count', { status: 'matched' });
    expiredAsk = await seedAsk('Expired open request should not count', { expired: true });

    await seedMatch(askA);
    await seedMatch(askA); // duplicate proposed match on one ask; count/items must dedupe by request_id
    await seedMatch(askB);
    await seedMatch(matchedAsk, 'matched');
    await seedMatch(expiredAsk);
  });

  afterAll(async () => {
    await query(`DELETE FROM requests.matches WHERE id = ANY($1)`, [createdMatchIds]).catch(() => {});
    await query(`DELETE FROM requests.request_communities WHERE request_id = ANY($1)`, [createdRequestIds]).catch(() => {});
    await query(`DELETE FROM requests.help_requests WHERE id = ANY($1)`, [createdRequestIds]).catch(() => {});
    await query(`DELETE FROM communities.members WHERE community_id = $1`, [communityId]).catch(() => {});
    await query(`DELETE FROM communities.communities WHERE id = $1`, [communityId]).catch(() => {});
    await query(`DELETE FROM auth.users WHERE id = ANY($1)`, [[helperId, requesterId]]).catch(() => {});
  });

  it('returns the canonical distinct offered-awaiting rows and Home uses the same predicate', async () => {
    const direct = await request(appAs(helperId)).get('/requests/offered-awaiting');

    expect(direct.status).toBe(200);
    expect(direct.body.data.count).toBe(2);
    expect(direct.body.data.items.map((i: any) => i.request_id).sort()).toEqual([askA, askB].sort());
    expect(new Set(direct.body.data.items.map((i: any) => i.request_id)).size).toBe(direct.body.data.items.length);

    const home = await request(appAs(helperId)).get('/requests/curated').query({ view: 'home', minScore: 0 });

    expect(home.status).toBe(200);
    expect(home.body.data.offeredAwaiting).toBe(2);
    expect(home.body.data.offeredAwaitingItems.map((i: any) => i.request_id).sort()).toEqual([askA, askB].sort());
  });
});
