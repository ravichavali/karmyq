import { Router, Request, Response } from 'express';
import { query } from '../database/db';
import { publishEvent } from '../events/publisher';
import {
  sendSuccess,
  sendInternalError,
  HTTP_STATUS
} from '@karmyq/shared/utils/response';
// Temporarily commented out - matching feature
// import { findMatches } from '@karmyq/shared/matching';
// import type { UserProfile } from '@karmyq/shared/matching';

const router = Router();

// GET /matches - Get all matches
router.get('/', async (req: Request, res: Response) => {
  try {
    const { request_id, offer_id, status, user_id, limit = 50, offset = 0 } = req.query;

    let queryText = `
      SELECT
        m.id, m.request_id, m.offer_id, m.responder_id, m.status, m.created_at, m.completed_at,
        m.requester_done_at, m.responder_done_at,
        m.scheduled_at, m.travel_time_minutes,
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

    // Debug: Log first match to verify data structure
    if (result.rows.length > 0) {
      console.log('Sample match data:', {
        id: result.rows[0].id,
        requester_name: result.rows[0].requester_name,
        responder_name: result.rows[0].responder_name,
        request_description: result.rows[0].request_description ? 'present' : 'missing'
      });
    }

    sendSuccess(res, {
      matches: result.rows,
      count: result.rowCount,
      total: result.rowCount,
    }, HTTP_STATUS.OK, { requestId: (req as any).id });
  } catch (error: any) {
    console.error('Error fetching matches:', error);
    sendInternalError(res, 'Failed to fetch matches', error instanceof Error ? error : undefined, { requestId: (req as any).id });
  }
});

// Temporarily disabled - matching feature needs Docker rebuild
// GET /matches/find-candidates/:request_id - Find potential helpers for a request using matching algorithm
/*
router.get('/find-candidates/:request_id', async (req: Request, res: Response) => {
  // ... matching algorithm endpoint code ...
  // Commented out temporarily until shared package is available in Docker
});
*/
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

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    console.error('Error fetching match:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch match',
      error: error.message,
    });
  }
});

// POST /matches - Create a match
router.post('/', async (req: Request, res: Response) => {
  try {
    const { request_id, offer_id, responder_id } = req.body;

    if (!request_id || !responder_id) {
      return res.status(400).json({
        success: false,
        message: 'request_id and responder_id are required',
      });
    }

    // Verify request exists and is open
    const requestCheck = await query(
      `SELECT id, status, requester_id FROM requests.help_requests WHERE id = $1`,
      [request_id]
    );

    if (requestCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Request not found',
      });
    }

    if (requestCheck.rows[0].status !== 'open') {
      return res.status(400).json({
        success: false,
        message: 'Request is not open',
      });
    }

    // Verify offer exists and is active (if provided)
    let offerCheck = null;
    if (offer_id) {
      offerCheck = await query(
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

      // Verify responder is the offerer
      if (offerCheck.rows[0].offerer_id !== responder_id) {
        return res.status(403).json({
          success: false,
          message: 'responder_id must match the offerer_id',
        });
      }
    }

    // Create match
    const matchResult = await query(
      `INSERT INTO requests.matches
        (request_id, offer_id, responder_id, status)
      VALUES ($1, $2, $3, 'proposed')
      RETURNING *`,
      [request_id, offer_id, responder_id]
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
      requester_id: requestCheck.rows[0].requester_id,
      responder_id,
    });

    res.status(201).json({
      success: true,
      data: match,
      message: 'Match created successfully',
    });
  } catch (error: any) {
    console.error('Error creating match:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create match',
      error: error.message,
    });
  }
});

// PUT /matches/:id/accept - Accept a proposed match
router.put('/:id/accept', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { user_id, travel_time_minutes = 60 } = req.body;

    // Get match details
    const matchCheck = await query(
      `SELECT
        m.id, m.request_id, m.offer_id, m.responder_id, m.status,
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

    // Verify user is the requester
    if (match.requester_id !== user_id) {
      return res.status(403).json({
        success: false,
        message: 'Only the requester can accept this match',
      });
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

    // Accept match, store scheduling info
    await query(
      `UPDATE requests.matches
       SET status = 'matched', scheduled_at = $2, travel_time_minutes = $3
       WHERE id = $1`,
      [id, scheduled_at, travel_time_minutes]
    );

    // Update request status to matched
    await query(
      `UPDATE requests.help_requests
       SET status = 'matched'
       WHERE id = $1`,
      [match.request_id]
    );

    // Reject all other proposed matches for this request
    await query(
      `UPDATE requests.matches
       SET status = 'rejected'
       WHERE request_id = $1 AND id != $2 AND status = 'proposed'`,
      [match.request_id, id]
    );

    // Fetch enriched match data for response (includes payload for frontend fulfillment panel)
    const enriched = await query(
      `SELECT m.*, r.request_type, r.payload, r.title as request_title
       FROM requests.matches m
       JOIN requests.help_requests r ON m.request_id = r.id
       WHERE m.id = $1`,
      [id]
    );

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
      data: enriched.rows[0],
    });
  } catch (error: any) {
    console.error('Error accepting match:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept match',
      error: error.message,
    });
  }
});

// PUT /matches/:id/reject - Reject a proposed match
router.put('/:id/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    // Get match details
    const matchCheck = await query(
      `SELECT
        m.id, m.request_id, m.status,
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

    // Verify user is the requester
    if (match.requester_id !== user_id) {
      return res.status(403).json({
        success: false,
        message: 'Only the requester can reject this match',
      });
    }

    // Reject match
    await query(
      `UPDATE requests.matches
       SET status = 'rejected'
       WHERE id = $1`,
      [id]
    );

    // Check if there are any remaining proposed matches
    const remainingMatches = await query(
      `SELECT COUNT(*) as count FROM requests.matches
       WHERE request_id = $1 AND status = 'proposed'`,
      [match.request_id]
    );

    // If no more proposed matches, reopen the request
    if (remainingMatches.rows[0].count === '0') {
      await query(
        `UPDATE requests.help_requests SET status = 'open' WHERE id = $1`,
        [match.request_id]
      );
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
    console.error('Error rejecting match:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject match',
      error: error.message,
    });
  }
});

// PUT /matches/:id/complete - Mark match as completed
router.put('/:id/complete', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

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
    const doneAtColumn = isRequester ? 'requester_done_at' : 'responder_done_at';

    // Record this party's completion. Use a RETURNING clause to get both done_at
    // values in a single query so we can check if both parties have now confirmed.
    const updateResult = await query(
      `UPDATE requests.matches
       SET ${doneAtColumn} = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING requester_done_at, responder_done_at`,
      [id]
    );

    const updated = updateResult.rows[0];
    const bothDone = updated.requester_done_at !== null && updated.responder_done_at !== null;

    if (bothDone) {
      // Both parties have confirmed — finalize the match
      await query(
        `UPDATE requests.matches
         SET status = 'completed', completed_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [id]
      );

      await query(
        `UPDATE requests.help_requests SET status = 'completed' WHERE id = $1`,
        [match.request_id]
      );

      // Publish event once, only when fully complete (karma is awarded here)
      await publishEvent('match_completed', {
        match_id: id,
        request_id: match.request_id,
        offer_id: match.offer_id,
        requester_id: match.requester_id,
        responder_id: match.responder_id,
      });
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
    console.error('Error completing match:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete match',
      error: error.message,
    });
  }
});

// DELETE /matches/:id - Cancel match
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

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

    // Cancel match
    await query(
      `UPDATE requests.matches
       SET status = 'cancelled'
       WHERE id = $1`,
      [id]
    );

    // Reopen request
    await query(
      `UPDATE requests.help_requests SET status = 'open' WHERE id = $1`,
      [match.request_id]
    );

    // Reopen offer if it exists
    if (match.offer_id) {
      await query(
        `UPDATE requests.help_offers SET status = 'active' WHERE id = $1`,
        [match.offer_id]
      );
    }

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
    console.error('Error cancelling match:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel match',
      error: error.message,
    });
  }
});

export default router;
