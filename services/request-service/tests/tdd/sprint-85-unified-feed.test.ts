/**
 * Sprint 85 / ADR-066 — Unified Feed `view=home` integration test.
 *
 * Seeds real data and exercises GET /requests/curated?view=home through the route handler,
 * asserting the union contract end-to-end: it returns { items }, a `decision` the member owes
 * ranks strictly ABOVE a `request` they can fill, and match_score is a 0–100 integer (never 0–1).
 *
 * Requires: PostgreSQL database connection (runs in CI / deploy's integration step). In the local
 * TDD tier without a DB it fails like the other DB-dependent integration tests — that is expected.
 */

import express from 'express';
import request from 'supertest';
import { query } from '../../src/database/db';
import requestsRouter from '../../src/routes/requests';

describe('Sprint 85: GET /requests/curated?view=home (integration)', () => {
  let helperId: string; // the member viewing the feed
  let requesterId: string; // posts requests + an offer awaiting the helper
  let communityId: string;
  let fillableRequestId: string;
  let decisionRequestId: string;
  let matchId: string;

  function appAs(userId: string) {
    const app = express();
    app.use(express.json());
    app.use((req: any, _res: any, next: any) => {
      req.user = { userId, email: 'u@test.com', communities: [] }; // empty → skips effective-params fetch
      next();
    });
    app.use('/requests', requestsRouter);
    return app;
  }

  beforeAll(async () => {
    const helper = await query(
      `INSERT INTO auth.users (email, name, password_hash) VALUES ($1,$2,$3) RETURNING id`,
      ['s85-helper@example.com', 'S85 Helper', 'hash'],
    );
    helperId = helper.rows[0].id;
    const requester = await query(
      `INSERT INTO auth.users (email, name, password_hash) VALUES ($1,$2,$3) RETURNING id`,
      ['s85-requester@example.com', 'S85 Requester', 'hash'],
    );
    requesterId = requester.rows[0].id;

    const community = await query(
      `INSERT INTO communities.communities (name, description) VALUES ($1,$2) RETURNING id`,
      ['S85 Feed Community', 'unified feed integration'],
    );
    communityId = community.rows[0].id;

    await query(
      `INSERT INTO communities.members (community_id, user_id, role, status)
       VALUES ($1,$2,'member','active'), ($1,$3,'member','active')`,
      [communityId, helperId, requesterId],
    );
    await query(`INSERT INTO auth.user_skills (user_id, skill) VALUES ($1,'plumbing')`, [helperId]);

    // A fillable request the helper can offer on (matches their plumbing skill).
    const fillable = await query(
      `INSERT INTO requests.help_requests (requester_id, request_type, category, title, description, status, urgency, payload)
       VALUES ($1,'service','service',$2,$3,'open','high',$4) RETURNING id`,
      [requesterId, 'Need a plumber for a leak', 'Kitchen pipe leaking', JSON.stringify({ service_category: 'plumbing', skill_level_required: 'intermediate' })],
    );
    fillableRequestId = fillable.rows[0].id;
    await query(`INSERT INTO requests.request_communities (request_id, community_id) VALUES ($1,$2)`, [fillableRequestId, communityId]);

    // A request the helper made, with a proposed offer the helper owes a response on... actually
    // model the helper as the REQUESTER of a second request with an incoming proposed match, so the
    // helper owes accept/decline — a decision.
    const decisionReq = await query(
      `INSERT INTO requests.help_requests (requester_id, request_type, category, title, description, status, urgency, payload)
       VALUES ($1,'generic','generic',$2,$3,'open','medium','{}') RETURNING id`,
      [helperId, 'Help moving a couch', 'Saturday morning'],
    );
    decisionRequestId = decisionReq.rows[0].id;
    await query(`INSERT INTO requests.request_communities (request_id, community_id) VALUES ($1,$2)`, [decisionRequestId, communityId]);
    const match = await query(
      `INSERT INTO requests.matches (request_id, responder_id, status) VALUES ($1,$2,'proposed') RETURNING id`,
      [decisionRequestId, requesterId],
    );
    matchId = match.rows[0].id;
  });

  afterAll(async () => {
    await query(`DELETE FROM requests.matches WHERE id = $1`, [matchId]).catch(() => {});
    await query(`DELETE FROM requests.help_requests WHERE id = ANY($1)`, [[fillableRequestId, decisionRequestId]]).catch(() => {});
    await query(`DELETE FROM auth.user_skills WHERE user_id = $1`, [helperId]).catch(() => {});
    await query(`DELETE FROM communities.members WHERE community_id = $1`, [communityId]).catch(() => {});
    await query(`DELETE FROM communities.communities WHERE id = $1`, [communityId]).catch(() => {});
    await query(`DELETE FROM auth.users WHERE id = ANY($1)`, [[helperId, requesterId]]).catch(() => {});
  });

  it('returns the union { items } with decisions ranked above requests, and 0–100 match scores', async () => {
    const res = await request(appAs(helperId)).get('/requests/curated').query({ view: 'home', minScore: 0 });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);

    const items = res.body.data.items as Array<{ kind: string; priority: number; data: any }>;
    const firstDecision = items.find((i) => i.kind === 'decision');
    const firstRequest = items.find((i) => i.kind === 'request');

    // The helper owes a response on the incoming proposed match.
    expect(firstDecision).toBeDefined();
    expect(firstDecision!.data.actions).toEqual(expect.arrayContaining(['accept_offer', 'decline_offer']));

    // The fillable plumbing request appears as a request item with a normalized score.
    expect(firstRequest).toBeDefined();
    const score = firstRequest!.data.match_score;
    expect(score === null || (Number.isInteger(score) && score >= 0 && score <= 100)).toBe(true);

    // Action altitude: every decision strictly outranks every request, and array order reflects it.
    const minDecisionPriority = Math.min(...items.filter((i) => i.kind === 'decision').map((i) => i.priority));
    const maxRequestPriority = Math.max(...items.filter((i) => i.kind === 'request').map((i) => i.priority));
    expect(minDecisionPriority).toBeGreaterThan(maxRequestPriority);
    expect(items.findIndex((i) => i.kind === 'decision')).toBeLessThan(items.findIndex((i) => i.kind === 'request'));
  });
});
