/**
 * Sprint 90 / ADR-069 — GET /requests/retention-policy.
 *
 * Two tiers of assertion:
 *  1. Pure unit (no DB): the window-resolution helper honors community → global → fallback.
 *  2. Route behavior: non-member is 403'd; a member gets the policy (not an id lookup — the static
 *     path must NOT be shadowed by `/:id`). The member/200 path needs a DB and so runs in CI/deploy;
 *     locally without a DB it fails like the other integration tests — that is expected.
 */

import express from 'express';
import request from 'supertest';
import { query } from '../../src/database/db';
import requestsRouter, { resolveRetentionWindows } from '../../src/routes/requests';

describe('Sprint 90: resolveRetentionWindows (pure)', () => {
  it('falls back to hardcoded windows when config is empty', () => {
    expect(resolveRetentionWindows([])).toEqual({
      completedRequestWindowDays: 180,
      expiredRequestWindowDays: 30,
      messageWindowDays: 180,
    });
  });

  it('uses the global (NULL) row when present', () => {
    const rows = [
      { community_id: null, completed_request_window_days: 90, expired_request_window_days: 14, message_window_days: 60 },
    ];
    expect(resolveRetentionWindows(rows)).toEqual({
      completedRequestWindowDays: 90,
      expiredRequestWindowDays: 14,
      messageWindowDays: 60,
    });
  });

  it('lets a community row override the global row', () => {
    const rows = [
      { community_id: null, completed_request_window_days: 180, expired_request_window_days: 30, message_window_days: 180 },
      { community_id: 'c1', completed_request_window_days: 45, expired_request_window_days: 7, message_window_days: 45 },
    ];
    expect(resolveRetentionWindows(rows, 'c1')).toEqual({
      completedRequestWindowDays: 45,
      expiredRequestWindowDays: 7,
      messageWindowDays: 45,
    });
  });
});

describe('Sprint 90: GET /requests/retention-policy (route)', () => {
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

  it('rejects a non-member caller (community-scoped) with 403 — no DB needed', async () => {
    const notAMember = [{ id: 'other-community', name: 'Elsewhere', role: 'member' }];
    const res = await request(appAs('u1', notAMember)).get('/requests/retention-policy?communityId=target-community');
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // DB-backed: a member gets the resolved policy, proving the static path is NOT shadowed by `/:id`.
  describe('member path (integration — requires DB)', () => {
    let communityId: string;
    let memberId: string;
    const createdRequestIds: string[] = [];

    beforeAll(async () => {
      const u = await query(
        `INSERT INTO auth.users (email, name, password_hash) VALUES ($1,$2,$3) RETURNING id`,
        ['s90-retention@example.com', 'S90 Member', 'hash'],
      );
      memberId = u.rows[0].id;
      const c = await query(
        `INSERT INTO communities.communities (name, description) VALUES ($1,$2) RETURNING id`,
        ['S90 Retention Community', 'retention policy integration'],
      );
      communityId = c.rows[0].id;
      await query(
        `INSERT INTO communities.members (community_id, user_id, role, status, joined_at)
         VALUES ($1,$2,'member','active', NOW())`,
        [communityId, memberId],
      );
      // One held request (free-text intact), one already forgotten (anonymized).
      const held = await query(
        `INSERT INTO requests.help_requests (requester_id, request_type, category, title, description, status, urgency, payload)
         VALUES ($1,'generic','generic','Held ask','still here','open','medium','{}') RETURNING id`,
        [memberId],
      );
      createdRequestIds.push(held.rows[0].id);
      await query(`INSERT INTO requests.request_communities (request_id, community_id) VALUES ($1,$2)`, [held.rows[0].id, communityId]);
      const forgotten = await query(
        `INSERT INTO requests.help_requests (requester_id, request_type, category, title, description, status, urgency, payload, content_forgotten_at)
         VALUES ($1,'generic','generic','[forgotten]','[forgotten]','completed','medium','{}', NOW()) RETURNING id`,
        [memberId],
      );
      createdRequestIds.push(forgotten.rows[0].id);
      await query(`INSERT INTO requests.request_communities (request_id, community_id) VALUES ($1,$2)`, [forgotten.rows[0].id, communityId]);
    });

    afterAll(async () => {
      await query(`DELETE FROM requests.help_requests WHERE id = ANY($1)`, [createdRequestIds]).catch(() => {});
      await query(`DELETE FROM communities.members WHERE community_id = $1`, [communityId]).catch(() => {});
      await query(`DELETE FROM communities.communities WHERE id = $1`, [communityId]).catch(() => {});
      await query(`DELETE FROM auth.users WHERE id = $1`, [memberId]).catch(() => {});
    });

    it('returns resolved windows + non-negative held/forgotten counts (not an id lookup)', async () => {
      const member = [{ id: communityId, name: 'S90 Retention Community', role: 'member' }];
      const res = await request(appAs(memberId, member)).get(`/requests/retention-policy?communityId=${communityId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      // Resolved windows present (global defaults unless a community override row was seeded).
      expect(data.windows.completedRequestWindowDays).toBeGreaterThan(0);
      expect(data.windows.expiredRequestWindowDays).toBeGreaterThan(0);
      expect(data.windows.messageWindowDays).toBeGreaterThan(0);
      // Counts reflect the seeded rows and are non-negative.
      expect(data.counts.held).toBeGreaterThanOrEqual(1);
      expect(data.counts.forgotten).toBeGreaterThanOrEqual(1);
      // Proves the static path was NOT captured by `/:id` (that would 404 / return a single request).
      expect(data).not.toHaveProperty('id');
    });
  });
});
