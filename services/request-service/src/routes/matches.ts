import { Router, Request, Response } from 'express';
import { AuthenticatedRequest } from '@karmyq/shared/middleware/auth';
import { query, withTransaction } from '../database/db';
import { getRequestReachability } from '../db/eligibility';
import { publishEvent } from '../events/publisher';
import {
  sendSuccess,
  sendInternalError,
  HTTP_STATUS
} from '@karmyq/shared/utils/response';

const router = Router();

// GET /matches - Get all matches
router.get('/', async (req: Request, res: Response) => {
  try {
    const { request_id, offer_id, status, user_id, limit = 50, offset = 0 } = req.query;

    let queryText = `
      SELECT
        m.id, m.request_id, m.offer_id, m.responder_id, m.status, m.created_at, m.completed_at,
        m.requester_done_at, m.responder_done_at,
        m.scheduled_at, m.travel_time_minutes, m.admin_proposed,
        r.title as request_title, r.description as request_description, r.category as request_category,
        r.request_type, r.payload,
        r.requester_id, req_user.name as requester_name,
        o.title as offer_title,
        o.offerer_id, help_user.name as helper_name,
        resp_user.name as responder_name
      FROM requests.matches m
      LEFT JOIN requests.help_requests r ON m.request_id = r.id
      LEFT JOIN requests.help_offers o ON m.offer_id = o.id
      LEFT JOIN auth.users req_user ON r.requester_id = req_user.id
      LEFT JOIN auth.users help_user ON o.offerer_id = help_user.id
      LEFT JOIN auth.users resp_user ON m.responder_id = resp_user.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramCount = 1;

    if (request_id) {
      queryText += ` AND m.request_id = $${paramCount}`;
      params.push(request_id);
      paramCount++;
    }

    if (offer_id) {
      queryText += ` AND m.offer_id = $${paramCount}`;
      params.push(offer_id);
      paramCount++;
    }

    if (status) {
      queryText += ` AND m.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (user_id) {
      queryText += ` AND (r.requester_id = $${paramCount} OR m.responder_id = $${paramCount})`;
      params.push(user_id);
      paramCount++;
    }

    queryText += ` ORDER BY m.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    sendSuccess(res, {
      matches: result.rows,
      count: result.rowCount,
      total: result.rowCount,
    }, HTTP_STATUS.OK, { requestId: (req as any).id });
  } catch (error: any) {
    (req as any).logger?.error('Error fetching matches', error instanceof Error ? error : new Error(String(error)), { service: 'request-service' });
    sendInternalError(res, 'Failed to fetch matches', error instanceof Error ? error : undefined, { requestId: (req as any).id });
  }
});

// GET /matches/:id - Get specific match
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT
        m.id, m.request_id, m.offer_id, m.responder_id, m.status,
        m.scheduled_at, m.travel_time_minutes,
        m.created_at, m.completed_at,
        r.title as request_title, r.description as request_description,
        r.category as request_category, r.request_type, r.payload, r.requester_id,
        req_user.name as requester_name, req_user.email as requester_email,
        o.title as offer_title, o.description as offer_description,
        o.offerer_id,
        help_user.name as helper_name, help_user.email as helper_email
      FROM requests.matches m
      LEFT JOIN requests.help_requests r ON m.request_id = r.id
      LEFT JOIN requests.help_offers o ON m.offer_id = o.id
      LEFT JOIN auth.users req_user ON r.requester_id = req_user.id
      LEFT JOIN auth.users help_user ON o.offerer_id = help_user.id
      WHERE m.id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Match not found',
      });
    }

    sendSuccess(res, result.rows[0]);
  } catch (error: any) {
    (req as any).logger?.error('Error fetching match', error instanceof Error ? error : new Error(String(error)), { service: 'request-service' });
    sendInternalError(res, 'Failed to fetch match', error instanceof Error ? error : undefined);
  }
});

// POST /matches - Create a member's offer to help (self-offer).
//
// Eligibility-to-offer follows the request's feed VISIBILITY boundary (can the feed ever show this
// ask to this viewer?), shared with the read path via getRequestReachability(): a member of a request
// community (community scope), any viewer for trust_network/platform scope, or a viewer reachable via
// an active sister-community link. That boundary is deterministic; the feed's stochastic explore/
// exploit RANKING within the visible set is NOT re-gated here. On top of visibility, the mutation
// enforces the lifecycle invariants that must hold however the user reached the ask: verified JWT
// identity (ADR-064, never a body responder_id), open + unexpired, not the user's own, no duplicate.
// Admin-proposed matches use POST /requests/:id/propose-match (adminActions), not this route.
router.post('/', async (req: Request, res: Response) => {
  try {
    const responder_id = (req as any).user?.userId;
    const { request_id, offer_id } = req.body;

    if (!responder_id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (!request_id) {
      return res.status(400).json({ success: false, message: 'request_id is required' });
    }

    const reachability = await getRequestReachability(request_id, responder_id);

    if (!reachability.exists) {
      return res.status(404).json({
        success: false,
        message: 'Request not found',
      });
    }

    // Request must be open and unexpired (expired-open asks are not actionable).
    if (reachability.status !== 'open' || reachability.expired === true) {
      return res.status(400).json({
        success: false,
        message: 'Request is not open',
        error: 'REQUEST_NOT_OPEN',
      });
    }

    // Self-match guard: a requester cannot offer on their own request.
    if (reachability.requesterId === responder_id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot offer on your own request',
        error: 'OWN_REQUEST',
      });
    }

    // Visibility boundary: the ask must be within the viewer's feed-visibility audience. A
    // community-scoped ask the viewer can't see (non-member, no sister link) is not offerable even
    // with a direct id — that would leak past the request's chosen audience.
    if (!reachability.reachable) {
      return res.status(403).json({
        success: false,
        message: 'This request is not available to you',
        error: 'REQUEST_NOT_REACHABLE',
      });
    }

    // Duplicate guard: one live offer per responder per request (matches has no unique
    // (request_id, responder_id), so enforce it here — best-effort against a racing double-submit).
    const dupeCheck = await query(
      `SELECT 1 FROM requests.matches
        WHERE request_id = $1 AND responder_id = $2 AND status IN ('proposed', 'matched')
        LIMIT 1`,
      [request_id, responder_id]
    );
    if (dupeCheck.rowCount! > 0) {
      return res.status(409).json({
        success: false,
        message: 'You have already offered to help on this request',
        error: 'ALREADY_OFFERED',
      });
    }

    // Verify offer exists and is active (if provided), and belongs to the responder.
    if (offer_id) {
      const offerCheck = await query(
        `SELECT id, status, offerer_id FROM requests.help_offers WHERE id = $1`,
        [offer_id]
      );

      if (offerCheck.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Offer not found',
        });
      }

      if (offerCheck.rows[0].status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Offer is not active',
        });
      }

      // The linked offer must belong to the responder (the JWT identity).
      if (offerCheck.rows[0].offerer_id !== responder_id) {
        return res.status(403).json({
          success: false,
          message: 'Offer must belong to the responder',
        });
      }
    }

    // Create match
    const matchResult = await query(
      `INSERT INTO requests.matches
        (request_id, offer_id, responder_id, status)
      VALUES ($1, $2, $3, 'proposed')
      RETURNING *`,
      [request_id, offer_id ?? null, responder_id]
    );

    const match = matchResult.rows[0];

    // Don't update request status here - only update when match is accepted
    // (Request stays 'open' until someone accepts an offer)

    // Update offer status if provided
    if (offer_id) {
      await query(
        `UPDATE requests.help_offers SET status = 'matched' WHERE id = $1`,
        [offer_id]
      );
    }

    // Publish event
    await publishEvent('match_created', {
      match_id: match.id,
      request_id,
      offer_id,
      requester_id: reachability.requesterId,
      responder_id,
    });

    // Fire-and-forget: log offer_made to feed_events
    setImmediate(() => {
      void query(
        `INSERT INTO requests.feed_events (user_id, request_id, event_type)
         VALUES ($1, $2, 'offer_made')
         ON CONFLICT DO NOTHING`,
        [responder_id, request_id]
      ).catch((e: any) => (req as any).logger?.error('feed-offer-log failed', e instanceof Error ? e : new Error(String(e)), { service: 'request-service', step: 'feed-offer-log' }));
    });

    sendSuccess(res, match, HTTP_STATUS.CREATED);
  } catch (error: any) {
    (req as any).logger?.error('Error creating match', error instanceof Error ? error : new Error(String(error)), { service: 'request-service' });
    sendInternalError(res, 'Failed to create match', error instanceof Error ? error : undefined);
  }
});

// PUT /matches/:id/accept - Accept a proposed match
router.put('/:id/accept', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    // ADR-064: authorize from the verified JWT identity, never a client-supplied
    // body field. `body.user_id` (if any) is ignored. `travel_time_minutes` is
    // legitimate scheduling input and still comes from the body.
    const user_id = req.user!.userId;
    const { travel_time_minutes = 60 } = req.body;

    // Get match details
    const matchCheck = await query(
      `SELECT
        m.id, m.request_id, m.offer_id, m.responder_id, m.status, m.admin_proposed,
        r.requester_id
      FROM requests.matches m
      LEFT JOIN requests.help_requests r ON m.request_id = r.id
      WHERE m.id = $1`,
      [id]
    );

    if (matchCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Match not found',
      });
    }

    const match = matchCheck.rows[0];

    // For admin-proposed matches the suggested helper accepts; for normal offers the requester accepts
    if (match.admin_proposed) {
      if (match.responder_id !== user_id) {
        return res.status(403).json({
          success: false,
          message: 'Only the suggested helper can accept this match',
        });
      }
    } else {
      if (match.requester_id !== user_id) {
        return res.status(403).json({
          success: false,
          message: 'Only the requester can accept this match',
        });
      }
    }

    // Verify match is in proposed state
    if (match.status !== 'proposed') {
      return res.status(400).json({
        success: false,
        message: 'Match must be in proposed state to accept',
      });
    }

    // Fetch request payload to extract scheduled_at for structured types (e.g. ride departure_time)
    const requestData = await query(
      `SELECT request_type, payload FROM requests.help_requests WHERE id = $1`,
      [match.request_id]
    );
    const req_payload = requestData.rows[0];
    let scheduled_at: string | null = null;
    if (req_payload?.request_type === 'ride' && req_payload?.payload?.departure_time) {
      scheduled_at = req_payload.payload.departure_time;
    }

    // Atomic accept: match → request → free sibling offers → reject siblings, all in
    // one transaction so a mid-sequence failure can't split match/request/offer state.
    const result = await withTransaction(async (q) => {
      // Serialize concurrent accepts on the SAME request by locking the request row
      // first. Without this, two sibling proposed matches could both read 'proposed'
      // and both commit as 'matched'. The lock makes the two accepts run one-at-a-time.
      await q(
        `SELECT id FROM requests.help_requests WHERE id = $1 FOR UPDATE`,
        [match.request_id]
      );

      // Accept THIS match only if it is still proposed. The row-count guard turns a
      // lost race (the sibling won and rejected this match) into a clean 409.
      const accepted = await q(
        `UPDATE requests.matches
         SET status = 'matched', scheduled_at = $2, travel_time_minutes = $3
         WHERE id = $1 AND status = 'proposed'`,
        [id, scheduled_at, travel_time_minutes]
      );
      if (accepted.rowCount === 0) {
        return { conflict: true as const };
      }

      // Update request status to matched
      await q(
        `UPDATE requests.help_requests
         SET status = 'matched'
         WHERE id = $1`,
        [match.request_id]
      );

      // Free the offers of the sibling matches we're about to reject so those
      // helpers re-enter the active pool (BUG-008). Run BEFORE the reject UPDATE so
      // the subquery still sees the siblings as 'proposed'.
      await q(
        `UPDATE requests.help_offers
         SET status = 'active'
         WHERE id IN (
           SELECT offer_id FROM requests.matches
           WHERE request_id = $1 AND id != $2 AND status = 'proposed' AND offer_id IS NOT NULL
         )`,
        [match.request_id, id]
      );

      // Reject all other proposed matches for this request
      await q(
        `UPDATE requests.matches
         SET status = 'rejected'
         WHERE request_id = $1 AND id != $2 AND status = 'proposed'`,
        [match.request_id, id]
      );

      // Fetch enriched match data for response (includes payload for frontend fulfillment panel)
      const enriched = await q(
        `SELECT m.*, r.request_type, r.payload, r.title as request_title
         FROM requests.matches m
         JOIN requests.help_requests r ON m.request_id = r.id
         WHERE m.id = $1`,
        [id]
      );
      return { enriched };
    });

    // Lost the race: a sibling match was accepted first (this one is now rejected).
    if ('conflict' in result) {
      return res.status(409).json({
        success: false,
        message: 'This request was just matched with someone else',
        error: 'ALREADY_MATCHED',
      });
    }

    // Publish event
    await publishEvent('match_accepted', {
      match_id: id,
      request_id: match.request_id,
      requester_id: match.requester_id,
      responder_id: match.responder_id,
      request_type: req_payload?.request_type,
      scheduled_at,
    });

    res.json({
      success: true,
      message: 'Match accepted successfully',
      data: result.enriched.rows[0],
    });
  } catch (error: any) {
    (req as any).logger?.error('Error accepting match', error instanceof Error ? error : new Error(String(error)), { service: 'request-service' });
    res.status(500).json({
      success: false,
      message: 'Failed to accept match',
      error: error.message,
    });
  }
});

// PUT /matches/:id/reject - Reject a proposed match
router.put('/:id/reject', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    // ADR-064: authorize from the verified JWT identity, never `body.user_id`.
    const user_id = req.user!.userId;

    // Get match details
    const matchCheck = await query(
      `SELECT
        m.id, m.request_id, m.offer_id, m.status, m.responder_id,
        r.requester_id
      FROM requests.matches m
      LEFT JOIN requests.help_requests r ON m.request_id = r.id
      WHERE m.id = $1`,
      [id]
    );

    if (matchCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Match not found',
      });
    }

    const match = matchCheck.rows[0];

    // Verify user is a match participant
    if (match.requester_id !== user_id && match.responder_id !== user_id) {
      return res.status(403).json({
        success: false,
        message: 'Only match participants can reject or withdraw.',
      });
    }

    // Atomic reject: mark rejected → free the linked offer → reopen the request when
    // no proposed matches remain, all in one transaction so a mid-sequence failure
    // can't strand the offer or split match/request state.
    const rejected = await withTransaction(async (q) => {
      // Serialize against a concurrent accept on the same request (accept locks the
      // same row), so reject can never run between accept's read and commit.
      await q(
        `SELECT id FROM requests.help_requests WHERE id = $1 FOR UPDATE`,
        [match.request_id]
      );

      // Reject only while still proposed. Without the status guard a reject racing an
      // accept could flip an accepted (or completed) match back to 'rejected' and
      // reopen a request that is already matched.
      const result = await q(
        `UPDATE requests.matches
         SET status = 'rejected'
         WHERE id = $1 AND status = 'proposed'`,
        [id]
      );
      if (result.rowCount === 0) {
        return false;
      }

      // Free the linked offer back to the active pool so the helper re-enters
      // matching (mirrors the cancel path). Without this the offer is stranded in
      // 'matched' forever and the helper silently disappears from /offers (BUG-008).
      if (match.offer_id) {
        await q(
          `UPDATE requests.help_offers SET status = 'active' WHERE id = $1`,
          [match.offer_id]
        );
      }

      // Check if there are any remaining proposed matches
      const remainingMatches = await q(
        `SELECT COUNT(*) as count FROM requests.matches
         WHERE request_id = $1 AND status = 'proposed'`,
        [match.request_id]
      );

      // If no more proposed matches, reopen the request — but never reopen one that a
      // concurrent accept just transitioned to 'matched'.
      if (remainingMatches.rows[0].count === '0') {
        await q(
          `UPDATE requests.help_requests SET status = 'open' WHERE id = $1 AND status != 'matched'`,
          [match.request_id]
        );
      }
      return true;
    });

    // The match left 'proposed' before we got the lock (accepted/completed/cancelled
    // concurrently, or already rejected) — nothing to reject.
    if (!rejected) {
      return res.status(409).json({
        success: false,
        message: 'Match is no longer awaiting a response',
        error: 'MATCH_NOT_PROPOSED',
      });
    }

    // Publish event
    await publishEvent('match_rejected', {
      match_id: id,
      request_id: match.request_id,
    });

    res.json({
      success: true,
      message: 'Match rejected successfully',
    });
  } catch (error: any) {
    (req as any).logger?.error('Error rejecting match', error instanceof Error ? error : new Error(String(error)), { service: 'request-service' });
    res.status(500).json({
      success: false,
      message: 'Failed to reject match',
      error: error.message,
    });
  }
});

// PUT /matches/:id/complete - Mark match as completed
router.put('/:id/complete', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    // ADR-064: authorize from the verified JWT identity, never `body.user_id`.
    // `complete` is the highest-impact action — a forged completion publishes
    // `match_completed`, which awards karma.
    const user_id = req.user!.userId;

    // Get match details
    const matchCheck = await query(
      `SELECT
        m.id, m.request_id, m.offer_id, m.responder_id, m.status,
        r.requester_id,
        o.offerer_id
      FROM requests.matches m
      LEFT JOIN requests.help_requests r ON m.request_id = r.id
      LEFT JOIN requests.help_offers o ON m.offer_id = o.id
      WHERE m.id = $1`,
      [id]
    );

    if (matchCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Match not found',
      });
    }

    const match = matchCheck.rows[0];

    // Verify user is requester or responder
    if (match.requester_id !== user_id && match.responder_id !== user_id) {
      return res.status(403).json({
        success: false,
        message: 'Only the requester or responder can complete this match',
      });
    }

    const isRequester = match.requester_id === user_id;

    // Sprint 126: completing an already-completed match is IDEMPOTENT, not a second completion.
    //
    // `m.status` was selected here and never checked, so a participant could call this repeatedly.
    // Each call re-stamped `completed_at = CURRENT_TIMESTAMP` and re-published `match_completed`.
    // On its own that mostly re-awarded karma; since ADR-096 the projection identity makes the
    // repeat award a no-op — but the moving `completed_at` is worse than the duplicate was. It
    // shifts the strictly-before as-of boundary, so a replay can select a different top-3 community
    // set or cross a 10/50/100 milestone it had not crossed, producing rows under NEW identities
    // the unique index cannot absorb. It also makes stored rows disagree with what replay derives,
    // which the backfill reports as a BLOCKING CONFLICTING_KARMA_PROJECTION anomaly — i.e. one
    // double-click could refuse the whole standing backfill.
    //
    // Returning success rather than 409 keeps retrying clients working; the completion they asked
    // for is, after all, already true.
    if (match.status === 'completed') {
      return res.json({
        success: true,
        data: { fully_completed: true, waiting_for: null },
        message: 'Match already completed',
      });
    }

    const doneAtColumn = isRequester ? 'requester_done_at' : 'responder_done_at';

    // Atomic completion: record this party's done_at and, when both parties have now
    // confirmed, finalize the match + request together so completion can never leave
    // the match 'completed' while the request lags (or vice versa).
    const bothDone = await withTransaction(async (q) => {
      // Use a RETURNING clause to get both done_at values in a single statement so we
      // can check if both parties have now confirmed.
      const updateResult = await q(
        `UPDATE requests.matches
         SET ${doneAtColumn} = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING requester_done_at, responder_done_at`,
        [id]
      );

      const updated = updateResult.rows[0];
      const finished = updated.requester_done_at !== null && updated.responder_done_at !== null;

      if (finished) {
        // Both parties have confirmed — finalize the match
        await q(
          `UPDATE requests.matches
           SET status = 'completed', completed_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [id]
        );

        await q(
          `UPDATE requests.help_requests SET status = 'completed' WHERE id = $1`,
          [match.request_id]
        );
      }
      return finished;
    });

    if (bothDone) {
      // Publish event once, only when fully complete (karma is awarded here). After
      // commit so we never publish on a rolled-back completion.
      await publishEvent('match_completed', {
        match_id: id,
        request_id: match.request_id,
        offer_id: match.offer_id,
        requester_id: match.requester_id,
        responder_id: match.responder_id,
      });

      // Fire-and-forget: log match_completed to feed_events (for the helper)
      void query(
        `INSERT INTO requests.feed_events (user_id, request_id, event_type)
         VALUES ($1, $2, 'match_completed')
         ON CONFLICT DO NOTHING`,
        [match.responder_id, match.request_id]
      ).catch((e: any) => (req as any).logger?.error('feed-completion-log failed', e instanceof Error ? e : new Error(String(e)), { service: 'request-service', step: 'feed-completion-log' }));
    }

    res.json({
      success: true,
      // Let the frontend know whether the match is fully done or still waiting
      // for the other party. The frontend uses this to decide what copy to show.
      data: {
        fully_completed: bothDone,
        waiting_for: bothDone ? null : (isRequester ? 'helper' : 'requester'),
      },
      message: bothDone
        ? 'Match completed successfully'
        : 'Your completion recorded — waiting for the other party',
    });
  } catch (error: any) {
    (req as any).logger?.error('Error completing match', error instanceof Error ? error : new Error(String(error)), { service: 'request-service' });
    res.status(500).json({
      success: false,
      message: 'Failed to complete match',
      error: error.message,
    });
  }
});

// DELETE /matches/:id - Cancel match
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    // ADR-064: authorize from the verified JWT identity, never `body.user_id`.
    const user_id = req.user!.userId;

    // Get match details
    const matchCheck = await query(
      `SELECT
        m.id, m.request_id, m.offer_id, m.responder_id,
        r.requester_id,
        o.offerer_id
      FROM requests.matches m
      LEFT JOIN requests.help_requests r ON m.request_id = r.id
      LEFT JOIN requests.help_offers o ON m.offer_id = o.id
      WHERE m.id = $1`,
      [id]
    );

    if (matchCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Match not found',
      });
    }

    const match = matchCheck.rows[0];

    // Verify user is requester or responder
    if (match.requester_id !== user_id && match.responder_id !== user_id) {
      return res.status(403).json({
        success: false,
        message: 'Only the requester or responder can cancel this match',
      });
    }

    // Atomic cancel: cancel the match → reopen the request → reopen the offer, all in
    // one transaction so a mid-sequence failure can't split match/request/offer state.
    await withTransaction(async (q) => {
      await q(
        `UPDATE requests.matches
         SET status = 'cancelled'
         WHERE id = $1`,
        [id]
      );

      await q(
        `UPDATE requests.help_requests SET status = 'open' WHERE id = $1`,
        [match.request_id]
      );

      // Reopen offer if it exists
      if (match.offer_id) {
        await q(
          `UPDATE requests.help_offers SET status = 'active' WHERE id = $1`,
          [match.offer_id]
        );
      }
    });

    // Publish event
    await publishEvent('match_cancelled', {
      match_id: id,
      request_id: match.request_id,
      offer_id: match.offer_id,
    });

    res.json({
      success: true,
      message: 'Match cancelled successfully',
    });
  } catch (error: any) {
    (req as any).logger?.error('Error cancelling match', error instanceof Error ? error : new Error(String(error)), { service: 'request-service' });
    res.status(500).json({
      success: false,
      message: 'Failed to cancel match',
      error: error.message,
    });
  }
});

export default router;
