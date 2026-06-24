import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '@karmyq/shared/middleware/auth';
import { query, withTransaction } from '../database/db';
import pool from '../database/db';
import { publishEvent } from '../events/publisher';
import {
  createDibs,
  getDibsById,
  getDibsByRequestId,
  updateDibsStatus,
  getPendingDibsForProvider,
  getEligibleCandidates,
  getMutualAidCandidates,
  getRelationshipContext,
  deriveSimilarityKey,
  RelationshipContext,
} from '../db/dibsDb';
import { getBestCandidate, getMutualAidBestCandidate } from '../services/dibsScoringService';
import { deriveDibsReason, DibsReason } from '../services/dibsReason';

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
      `SELECT id, requester_id, scheduled_for, request_type, category, payload FROM requests.help_requests WHERE id = $1`,
      [requestId]
    );

    if (requestResult.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Request not found', error: 'NOT_FOUND' });
    }

    const request = requestResult.rows[0];

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

    // BUG-007: derive provider-vs-neighbor from the PERSISTED request_type so the GET
    // candidate framing can never disagree with the POST /dibs submit validation (which
    // also keys off the stored request_type). The legacy ?type= query param is ignored.
    // ADR-072: routing compares on the task-similarity key (payload subtype when one
    // exists, e.g. service_category 'plumbing'), not the raw category column — new rows
    // store the coarse request_type there, which would make "similar" mean "both service".
    const similarityKey = deriveSimilarityKey(request);
    const candidate = request.request_type === 'service'
      ? await getBestCandidate(userId, communityIds, similarityKey)
      : await getMutualAidBestCandidate(userId, communityIds, similarityKey);

    let trustPath: object | null = null;
    let relationshipContext: RelationshipContext | null = null;
    let reason: DibsReason | null = null;

    if (candidate) {
      // ADR-072: server-side relationship routing — compute WHY this person is the
      // first-ask (prior similar success / trusted neighbour / provider match) from
      // stored relationship history, so the UI renders the server's judgment rather
      // than recreating the rules. Same facet rules as POST /dibs.
      relationshipContext = await getRelationshipContext(userId, candidate.providerUserId, similarityKey);
      reason = deriveDibsReason(candidate.kind, relationshipContext);

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const pathRes = await fetch(
          `${process.env.SOCIAL_GRAPH_API_URL || 'http://social-graph-service:3010'}/social-graph/paths/${candidate.providerUserId}`,
          {
            headers: { Authorization: req.headers.authorization || '' },
            signal: controller.signal,
          }
        );
        clearTimeout(timeout);
        if (pathRes.ok) {
          const pathData = await pathRes.json() as { success: boolean; data?: object };
          if (pathData.success && pathData.data) {
            trustPath = pathData.data;
          }
        }
      } catch {
        // Non-fatal — trust path is enhancement only
      }
    }

    // Sprint 112 (ADR-082): the dibs nudge shows WHO to ask + WHY (reason + relationship context +
    // path structure), never the candidate's exact reputation. Strip trustScore — for a neighbor it
    // is an ordinary member's private score; the nudge is not a reputation surface.
    let safeCandidate: object | null = null;
    if (candidate) {
      const { trustScore: _omitTrustScore, ...rest } = candidate;
      safeCandidate = { ...rest, trustPath, reason, relationshipContext };
    }
    return res.json({
      success: true,
      data: safeCandidate,
    });
  } catch (err: any) {
    (req as any).logger?.error('[dibs] Error fetching dibs candidate', err instanceof Error ? err : new Error(String(err)), { service: 'request-service' });
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
      `SELECT id, requester_id, scheduled_for, status, request_type, category, payload FROM requests.help_requests WHERE id = $1`,
      [requestId]
    );

    if (requestResult.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Request not found', error: 'NOT_FOUND' });
    }

    const request = requestResult.rows[0];

    // Must be open
    if (!['open'].includes(request.status)) {
      return res.status(409).json({
        success: false,
        message: 'Request is not available for dibs',
        error: 'REQUEST_NOT_OPEN',
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

    // Verify the nominee is eligible. BUG-007 (Option A): a non-service request is
    // a neighbor first-ask — validate against the mutual-aid candidate pool
    // (ordinary community members), NOT the provider-only pool, or a neighbor with
    // no provider profile always 403s (NO_PRIOR_INTERACTION).
    const isService = request.request_type === 'service';
    const eligibleCandidates = isService
      ? await getEligibleCandidates(userId, communityIds, deriveSimilarityKey(request))
      : await getMutualAidCandidates(userId, communityIds, deriveSimilarityKey(request));
    const nominatedCandidate = eligibleCandidates.find((c) => c.providerUserId === providerUserId);

    if (!nominatedCandidate) {
      // Provider availability only applies to the provider pool; neighbors have no
      // provider profile, so a non-eligible neighbor falls straight to NO_PRIOR_INTERACTION.
      if (isService) {
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
      }

      return res.status(403).json({
        success: false,
        message: 'This person has no prior connection with you yet',
        error: 'NO_PRIOR_INTERACTION',
      });
    }

    const now = new Date();
    const DIBS_FIXED_WINDOW_MS = 24 * 60 * 60 * 1000;
    let expiresAt: Date;
    if (request.scheduled_for) {
      const scheduledFor = new Date(request.scheduled_for);
      const leadTime = scheduledFor.getTime() - now.getTime();
      if (leadTime <= 0) {
        return res.status(400).json({ success: false, message: 'scheduled_for must be in the future', error: 'SCHEDULED_FOR_IN_PAST' });
      }
      expiresAt = new Date(now.getTime() + leadTime * 0.20);
    } else {
      expiresAt = new Date(now.getTime() + DIBS_FIXED_WINDOW_MS);
    }

    // Dibs insert + request status transition commit or roll back together. The insert
    // must run on the SAME transaction client (passed as `q`) — on the pool it would
    // survive a rollback of the status update, leaving an orphaned dibs row.
    const dibsRecord = await withTransaction(async (q) => {
      const created = await createDibs(requestId, userId, providerUserId, expiresAt, q);

      await q(
        `UPDATE requests.help_requests SET status = 'dibs_pending' WHERE id = $1`,
        [requestId]
      );

      return created;
    });

    // Publish event (best-effort — Redis outage must not fail the dibs creation)
    try {
      await publishEvent('dibs_submitted', {
        dibsId: dibsRecord.id,
        requestId,
        providerUserId,
        expiresAt,
      });
    } catch (eventErr) {
      (req as any).logger?.error('[dibs] Failed to publish dibs_submitted event', eventErr instanceof Error ? eventErr : new Error(String(eventErr)), { service: 'request-service' });
    }

    return res.status(201).json({ success: true, data: dibsRecord });
  } catch (err: any) {
    (req as any).logger?.error('[dibs] Error creating dibs', err instanceof Error ? err : new Error(String(err)), { service: 'request-service' });
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
    (req as any).logger?.error('[dibs] Error fetching pending dibs for provider', err instanceof Error ? err : new Error(String(err)), { service: 'request-service' });
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

    // Wrap accept writes in a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE requests.dibs SET status = 'accepted', updated_at = NOW() WHERE id = $1`,
        [dibsId]
      );

      // Create a match record
      await client.query(
        `INSERT INTO requests.matches (request_id, responder_id, status)
         VALUES ($1, $2, 'matched')`,
        [dibs.request_id, dibs.provider_user_id]
      );

      // Update request status
      await client.query(
        `UPDATE requests.help_requests SET status = 'matched' WHERE id = $1`,
        [dibs.request_id]
      );

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    // Publish event (best-effort)
    try {
      await publishEvent('dibs_accepted', {
        dibsId,
        requestId: dibs.request_id,
        providerUserId: dibs.provider_user_id,
      });
    } catch (eventErr) {
      (req as any).logger?.error('[dibs] Failed to publish dibs_accepted event', eventErr instanceof Error ? eventErr : new Error(String(eventErr)), { service: 'request-service' });
    }

    const updatedDibs = await getDibsById(dibsId);
    return res.json({ success: true, data: updatedDibs });
  } catch (err: any) {
    (req as any).logger?.error('[dibs] Error accepting dibs', err instanceof Error ? err : new Error(String(err)), { service: 'request-service' });
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

    // Must not be expired
    const now = new Date();
    if (new Date(dibs.expires_at) < now) {
      return res.status(410).json({
        success: false,
        message: 'Dibs window has expired',
        error: 'DIBS_EXPIRED',
      });
    }

    // Wrap decline writes in a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE requests.dibs SET status = 'declined', updated_at = NOW() WHERE id = $1`,
        [dibsId]
      );

      // Reopen the request
      await client.query(
        `UPDATE requests.help_requests SET status = 'open' WHERE id = $1`,
        [dibs.request_id]
      );

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    // Publish event (best-effort)
    try {
      await publishEvent('dibs_declined', {
        dibsId,
        requestId: dibs.request_id,
        providerUserId: dibs.provider_user_id,
      });
    } catch (eventErr) {
      (req as any).logger?.error('[dibs] Failed to publish dibs_declined event', eventErr instanceof Error ? eventErr : new Error(String(eventErr)), { service: 'request-service' });
    }

    const updatedDibs = await getDibsById(dibsId);
    return res.json({ success: true, data: updatedDibs });
  } catch (err: any) {
    (req as any).logger?.error('[dibs] Error declining dibs', err instanceof Error ? err : new Error(String(err)), { service: 'request-service' });
    return res.status(500).json({ success: false, message: 'Failed to decline dibs', error: err.message });
  }
});

// ── POST /requests/dibs/:id/expire ───────────────────────────────────────────
//
// TEST-ONLY: force-expire a dibs record without waiting for the cron job.
// Used by integration tests in tests/tdd/sprint-42-dibs.test.ts.

router.post('/dibs/:id/expire', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ success: false, message: 'Not found' });
  }

  const { id: dibsId } = req.params;

  try {
    const dibs = await getDibsById(dibsId);

    if (!dibs) {
      return res.status(404).json({ success: false, message: 'Dibs not found', error: 'NOT_FOUND' });
    }

    if (dibs.status !== 'pending') {
      return res.status(409).json({
        success: false,
        message: `Cannot expire a dibs record with status '${dibs.status}'`,
        error: 'INVALID_STATE',
      });
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
      (req as any).logger?.error('[dibs] Failed to publish dibs_expired event', eventErr instanceof Error ? eventErr : new Error(String(eventErr)), { service: 'request-service' });
    }

    return res.json({ success: true, data: { dibs_status: 'expired' } });
  } catch (err: any) {
    (req as any).logger?.error('[dibs] Error force-expiring dibs', err instanceof Error ? err : new Error(String(err)), { service: 'request-service' });
    return res.status(500).json({ success: false, message: 'Failed to expire dibs', error: err.message });
  }
});

export default router;
