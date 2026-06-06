/**
 * Sprint 89 / ADR-068 — Community pulse endpoint (integration).
 *
 * Seeds real data and exercises GET /requests/community/:communityId/pulse through the route
 * handler, asserting the weekly help-loop pulse exactly. The pulse REUSES the S86 community-feed
 * texture aggregation (helped this week / recent joins / open non-expired asks / recent helpers)
 * plus one new `timeSensitive` field — so these assertions also lock the texture aggregation's
 * window + expiry semantics in lockstep with the in-feed ActivityCard.
 *
 * Robust-testing standard (Sprint 65+): no stubs for the logic under test; assert exact counts
 * against seeded rows, including the negative cases (8-days-ago, expired) that must be excluded.
 *
 * Requires: PostgreSQL database connection (runs in CI / deploy's integration step). In the local
 * TDD tier without a DB it fails like the other DB-dependent integration tests — that is expected.
 */

import express from 'express';
import request from 'supertest';
import { query } from '../../src/database/db';
import requestsRouter from '../../src/routes/requests';

describe('Sprint 89: GET /requests/community/:communityId/pulse (integration)', () => {
  let communityId: string;
  let helperId: string; // completes an exchange this week → recentHelpers + helpedThisWeek
  let requesterId: string; // posts the open asks
  let oldJoinerId: string; // joined 8 days ago → must NOT count in recentJoins
  const createdRequestIds: string[] = [];
  const createdMatchIds: string[] = [];

  /** Mount the router behind a fake auth middleware that sets the caller's JWT `communities`. */
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

  beforeAll(async () => {
    const helper = await query(
      `INSERT INTO auth.users (email, name, password_hash) VALUES ($1,$2,$3) RETURNING id`,
      ['s89-helper@example.com', 'S89 Helper', 'hash'],
    );
    helperId = helper.rows[0].id;
    const requester = await query(
      `INSERT INTO auth.users (email, name, password_hash) VALUES ($1,$2,$3) RETURNING id`,
      ['s89-requester@example.com', 'S89 Requester', 'hash'],
    );
    requesterId = requester.rows[0].id;
    const oldJoiner = await query(
      `INSERT INTO auth.users (email, name, password_hash) VALUES ($1,$2,$3) RETURNING id`,
      ['s89-oldjoiner@example.com', 'S89 OldJoiner', 'hash'],
    );
    oldJoinerId = oldJoiner.rows[0].id;

    const community = await query(
      `INSERT INTO communities.communities (name, description) VALUES ($1,$2) RETURNING id`,
      ['S89 Pulse Community', 'community pulse integration'],
    );
    communityId = community.rows[0].id;

    // helper + requester joined this week (count); oldJoiner joined 8 days ago (does NOT count).
    await query(
      `INSERT INTO communities.members (community_id, user_id, role, status, joined_at) VALUES
         ($1,$2,'member','active', NOW() - INTERVAL '2 days'),
         ($1,$3,'member','active', NOW() - INTERVAL '2 days'),
         ($1,$4,'member','active', NOW() - INTERVAL '8 days')`,
      [communityId, helperId, requesterId, oldJoinerId],
    );

    // Two completed exchanges: one 2 days ago (counts), one 8 days ago (does NOT count).
    const completedRecent = await query(
      `INSERT INTO requests.help_requests (requester_id, request_type, category, title, description, status, urgency, payload)
       VALUES ($1,'generic','generic',$2,$3,'completed','medium','{}') RETURNING id`,
      [requesterId, 'Recent completed ask', 'closed 2 days ago'],
    );
    createdRequestIds.push(completedRecent.rows[0].id);
    await query(`INSERT INTO requests.request_communities (request_id, community_id) VALUES ($1,$2)`, [completedRecent.rows[0].id, communityId]);
    const matchRecent = await query(
      `INSERT INTO requests.matches (request_id, responder_id, status, completed_at)
       VALUES ($1,$2,'completed', NOW() - INTERVAL '2 days') RETURNING id`,
      [completedRecent.rows[0].id, helperId],
    );
    createdMatchIds.push(matchRecent.rows[0].id);

    const completedOld = await query(
      `INSERT INTO requests.help_requests (requester_id, request_type, category, title, description, status, urgency, payload)
       VALUES ($1,'generic','generic',$2,$3,'completed','medium','{}') RETURNING id`,
      [requesterId, 'Old completed ask', 'closed 8 days ago'],
    );
    createdRequestIds.push(completedOld.rows[0].id);
    await query(`INSERT INTO requests.request_communities (request_id, community_id) VALUES ($1,$2)`, [completedOld.rows[0].id, communityId]);
    const matchOld = await query(
      `INSERT INTO requests.matches (request_id, responder_id, status, completed_at)
       VALUES ($1,$2,'completed', NOW() - INTERVAL '8 days') RETURNING id`,
      [completedOld.rows[0].id, helperId],
    );
    createdMatchIds.push(matchOld.rows[0].id);

    // Open asks: one medium non-expired (counts openAsks only), one urgent non-expired (counts
    // openAsks + timeSensitive), one EXPIRED urgent (must be excluded from BOTH).
    const openMedium = await query(
      `INSERT INTO requests.help_requests (requester_id, request_type, category, title, description, status, urgency, payload, expired)
       VALUES ($1,'generic','generic',$2,$3,'open','medium','{}', FALSE) RETURNING id`,
      [requesterId, 'Open medium ask', 'still open'],
    );
    createdRequestIds.push(openMedium.rows[0].id);
    await query(`INSERT INTO requests.request_communities (request_id, community_id) VALUES ($1,$2)`, [openMedium.rows[0].id, communityId]);

    const openUrgent = await query(
      `INSERT INTO requests.help_requests (requester_id, request_type, category, title, description, status, urgency, payload, expired)
       VALUES ($1,'generic','generic',$2,$3,'open','urgent','{}', FALSE) RETURNING id`,
      [requesterId, 'Open urgent ask', 'time sensitive'],
    );
    createdRequestIds.push(openUrgent.rows[0].id);
    await query(`INSERT INTO requests.request_communities (request_id, community_id) VALUES ($1,$2)`, [openUrgent.rows[0].id, communityId]);

    const openExpiredUrgent = await query(
      `INSERT INTO requests.help_requests (requester_id, request_type, category, title, description, status, urgency, payload, expired)
       VALUES ($1,'generic','generic',$2,$3,'open','urgent','{}', TRUE) RETURNING id`,
      [requesterId, 'Expired urgent ask', 'should be excluded'],
    );
    createdRequestIds.push(openExpiredUrgent.rows[0].id);
    await query(`INSERT INTO requests.request_communities (request_id, community_id) VALUES ($1,$2)`, [openExpiredUrgent.rows[0].id, communityId]);
  });

  afterAll(async () => {
    await query(`DELETE FROM requests.matches WHERE id = ANY($1)`, [createdMatchIds]).catch(() => {});
    await query(`DELETE FROM requests.help_requests WHERE id = ANY($1)`, [createdRequestIds]).catch(() => {});
    await query(`DELETE FROM communities.members WHERE community_id = $1`, [communityId]).catch(() => {});
    await query(`DELETE FROM communities.communities WHERE id = $1`, [communityId]).catch(() => {});
    await query(`DELETE FROM auth.users WHERE id = ANY($1)`, [[helperId, requesterId, oldJoinerId]]).catch(() => {});
  });

  it('aggregates the weekly pulse exactly, excluding 8-days-ago and expired rows', async () => {
    const member = [{ id: communityId, name: 'S89 Pulse Community', role: 'member' }];
    const res = await request(appAs(helperId, member)).get(`/requests/community/${communityId}/pulse`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;

    // Exactly one completed exchange in the last 7 days (the 8-days-ago one is excluded).
    expect(data.helpedThisWeek).toBe(1);
    // Two open, non-expired asks (the expired urgent one is excluded).
    expect(data.openAsks).toBe(2);
    // Of the open non-expired asks, one is urgent/high (the expired urgent one is NOT counted).
    expect(data.timeSensitive).toBe(1);
    // Two members joined in the last 7 days (the 8-days-ago joiner is excluded).
    expect(data.recentJoins).toBe(2);
    // The recent helper behind the completed exchange surfaces with an exact count.
    expect(data.recentHelpers).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'S89 Helper', count: 1 })]),
    );
    expect(data.windowDays).toBe(7);
  });

  it('rejects a non-member caller with 403', async () => {
    const notAMember = [{ id: 'some-other-community-id', name: 'Elsewhere', role: 'member' }];
    const res = await request(appAs(requesterId, notAMember)).get(`/requests/community/${communityId}/pulse`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});
