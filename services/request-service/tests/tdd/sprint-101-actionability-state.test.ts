/**
 * Sprint 101 — Actionability + State Truth (integration).
 *
 * Two server-side truths this sprint adds to the request-service read models:
 *
 *  1. The Home feed (`GET /requests/curated?view=home`) keeps the `offeredAwaiting` count and now
 *     also returns `offeredAwaitingItems` — a small preview list selected from the SAME predicate
 *     (responder's proposed match on an open, unexpired ask), deduped by `request_id`. A helper can
 *     have more than one proposed match row on the same ask (matches has no unique (request_id,
 *     responder_id)); the count is DISTINCT by request and the preview must dedupe to one item per
 *     ask, so the headline number and the rendered items can never disagree.
 *
 *  2. `GET /requests/:id` becomes the canonical viewer-aware detail read. `viewer_relation` is
 *     derived server-side — never guessed by the UI — into one of:
 *       own_request | already_offered | can_offer | not_actionable
 *     `can_offer` requires the ask to be open, unexpired, not the viewer's own, the viewer to have no
 *     live proposed/matched responder match, and the viewer to be an active member of at least one of
 *     the request's communities. Expired-but-open asks and non-member open asks are `not_actionable`
 *     so the UI never shows an Offer button that would 403 on click.
 *
 * Robust-testing standard (Sprint 65+): no stubs for the logic under test (the predicates live in
 * SQL); assert exact values against seeded rows. DB-backed like the rest of the request-service TDD
 * suite — runs in CI / the deploy integration step. Locally without a DB it fails on connection,
 * which is expected.
 */

import express from 'express';
import request from 'supertest';
import { query } from '../../src/database/db';
import requestsRouter from '../../src/routes/requests';
import matchesRouter from '../../src/routes/matches';

describe('Sprint 101: offered-awaiting items + request detail viewer relation (integration)', () => {
  let communityId: string;
  let otherCommunityId: string; // viewer is NOT a member of this one
  let viewerId: string; // the caller
  let requesterId: string; // owns the asks the viewer offered on / can offer on

  let awaitingRequestId: string; // open ask the viewer offered on (proposed) — twice
  let ownRequestId: string; // open ask owned by the viewer
  let canOfferRequestId: string; // open ask in viewer's community, no match
  let completedRequestId: string; // completed ask
  let expiredOpenRequestId: string; // status=open but expired=TRUE
  let nonMemberOpenRequestId: string; // open ask in a community the viewer is not in

  const createdRequestIds: string[] = [];
  const createdMatchIds: string[] = [];

  function appAs(userId: string, communities: Array<{ id: string; name: string; role: string }> = []) {
    const app = express();
    app.use(express.json());
    app.use((req: any, _res: any, next: any) => {
      req.user = { userId, email: 'u@test.com', communities };
      next();
    });
    app.use('/requests', requestsRouter);
    return app;
  }

  /** A matches app authenticated as `userId` — the write path (POST /matches) for offers. */
  function matchesAppAs(userId: string) {
    const app = express();
    app.use(express.json());
    app.use((req: any, _res: any, next: any) => {
      req.user = { userId, email: 'u@test.com', communities: [] };
      next();
    });
    app.use('/matches', matchesRouter);
    return app;
  }

  async function seedAsk(
    ownerId: string,
    title: string,
    opts: { status?: string; expired?: boolean; communityId?: string } = {}
  ): Promise<string> {
    const status = opts.status ?? 'open';
    const expired = opts.expired ?? false;
    const cid = opts.communityId ?? communityId;
    const r = await query(
      `INSERT INTO requests.help_requests (requester_id, request_type, category, title, description, status, urgency, expired, payload)
       VALUES ($1,'generic','generic',$2,$3,$4,'medium',$5,'{}') RETURNING id`,
      [ownerId, title, 's101 ask', status, expired]
    );
    createdRequestIds.push(r.rows[0].id);
    await query(`INSERT INTO requests.request_communities (request_id, community_id) VALUES ($1,$2)`, [r.rows[0].id, cid]);
    return r.rows[0].id;
  }

  async function seedProposedMatch(reqId: string, responderId: string): Promise<string> {
    const m = await query(
      `INSERT INTO requests.matches (request_id, responder_id, status) VALUES ($1,$2,'proposed') RETURNING id`,
      [reqId, responderId]
    );
    createdMatchIds.push(m.rows[0].id);
    return m.rows[0].id;
  }

  beforeAll(async () => {
    const mk = async (email: string, name: string) =>
      (await query(`INSERT INTO auth.users (email, name, password_hash) VALUES ($1,$2,'hash') RETURNING id`, [email, name])).rows[0].id;

    viewerId = await mk('s101-viewer@example.com', 'S101 Viewer');
    requesterId = await mk('s101-requester@example.com', 'S101 Requester');

    communityId = (
      await query(`INSERT INTO communities.communities (name, description) VALUES ($1,$2) RETURNING id`, ['S101 Actionability Community', 's101'])
    ).rows[0].id;
    otherCommunityId = (
      await query(`INSERT INTO communities.communities (name, description) VALUES ($1,$2) RETURNING id`, ['S101 Other Community', 's101 other'])
    ).rows[0].id;

    // Viewer + requester are active members of the main community. Viewer is NOT a member of "other".
    await query(
      `INSERT INTO communities.members (community_id, user_id, role, status, joined_at) VALUES
         ($1,$2,'member','active', NOW() - INTERVAL '3 days'),
         ($1,$3,'member','active', NOW() - INTERVAL '3 days'),
         ($4,$3,'member','active', NOW() - INTERVAL '3 days')`,
      [communityId, viewerId, requesterId, otherCommunityId]
    );

    awaitingRequestId = await seedAsk(requesterId, 'Ceiling fan install');
    // TWO proposed match rows on the SAME ask: count must stay DISTINCT (1), preview dedupes to 1 item.
    await seedProposedMatch(awaitingRequestId, viewerId);
    await seedProposedMatch(awaitingRequestId, viewerId);

    ownRequestId = await seedAsk(viewerId, 'My own open ask');
    canOfferRequestId = await seedAsk(requesterId, 'Ride to appointment');
    completedRequestId = await seedAsk(requesterId, 'Completed ask', { status: 'completed' });
    expiredOpenRequestId = await seedAsk(requesterId, 'Expired open ask', { status: 'open', expired: true });
    nonMemberOpenRequestId = await seedAsk(requesterId, 'Non-member open ask', { communityId: otherCommunityId });
  });

  afterAll(async () => {
    // Delete matches by request_id too — the write-path test creates matches via POST /matches whose
    // ids aren't tracked in createdMatchIds.
    await query(`DELETE FROM requests.matches WHERE request_id = ANY($1)`, [createdRequestIds]).catch(() => {});
    await query(`DELETE FROM requests.matches WHERE id = ANY($1)`, [createdMatchIds]).catch(() => {});
    await query(`DELETE FROM requests.request_communities WHERE request_id = ANY($1)`, [createdRequestIds]).catch(() => {});
    await query(`DELETE FROM requests.help_requests WHERE id = ANY($1)`, [createdRequestIds]).catch(() => {});
    await query(`DELETE FROM communities.members WHERE community_id = ANY($1)`, [[communityId, otherCommunityId]]).catch(() => {});
    await query(`DELETE FROM communities.communities WHERE id = ANY($1)`, [[communityId, otherCommunityId]]).catch(() => {});
    await query(`DELETE FROM auth.users WHERE id = ANY($1)`, [[viewerId, requesterId]]).catch(() => {});
  });

  it('returns offeredAwaitingItems from the same distinct-open-ask predicate as offeredAwaiting', async () => {
    const member = [{ id: communityId, name: 'S101 Actionability Community', role: 'member' }];
    const res = await request(appAs(viewerId, member)).get('/requests/curated').query({ view: 'home', minScore: 0 });

    expect(res.status).toBe(200);
    expect(res.body.data.offeredAwaiting).toBe(1);
    expect(res.body.data.offeredAwaitingItems).toHaveLength(1);
    expect(res.body.data.offeredAwaitingItems[0]).toEqual(
      expect.objectContaining({
        request_id: awaitingRequestId,
        match_id: expect.any(String),
        status: 'proposed',
        title: 'Ceiling fan install',
      })
    );
  });

  it('derives viewer_relation server-side for each lifecycle state', async () => {
    const member = [{ id: communityId, name: 'S101 Actionability Community', role: 'member' }];

    const own = await request(appAs(viewerId, member)).get(`/requests/${ownRequestId}`);
    expect(own.status).toBe(200);
    expect(own.body.data.viewer_relation).toBe('own_request');

    const alreadyOffered = await request(appAs(viewerId, member)).get(`/requests/${awaitingRequestId}`);
    expect(alreadyOffered.status).toBe(200);
    expect(alreadyOffered.body.data.viewer_relation).toBe('already_offered');
    expect(alreadyOffered.body.data.viewer_match).toEqual(
      expect.objectContaining({ id: expect.any(String), status: 'proposed' })
    );

    const canOffer = await request(appAs(viewerId, member)).get(`/requests/${canOfferRequestId}`);
    expect(canOffer.status).toBe(200);
    expect(canOffer.body.data.viewer_relation).toBe('can_offer');

    const completed = await request(appAs(viewerId, member)).get(`/requests/${completedRequestId}`);
    expect(completed.status).toBe(200);
    expect(completed.body.data.viewer_relation).toBe('not_actionable');

    const expiredOpen = await request(appAs(viewerId, member)).get(`/requests/${expiredOpenRequestId}`);
    expect(expiredOpen.status).toBe(200);
    expect(expiredOpen.body.data.viewer_relation).toBe('not_actionable');

    // Eligibility-to-offer follows feed discoverability, NOT membership. An open, unexpired ask in a
    // community the viewer doesn't belong to is reachable cross-community (trust_network / platform /
    // sister tiers), so it is can_offer — not gated to members.
    const nonMemberOpen = await request(appAs(viewerId, member)).get(`/requests/${nonMemberOpenRequestId}`);
    expect(nonMemberOpen.status).toBe(200);
    expect(nonMemberOpen.body.data.viewer_relation).toBe('can_offer');
  });

  // Write-path INVARIANTS (runs last so the can_offer read assertions above see no fresh match):
  // POST /matches enforces only the invariants that must hold however the user reached the ask —
  // JWT identity, open + unexpired, not-own, no-duplicate. It does NOT re-gate on membership /
  // reachability (that's the feed's job, and it's personalized + non-deterministic).
  it('POST /matches enforces invariants (identity/open/unexpired/own/dup) and allows cross-community offers', async () => {
    // Forged body responder_id is ignored — the offer is recorded under the authenticated viewer.
    const forged = await request(matchesAppAs(viewerId))
      .post('/matches')
      .send({ request_id: canOfferRequestId, responder_id: requesterId });
    expect(forged.status).toBe(201);
    expect(forged.body.data.responder_id).toBe(viewerId);

    // Duplicate: viewer already has a live offer on this ask now → 409.
    const dupe = await request(matchesAppAs(viewerId))
      .post('/matches')
      .send({ request_id: canOfferRequestId });
    expect(dupe.status).toBe(409);
    expect(dupe.body.error).toBe('ALREADY_OFFERED');

    // Expired-open ask → not actionable on the write path.
    const expired = await request(matchesAppAs(viewerId))
      .post('/matches')
      .send({ request_id: expiredOpenRequestId });
    expect(expired.status).toBe(400);
    expect(expired.body.error).toBe('REQUEST_NOT_OPEN');

    // Cross-community: an open ask in a community the viewer is NOT a member of is offerable (201).
    // The feed is the discovery gate, not membership — this is the regression-guard for that rule.
    const crossCommunity = await request(matchesAppAs(viewerId))
      .post('/matches')
      .send({ request_id: nonMemberOpenRequestId });
    expect(crossCommunity.status).toBe(201);
    expect(crossCommunity.body.data.responder_id).toBe(viewerId);

    // Own request → 400.
    const own = await request(matchesAppAs(viewerId))
      .post('/matches')
      .send({ request_id: ownRequestId });
    expect(own.status).toBe(400);
    expect(own.body.error).toBe('OWN_REQUEST');
  });
});
