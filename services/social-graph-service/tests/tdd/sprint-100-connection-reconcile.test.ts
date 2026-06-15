/**
 * Sprint 100 / ADR-078 — a completed match must produce a connection AND a per-community trust edge
 * for EVERY community the request belongs to, derived from `requests.request_communities` and NOT
 * from the event payload's `community_id` (integration).
 *
 * The bug: the `match_completed` publisher (request-service) never set `community_id`, so the old
 * subscriber's `if (community_id)` guard meant a community trust edge was essentially never created —
 * the community pulse counted exchanges that "How we're connected" then showed no edge for. The live
 * audit found 0 trust edges for two communities whose pulses counted 9 completed exchanges each.
 *
 * This seeds a request cross-posted to TWO communities, fires `handleMatchCompleted` with a payload
 * that has NO `community_id`, and asserts both communities receive a trust edge (plus the connection
 * row). Cross-posting also proves we don't collapse to a single "primary" community.
 *
 * Robust-testing standard: real DB, real upserts, exact assertions on the seeded pair in each
 * community — including the negative (no payload community_id) that previously produced zero edges.
 * DB-backed like the rest of the trust suite — runs in CI / deploy integration; fails on connection
 * locally without a DB (expected).
 */

import { handleMatchCompleted } from '../../src/events/subscriber';
import { pool } from '../../src/config/database';

describe('Sprint 100: match_completed reconciles trust edges from request communities (integration)', () => {
  let communityAId: string;
  let communityBId: string;
  let requesterId: string;
  let responderId: string;
  let requestId: string;

  beforeAll(async () => {
    const mk = async (email: string, name: string) =>
      (await pool.query(`INSERT INTO auth.users (email, name, password_hash) VALUES ($1,$2,'hash') RETURNING id`, [email, name])).rows[0].id;
    requesterId = await mk('s100-reconcile-requester@example.com', 'S100 Reconcile Requester');
    responderId = await mk('s100-reconcile-responder@example.com', 'S100 Reconcile Responder');

    const mkCommunity = async (name: string) =>
      (await pool.query(`INSERT INTO communities.communities (name, description) VALUES ($1,$2) RETURNING id`, [name, 's100 reconcile'])).rows[0].id;
    communityAId = await mkCommunity('S100 Reconcile Community A');
    communityBId = await mkCommunity('S100 Reconcile Community B');

    // Both parties are active members of BOTH communities.
    await pool.query(
      `INSERT INTO communities.members (community_id, user_id, role, status, joined_at) VALUES
         ($1,$3,'member','active', NOW() - INTERVAL '5 days'),
         ($1,$4,'member','active', NOW() - INTERVAL '5 days'),
         ($2,$3,'member','active', NOW() - INTERVAL '5 days'),
         ($2,$4,'member','active', NOW() - INTERVAL '5 days')`,
      [communityAId, communityBId, requesterId, responderId],
    );

    // A request cross-posted to BOTH communities.
    requestId = (
      await pool.query(
        `INSERT INTO requests.help_requests (requester_id, request_type, category, title, description, status, urgency, payload)
         VALUES ($1,'generic','generic','S100 reconcile ask','x','completed','medium','{}') RETURNING id`,
        [requesterId],
      )
    ).rows[0].id;
    await pool.query(
      `INSERT INTO requests.request_communities (request_id, community_id) VALUES ($1,$2),($1,$3)`,
      [requestId, communityAId, communityBId],
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM social_graph.trust_edges WHERE community_id = ANY($1)`, [[communityAId, communityBId]]).catch(() => {});
    await pool.query(
      `DELETE FROM social_graph.connections WHERE user_a_id = ANY($1) OR user_b_id = ANY($1)`,
      [[requesterId, responderId]],
    ).catch(() => {});
    await pool.query(`DELETE FROM requests.request_communities WHERE request_id = $1`, [requestId]).catch(() => {});
    await pool.query(`DELETE FROM requests.help_requests WHERE id = $1`, [requestId]).catch(() => {});
    await pool.query(`DELETE FROM communities.members WHERE community_id = ANY($1)`, [[communityAId, communityBId]]).catch(() => {});
    await pool.query(`DELETE FROM communities.communities WHERE id = ANY($1)`, [[communityAId, communityBId]]).catch(() => {});
    await pool.query(`DELETE FROM auth.users WHERE id = ANY($1)`, [[requesterId, responderId]]).catch(() => {});
    await pool.end().catch(() => {});
  });

  async function trustEdgeCount(communityId: string): Promise<number> {
    const res = await pool.query(
      `SELECT COUNT(*)::int AS n FROM social_graph.trust_edges
       WHERE community_id = $1
         AND LEAST(user_id_a::text, user_id_b::text) = LEAST($2::text, $3::text)
         AND GREATEST(user_id_a::text, user_id_b::text) = GREATEST($2::text, $3::text)`,
      [communityId, requesterId, responderId],
    );
    return res.rows[0].n;
  }

  it('creates a connection + a trust edge in EVERY request community, with no payload community_id', async () => {
    // The payload deliberately omits community_id — the bug condition.
    await handleMatchCompleted({ request_id: requestId, requester_id: requesterId, responder_id: responderId });

    const conn = await pool.query(
      `SELECT COUNT(*)::int AS n FROM social_graph.connections
       WHERE LEAST(user_a_id::text, user_b_id::text) = LEAST($1::text, $2::text)
         AND GREATEST(user_a_id::text, user_b_id::text) = GREATEST($1::text, $2::text)`,
      [requesterId, responderId],
    );
    expect(conn.rows[0].n).toBe(1);

    expect(await trustEdgeCount(communityAId)).toBe(1);
    expect(await trustEdgeCount(communityBId)).toBe(1);
  });
});
