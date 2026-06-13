/**
 * Sprint 97 / BUG-097-002 — Community pulse must only name helpers who are active members of the
 * community whose pulse is being rendered (integration).
 *
 * The reported bug: a community page named a recent helper (Chen Johansson) who was NOT a member of
 * that community — the recent-helpers query joined completed matches to the community via
 * request_communities but never required the responder to be an active member of THAT community.
 * The audit found 186 such (community, non-member-helper) pairs on the live demo DB.
 *
 * This seeds:
 *   - community A (rendered) and community B (the non-member's real home)
 *   - memberHelper: active member of A, completes one A-attached exchange this week → MUST appear
 *   - foreignHelper: active member of B but NOT A, completes one A-attached exchange this week →
 *     MUST be excluded from A's pulse
 *
 * Robust-testing standard (Sprint 65+): no stubs for the logic under test; assert exact names and
 * counts against seeded rows, including the negative case (the non-member) that must be excluded.
 * `helpedThisWeek` is asserted to use the same member-only subset as `recentHelpers`, so the pulse
 * can never claim N exchanges while naming zero qualifying member helpers.
 *
 * Requires: PostgreSQL connection (runs in CI / deploy integration step). Locally without a DB it
 * fails on connection like the other DB-backed pulse tests — that is expected.
 */

import express from 'express';
import request from 'supertest';
import { query } from '../../src/database/db';
import requestsRouter from '../../src/routes/requests';

describe('Sprint 97: community pulse excludes non-member helpers (integration)', () => {
  let communityAId: string; // the rendered community
  let communityBId: string; // the foreign helper's real home
  let memberHelperId: string; // active member of A → appears
  let foreignHelperId: string; // active member of B, NOT A → excluded
  let requesterId: string; // owns the asks, member of A, the caller
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

  /** Create a completed-this-week match attached to community A, responded to by `responderId`. */
  async function seedCompletedExchange(responderId: string): Promise<void> {
    const req = await query(
      `INSERT INTO requests.help_requests (requester_id, request_type, category, title, description, status, urgency, payload)
       VALUES ($1,'generic','generic',$2,$3,'completed','medium','{}') RETURNING id`,
      [requesterId, 'S97 completed ask', 'closed this week'],
    );
    createdRequestIds.push(req.rows[0].id);
    await query(`INSERT INTO requests.request_communities (request_id, community_id) VALUES ($1,$2)`, [req.rows[0].id, communityAId]);
    const match = await query(
      `INSERT INTO requests.matches (request_id, responder_id, status, completed_at)
       VALUES ($1,$2,'completed', NOW() - INTERVAL '2 days') RETURNING id`,
      [req.rows[0].id, responderId],
    );
    createdMatchIds.push(match.rows[0].id);
  }

  beforeAll(async () => {
    const mk = async (email: string, name: string) =>
      (await query(`INSERT INTO auth.users (email, name, password_hash) VALUES ($1,$2,'hash') RETURNING id`, [email, name])).rows[0].id;

    memberHelperId = await mk('s97-member-helper@example.com', 'S97 Member Helper');
    foreignHelperId = await mk('s97-foreign-helper@example.com', 'S97 Foreign Helper');
    requesterId = await mk('s97-requester@example.com', 'S97 Requester');

    const mkCommunity = async (name: string) =>
      (await query(`INSERT INTO communities.communities (name, description) VALUES ($1,$2) RETURNING id`, [name, 's97 pulse membership'])).rows[0].id;
    communityAId = await mkCommunity('S97 Community A (rendered)');
    communityBId = await mkCommunity('S97 Community B (foreign home)');

    // memberHelper + requester are active members of A. foreignHelper is an active member of B only.
    await query(
      `INSERT INTO communities.members (community_id, user_id, role, status, joined_at) VALUES
         ($1,$2,'member','active', NOW() - INTERVAL '2 days'),
         ($1,$3,'member','active', NOW() - INTERVAL '2 days'),
         ($4,$5,'member','active', NOW() - INTERVAL '2 days')`,
      [communityAId, memberHelperId, requesterId, communityBId, foreignHelperId],
    );

    // Both helpers complete one A-attached exchange this week.
    await seedCompletedExchange(memberHelperId);
    await seedCompletedExchange(foreignHelperId);
  });

  afterAll(async () => {
    await query(`DELETE FROM requests.matches WHERE id = ANY($1)`, [createdMatchIds]).catch(() => {});
    await query(`DELETE FROM requests.help_requests WHERE id = ANY($1)`, [createdRequestIds]).catch(() => {});
    await query(`DELETE FROM communities.members WHERE community_id = ANY($1)`, [[communityAId, communityBId]]).catch(() => {});
    await query(`DELETE FROM communities.communities WHERE id = ANY($1)`, [[communityAId, communityBId]]).catch(() => {});
    await query(`DELETE FROM auth.users WHERE id = ANY($1)`, [[memberHelperId, foreignHelperId, requesterId]]).catch(() => {});
  });

  it('names only active members of the rendered community and excludes the foreign helper', async () => {
    const member = [{ id: communityAId, name: 'S97 Community A (rendered)', role: 'member' }];
    const res = await request(appAs(requesterId, member)).get(`/requests/community/${communityAId}/pulse`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;

    const helperNames = data.recentHelpers.map((h: { name: string }) => h.name);
    expect(helperNames).toContain('S97 Member Helper');
    expect(helperNames).not.toContain('S97 Foreign Helper');
    expect(data.recentHelpers).toEqual([{ name: 'S97 Member Helper', count: 1 }]);

    // Member-only semantics: helpedThisWeek counts the same active-member subset as recentHelpers,
    // so the foreign helper's exchange is not counted either.
    expect(data.helpedThisWeek).toBe(1);
  });
});
