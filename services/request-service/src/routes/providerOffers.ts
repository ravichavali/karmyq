import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '@karmyq/shared/middleware/auth';
import { query } from '../database/db';
import { publishEvent } from '../events/publisher';
import {
  createProviderOffer,
  getMyProviderOffers,
  withdrawProviderOffer,
  validateRequestForOffer,
} from '../db/providerOffersDb';

const router = Router();

/**
 * POST /providers/offers
 * Submit a provider offer on an open help request.
 */
router.post('/offers', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { request_id, price, note } = req.body;
  const userId = req.user!.userId;

  if (!request_id) {
    return res.status(400).json({ success: false, message: 'request_id required', error: 'MISSING_FIELDS' });
  }

  try {
    // Look up the provider profile for this user
    const providerResult = await query(
      `SELECT id FROM requests.provider_profiles WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    if (!providerResult.rows.length) {
      return res.status(403).json({
        success: false,
        message: 'No provider profile found for this user',
        error: 'NO_PROVIDER_PROFILE',
      });
    }
    const providerId = providerResult.rows[0].id;

    const communityIds = (req.user!.communities ?? []).map((m: { id: string }) => m.id);
    const validation = await validateRequestForOffer(request_id, communityIds);
    if (!validation.valid) {
      return res.status(404).json({ success: false, message: validation.reason!, error: 'REQUEST_NOT_FOUND' });
    }

    const offer = await createProviderOffer(
      userId,
      providerId,
      request_id,
      price != null ? Number(price) : null,
      note ?? null
    );

    // Notify the requester via event queue
    const reqResult = await query(
      `SELECT user_id FROM requests.help_requests WHERE id = $1`,
      [request_id]
    );
    // Fire-and-forget notification event (Redis outage should not fail the offer creation)
    try {
      if (reqResult.rows.length > 0) {
        await publishEvent('offer_submitted', {
          offerId: offer.id,
          requestId: request_id,
          requesterUserId: reqResult.rows[0].user_id,
          providerName: req.user!.email,
          price: offer.price,
        });
      }
    } catch (eventErr) {
      (req as any).logger?.error('[providerOffers] Failed to publish offer_submitted event', eventErr instanceof Error ? eventErr : new Error(String(eventErr)), { service: 'request-service' });
    }

    res.status(201).json({ success: true, data: offer });
  } catch (err: any) {
    if (err.code === 'DUPLICATE_OFFER') {
      return res.status(409).json({
        success: false,
        message: 'You already have an active offer for this request',
        error: 'DUPLICATE_OFFER',
      });
    }
    (req as any).logger?.error('Error creating provider offer', err instanceof Error ? err : new Error(String(err)), { service: 'request-service' });
    res.status(500).json({ success: false, message: 'Failed to create offer', error: err.message });
  }
});

/**
 * GET /providers/offers
 * List all offers submitted by the authenticated provider.
 */
router.get('/offers', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const offers = await getMyProviderOffers(req.user!.userId);
    res.json({ success: true, data: offers });
  } catch (err: any) {
    (req as any).logger?.error('Error fetching provider offers', err instanceof Error ? err : new Error(String(err)), { service: 'request-service' });
    res.status(500).json({ success: false, message: 'Failed to fetch offers', error: err.message });
  }
});

/**
 * PUT /providers/offers/:id/withdraw
 * Withdraw a pending offer. Only the owning provider may withdraw.
 */
router.put('/offers/:id/withdraw', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const offer = await withdrawProviderOffer(req.params.id, req.user!.userId);
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found or not in a withdrawable state',
        error: 'NOT_FOUND',
      });
    }
    res.json({ success: true, data: offer });
  } catch (err: any) {
    (req as any).logger?.error('Error withdrawing provider offer', err instanceof Error ? err : new Error(String(err)), { service: 'request-service' });
    res.status(500).json({ success: false, message: 'Failed to withdraw offer', error: err.message });
  }
});

export default router;
