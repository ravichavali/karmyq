import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '@karmyq/shared/middleware/auth';
import { query } from '../database/db';
import { publishEvent } from '../events/publisher';
import {
  createDibs,
  getDibsById,
  getDibsByRequestId,
  updateDibsStatus,
  getPendingDibsForProvider,
  getEligibleCandidates,
} from '../db/dibsDb';
import { getBestCandidate } from '../services/dibsScoringService';

const router = Router();

// ── GET /requests/:id/dibs-candidate ─────────────────────────────────────────
//
// Returns the top-scored dibs candidate for a scheduled request.
// Caller must be the requester.

router.get('/:id/dibs-candidate', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { id: requestId } = req.params;
  const userId = req.user!.userId;

  try {
    // Fetch the request
    const requestResult = await query(
      `SELECT id, requester_id, scheduled_for FROM requests.help_requests WHERE id = $1`,
      [requestId]
    );

    if (requestResult.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Request not found', error: 'NOT_FOUND' });
    }

    const request = requestResult.rows[0];

    // Must be a scheduled request
    if (!request.scheduled_for) {
      return res.status(400).json({
        success: false,
        message: 'Only scheduled requests are eligible for dibs',
        error: 'ASAP_NOT_ELIGIBLE',
      });
    }

    // Caller must be the requester
    if (request.requester_id !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized', error: 'FORBIDDEN' });
    }

    // Get community IDs for this request
    const communitiesResult = await query(
      `SELECT community_id FROM requests.request_communities WHERE request_id = $1`,
      [requestId]
    );
    const communityIds: string[] = communitiesResult.rows.map((r: any) => r.community_id);

    const candidate = await getBestCandidate(userId, communityIds);

    return res.json({ success: true, data: candidate });
  } catch (err: any) {
    console.error('[dibs] Error fetching dibs candidate:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch dibs candidate', error: err.message });
  }
});

// ── POST /requests/:id/dibs ───────────────────────────────────────────────────
//
// Submit a dibs invitation to a specific provider for a scheduled request.
// Caller must be the requester.

router.post('/:id/dibs', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { id: requestId } = req.params;
  const { provider_user_id: providerUserId } = req.body;
  const userId = req.user!.userId;

  if (!providerUserId) {
    return res.status(400).json({ success: false, message: 'provider_user_id is required', error: 'MISSING_FIELDS' });
  }

  try {
    // Fetch the request
    const requestResult = await query(
      `SELECT id, requester_id, scheduled_for FROM requests.help_requests WHERE id = $1`,
      [requestId]
    );

    if (requestResult.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Request not found', error: 'NOT_FOUND' });
    }

    const request = requestResult.rows[0];

    // Must be a scheduled request
    if (!request.scheduled_for) {
      return res.status(400).json({
        success: false,
        message: 'Only scheduled requests are eligible for dibs',
        error: 'ASAP_NOT_ELIGIBLE',
      });
    }

    // Caller must be the requester
    if (request.requester_id !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized', error: 'FORBIDDEN' });
    }

    // Check for existing dibs on this request
    const existingDibs = await getDibsByRequestId(requestId);
    if (existingDibs) {
      return res.status(409).json({
        success: false,
        message: 'A dibs invitation has already been sent for this request',
        error: 'DIBS_ALREADY_SENT',
      });
    }

    // Get community IDs for this request
    const communitiesResult = await query(
      `SELECT community_id FROM requests.request_communities WHERE request_id = $1`,
      [requestId]
    );
    const communityIds: string[] = communitiesResult.rows.map((r: any) => r.community_id);

    // Verify the nominated provider is in the eligible candidates list
    const eligibleCandidates = await getEligibleCandidates(userId, communityIds);
    const nominatedCandidate = eligibleCandidates.find((c) => c.providerUserId === providerUserId);

    if (!nominatedCandidate) {
      // Determine reason: check if provider exists but is unavailable vs no prior interaction
      const providerCheck = await query(
        `SELECT pp.is_available FROM requests.provider_profiles pp WHERE pp.user_id = $1 AND pp.is_active = true LIMIT 1`,
        [providerUserId]
      );

      if (providerCheck.rows.length > 0 && !providerCheck.rows[0].is_available) {
        return res.status(422).json({
          success: false,
          message: 'Provider is not currently available',
          error: 'PROVIDER_NOT_AVAILABLE',
        });
      }

      return res.status(403).json({
        success: false,
        message: 'Provider has no prior completed interaction with requester',
        error: 'NO_PRIOR_INTERACTION',
      });
    }

    // Calculate expiry: 20% of lead time from now to scheduled_for
    const now = new Date();
    const scheduledFor = new Date(request.scheduled_for);
    const leadTime = scheduledFor.getTime() - now.getTime();
    const expiresAt = new Date(now.getTime() + leadTime * 0.20);

    // Create dibs record
    const dibsRecord = await createDibs(requestId, userId, providerUserId, expiresAt);

    // Update request status
    await query(
      `UPDATE requests.help_requests SET status = 'dibs_pending' WHERE id = $1`,
      [requestId]
    );

    // Publish event (best-effort — Redis outage must not fail the dibs creation)
    try {
      await publishEvent('dibs_submitted', {
        dibsId: dibsRecord.id,
        requestId,
        providerUserId,
        expiresAt,
      });
    } catch (eventErr) {
      console.error('[dibs] Failed to publish dibs_submitted event:', eventErr);
    }

    return res.status(201).json({ success: true, data: dibsRecord });
  } catch (err: any) {
    console.error('[dibs] Error creating dibs:', err);
    return res.status(500).json({ success: false, message: 'Failed to create dibs', error: err.message });
  }
});

// ── GET /requests/dibs/pending-for-provider ──────────────────────────────────
//
// Returns all pending dibs records for the authenticated provider.
// IMPORTANT: defined before /dibs/:id routes to avoid param shadowing.

router.get('/dibs/pending-for-provider', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;

  try {
    const pendingDibs = await getPendingDibsForProvider(userId);
    return res.json({ success: true, data: pendingDibs });
  } catch (err: any) {
    console.error('[dibs] Error fetching pending dibs for provider:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch pending dibs', error: err.message });
  }
});

// ── PUT /requests/dibs/:id/accept ─────────────────────────────────────────────
//
// Provider accepts a pending dibs invitation.
// Creates a match and sets request status to 'matched'.

router.put('/dibs/:id/accept', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { id: dibsId } = req.params;
  const userId = req.user!.userId;

  try {
    const dibs = await getDibsById(dibsId);

    if (!dibs) {
      return res.status(404).json({ success: false, message: 'Dibs not found', error: 'NOT_FOUND' });
    }

    // Caller must be the provider
    if (dibs.provider_user_id !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized', error: 'FORBIDDEN' });
    }

    // Must be pending
    if (dibs.status !== 'pending') {
      return res.status(409).json({
        success: false,
        message: `Dibs is already ${dibs.status}`,
        error: 'INVALID_STATE',
      });
    }

    // Must not be expired
    if (new Date(dibs.expires_at) <= new Date()) {
      return res.status(410).json({
        success: false,
        message: 'This dibs invitation has expired',
        error: 'DIBS_EXPIRED',
      });
    }

    await updateDibsStatus(dibsId, 'accepted');

    // Create a match record
    await query(
      `INSERT INTO requests.matches (request_id, responder_id, status)
       VALUES ($1, $2, 'matched')`,
      [dibs.request_id, dibs.provider_user_id]
    );

    // Update request status
    await query(
      `UPDATE requests.help_requests SET status = 'matched' WHERE id = $1`,
      [dibs.request_id]
    );

    // Publish event (best-effort)
    try {
      await publishEvent('dibs_accepted', {
        dibsId,
        requestId: dibs.request_id,
        providerUserId: dibs.provider_user_id,
      });
    } catch (eventErr) {
      console.error('[dibs] Failed to publish dibs_accepted event:', eventErr);
    }

    const updatedDibs = await getDibsById(dibsId);
    return res.json({ success: true, data: updatedDibs });
  } catch (err: any) {
    console.error('[dibs] Error accepting dibs:', err);
    return res.status(500).json({ success: false, message: 'Failed to accept dibs', error: err.message });
  }
});

// ── PUT /requests/dibs/:id/decline ────────────────────────────────────────────
//
// Provider declines a pending dibs invitation.
// Resets request status to 'open'.

router.put('/dibs/:id/decline', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { id: dibsId } = req.params;
  const userId = req.user!.userId;

  try {
    const dibs = await getDibsById(dibsId);

    if (!dibs) {
      return res.status(404).json({ success: false, message: 'Dibs not found', error: 'NOT_FOUND' });
    }

    // Caller must be the provider
    if (dibs.provider_user_id !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized', error: 'FORBIDDEN' });
    }

    // Must be pending
    if (dibs.status !== 'pending') {
      return res.status(409).json({
        success: false,
        message: `Dibs is already ${dibs.status}`,
        error: 'INVALID_STATE',
      });
    }

    await updateDibsStatus(dibsId, 'declined');

    // Reopen the request
    await query(
      `UPDATE requests.help_requests SET status = 'open' WHERE id = $1`,
      [dibs.request_id]
    );

    // Publish event (best-effort)
    try {
      await publishEvent('dibs_declined', {
        dibsId,
        requestId: dibs.request_id,
        providerUserId: dibs.provider_user_id,
      });
    } catch (eventErr) {
      console.error('[dibs] Failed to publish dibs_declined event:', eventErr);
    }

    const updatedDibs = await getDibsById(dibsId);
    return res.json({ success: true, data: updatedDibs });
  } catch (err: any) {
    console.error('[dibs] Error declining dibs:', err);
    return res.status(500).json({ success: false, message: 'Failed to decline dibs', error: err.message });
  }
});

// ── POST /requests/dibs/:id/expire ───────────────────────────────────────────
//
// TEST-ONLY: force-expire a dibs record without waiting for the cron job.
// Used by integration tests in tests/tdd/sprint-42-dibs.test.ts.

router.post('/dibs/:id/expire', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { id: dibsId } = req.params;

  try {
    const dibs = await getDibsById(dibsId);

    if (!dibs) {
      return res.status(404).json({ success: false, message: 'Dibs not found', error: 'NOT_FOUND' });
    }

    await updateDibsStatus(dibsId, 'expired');

    await query(
      `UPDATE requests.help_requests SET status = 'open' WHERE id = $1`,
      [dibs.request_id]
    );

    // Publish event (best-effort)
    try {
      await publishEvent('dibs_expired', {
        dibsId,
        requestId: dibs.request_id,
      });
    } catch (eventErr) {
      console.error('[dibs] Failed to publish dibs_expired event:', eventErr);
    }

    return res.json({ success: true, data: { dibs_status: 'expired' } });
  } catch (err: any) {
    console.error('[dibs] Error force-expiring dibs:', err);
    return res.status(500).json({ success: false, message: 'Failed to expire dibs', error: err.message });
  }
});

export default router;
