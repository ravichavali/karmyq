import { Router, Response } from 'express';
import { query } from '../database/db';
import { authMiddleware, AuthenticatedRequest } from '@karmyq/shared/middleware/auth';
import { publishEvent } from '../events/publisher';
import { PROVIDER_SERVICE_TYPES, type CreateProviderProfileInput } from '@karmyq/shared/schemas/providers';
import { getCommunityProviders, isActiveMember } from '../services/providerReachService';

const router = Router();

// GET /requests/providers - Browse providers
//
// Sprint 125 / ADR-095: this route was public. ADR-041 called the directory "publicly visible",
// which in practice let anyone on the internet enumerate every provider profile on the platform —
// display name, bio, location notes, pricing, and the owner's user id — with no account. It is now
// visible to any authenticated user; it is deliberately still NOT community-gated, because the
// directory's purpose is cross-community discovery. Community gating lives on
// `GET /community/:communityId` above.
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { service_type, user_id, limit = 20, offset = 0 } = req.query;

    let queryText = `
      SELECT
        pp.id, pp.user_id, pp.service_type, pp.display_name,
        pp.bio, pp.pricing_notes, pp.location_notes, pp.is_active,
        pp.created_at, pp.updated_at,
        u.name as user_name,
        pts.avg_stars, pts.total_reviews, pts.trust_score,
        prd.vehicle_type, prd.max_passengers, prd.typical_routes, prd.advance_booking_required
      FROM requests.provider_profiles pp
      LEFT JOIN auth.users u ON pp.user_id = u.id
      LEFT JOIN reputation.provider_trust_scores pts ON pp.id = pts.provider_id
      LEFT JOIN requests.provider_ride_details prd ON pp.id = prd.provider_id
      WHERE pp.is_active = TRUE
    `;

    const params: any[] = [];
    let paramCount = 1;

    if (service_type) {
      queryText += ` AND pp.service_type = $${paramCount}`;
      params.push(service_type);
      paramCount++;
    }

    if (user_id) {
      queryText += ` AND pp.user_id = $${paramCount}`;
      params.push(user_id);
      paramCount++;
    }

    queryText += ` ORDER BY pts.trust_score DESC NULLS LAST, pp.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await query(queryText, params);
    const providers = result.rows;

    // F1 (Sprint 93, ADR-073): annotate each provider with `shared_communities` — the communities
    // the provider and viewer both belong to — so the UI can present the directory through the
    // community trust lens that dibs/matching already use. No schema change (reuses
    // communities.members).
    //
    // Sprint 125: the viewer is now guaranteed by authMiddleware, so the old optional-viewer
    // decode and its `viewer &&` guard are gone. Only the empty-list check remains, and that is a
    // real one: `ANY($2)` with an empty array is a pointless round trip.
    const viewerId = req.user!.userId;
    if (providers.length > 0) {
      // Derive the viewer's shared communities from LIVE membership (communities.members),
      // never the JWT 'communities' claim — a stale token must not badge a community the
      // viewer has since left (the stale-JWT membership class noted in CONTEXT §10.5). We
      // trust only the signed userId, then join the viewer's *active* membership against
      // each listed provider's *active* membership.
      const shared = await query(
        `SELECT pm.user_id, pm.community_id, c.name AS community_name
         FROM communities.members vm
         JOIN communities.members pm ON pm.community_id = vm.community_id
         JOIN communities.communities c ON c.id = vm.community_id
         WHERE vm.user_id = $1 AND vm.status = 'active'
           AND pm.user_id = ANY($2) AND pm.status = 'active'`,
        [viewerId, providers.map((p: any) => p.user_id)]
      );
      const byUser = new Map<string, { id: string; name: string }[]>();
      for (const row of shared.rows) {
        const list = byUser.get(row.user_id) ?? [];
        list.push({ id: row.community_id, name: row.community_name });
        byUser.set(row.user_id, list);
      }
      for (const p of providers) {
        p.shared_communities = byUser.get(p.user_id) ?? [];
      }
    }

    res.json({ success: true, data: providers });
  } catch (error: any) {
    (req as any).logger?.error('Error fetching providers', error instanceof Error ? error : new Error(String(error)), { service: 'request-service' });
    res.status(500).json({ success: false, message: 'Failed to fetch providers', error: error.message });
  }
});

// GET /requests/providers/community/:communityId - Providers reachable through one community
//
// ⚠️ ORDERING: this must stay ABOVE `GET /:providerId`. Express matches in registration order, and
// `/:providerId` happily captures the literal segment "community", which would turn this endpoint
// into a 404 for a provider id that does not exist. `/providers/my` above relies on the same rule.
//
// ⚠️ PATH: deliberately NOT `/communities/:id/providers` — nginx routes the `/api/communities`
// prefix to community-service (nginx.conf:172-173), so that path would never reach this service.
// This path rides the existing `/api/requests` rule and needs no nginx change or deploy ordering.
router.get('/community/:communityId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const viewerId = req.user!.userId;
    const { communityId } = req.params;

    // Membership is checked BEFORE the layer is queried, not filtered out of the result. A
    // non-member must learn nothing about the community's providers, including how many there are.
    if (!(await isActiveMember(viewerId, communityId))) {
      return res.status(403).json({
        success: false,
        message: 'You must be an active member of this community to view its providers',
        error: 'NOT_A_MEMBER',
      });
    }

    const providers = await getCommunityProviders(communityId, {
      limit: req.query.limit,
      offset: req.query.offset,
    });

    // An empty array covers three different situations on purpose: the community never enabled
    // provider services, it enabled them and nobody qualifies yet, or its allowlist excludes every
    // registered type. All three are "nothing to show a member", and the distinction that matters
    // to the UI (enabled vs not) comes from the community config it already loads.
    res.json({ success: true, data: providers });
  } catch (error: any) {
    (req as any).logger?.error(
      'Error fetching community providers',
      error instanceof Error ? error : new Error(String(error)),
      { service: 'request-service' }
    );
    res.status(500).json({
      success: false,
      message: 'Failed to fetch community providers',
      error: error.message,
    });
  }
});

// GET /requests/providers/my - Get authenticated user's own provider profiles
router.get('/my', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const result = await query(`
      SELECT
        pp.id, pp.user_id, pp.service_type, pp.display_name,
        pp.bio, pp.pricing_notes, pp.location_notes, pp.is_active, pp.is_available,
        pp.created_at, pp.updated_at,
        pts.avg_stars, pts.total_reviews, pts.completion_rate, pts.response_rate, pts.trust_score
      FROM requests.provider_profiles pp
      LEFT JOIN reputation.provider_trust_scores pts ON pp.id = pts.provider_id
      WHERE pp.user_id = $1
      ORDER BY pp.created_at ASC
    `, [userId]);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    (req as any).logger?.error('Error fetching own provider profiles', error instanceof Error ? error : new Error(String(error)), { service: 'request-service' });
    res.status(500).json({ success: false, message: 'Failed to fetch provider profiles', error: error.message });
  }
});

// ── Rate Card helpers ──────────────────────────────────────────────────────

// The canonical list. Sprint 125 made this the arbiter of the community allowlist too (a value
// the backend rejects yields a filter matching nobody), so it reads the shared constant rather
// than keeping a fourth copy.
const VALID_SERVICE_TYPES: readonly string[] = PROVIDER_SERVICE_TYPES;
const VALID_RATE_UNITS = ['per_hour', 'per_session', 'per_trip', 'flat_rate'];
const VALID_PRICING_MODELS = ['standard', 'free', 'negotiable'];

function validateRateCardInput(body: any): string | null {
  const { label, pricing_model, rate_amount, rate_unit, service_type, currency } = body;
  if (!label || typeof label !== 'string' || label.length > 100) {
    return 'label is required and must be ≤ 100 characters';
  }
  if (!pricing_model || !VALID_PRICING_MODELS.includes(pricing_model)) {
    return 'pricing_model must be standard, free, or negotiable';
  }
  if (pricing_model === 'standard') {
    if (rate_amount == null || Number(rate_amount) < 0) return 'rate_amount is required and must be non-negative for standard pricing';
    if (!rate_unit || !VALID_RATE_UNITS.includes(rate_unit)) return 'rate_unit must be per_hour, per_session, per_trip, or flat_rate for standard pricing';
  } else {
    if (rate_amount != null) return 'rate_amount must be absent for non-standard pricing_model';
    if (rate_unit != null) return 'rate_unit must be absent for non-standard pricing_model';
  }
  if (service_type && !VALID_SERVICE_TYPES.includes(service_type)) {
    return `service_type must be one of: ${VALID_SERVICE_TYPES.join(', ')}`;
  }
  if (currency && currency.length !== 3) return 'currency must be a 3-character code';
  return null;
}

// GET /providers/:providerId/rate-cards (authenticated; owner gets all including inactive via
// ?include_inactive=true). Sprint 125 / ADR-095: was public, hence the bespoke token decode that
// used to live inside. `authMiddleware` has already verified the token and populated `req.user`,
// so the owner check is now a plain comparison against the verified identity.
router.get('/:providerId/rate-cards', authMiddleware, async (req: any, res: Response) => {
  try {
    const { providerId } = req.params;
    const { include_inactive } = req.query;

    // Only the profile's owner may see inactive rate cards. A non-owner asking for them is not an
    // error — they silently get the active-only view, as before.
    let includeInactive = false;
    if (include_inactive === 'true') {
      const ownerCheck = await query(
        'SELECT user_id FROM requests.provider_profiles WHERE id = $1',
        [providerId]
      );
      includeInactive = ownerCheck.rows[0]?.user_id === req.user!.userId;
    }

    const result = await query(
      `SELECT * FROM requests.provider_rate_cards
       WHERE provider_id = $1 ${includeInactive ? '' : 'AND is_active = TRUE '}
       ORDER BY created_at ASC`,
      [providerId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch rate cards', error: error.message });
  }
});

// POST /providers/:providerId/rate-cards (owner only)
router.post('/:providerId/rate-cards', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { providerId } = req.params;

    const ownerCheck = await query(
      'SELECT user_id FROM requests.provider_profiles WHERE id = $1',
      [providerId]
    );
    if (ownerCheck.rows.length === 0) return res.status(404).json({ success: false, message: 'Provider not found' });
    if (ownerCheck.rows[0].user_id !== userId) return res.status(403).json({ success: false, message: 'Not authorized' });

    const validationError = validateRateCardInput(req.body);
    if (validationError) return res.status(400).json({ success: false, message: validationError });

    const { label, service_type, pricing_model, rate_amount, rate_unit, currency, notes } = req.body;
    const result = await query(
      `INSERT INTO requests.provider_rate_cards
         (provider_id, label, service_type, pricing_model, rate_amount, rate_unit, currency, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        providerId,
        label,
        service_type ?? null,
        pricing_model,
        pricing_model === 'standard' ? rate_amount : null,
        pricing_model === 'standard' ? rate_unit : null,
        currency ?? 'USD',
        notes ?? null,
      ]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to create rate card', error: error.message });
  }
});

// PUT /providers/:providerId/rate-cards/:cardId (owner only)
router.put('/:providerId/rate-cards/:cardId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { providerId, cardId } = req.params;

    const ownerCheck = await query(
      'SELECT user_id FROM requests.provider_profiles WHERE id = $1',
      [providerId]
    );
    if (ownerCheck.rows.length === 0) return res.status(404).json({ success: false, message: 'Provider not found' });
    if (ownerCheck.rows[0].user_id !== userId) return res.status(403).json({ success: false, message: 'Not authorized' });

    const existing = await query(
      'SELECT * FROM requests.provider_rate_cards WHERE id = $1 AND provider_id = $2',
      [cardId, providerId]
    );
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Rate card not found' });

    const merged = { ...existing.rows[0], ...req.body };
    // If pricing_model is changing to non-standard, auto-clear rate fields
    if (merged.pricing_model !== 'standard') {
      merged.rate_amount = null;
      merged.rate_unit = null;
    }
    const validationError = validateRateCardInput(merged);
    if (validationError) return res.status(400).json({ success: false, message: validationError });

    const { label, service_type, pricing_model, rate_amount, rate_unit, currency, notes, is_active } = merged;
    const result = await query(
      `UPDATE requests.provider_rate_cards
       SET label=$1, service_type=$2, pricing_model=$3, rate_amount=$4, rate_unit=$5,
           currency=$6, notes=$7, is_active=$8, updated_at=CURRENT_TIMESTAMP
       WHERE id=$9 AND provider_id=$10
       RETURNING *`,
      [
        label,
        service_type ?? null,
        pricing_model,
        pricing_model === 'standard' ? rate_amount : null,
        pricing_model === 'standard' ? rate_unit : null,
        currency ?? 'USD',
        notes ?? null,
        is_active ?? true,
        cardId,
        providerId,
      ]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update rate card', error: error.message });
  }
});

// DELETE /providers/:providerId/rate-cards/:cardId (owner only — soft delete)
router.delete('/:providerId/rate-cards/:cardId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { providerId, cardId } = req.params;

    const ownerCheck = await query(
      'SELECT user_id FROM requests.provider_profiles WHERE id = $1',
      [providerId]
    );
    if (ownerCheck.rows.length === 0) return res.status(404).json({ success: false, message: 'Provider not found' });
    if (ownerCheck.rows[0].user_id !== userId) return res.status(403).json({ success: false, message: 'Not authorized' });

    const result = await query(
      `UPDATE requests.provider_rate_cards
       SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND provider_id = $2
       RETURNING id`,
      [cardId, providerId]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Rate card not found' });
    res.json({ success: true, data: { id: cardId }, message: 'Rate card deactivated' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to deactivate rate card', error: error.message });
  }
});

// GET /requests/providers/:providerId - Get single provider profile
// Sprint 125 / ADR-095: was public. See the note on `GET /` above.
router.get('/:providerId', authMiddleware, async (req: any, res: Response) => {
  try {
    const { providerId } = req.params;

    const result = await query(`
      SELECT
        pp.id, pp.user_id, pp.service_type, pp.display_name,
        pp.bio, pp.pricing_notes, pp.location_notes, pp.is_active,
        pp.created_at, pp.updated_at,
        u.name as user_name,
        pts.avg_stars, pts.total_reviews, pts.completion_rate, pts.response_rate, pts.trust_score,
        prd.vehicle_type, prd.max_passengers, prd.typical_routes, prd.advance_booking_required
      FROM requests.provider_profiles pp
      LEFT JOIN auth.users u ON pp.user_id = u.id
      LEFT JOIN reputation.provider_trust_scores pts ON pp.id = pts.provider_id
      LEFT JOIN requests.provider_ride_details prd ON pp.id = prd.provider_id
      WHERE pp.id = $1
    `, [providerId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Provider not found' });
    }

    const provider = result.rows[0];
    const cardsResult = await query(
      'SELECT * FROM requests.provider_rate_cards WHERE provider_id = $1 AND is_active = TRUE ORDER BY created_at ASC',
      [providerId]
    );
    provider.rate_cards = cardsResult.rows;
    res.json({ success: true, data: provider });
  } catch (error: any) {
    (req as any).logger?.error('Error fetching provider', error instanceof Error ? error : new Error(String(error)), { service: 'request-service' });
    res.status(500).json({ success: false, message: 'Failed to fetch provider', error: error.message });
  }
});

// POST /requests/providers - Create provider profile (auth required)
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { service_type, display_name, bio, pricing_notes, location_notes, ride_details }: CreateProviderProfileInput = req.body;

    if (!service_type || !display_name) {
      return res.status(400).json({ success: false, message: 'service_type and display_name are required' });
    }

    // Upsert provider profile — reactivates an existing inactive profile for the same service type
    const profileResult = await query(`
      INSERT INTO requests.provider_profiles (user_id, service_type, display_name, bio, pricing_notes, location_notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id, service_type) DO UPDATE
        SET display_name = EXCLUDED.display_name,
            bio = EXCLUDED.bio,
            pricing_notes = EXCLUDED.pricing_notes,
            location_notes = EXCLUDED.location_notes,
            is_active = TRUE,
            updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [userId, service_type, display_name, bio ?? null, pricing_notes ?? null, location_notes ?? null]);

    const profile = profileResult.rows[0];

    // If ride service type, upsert ride details
    if (service_type === 'ride' && ride_details) {
      await query(`
        INSERT INTO requests.provider_ride_details (provider_id, vehicle_type, max_passengers, typical_routes, advance_booking_required)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (provider_id) DO UPDATE
          SET vehicle_type = EXCLUDED.vehicle_type,
              max_passengers = EXCLUDED.max_passengers,
              typical_routes = EXCLUDED.typical_routes,
              advance_booking_required = EXCLUDED.advance_booking_required
      `, [
        profile.id,
        ride_details.vehicle_type ?? null,
        ride_details.max_passengers ?? 1,
        ride_details.typical_routes ?? null,
        ride_details.advance_booking_required ?? false,
      ]);
    }

    // Initialize trust score row
    await query(`
      INSERT INTO reputation.provider_trust_scores (provider_id) VALUES ($1)
      ON CONFLICT (provider_id) DO NOTHING
    `, [profile.id]);

    res.status(201).json({ success: true, data: profile, message: 'Provider profile created' });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'Provider profile already exists for this service type' });
    }
    (req as any).logger?.error('Error creating provider', error instanceof Error ? error : new Error(String(error)), { service: 'request-service' });
    res.status(500).json({ success: false, message: 'Failed to create provider profile', error: error.message });
  }
});

// PUT /requests/providers/:providerId - Update provider profile (owner only)
router.put('/:providerId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { providerId } = req.params;
    const { display_name, bio, pricing_notes, location_notes, is_active, ride_details } = req.body;

    // Verify ownership
    const existing = await query(
      'SELECT id, user_id, service_type FROM requests.provider_profiles WHERE id = $1',
      [providerId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Provider not found' });
    }
    if (existing.rows[0].user_id !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this profile' });
    }

    const result = await query(`
      UPDATE requests.provider_profiles
      SET
        display_name = COALESCE($1, display_name),
        bio = COALESCE($2, bio),
        pricing_notes = COALESCE($3, pricing_notes),
        location_notes = COALESCE($4, location_notes),
        is_active = COALESCE($5, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `, [display_name, bio, pricing_notes, location_notes, is_active, providerId]);

    // Update ride details if provided
    if (existing.rows[0].service_type === 'ride' && ride_details) {
      await query(`
        INSERT INTO requests.provider_ride_details (provider_id, vehicle_type, max_passengers, typical_routes, advance_booking_required)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (provider_id) DO UPDATE SET
          vehicle_type = EXCLUDED.vehicle_type,
          max_passengers = EXCLUDED.max_passengers,
          typical_routes = EXCLUDED.typical_routes,
          advance_booking_required = EXCLUDED.advance_booking_required
      `, [
        providerId,
        ride_details.vehicle_type ?? null,
        ride_details.max_passengers ?? 1,
        ride_details.typical_routes ?? null,
        ride_details.advance_booking_required ?? false,
      ]);
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    (req as any).logger?.error('Error updating provider', error instanceof Error ? error : new Error(String(error)), { service: 'request-service' });
    res.status(500).json({ success: false, message: 'Failed to update provider profile', error: error.message });
  }
});

// DELETE /requests/providers/:providerId - Delete provider profile (owner only)
router.delete('/:providerId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { providerId } = req.params;

    const existing = await query(
      'SELECT id, user_id FROM requests.provider_profiles WHERE id = $1',
      [providerId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Provider not found' });
    }
    if (existing.rows[0].user_id !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this profile' });
    }

    await query('DELETE FROM requests.provider_profiles WHERE id = $1', [providerId]);

    res.json({ success: true, message: 'Provider profile deleted' });
  } catch (error: any) {
    (req as any).logger?.error('Error deleting provider', error instanceof Error ? error : new Error(String(error)), { service: 'request-service' });
    res.status(500).json({ success: false, message: 'Failed to delete provider profile', error: error.message });
  }
});

// PATCH /requests/providers/:providerId/availability - Toggle provider availability (owner only)
router.patch('/:providerId/availability', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { providerId } = req.params;
    const { is_available } = req.body;

    if (typeof is_available !== 'boolean') {
      return res.status(400).json({ success: false, message: 'is_available must be a boolean' });
    }

    const ownerCheck = await query(
      `SELECT id FROM requests.provider_profiles WHERE id = $1 AND user_id = $2`,
      [providerId, userId]
    );

    if (ownerCheck.rowCount === 0) {
      return res.status(403).json({ success: false, message: 'You can only update your own provider profile' });
    }

    const result = await query(
      `UPDATE requests.provider_profiles
       SET is_available = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, is_available`,
      [is_available, providerId]
    );

    const provider = result.rows[0];

    // Publish event when provider goes on duty so notification service can
    // push-notify them with matching open requests in their communities.
    if (is_available === true) {
      const memberships = req.user!.communities ?? [];
      const communityIds = memberships.map((m: { id: string }) => m.id);

      await publishEvent('provider_went_on_duty', {
        providerId: provider.id,
        providerUserId: req.user!.userId,
        communityIds,
      });
    }

    res.json({ success: true, data: provider });
  } catch (error: any) {
    (req as any).logger?.error('Error updating provider availability', error instanceof Error ? error : new Error(String(error)), { service: 'request-service' });
    res.status(500).json({ success: false, message: 'Failed to update availability', error: error.message });
  }
});

export default router;
