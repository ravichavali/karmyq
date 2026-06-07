/**
 * Sprint 90 / ADR-069 — Memory retention job (integration).
 *
 * Seeds a real aged exchange and exercises `forgetExchangeContent()` against the database, asserting
 * the forgetting is correct AND that the aggregates are untouched:
 *  - completed-request free-text (title/description/payload/requirements) → '[forgotten]' / '{}'
 *  - the conversation's messages → '[forgotten]' (cascade)
 *  - karma_records.reason + points byte-for-byte UNCHANGED (the load-bearing aggregate)
 *  - the match row survives
 *  - an expired + unmatched request is hard-deleted; an expired + MATCHED one is not
 *
 * Requires PostgreSQL (runs in CI / deploy's integration step). Locally without a DB it fails like the
 * other DB-dependent tests — that is expected, and the tdd tier never blocks a push.
 */

import { forgetExchangeContent } from '../../src/jobs/memoryRetentionJob';
import { query } from '../../src/database/db';

describe('Sprint 90: forgetExchangeContent (integration)', () => {
  let requesterId: string;
  let helperId: string;
  let communityId: string;
  let completedReqId: string;
  let completedMatchId: string;
  let conversationId: string;
  let messageId: string;
  let karmaId: string;
  let expiredUnmatchedId: string;
  let expiredMatchedId: string;
  let expiredMatchedMatchId: string;

  beforeAll(async () => {
    const r = await query(
      `INSERT INTO auth.users (email, name, password_hash) VALUES ($1,$2,$3) RETURNING id`,
      ['s90-forget-req@example.com', 'S90 Req', 'hash'],
    );
    requesterId = r.rows[0].id;
    const h = await query(
      `INSERT INTO auth.users (email, name, password_hash) VALUES ($1,$2,$3) RETURNING id`,
      ['s90-forget-helper@example.com', 'S90 Helper', 'hash'],
    );
    helperId = h.rows[0].id;
    const c = await query(
      `INSERT INTO communities.communities (name, description) VALUES ($1,$2) RETURNING id`,
      ['S90 Forget Community', 'forgetting integration'],
    );
    communityId = c.rows[0].id;

    // Ensure a global retention config row (windows 180/30/180) exists.
    await query(
      `INSERT INTO requests.retention_config (community_id)
       SELECT NULL WHERE NOT EXISTS (SELECT 1 FROM requests.retention_config WHERE community_id IS NULL)`,
    );

    // 1) Aged COMPLETED exchange (updated 200 days ago) with PII in every free-text column.
    const completed = await query(
      `INSERT INTO requests.help_requests
         (requester_id, request_type, category, title, description, status, urgency, payload, requirements, updated_at)
       VALUES ($1,'generic','generic',$2,$3,'completed','medium',$4,$5, NOW() - INTERVAL '200 days')
       RETURNING id`,
      [requesterId, 'Ride to the clinic for Jane Doe', 'Pick me up at 123 Main St', '{"address":"123 Main St"}', '{"note":"call first"}'],
    );
    completedReqId = completed.rows[0].id;
    const cm = await query(
      `INSERT INTO requests.matches (request_id, responder_id, status, completed_at)
       VALUES ($1,$2,'completed', NOW() - INTERVAL '200 days') RETURNING id`,
      [completedReqId, helperId],
    );
    completedMatchId = cm.rows[0].id;
    const conv = await query(
      `INSERT INTO messaging.conversations (request_match_id) VALUES ($1) RETURNING id`,
      [completedMatchId],
    );
    conversationId = conv.rows[0].id;
    const msg = await query(
      `INSERT INTO messaging.messages (sender_id, conversation_id, content)
       VALUES ($1,$2,$3) RETURNING id`,
      [requesterId, conversationId, 'My address is 123 Main St, see you at 4pm'],
    );
    messageId = msg.rows[0].id;
    // Karma earned from the exchange — the aggregate that must NOT change.
    const karma = await query(
      `INSERT INTO reputation.karma_records (user_id, community_id, points, reason)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [helperId, communityId, 50, 'Provided help'],
    );
    karmaId = karma.rows[0].id;

    // 2) Expired + UNMATCHED request aged 40 days → must be hard-deleted.
    const eu = await query(
      `INSERT INTO requests.help_requests
         (requester_id, request_type, category, title, description, status, urgency, expired, updated_at)
       VALUES ($1,'generic','generic','Expired unmatched','nobody came','open','medium', TRUE, NOW() - INTERVAL '40 days')
       RETURNING id`,
      [requesterId],
    );
    expiredUnmatchedId = eu.rows[0].id;

    // 3) Expired + MATCHED request aged 40 days → must NOT be hard-deleted (it has an aggregate).
    const em = await query(
      `INSERT INTO requests.help_requests
         (requester_id, request_type, category, title, description, status, urgency, expired, updated_at)
       VALUES ($1,'generic','generic','Expired matched','someone came','open','medium', TRUE, NOW() - INTERVAL '40 days')
       RETURNING id`,
      [requesterId],
    );
    expiredMatchedId = em.rows[0].id;
    const emMatch = await query(
      `INSERT INTO requests.matches (request_id, responder_id, status)
       VALUES ($1,$2,'completed') RETURNING id`,
      [expiredMatchedId, helperId],
    );
    expiredMatchedMatchId = emMatch.rows[0].id;

    await forgetExchangeContent();
  });

  afterAll(async () => {
    await query(`DELETE FROM messaging.messages WHERE id = $1`, [messageId]).catch(() => {});
    await query(`DELETE FROM messaging.conversations WHERE id = $1`, [conversationId]).catch(() => {});
    await query(`DELETE FROM reputation.karma_records WHERE id = $1`, [karmaId]).catch(() => {});
    await query(`DELETE FROM requests.matches WHERE id = ANY($1)`, [[completedMatchId, expiredMatchedMatchId]]).catch(() => {});
    await query(`DELETE FROM requests.help_requests WHERE id = ANY($1)`, [[completedReqId, expiredMatchedId]]).catch(() => {});
    await query(`DELETE FROM communities.communities WHERE id = $1`, [communityId]).catch(() => {});
    await query(`DELETE FROM auth.users WHERE id = ANY($1)`, [[requesterId, helperId]]).catch(() => {});
  });

  it('anonymizes ALL completed-request free-text to sentinels and stamps content_forgotten_at', async () => {
    const res = await query(
      `SELECT title, description, payload, requirements, content_forgotten_at
         FROM requests.help_requests WHERE id = $1`,
      [completedReqId],
    );
    const row = res.rows[0];
    expect(row.title).toBe('[forgotten]');
    expect(row.description).toBe('[forgotten]');
    expect(row.payload).toEqual({});
    expect(row.requirements).toEqual({});
    expect(row.content_forgotten_at).not.toBeNull();
  });

  it('cascade-forgets the conversation messages (same Exchange Unit)', async () => {
    const res = await query(`SELECT content, forgotten_at FROM messaging.messages WHERE id = $1`, [messageId]);
    expect(res.rows[0].content).toBe('[forgotten]');
    expect(res.rows[0].forgotten_at).not.toBeNull();
  });

  it('leaves karma_records byte-for-byte unchanged (reason + points)', async () => {
    const res = await query(`SELECT points, reason FROM reputation.karma_records WHERE id = $1`, [karmaId]);
    expect(res.rows[0].points).toBe(50);
    expect(res.rows[0].reason).toBe('Provided help');
  });

  it('keeps the match row of the completed exchange (the aggregate survives)', async () => {
    const res = await query(`SELECT 1 FROM requests.matches WHERE id = $1`, [completedMatchId]);
    expect(res.rows.length).toBe(1);
  });

  it('hard-deletes the expired + unmatched request', async () => {
    const res = await query(`SELECT 1 FROM requests.help_requests WHERE id = $1`, [expiredUnmatchedId]);
    expect(res.rows.length).toBe(0);
  });

  it('does NOT hard-delete the expired + matched request', async () => {
    const res = await query(`SELECT 1 FROM requests.help_requests WHERE id = $1`, [expiredMatchedId]);
    expect(res.rows.length).toBe(1);
  });
});
