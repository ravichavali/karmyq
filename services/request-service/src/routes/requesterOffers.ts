import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '@karmyq/shared/middleware/auth';
import { publishEvent } from '../events/publisher';
import { getOffersForRequest, acceptOffer, declineOffer } from '../db/offersDb';

const router = Router();

/**
 * GET /requests/:id/offers
 * List all provider offers on a specific help request.
 * Caller must be the request owner (requester side).
 */
router.get('/:id/offers', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const offers = await getOffersForRequest(req.params.id, req.user!.userId);
    if (offers === null) {
      return res.status(403).json({ success: false, message: 'Not authorized', error: 'FORBIDDEN' });
    }
    res.json({ success: true, data: offers });
  } catch (err: any) {
    console.error('[requesterOffers] Error fetching offers for request:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch offers', error: err.message });
  }
});

/**
 * PUT /requests/offers/:id/accept
 * Accept a pending provider offer. Caller must own the underlying help request.
 */
router.put('/offers/:id/accept', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const offer = await acceptOffer(req.params.id, req.user!.userId);
    if (offer === 'FORBIDDEN') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
        error: 'FORBIDDEN',
      });
    }
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found or not pending',
        error: 'NOT_FOUND',
      });
    }

    // Best-effort notification event — Redis outage must not fail the accept
    try {
      await publishEvent('offer_accepted', {
        offerId: offer.id,
        providerUserId: offer.provider_user_id,
        requesterName: req.user!.email,
      });
    } catch (eventErr) {
      console.error('[requesterOffers] Failed to publish offer_accepted event:', eventErr);
    }

    res.json({ success: true, data: offer });
  } catch (err: any) {
    console.error('[requesterOffers] Error accepting offer:', err);
    res.status(500).json({ success: false, message: 'Failed to accept offer', error: err.message });
  }
});

/**
 * PUT /requests/offers/:id/decline
 * Decline a pending provider offer. Caller must own the underlying help request.
 */
router.put('/offers/:id/decline', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const offer = await declineOffer(req.params.id, req.user!.userId);
    if (offer === 'FORBIDDEN') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
        error: 'FORBIDDEN',
      });
    }
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found or not pending',
        error: 'NOT_FOUND',
      });
    }

    // Best-effort notification event
    try {
      await publishEvent('offer_declined', {
        offerId: offer.id,
        providerUserId: offer.provider_user_id,
      });
    } catch (eventErr) {
      console.error('[requesterOffers] Failed to publish offer_declined event:', eventErr);
    }

    res.json({ success: true, data: offer });
  } catch (err: any) {
    console.error('[requesterOffers] Error declining offer:', err);
    res.status(500).json({ success: false, message: 'Failed to decline offer', error: err.message });
  }
});

export default router;
