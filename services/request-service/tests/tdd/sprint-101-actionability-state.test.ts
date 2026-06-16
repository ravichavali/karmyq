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

  let sisterCommunityId: string; // viewer NOT a member, but sister-linked to communityId

  let awaitingRequestId: string; // open ask the viewer offered on (proposed) — twice
  let ownRequestId: string; // open ask owned by the viewer
  let canOfferRequestId: string; // open ask in viewer's community, no match
  let completedRequestId: string; // completed ask
  let expiredOpenRequestId: string; // status=open but expired=TRUE
  let nonMemberCommunityRequestId: string; // community-scoped ask in a community the viewer is NOT in → out of audience
  let wideScopeRequestId: string; // platform-scoped ask in the other community → cross-community reachable
  let sisterRequestId: string; // community-scoped ask in a sister-linked community → reachable via link

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
    opts: { status?: string; expired?: boolean; communityId?: string; visibilityScope?: string } = {}
  ): Promise<string> {
    const status = opts.status ?? 'open';
    const expired = opts.expired ?? false;
    const cid = opts.communityId ?? communityId;
    const scope = opts.visibilityScope ?? 'community';
    const r = await query(
      `INSERT INTO requests.help_requests (requester_id, request_type, category, title, description, status, urgency, expired, visibility_scope, payload)
       VALUES ($1,'generic','generic',$2,$3,$4,'medium',$5,$6,'{}') RETURNING id`,
      [ownerId, title, 's101 ask', status, expired, scope]
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
    sisterCommunityId = (
      await query(`INSERT INTO communities.communities (name, description) VALUES ($1,$2) RETURNING id`, ['S101 Sister Community', 's101 sister'])
    ).rows[0].id;

    // Viewer + requester are active members of the main community. Requester is also a member of
    // "other" and "sister" (so they can own asks there). Viewer is NOT a member of "other"/"sister".
    await query(
      `INSERT INTO communities.members (community_id, user_id, role, status, joined_at) VALUES
         ($1,$2,'member','active', NOW() - INTERVAL '3 days'),
         ($1,$3,'member','active', NOW() - INTERVAL '3 days'),
         ($4,$3,'member','active', NOW() - INTERVAL '3 days'),
         ($5,$3,'member','active', NOW() - INTERVAL '3 days')`,
      [communityId, viewerId, requesterId, otherCommunityId, sisterCommunityId]
    );

    // Active sister link between the viewer's community and the sister community, with feeds shared.
    await query(
      `INSERT INTO communities.community_links (community_a_id, community_b_id, link_type, status, show_in_sister_feeds)
       VALUES ($1,$2,'sister','active',TRUE)`,
      [communityId, sisterCommunityId]
    );

    awaitingRequestId = await seedAsk(requesterId, 'Ceiling fan install');
    // TWO proposed match rows on the SAME ask: count must stay DISTINCT (1), preview dedupes to 1 item.
    await seedProposedMatch(awaitingRequestId, viewerId);
    await seedProposedMatch(awaitingRequestId, viewerId);

    ownRequestId = await seedAsk(viewerId, 'My own open ask');
    canOfferRequestId = await seedAsk(requesterId, 'Ride to appointment');
    completedRequestId = await seedAsk(requesterId, 'Completed ask', { status: 'completed' });
    expiredOpenRequestId = await seedAsk(requesterId, 'Expired open ask', { status: 'open', expired: true });
    // Community-scoped ask in a community the viewer is NOT in, with no sister link → out of audience.
    nonMemberCommunityRequestId = await seedAsk(requesterId, 'Non-member community ask', { communityId: otherCommunityId });
    // Platform-scoped ask in the other community → visible cross-community to anyone.
    wideScopeRequestId = await seedAsk(requesterId, 'Platform-scope ask', { communityId: otherCommunityId, visibilityScope: 'platform' });
    // Community-scoped ask in a sister-linked community → reachable via the active link.
    sisterRequestId = await seedAsk(requesterId, 'Sister-linked ask', { communityId: sisterCommunityId });
  });

  afterAll(async () => {
    // Delete matches by request_id too — the write-path test creates matches via POST /matches whose
    // ids aren't tracked in createdMatchIds.
    await query(`DELETE FROM requests.matches WHERE request_id = ANY($1)`, [createdRequestIds]).catch(() => {});
    await query(`DELETE FROM requests.matches WHERE id = ANY($1)`, [createdMatchIds]).catch(() => {});
    await query(`DELETE FROM requests.request_communities WHERE request_id = ANY($1)`, [createdRequestIds]).catch(() => {});
    await query(`DELETE FROM requests.help_requests WHERE id = ANY($1)`, [createdRequestIds]).catch(() => {});
    await query(`DELETE FROM communities.community_links WHERE community_a_id = ANY($1) OR community_b_id = ANY($1)`, [[communityId, otherCommunityId, sisterCommunityId]]).catch(() => {});
    await query(`DELETE FROM communities.members WHERE community_id = ANY($1)`, [[communityId, otherCommunityId, sisterCommunityId]]).catch(() => {});
    await query(`DELETE FROM communities.communities WHERE id = ANY($1)`, [[communityId, otherCommunityId, sisterCommunityId]]).catch(() => {});
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

    // Eligibility follows the request's feed-VISIBILITY boundary, not membership and not "any UUID".
    // A COMMUNITY-scoped ask in a community the viewer isn't in (no sister link) is out of audience →
    // not_actionable (the feed could never show it to them; a direct id must not unlock an Offer).
    const nonMemberCommunity = await request(appAs(viewerId, member)).get(`/requests/${nonMemberCommunityRequestId}`);
    expect(nonMemberCommunity.status).toBe(200);
    expect(nonMemberCommunity.body.data.viewer_relation).toBe('not_actionable');

    // A PLATFORM-scoped ask in another community IS within the audience cross-community → can_offer.
    const wideScope = await request(appAs(viewerId, member)).get(`/requests/${wideScopeRequestId}`);
    expect(wideScope.status).toBe(200);
    expect(wideScope.body.data.viewer_relation).toBe('can_offer');

    // A community-scoped ask in a SISTER-linked community is reachable via the link → can_offer.
    const sister = await request(appAs(viewerId, member)).get(`/requests/${sisterRequestId}`);
    expect(sister.status).toBe(200);
    expect(sister.body.data.viewer_relation).toBe('can_offer');
  });

  // Write-path = visibility boundary + lifecycle invariants (runs last so the can_offer read
  // assertions above see no fresh match). POST /matches shares getRequestReachability() with the read
  // path, then enforces JWT identity, open + unexpired, not-own, no-duplicate.
  it('POST /matches enforces the visibility boundary + invariants (identity/open/unexpired/own/dup)', async () => {
    // Forged body responder_id is ignored — the offer is recorded under the authenticated viewer.
    // canOfferRequest is in the viewer's own community (member) → reachable.
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

    // Expired-open ask → 400.
    const expired = await request(matchesAppAs(viewerId))
      .post('/matches')
      .send({ request_id: expiredOpenRequestId });
    expect(expired.status).toBe(400);
    expect(expired.body.error).toBe('REQUEST_NOT_OPEN');

    // Out-of-audience: community-scoped ask in a community the viewer isn't in → 403, NOT a silent
    // success. This is the regression guard against "any open request id is offerable".
    const outOfAudience = await request(matchesAppAs(viewerId))
      .post('/matches')
      .send({ request_id: nonMemberCommunityRequestId });
    expect(outOfAudience.status).toBe(403);
    expect(outOfAudience.body.error).toBe('REQUEST_NOT_REACHABLE');

    // Platform-scope cross-community ask → offerable (201).
    const wideScope = await request(matchesAppAs(viewerId))
      .post('/matches')
      .send({ request_id: wideScopeRequestId });
    expect(wideScope.status).toBe(201);
    expect(wideScope.body.data.responder_id).toBe(viewerId);

    // Sister-linked community ask → offerable (201).
    const sister = await request(matchesAppAs(viewerId))
      .post('/matches')
      .send({ request_id: sisterRequestId });
    expect(sister.status).toBe(201);

    // Own request → 400.
    const own = await request(matchesAppAs(viewerId))
      .post('/matches')
      .send({ request_id: ownRequestId });
    expect(own.status).toBe(400);
    expect(own.body.error).toBe('OWN_REQUEST');
  });
});
