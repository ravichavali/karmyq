/**
 * Sprint 108 — admin-proposed responder matches are canonical decisions; self-offers are not.
 *
 * Proves the dedupe invariant in BOTH directions against the real schema:
 *   - an admin_proposed = TRUE responder match → a responder-role match DECISION (accept/decline) AND
 *     the curated-home `suggestedAsHelper` preview; it is NOT in offered-awaiting (requester does not
 *     owe it — the member does).
 *   - a self-offer (admin_proposed = FALSE) responder match → offered-awaiting ONLY; never a decision
 *     and never in suggestedAsHelper (re-creating BUG-022/023 duplication otherwise).
 *
 * DB-backed like the surrounding request-service TDD suite. Locally without PostgreSQL it fails on
 * connection; CI/deploy integration runs it against a database. Seeds `creator_id` on the community
 * (S107 lesson: the real schema requires it).
 */

import express from 'express';
import request from 'supertest';
import { query } from '../../src/database/db';
import requestsRouter from '../../src/routes/requests';

describe('Sprint 108 admin-proposed decision truth (integration)', () => {
  let helperId: string;
  let requesterId: string;
  let communityId: string;
  let adminProposedAsk: string;
  let selfOfferAsk: string;
  const createdRequestIds: string[] = [];
  const createdMatchIds: string[] = [];

  function appAs(userId: string) {
    const app = express();
    app.use(express.json());
    app.use((req: any, _res: any, next: any) => {
      req.user = {
        userId,
        email: 's108-helper@example.com',
        communities: [{ id: communityId, name: 'S108 Admin Proposed', role: 'member' }],
      };
      next();
    });
    app.use('/requests', requestsRouter);
    return app;
  }

  async function seedAsk(title: string): Promise<string> {
    const req = await query(
      `INSERT INTO requests.help_requests (requester_id, request_type, category, title, description, status, urgency, expired, payload)
       VALUES ($1,'generic','generic',$2,$3,'open','medium',false,'{}') RETURNING id`,
      [requesterId, title, 's108 admin proposed'],
    );
    const id = req.rows[0].id;
    createdRequestIds.push(id);
    await query(`INSERT INTO requests.request_communities (request_id, community_id) VALUES ($1,$2)`, [id, communityId]);
    return id;
  }

  async function seedMatch(requestId: string, adminProposed: boolean): Promise<string> {
    const match = await query(
      `INSERT INTO requests.matches (request_id, responder_id, status, admin_proposed)
       VALUES ($1,$2,'proposed',$3) RETURNING id`,
      [requestId, helperId, adminProposed],
    );
    createdMatchIds.push(match.rows[0].id);
    return match.rows[0].id;
  }

  beforeAll(async () => {
    const helper = await query(
      `INSERT INTO auth.users (email, name, password_hash) VALUES ($1,$2,'hash') RETURNING id`,
      ['s108-helper@example.com', 'S108 Helper'],
    );
    helperId = helper.rows[0].id;
    const requester = await query(
      `INSERT INTO auth.users (email, name, password_hash) VALUES ($1,$2,'hash') RETURNING id`,
      ['s108-requester@example.com', 'S108 Requester'],
    );
    requesterId = requester.rows[0].id;
    const community = await query(
      `INSERT INTO communities.communities (name, description, creator_id) VALUES ($1,$2,$3) RETURNING id`,
      ['S108 Admin Proposed', 'admin proposed decision truth', requesterId],
    );
    communityId = community.rows[0].id;
    await query(
      `INSERT INTO communities.members (community_id, user_id, role, status)
       VALUES ($1,$2,'member','active'), ($1,$3,'member','active')`,
      [communityId, helperId, requesterId],
    );

    adminProposedAsk = await seedAsk('Matchmaker suggested you help carry boxes');
    selfOfferAsk = await seedAsk('You offered to walk a neighbour dog');

    await seedMatch(adminProposedAsk, true);
    await seedMatch(selfOfferAsk, false);
  });

  afterAll(async () => {
    await query(`DELETE FROM requests.matches WHERE id = ANY($1)`, [createdMatchIds]).catch(() => {});
    await query(`DELETE FROM requests.request_communities WHERE request_id = ANY($1)`, [createdRequestIds]).catch(() => {});
    await query(`DELETE FROM requests.help_requests WHERE id = ANY($1)`, [createdRequestIds]).catch(() => {});
    await query(`DELETE FROM communities.members WHERE community_id = $1`, [communityId]).catch(() => {});
    await query(`DELETE FROM communities.communities WHERE id = $1`, [communityId]).catch(() => {});
    await query(`DELETE FROM auth.users WHERE id = ANY($1)`, [[helperId, requesterId]]).catch(() => {});
  });

  it('admin-proposed responder match → suggestedAsHelper + responder decision; self-offer → offered-awaiting', async () => {
    const home = await request(appAs(helperId)).get('/requests/curated').query({ view: 'home', minScore: 0 });
    expect(home.status).toBe(200);

    // suggestedAsHelper previews the admin-proposed ask ONLY.
    expect(home.body.data.suggestedAsHelper.count).toBe(1);
    expect(home.body.data.suggestedAsHelper.items.map((i: any) => i.request_id)).toEqual([adminProposedAsk]);

    // offered-awaiting carries the self-offer ONLY (the admin-proposed one is the member's to decide,
    // not awaiting the requester).
    expect(home.body.data.offeredAwaiting).toBe(1);
    expect(home.body.data.offeredAwaitingItems.map((i: any) => i.request_id)).toEqual([selfOfferAsk]);

    // The decision band (in the curated items) carries the admin-proposed match as a responder-role
    // decision, and never the self-offer.
    const decisions = (home.body.data.items as any[]).filter((it) => it.kind === 'decision');
    const adminDecision = decisions.find((d) => d.data.request_id === adminProposedAsk);
    expect(adminDecision).toBeDefined();
    expect(adminDecision.data).toMatchObject({
      subject_kind: 'match',
      member_role: 'responder',
      actions: ['accept_offer', 'decline_offer'],
    });
    expect(decisions.some((d) => d.data.request_id === selfOfferAsk)).toBe(false);
  });

  it('the canonical offered-awaiting endpoint also excludes the admin-proposed ask', async () => {
    const direct = await request(appAs(helperId)).get('/requests/offered-awaiting');
    expect(direct.status).toBe(200);
    expect(direct.body.data.items.map((i: any) => i.request_id)).toEqual([selfOfferAsk]);
  });
});
