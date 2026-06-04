/**
 * Sprint 86 / ADR-066 — Unified Feed `view=community` integration test.
 *
 * Seeds real data and exercises GET /requests/curated?view=community through the route handler,
 * asserting the community union end-to-end:
 *   - returns { items } with request items ranked ABOVE the activity summary ABOVE stories
 *   - NO `decision` item on this path (decisions are a Dashboard-Home concern)
 *   - the ADR-067 seam fix: a `moving`-category request resolves payload_type 'moving_help'
 *   - the guards: 400 when community_id is omitted; a non-member gets 403 (never another
 *     community's texture)
 *
 * Requires: PostgreSQL (runs in CI / deploy's integration step). In the local tier without a DB
 * it fails like the other DB-dependent integration tests — that is expected.
 */

import express from 'express';
import request from 'supertest';
import { query } from '../../src/database/db';
import requestsRouter from '../../src/routes/requests';

describe('Sprint 86: GET /requests/curated?view=community (integration)', () => {
  let memberId: string; // the member viewing the community feed
  let requesterId: string; // posts the fillable request + is the completed-exchange requester
  let outsiderId: string; // authenticated but NOT a member of the community
  let communityId: string;
  let fillableRequestId: string;
  let completedRequestId: string;
  let completedMatchId: string;

  function appAs(userId: string, communities: Array<{ id: string }> = []) {
    const app = express();
    app.use(express.json());
    app.use((req: any, _res: any, next: any) => {
      req.user = { userId, email: 'u@test.com', communities };
      next();
    });
    app.use('/requests', requestsRouter);
    return app;
  }

  beforeAll(async () => {
    const member = await query(
      `INSERT INTO auth.users (email, name, password_hash) VALUES ($1,$2,$3) RETURNING id`,
      ['s86-member@example.com', 'S86 Member', 'hash'],
    );
    memberId = member.rows[0].id;
    const requester = await query(
      `INSERT INTO auth.users (email, name, password_hash) VALUES ($1,$2,$3) RETURNING id`,
      ['s86-requester@example.com', 'S86 Requester', 'hash'],
    );
    requesterId = requester.rows[0].id;
    const outsider = await query(
      `INSERT INTO auth.users (email, name, password_hash) VALUES ($1,$2,$3) RETURNING id`,
      ['s86-outsider@example.com', 'S86 Outsider', 'hash'],
    );
    outsiderId = outsider.rows[0].id;

    const community = await query(
      `INSERT INTO communities.communities (name, description) VALUES ($1,$2) RETURNING id`,
      ['S86 Community Feed', 'community feed integration'],
    );
    communityId = community.rows[0].id;

    // member + requester both joined "now" → also drives new_members_count in the activity summary.
    await query(
      `INSERT INTO communities.members (community_id, user_id, role, status)
       VALUES ($1,$2,'member','active'), ($1,$3,'member','active')`,
      [communityId, memberId, requesterId],
    );

    // A fillable OPEN request the member can fill. category='moving' is the legacy skill token →
    // the ADR-067 map must resolve it to payload_type 'moving_help' (request_type stays the enum).
    const fillable = await query(
      `INSERT INTO requests.help_requests (requester_id, request_type, category, title, description, status, urgency, payload)
       VALUES ($1,'generic','moving',$2,$3,'open','high',$4) RETURNING id`,
      [
        requesterId,
        'Help moving a couch upstairs',
        'Third floor, no elevator',
        JSON.stringify({
          current_address: { address: '1 A St', city: 'Town', state: 'TX', floor: 1, has_elevator: false },
          new_address: { address: '2 B St', city: 'Town', state: 'TX', floor: 3, has_elevator: false },
          distance_miles: 4,
          estimated_duration_hours: 3,
          truck_needed: true,
          heavy_items: true,
          num_helpers_needed: 2,
        }),
      ],
    );
    fillableRequestId = fillable.rows[0].id;
    await query(`INSERT INTO requests.request_communities (request_id, community_id) VALUES ($1,$2)`, [fillableRequestId, communityId]);

    // A COMPLETED exchange this week (member was the helper). Drives exchanges_completed_week in the
    // activity summary and a first_timer story (the member's first completed exchange in the community).
    const completed = await query(
      `INSERT INTO requests.help_requests (requester_id, request_type, category, title, description, status, urgency, payload)
       VALUES ($1,'generic','generic',$2,$3,'completed','low','{}') RETURNING id`,
      [requesterId, 'Fix a leaky faucet', 'Done last week'],
    );
    completedRequestId = completed.rows[0].id;
    await query(`INSERT INTO requests.request_communities (request_id, community_id) VALUES ($1,$2)`, [completedRequestId, communityId]);
    const match = await query(
      `INSERT INTO requests.matches (request_id, responder_id, status, completed_at)
       VALUES ($1,$2,'completed', NOW()) RETURNING id`,
      [completedRequestId, memberId],
    );
    completedMatchId = match.rows[0].id;
  });

  afterAll(async () => {
    await query(`DELETE FROM requests.matches WHERE id = $1`, [completedMatchId]).catch(() => {});
    await query(`DELETE FROM requests.help_requests WHERE id = ANY($1)`, [[fillableRequestId, completedRequestId]]).catch(() => {});
    await query(`DELETE FROM communities.members WHERE community_id = $1`, [communityId]).catch(() => {});
    await query(`DELETE FROM communities.communities WHERE id = $1`, [communityId]).catch(() => {});
    await query(`DELETE FROM auth.users WHERE id = ANY($1)`, [[memberId, requesterId, outsiderId]]).catch(() => {});
  });

  it('returns the request+activity+story union for a member — no decision band, seam fix applied', async () => {
    const res = await request(appAs(memberId, [{ id: communityId }]))
      .get('/requests/curated')
      .query({ view: 'community', community_id: communityId, minScore: 0 });

    expect(res.status).toBe(200);
    const items = res.body.data.items as Array<{ kind: string; priority: number; data: any }>;
    expect(Array.isArray(items)).toBe(true);

    // No decision band on the community path.
    expect(items.some((i) => i.kind === 'decision')).toBe(false);

    // The fillable request appears with the ADR-067 payload_type resolved from category='moving'.
    const fillable = items.find((i) => i.kind === 'request' && i.data.request_id === fillableRequestId);
    expect(fillable).toBeDefined();
    expect(fillable!.data.payload_type).toBe('moving_help');

    // Texture present: one activity summary reflecting the completed exchange this week.
    const activity = items.find((i) => i.kind === 'activity');
    expect(activity).toBeDefined();
    expect(activity!.data.exchanges_completed_week).toBeGreaterThanOrEqual(1);
    expect(activity!.data.community_id).toBe(communityId);

    // Ranking bands: every request > every activity > every story, and array order reflects it.
    const reqMax = Math.max(...items.filter((i) => i.kind === 'request').map((i) => i.priority));
    const actMax = Math.max(...items.filter((i) => i.kind === 'activity').map((i) => i.priority));
    expect(reqMax).toBeGreaterThan(actMax);
    const stories = items.filter((i) => i.kind === 'story');
    if (stories.length > 0) {
      expect(actMax).toBeGreaterThan(Math.max(...stories.map((i) => i.priority)));
      // first request before activity before first story in render order
      expect(items.findIndex((i) => i.kind === 'request')).toBeLessThan(items.findIndex((i) => i.kind === 'activity'));
      expect(items.findIndex((i) => i.kind === 'activity')).toBeLessThan(items.findIndex((i) => i.kind === 'story'));
    }
  });

  it('returns 400 when community_id is omitted', async () => {
    const res = await request(appAs(memberId, [{ id: communityId }]))
      .get('/requests/curated')
      .query({ view: 'community', minScore: 0 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 for a non-member — never another community\'s texture', async () => {
    const res = await request(appAs(outsiderId, [])) // outsider is in no communities
      .get('/requests/curated')
      .query({ view: 'community', community_id: communityId, minScore: 0 });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.data).toBeUndefined();
  });
});
