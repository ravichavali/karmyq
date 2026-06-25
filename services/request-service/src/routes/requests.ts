import { Router, Request, Response } from 'express';
import { query } from '../database/db';
import { getRequestReachability } from '../db/eligibility';
import { publishEvent } from '../events/publisher';
import { buildRequestsQuery } from '../utils/queryBuilder';
import {
  sendSuccess,
  sendError,
  sendValidationError,
  sendNotFound,
  sendInternalError,
  HTTP_STATUS,
  validateRequest,
} from '@karmyq/shared/utils/response';
import {
  calculateMatchScore,
  calculateFeedScore,
  scoreRecency,
  scoreUrgency,
  scoreCommunityRelevance,
  scoreTrustDistance,
  resolveSourceTier,
  DEFAULT_FEED_WEIGHTS,
  DEFAULT_FEED_PREFERENCES,
} from '@karmyq/shared/matching';
import type { UserProfile, FeedScoringWeights, VisibilityScope } from '@karmyq/shared/matching/types';
import {
  scorePriorInteraction,
  normalizeMatchScore,
  buildRequestItem,
  buildDecisionItem,
  assembleHomeFeed,
  assembleFeed,
  type DecisionData,
  type DecisionAction,
  type UnifiedFeedItem,
} from '../services/unifiedFeed';
import { categoryToPayloadType } from '../services/payloadType';
import { buildActivityItem, buildStoryItem, type StoryData } from '../services/communityTexture';

const router = Router();

// The 5 built-in request types (the request_type_enum). Used to default feed-preference
// subscriptions and to gate request-type enforcement. Legacy config names (meal_share,
// tool_borrow, childcare, … from older seed data — init.sql / migrations 011-012) are NOT
// built-ins; the enforcement below ignores them so an all-legacy enabled_request_types reads
// as "unrestricted" (mirrors CommunityConfigEditor's normalization). See BUG-006.
const BUILTIN_REQUEST_TYPES = ['generic', 'ride', 'service', 'event', 'borrow'] as const;

interface ImpressionRequestRow {
  id: string;
  feedScore: number;
  sourceTier: string;
}

// Sprint 90 / ADR-069 — retention window resolution: community row → global (NULL) row → hardcoded
// fallback. Mirrors the cleanup-service job's resolution so the transparency page and the actual
// forgetting job agree on the windows. Pure, so it can be unit-tested without a database.
export interface RetentionWindows {
  completedRequestWindowDays: number;
  expiredRequestWindowDays: number;
  messageWindowDays: number;
}

interface RetentionConfigRow {
  community_id: string | null;
  completed_request_window_days: number;
  expired_request_window_days: number;
  message_window_days: number;
}

const RETENTION_FALLBACK: RetentionWindows = {
  completedRequestWindowDays: 180,
  expiredRequestWindowDays: 30,
  messageWindowDays: 180,
};

export function resolveRetentionWindows(
  rows: RetentionConfigRow[],
  communityId?: string
): RetentionWindows {
  const row =
    (communityId != null && rows.find((r) => r.community_id === communityId)) ||
    rows.find((r) => r.community_id == null);
  if (!row) return { ...RETENTION_FALLBACK };
  return {
    completedRequestWindowDays: row.completed_request_window_days,
    expiredRequestWindowDays: row.expired_request_window_days,
    messageWindowDays: row.message_window_days,
  };
}

// The default relevance threshold for the curated feed.
export const DEFAULT_MIN_SCORE = 30;

/**
 * Resolve the feed score gate. Sprint 112 (ADR-082): `minScore` is restricted to two FIXED
 * server-defined modes so it cannot be used as a disclosure oracle. Because `feedScore` is hidden
 * but still filtered against, an arbitrary caller-supplied threshold would let a caller binary-search
 * the inclusion boundary of a known request to infer its composite — and for a community whose
 * config sets requester-trust weight to 1.0 (every other weight 0), `feedScore = requesterTrust`, so
 * probing would read the target's exact trust score. There is no founder exception (ADR-082).
 *
 * Modes: `0`/`all` → show everything (no gate); anything else or absent → the default threshold.
 * Intermediate numeric thresholds are NOT honored, so the boundary never moves with caller input.
 */
export function parseMinScore(value: unknown): number {
  const raw = String(value ?? '').trim().toLowerCase();
  return raw === '0' || raw === 'all' ? 0 : DEFAULT_MIN_SCORE;
}

export function requestMeetsMinScore(request: { feedScore?: number | string | null }, minScore: number): boolean {
  const feedScore = typeof request.feedScore === 'string' ? parseFloat(request.feedScore) : request.feedScore;
  return typeof feedScore === 'number' && Number.isFinite(feedScore) && feedScore >= minScore;
}

export function buildImpressionInsert(userId: string, requests: ImpressionRequestRow[]): { queryText: string; values: unknown[] } | null {
  if (requests.length === 0) return null;
  const placeholders = requests.map(
    (_: any, i: number) => `($${i * 5 + 1}, $${i * 5 + 2}, 'impression', $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`
  ).join(', ');
  const values = requests.flatMap((r: ImpressionRequestRow, idx: number) => [
    userId, r.id, r.feedScore, idx + 1, r.sourceTier,
  ]);
  return {
    queryText: `INSERT INTO requests.feed_events (user_id, request_id, event_type, feed_score, feed_rank, source_tier)
             VALUES ${placeholders}
             ON CONFLICT DO NOTHING`,
    values,
  };
}

export function logRequestImpressions(req: Request, userId: string, requests: ImpressionRequestRow[]): void {
  setImmediate(() => {
    void (async () => {
      try {
        const insert = buildImpressionInsert(userId, requests);
        if (!insert) return;
        await query(insert.queryText, insert.values);
      } catch (e: any) {
        (req as any).logger?.error('feed-impression-log failed', e instanceof Error ? e : new Error(String(e)), { service: 'request-service', step: 'feed-impression-log' });
      }
    })();
  });
}

// GET /requests - Get all requests (with filters)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { community_id, status, type, requester_id, limit = 50, offset = 0, include_admin_notes } = req.query;

    const { queryText, params } = buildRequestsQuery({
      community_id: community_id as string,
      status: status as string,
      type: type as string,
      requester_id: requester_id as string,
      limit: limit as string,
      offset: offset as string,
      include_admin_notes: include_admin_notes as string,
      // BUG-002: exclude the viewer's already-engaged requests from the generic browse.
      viewer_id: (req as any).user?.userId,
    });

    const result = await query(queryText, params);

    sendSuccess(res, {
      requests: result.rows,
      count: result.rowCount,
      total: result.rowCount,
    }, HTTP_STATUS.OK, { requestId: (req as any).id });
  } catch (error: any) {
    (req as any).logger?.error('Error fetching requests', error instanceof Error ? error : new Error(String(error)), { service: 'request-service' });
    sendInternalError(res, 'Failed to fetch requests', error instanceof Error ? error : undefined, { requestId: (req as any).id });
  }
});

// GET /requests/matched/for-user - Get requests matching user's skills
router.get('/matched/for-user', async (req: Request, res: Response) => {
  try {
    const { user_id, limit = 10 } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'user_id is required',
      });
    }

    // Get requests from user's communities that match their skills
    // Skills match is based on category mapping to skills
    const result = await query(
      `SELECT DISTINCT
        r.id, r.requester_id, r.title, r.description,
        r.category, r.urgency, r.status, r.created_at, r.updated_at,
        r.scheduled_for,
        u.name as requester_name,
        STRING_AGG(DISTINCT c.name, ', ') as community_name,
        CASE
          WHEN r.urgency = 'urgent' THEN 4
          WHEN r.urgency = 'high' THEN 3
          WHEN r.urgency = 'medium' THEN 2
          ELSE 1
        END as urgency_priority
      FROM requests.help_requests r
      LEFT JOIN auth.users u ON r.requester_id = u.id
      LEFT JOIN requests.request_communities rc ON r.id = rc.request_id
      LEFT JOIN communities.communities c ON rc.community_id = c.id
      -- Only from communities the user is a member of
      INNER JOIN communities.members m ON rc.community_id = m.community_id
      -- dibs_pending requests are excluded by the status = 'open' equality check
      WHERE r.status = 'open'
        AND r.expired = FALSE
        AND m.user_id = $1
        AND m.status = 'active'
        AND r.requester_id != $1
        -- BUG-002: hide requests the viewer already has a live offer/match on, so a
        -- request they already engaged never reappears as browsable on reload.
        AND NOT EXISTS (
          SELECT 1 FROM requests.matches m_self
          WHERE m_self.request_id = r.id
            AND m_self.responder_id = $1
            AND m_self.status IN ('proposed', 'matched')
        )
        AND EXISTS (
          -- Match request category to user skills
          SELECT 1 FROM auth.user_skills s
          WHERE s.user_id = $1
          AND (
            -- Direct category matches
            (r.category = 'transportation' AND s.skill = 'driving')
            OR (r.category = 'moving' AND s.skill IN ('moving', 'handyman'))
            OR (r.category = 'childcare' AND s.skill = 'childcare')
            OR (r.category = 'pet_care' AND s.skill = 'pet_care')
            OR (r.category = 'tech_support' AND s.skill IN ('tech_support', 'coding'))
            OR (r.category = 'home_repair' AND s.skill IN ('home_repair', 'handyman', 'electrical', 'plumbing', 'carpentry'))
            OR (r.category = 'gardening' AND s.skill = 'gardening')
            OR (r.category = 'cooking' AND s.skill IN ('cooking', 'baking'))
            OR (r.category = 'tutoring' AND s.skill = 'tutoring')
            OR (r.category = 'language' AND s.skill = 'languages')
            OR (r.category = 'professional_advice' AND s.skill = 'career_advice')
            OR (r.category = 'cleaning' AND s.skill IN ('cleaning', 'organizing'))
          )
        )
      GROUP BY r.id, r.requester_id, r.title, r.description, r.category, r.urgency, r.status, r.created_at, r.updated_at, r.scheduled_for, u.name
      ORDER BY urgency_priority DESC, r.created_at DESC
      LIMIT $2`,
      [user_id, limit]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount,
    });
  } catch (error: any) {
    (req as any).logger?.error('Error fetching matched requests', error instanceof Error ? error : new Error(String(error)), { service: 'request-service' });
    sendInternalError(res, 'Failed to fetch matched requests', error instanceof Error ? error : undefined);
  }
});

/**
 * Helper function to get user profile for matching algorithm
 */
async function getUserProfile(userId: string): Promise<UserProfile> {
  // Get user basic info
  const userResult = await query(
    `SELECT id, name FROM auth.users WHERE id = $1`,
    [userId]
  );

  if (userResult.rowCount === 0) {
    throw new Error('User not found');
  }

  const user = userResult.rows[0];

  // Get user skills
  const skillsResult = await query(
    `SELECT skill FROM auth.user_skills WHERE user_id = $1`,
    [userId]
  );

  const skills = skillsResult.rows.map((row: any) => row.skill);

  return {
    id: user.id,
    name: user.name,
    skills,
    // TODO: Add location and availability when available
  };
}

// GET /requests/curated - Get curated feed based on user skills, trust, community config, and urgency
// ADR-031: Unified trust-scored feed with community-configurable weights
async function handleCuratedFeed(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    // Get query parameters
    const minMatchScore = parseMinScore(req.query.minScore); // Default 30%, but explicit 0 is valid
    const limit = parseInt(req.query.limit as string) || 20;
    const communityId = req.query.community_id as string | undefined;
    const tierFilter = req.query.tier as string | undefined; // Optional: 'community', 'trust_network', 'platform'

    // Get user profile for matching
    const userProfile = await getUserProfile(userId);

    // Get user preferences for request types
    const preferencesResult = await query(
      `SELECT request_type, subscribed
       FROM auth.user_request_preferences
       WHERE user_id = $1 AND subscribed = true`,
      [userId]
    );

    // If no preferences set, default to all types subscribed
    const subscribedTypes =
      preferencesResult.rowCount > 0
        ? preferencesResult.rows.map((row: any) => row.request_type)
        : [...BUILTIN_REQUEST_TYPES];

    // ADR-022: Fetch user feed preferences for multi-tier visibility
    const feedPrefsResult = await query(
      `SELECT feed_show_trust_network, feed_trust_network_max_degrees, feed_show_platform, feed_platform_categories
       FROM auth.user_feed_preferences
       WHERE user_id = $1`,
      [userId]
    );

    const feedPrefs = feedPrefsResult.rows[0] || DEFAULT_FEED_PREFERENCES;

    // Sprint 32: Fetch user effective trust params for cross-community prior in feed scoring
    const EFFECTIVE_PARAMS_DEFAULT = { depth_weight: 0.6, breadth_weight: 0.4, cross_community_prior: 0.5 };
    let userEffectiveParams = EFFECTIVE_PARAMS_DEFAULT;
    const primaryCommunityId = communityId || (req as any).user?.communities?.[0]?.id;
    if (primaryCommunityId) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000); // 3s timeout — never block the feed
        const paramsRes = await fetch(
          `${process.env.REPUTATION_API_URL || 'http://reputation-service:3004'}/reputation/users/${userId}/effective-params?communityId=${primaryCommunityId}`,
          { headers: { Authorization: req.headers.authorization || '' }, signal: controller.signal }
        );
        clearTimeout(timeout);
        if (paramsRes.ok) {
          const paramsData = await paramsRes.json() as { success: boolean; data?: typeof EFFECTIVE_PARAMS_DEFAULT };
          if (paramsData.success && paramsData.data) userEffectiveParams = paramsData.data;
        }
      } catch {
        // Non-fatal — use defaults; never block the feed
      }
    }

    // ADR-031: Fetch community configs for user's communities (for feed weights)
    const communityConfigsResult = await query(
      `SELECT
        cc.community_id,
        cc.enabled_request_types,
        cc.feed_weight_skill_match,
        cc.feed_weight_trust_distance,
        cc.feed_weight_community_relevance,
        cc.feed_weight_urgency,
        cc.feed_weight_requester_trust,
        cc.feed_weight_prior_interaction,
        cc.feed_weight_recency
      FROM communities.community_configs cc
      JOIN communities.members m ON cc.community_id = m.community_id
      WHERE m.user_id = $1 AND m.status = 'active'`,
      [userId]
    );

    // Build community config lookup map
    const communityConfigs = new Map<string, {
      weights: FeedScoringWeights;
      enabledTypes: Array<{ name: string; karma_multiplier?: number }>;
    }>();

    for (const row of communityConfigsResult.rows) {
      communityConfigs.set(row.community_id, {
        weights: {
          // Use ?? (not ||): 0 is a valid weight value. || treats 0 as "missing"
          // and replaces it with a default, pushing the sum above 1.0 → 500.
          feed_weight_skill_match: row.feed_weight_skill_match != null ? parseFloat(row.feed_weight_skill_match) : DEFAULT_FEED_WEIGHTS.feed_weight_skill_match,
          feed_weight_trust_distance: row.feed_weight_trust_distance != null ? parseFloat(row.feed_weight_trust_distance) : DEFAULT_FEED_WEIGHTS.feed_weight_trust_distance,
          feed_weight_community_relevance: row.feed_weight_community_relevance != null ? parseFloat(row.feed_weight_community_relevance) : DEFAULT_FEED_WEIGHTS.feed_weight_community_relevance,
          feed_weight_urgency: row.feed_weight_urgency != null ? parseFloat(row.feed_weight_urgency) : DEFAULT_FEED_WEIGHTS.feed_weight_urgency,
          feed_weight_requester_trust: row.feed_weight_requester_trust != null ? parseFloat(row.feed_weight_requester_trust) : DEFAULT_FEED_WEIGHTS.feed_weight_requester_trust,
          feed_weight_prior_interaction: row.feed_weight_prior_interaction != null ? parseFloat(row.feed_weight_prior_interaction) : DEFAULT_FEED_WEIGHTS.feed_weight_prior_interaction,
          feed_weight_recency: row.feed_weight_recency != null ? parseFloat(row.feed_weight_recency) : DEFAULT_FEED_WEIGHTS.feed_weight_recency,
        },
        enabledTypes: row.enabled_request_types || [],
      });
    }

    // ADR-022: Multi-tier feed query
    // Tier 1 (community): Always shown — requests from user's communities
    // Tier 2 (trust_network): Requests with wider scope where user has trust path (gated by feed prefs)
    // Tier 3 (platform): Platform-scoped requests (opt-in via feed prefs)
    let queryText = `
      SELECT DISTINCT
        r.id, r.requester_id, r.title, r.description,
        r.category, r.urgency, r.status, r.created_at, r.updated_at,
        r.request_type, r.payload, r.requirements,
        r.visibility_scope, r.visibility_max_degrees,
        r.scheduled_for,
        r.is_boosted, r.boosted_expires_at,
        u.name as requester_name,
        STRING_AGG(DISTINCT c.name, ', ') as community_name,
        STRING_AGG(DISTINCT rc.community_id::text, ',') as community_ids,
        BOOL_OR(m.id IS NOT NULL) as in_user_community
      FROM requests.help_requests r
      LEFT JOIN auth.users u ON r.requester_id = u.id
      LEFT JOIN requests.request_communities rc ON r.id = rc.request_id
      LEFT JOIN communities.communities c ON rc.community_id = c.id
      LEFT JOIN communities.members m ON rc.community_id = m.community_id AND m.user_id = $1 AND m.status = 'active'
      -- dibs_pending requests are excluded by the status = 'open' equality check
      WHERE r.status = 'open'
        AND r.expired = FALSE
        AND r.requester_id != $1
        -- BUG-002: hide requests the viewer already has a live offer/match on.
        AND NOT EXISTS (
          SELECT 1 FROM requests.matches m_self
          WHERE m_self.request_id = r.id
            AND m_self.responder_id = $1
            AND m_self.status IN ('proposed', 'matched')
        )
        AND (
          -- Tier 1: User's communities (always included)
          EXISTS (
            SELECT 1 FROM requests.request_communities rc2
            JOIN communities.members m2 ON rc2.community_id = m2.community_id
            WHERE rc2.request_id = r.id AND m2.user_id = $1 AND m2.status = 'active'
          )
    `;

    const params: any[] = [userId];
    let paramCount = 2;

    // Tier 2: Trust network requests (wider visibility, filtered by trust distance in app layer)
    if (feedPrefs.feed_show_trust_network) {
      queryText += `
          OR r.visibility_scope IN ('trust_network', 'platform')
      `;
    }

    // Tier 3: Platform requests (opt-in)
    if (feedPrefs.feed_show_platform && !feedPrefs.feed_show_trust_network) {
      // Only add if trust_network wasn't already included (which covers 'platform' scope too)
      queryText += `
          OR r.visibility_scope = 'platform'
      `;
    }

    queryText += `
        )
    `;

    if (communityId) {
      queryText += ` AND rc.community_id = $${paramCount}`;
      params.push(communityId);
      paramCount++;
    }

    queryText += `
      GROUP BY r.id, r.requester_id, r.title, r.description, r.category, r.urgency, r.status, r.created_at, r.updated_at, r.request_type, r.payload, r.requirements, r.visibility_scope, r.visibility_max_degrees, r.scheduled_for, r.is_boosted, r.boosted_expires_at, u.name
      LIMIT 150`; // Get more than needed, then filter by tier + score

    const requestsResult = await query(queryText, params);

    // Sprint 15: Sister community requests (Fractal Community Model Phase 1)
    // When includeSisterCommunities=true, fetch requests from linked communities
    // where show_in_sister_feeds=true, to be scored with trust_carry_factor applied.
    const includeSisterCommunities = req.query.includeSisterCommunities === 'true';
    let sisterRequests: any[] = [];
    const sisterCarryMap = new Map<string, number>(); // requestId → carry factor

    if (includeSisterCommunities) {
      const sisterLinksResult = await query(
        `SELECT DISTINCT
           CASE WHEN cl.community_a_id = m.community_id THEN cl.community_b_id
                ELSE cl.community_a_id END AS sister_community_id,
           cl.trust_carry_factor
         FROM communities.community_links cl
         JOIN communities.members m ON (
           m.community_id = cl.community_a_id OR m.community_id = cl.community_b_id
         )
         WHERE m.user_id = $1 AND m.status = 'active'
           AND cl.status = 'active' AND cl.show_in_sister_feeds = TRUE`,
        [userId]
      );

      if ((sisterLinksResult.rowCount ?? 0) > 0) {
        const sisterCommunityIds = sisterLinksResult.rows.map((r: any) => r.sister_community_id);
        const carryByCommId = new Map<string, number>(
          sisterLinksResult.rows.map((r: any) => [r.sister_community_id, parseFloat(r.trust_carry_factor)])
        );

        const sisterResult = await query(
          `SELECT DISTINCT
            r.id, r.requester_id, r.title, r.description,
            r.category, r.urgency, r.status, r.created_at, r.updated_at,
            r.request_type, r.payload, r.requirements,
            r.visibility_scope, r.visibility_max_degrees,
            r.scheduled_for,
            r.is_boosted, r.boosted_expires_at,
            u.name as requester_name,
            STRING_AGG(DISTINCT c.name, ', ') as community_name,
            STRING_AGG(DISTINCT rc.community_id::text, ',') as community_ids,
            FALSE as in_user_community
           FROM requests.help_requests r
           LEFT JOIN auth.users u ON r.requester_id = u.id
           LEFT JOIN requests.request_communities rc ON r.id = rc.request_id
           LEFT JOIN communities.communities c ON rc.community_id = c.id
           -- dibs_pending requests are excluded by the status = 'open' equality check
           WHERE r.status = 'open'
             AND r.expired = FALSE
             AND r.requester_id != $1
             -- BUG-002: hide requests the viewer already has a live offer/match on.
             AND NOT EXISTS (
               SELECT 1 FROM requests.matches m_self
               WHERE m_self.request_id = r.id
                 AND m_self.responder_id = $1
                 AND m_self.status IN ('proposed', 'matched')
             )
             AND rc.community_id = ANY($2::uuid[])
             AND r.id != ALL($3::uuid[])
           GROUP BY r.id, r.requester_id, r.title, r.description, r.category, r.urgency,
                    r.status, r.created_at, r.updated_at, r.request_type, r.payload,
                    r.requirements, r.visibility_scope, r.visibility_max_degrees,
                    r.scheduled_for, r.is_boosted, r.boosted_expires_at, u.name
           LIMIT 50`,
          [userId, sisterCommunityIds, requestsResult.rows.map((r: any) => r.id)]
        );

        // Annotate each sister request with its carry factor
        for (const row of sisterResult.rows) {
          const cIds = (row.community_ids || '').split(',').filter(Boolean);
          let carry = 0.40;
          for (const cId of cIds) {
            if (carryByCommId.has(cId)) { carry = carryByCommId.get(cId)!; break; }
          }
          sisterCarryMap.set(row.id, carry);
          sisterRequests.push(row);
        }
      }
    }

    // ADR-031 Phase 3: Batch-fetch trust distance and karma for all requesters
    const allRows = [...requestsResult.rows, ...sisterRequests];
    const requesterIds = [...new Set(
      allRows.map((r: any) => r.requester_id).filter(Boolean)
    )];

    // Batch trust distance lookup (from social_distances cache)
    const trustDistanceMap = new Map<string, number | null>();
    if (requesterIds.length > 0) {
      const trustResult = await query(
        `SELECT target_id, degrees_of_separation FROM (
          SELECT user_b_id as target_id, degrees_of_separation
          FROM auth.social_distances
          WHERE user_a_id = $1 AND user_b_id = ANY($2::uuid[]) AND expires_at > NOW()
          UNION
          SELECT user_a_id as target_id, degrees_of_separation
          FROM auth.social_distances
          WHERE user_b_id = $1 AND user_a_id = ANY($2::uuid[]) AND expires_at > NOW()
        ) sd`,
        [userId, requesterIds]
      );
      for (const row of trustResult.rows) {
        trustDistanceMap.set(row.target_id, row.degrees_of_separation);
      }
    }

    // Batch karma + trust score lookup for requesters
    const requesterKarmaMap = new Map<string, { totalKarma: number; trustScore: number }>();
    if (requesterIds.length > 0) {
      const karmaResult = await query(
        `SELECT
          kr.user_id,
          COALESCE(SUM(kr.points), 0)::int as total_karma,
          COALESCE(MAX(ts.score), 50)::int as best_trust_score
        FROM reputation.karma_records kr
        LEFT JOIN reputation.trust_scores ts
          ON kr.user_id = ts.user_id AND kr.community_id = ts.community_id
        WHERE kr.user_id = ANY($1::uuid[])
        GROUP BY kr.user_id`,
        [requesterIds]
      );
      for (const row of karmaResult.rows) {
        requesterKarmaMap.set(row.user_id, {
          totalKarma: row.total_karma,
          trustScore: row.best_trust_score,
        });
      }
    }

    // Batch prior-interaction lookup — the DECAYED edge weight (ADR-066 "designed to forget").
    // We read social_graph.trust_edges_live.current_weight (raw_weight × e^(-Δt/(stability·half_life)),
    // a VIEW — never written here) instead of the binary social_graph.connections.type, so feed
    // ranking reflects relationship *shape* (recency-decayed), not raw interaction history. Edges are
    // per-community and normalized (user_id_a < user_id_b); we take the member's strongest live edge
    // to each requester across their shared communities.
    const priorWeightMap = new Map<string, number>();
    if (requesterIds.length > 0) {
      try {
        const edgeResult = await query(
          `SELECT other_user_id, MAX(current_weight) AS weight FROM (
             SELECT CASE WHEN user_id_a = $1 THEN user_id_b ELSE user_id_a END AS other_user_id,
                    current_weight
             FROM social_graph.trust_edges_live
             WHERE (user_id_a = $1 AND user_id_b = ANY($2::uuid[]))
                OR (user_id_b = $1 AND user_id_a = ANY($2::uuid[]))
           ) e
           GROUP BY other_user_id`,
          [userId, requesterIds]
        );
        for (const row of edgeResult.rows) {
          priorWeightMap.set(row.other_user_id, parseFloat(row.weight));
        }
      } catch (e: any) {
        (req as any).logger?.error('prior-interaction-batch failed', e instanceof Error ? e : new Error(String(e)), { service: 'request-service', step: 'prior-interaction-batch' });
        // Non-fatal — continue without the prior-interaction signal
      }
    }

    // Calculate weighted feed scores and determine source tier
    const requestsWithScores = requestsResult.rows.map((request: any) => {
      // Skill match score (existing matcher)
      const matchResult = calculateMatchScore(
        {
          request_type: request.request_type || 'generic',
          title: request.title,
          description: request.description,
          urgency: request.urgency,
          payload: request.payload || {},
        },
        userProfile
      );

      // Determine which community config to use (first matching community)
      const requestCommunityIds = (request.community_ids || '').split(',').filter(Boolean);
      let weights = DEFAULT_FEED_WEIGHTS;
      let enabledTypes: Array<{ name: string; karma_multiplier?: number }> = [];

      for (const cId of requestCommunityIds) {
        const config = communityConfigs.get(cId);
        if (config) {
          weights = config.weights;
          enabledTypes = config.enabledTypes;
          break;
        }
      }

      // Calculate individual signal scores
      const urgencyVal = scoreUrgency(request.urgency || 'low');
      const communityRelevance = scoreCommunityRelevance(
        request.request_type || 'generic',
        enabledTypes
      );

      // Trust distance from social graph cache
      // Sprint 32: For null-degree (cross-community) requesters, use evolved cross_community_prior
      const degrees = trustDistanceMap.get(request.requester_id) ?? null;
      const trustDistance = degrees !== null
        ? scoreTrustDistance(degrees)
        : Math.round(userEffectiveParams.cross_community_prior * 100);

      // Requester karma/trust for display
      const requesterReputation = requesterKarmaMap.get(request.requester_id) || {
        totalKarma: 0,
        trustScore: 50,
      };

      // ADR-022: Determine source tier using shared utility
      const sourceTier = resolveSourceTier({
        inUserCommunity: request.in_user_community,
        visibilityScope: (request.visibility_scope || 'community') as VisibilityScope,
        visibilityMaxDegrees: request.visibility_max_degrees || 3,
        trustDegrees: degrees,
        feedPrefs,
      });

      // New signals: prior interaction (decayed edge weight), recency, requester trust
      const priorInteraction = scorePriorInteraction(priorWeightMap.get(request.requester_id));
      const recency = scoreRecency(request.created_at);

      // Weighted feed score
      const feedResult = calculateFeedScore(
        {
          skillMatchScore: matchResult.score,
          trustDistanceScore: trustDistance,
          communityRelevanceScore: communityRelevance,
          urgencyScore: urgencyVal,
          requesterTrustScore: requesterReputation.trustScore,
          priorInteractionScore: priorInteraction,
          recencyScore: recency,
        },
        weights
      );

      // Boost bonus: active admin boost floats request higher
      const boostActive = request.is_boosted &&
        request.boosted_expires_at &&
        new Date(request.boosted_expires_at) > new Date();
      const boostBonus = boostActive ? 30 : 0;
      const finalFeedScore = Math.min(100, feedResult.score + boostBonus);

      return {
        ...request,
        matchScore: matchResult.score,
        matchReasons: matchResult.reasons,
        feedScore: finalFeedScore,
        // Sprint 112 (ADR-082): matchBreakdown/feedBreakdown are NOT attached — their numeric
        // requesterTrust.raw / karma inputs are another member's exact reputation, and the legacy
        // feed response returns these scored objects verbatim. The match_reason string + match_score
        // are the user-facing explanation; the raw breakdowns stay internal to the ranker. The
        // requester's exact karma/trust feed ranking INTERNALLY but are never returned; only
        // structural proximity (degrees) is outward-facing.
        trustDegrees: degrees,
        priorInteractionScore: priorInteraction,
        recencyScore: recency,
        // ADR-022: Source tier
        sourceTier,
      };
    });

    // Sprint 15: Score sister community requests with trust_carry_factor applied
    const sisterRequestsWithScores = sisterRequests.map((request: any) => {
      const carryFactor = sisterCarryMap.get(request.id) ?? 0.40;
      const matchResult = calculateMatchScore(
        {
          request_type: request.request_type || 'generic',
          title: request.title,
          description: request.description,
          urgency: request.urgency,
          payload: request.payload || {},
        },
        userProfile
      );
      const urgencyVal = scoreUrgency(request.urgency || 'low');
      const degrees = trustDistanceMap.get(request.requester_id) ?? null;
      // Sprint 32: Apply cross-community prior for null-degree sister requesters too
      const trustDistance = degrees !== null
        ? scoreTrustDistance(degrees)
        : Math.round(userEffectiveParams.cross_community_prior * 100);
      const requesterReputation = requesterKarmaMap.get(request.requester_id) || {
        totalKarma: 0, trustScore: 50,
      };
      const sisterPriorInteraction = scorePriorInteraction(priorWeightMap.get(request.requester_id));
      const sisterRecency = scoreRecency(request.created_at);
      const feedResult = calculateFeedScore(
        {
          skillMatchScore: matchResult.score,
          trustDistanceScore: trustDistance,
          communityRelevanceScore: 0,
          urgencyScore: urgencyVal,
          requesterTrustScore: requesterReputation.trustScore,
          priorInteractionScore: sisterPriorInteraction,
          recencyScore: sisterRecency,
        },
        DEFAULT_FEED_WEIGHTS
      );
      // Boost bonus: active admin boost floats request higher
      const boostActive = request.is_boosted &&
        request.boosted_expires_at &&
        new Date(request.boosted_expires_at) > new Date();
      const boostBonus = boostActive ? 30 : 0;
      return {
        ...request,
        matchScore: matchResult.score,
        matchReasons: matchResult.reasons,
        feedScore: Math.min(100, Math.round(feedResult.score * carryFactor) + boostBonus),
        // Sprint 112 (ADR-082): matchBreakdown/feedBreakdown omitted (requester karma/trust inputs);
        // requester karma/trust feed ranking internally, never returned.
        trustDegrees: degrees,
        priorInteractionScore: sisterPriorInteraction,
        recencyScore: sisterRecency,
        sourceTier: 'sister_community',
        trustCarryFactor: carryFactor,
      };
    });

    // Filter: valid tier, subscribed request types, minimum score
    // Sort: community first, then trust_network, then platform; within each tier, by feedScore
    const tierOrder: Record<string, number> = { community: 0, trust_network: 1, platform: 2, sister_community: 3 };

    const filteredRequests = [...requestsWithScores, ...sisterRequestsWithScores]
      .filter((req: any) => req.sourceTier !== null)
      .filter((req: any) => !tierFilter || req.sourceTier === tierFilter)
      .filter((req: any) => subscribedTypes.includes(req.request_type || 'generic'))
      .filter((req: any) => requestMeetsMinScore(req, minMatchScore))
      .sort((a: any, b: any) => {
        const tierDiff = (tierOrder[a.sourceTier] ?? 3) - (tierOrder[b.sourceTier] ?? 3);
        return tierDiff !== 0 ? tierDiff : b.feedScore - a.feedScore;
      })
      .slice(0, limit);

    // Sprint 85 / ADR-066 — Unified feed: view=home returns the action-altitude union
    // ({ items }) instead of the legacy request array. `view` absent keeps the legacy shape
    // (back-compat for the existing BrowseFeed/community callers).
    if (req.query.view === 'home') {
      logRequestImpressions(req, userId, filteredRequests);
      await respondHomeFeed(req, res, userId, filteredRequests);
      return;
    }

    // Sprint 86 / ADR-066 — view=community returns the community-scoped union (requests + texture,
    // no decision band). community_id is required and the caller must be a member (guarded inside).
    if (req.query.view === 'community') {
      logRequestImpressions(req, userId, filteredRequests);
      await respondCommunityFeed(req, res, communityId, filteredRequests);
      return;
    }

    // Count by tier for response metadata
    const tierCounts = filteredRequests.reduce((acc: Record<string, number>, r: any) => {
      acc[r.sourceTier] = (acc[r.sourceTier] || 0) + 1;
      return acc;
    }, {});

    // Sprint 112 (ADR-082): the legacy feed returns scored objects verbatim. Strip the exact composite
    // feedScore and its reconstruction-enabling component signals (priorInteractionScore, recencyScore)
    // — with the public formula + readable weights they would let requester trust be solved. The
    // server has already sorted by feedScore, so the ranked ORDER is the outward ranking signal.
    const safeRequests = filteredRequests.map((r: any) => {
      const { feedScore: _fs, priorInteractionScore: _pis, recencyScore: _rs, ...safe } = r;
      return safe;
    });

    sendSuccess(
      res,
      {
        requests: safeRequests,
        count: safeRequests.length,
        filters: {
          minMatchScore,
          totalRequests: requestsResult.rowCount,
          matchedRequests: filteredRequests.length,
          subscribedTypes,
          tier: tierFilter || 'all',
        },
        tiers: tierCounts,
        feedPreferences: {
          showTrustNetwork: feedPrefs.feed_show_trust_network,
          trustNetworkMaxDegrees: feedPrefs.feed_trust_network_max_degrees,
          showPlatform: feedPrefs.feed_show_platform,
        },
        userProfile: {
          skills: userProfile.skills,
          skillCount: userProfile.skills.length,
        },
      },
      HTTP_STATUS.OK,
      { requestId: (req as any).id }
    );

    // Fire-and-forget: log impressions to feed_events (never block feed response)
    logRequestImpressions(req, userId, filteredRequests);
  } catch (error: any) {
    (req as any).logger?.error('Error fetching curated requests', error instanceof Error ? error : new Error(String(error)), { service: 'request-service' });
    sendInternalError(
      res,
      'Failed to fetch curated requests',
      error instanceof Error ? error : undefined,
      { requestId: (req as any).id }
    );
  }
}

/**
 * Sprint 85 / ADR-066 — Map an already-scored curated request row to the canonical request-card
 * payload (RequestCardData on the wire). Curated requests are always status='open' (the member
 * could fill them); the member-facing 'proposed' token applies to the member's OWN requests, which
 * surface as decisions, not request items. match_score is normalized to one 0–100 integer scale.
 */
function toRequestCardData(r: any): Record<string, unknown> {
  const communityId = (r.community_ids || '').split(',').filter(Boolean)[0] || '';
  return {
    request_id: r.id,
    requester_id: r.requester_id,
    title: r.title,
    description: r.description,
    author_name: r.requester_name,
    community_id: communityId,
    community_name: r.community_name || '',
    urgency: r.urgency,
    status: 'open',
    request_type: r.request_type || 'generic',
    // ADR-067 seam fix: the fine payload subtype the card renders, normalized from the mixed-vocab
    // `category` column (never a raw passthrough). Undefined for unmapped categories → renderer no-ops.
    payload_type: categoryToPayloadType(r.category),
    payload: r.payload || {},
    requirements: r.requirements || {},
    is_boosted: !!r.is_boosted,
    boosted_expires_at: r.boosted_expires_at || undefined,
    created_at: r.created_at,
    updated_at: r.updated_at,
    match_score: normalizeMatchScore(r.matchScore),
    match_reason: Array.isArray(r.matchReasons) ? r.matchReasons.join(' · ') : '',
    trust_degree: r.trustDegrees ?? null,
    // Sprint 112 (ADR-082): requesterKarma/requesterTrustScore intentionally omitted (see above).
  };
}

/**
 * Fetch the decisions the member owes — the "needs your response" band. Reads the same
 * matches/dibs data the Commitments tab does: proposed offers awaiting accept/decline (member is
 * requester) or withdraw (member is responder), matched items awaiting the member's mark-done, and
 * pending dibs on the member's own requests. Each failure is non-fatal — a decision-query error
 * degrades to "no decisions" rather than breaking the whole feed.
 */
export async function fetchDecisions(req: Request, userId: string): Promise<UnifiedFeedItem<DecisionData>[]> {
  const decisions: DecisionData[] = [];

  try {
    const matchRows = await query(
      `SELECT m.id, m.request_id, m.status, m.created_at, m.admin_proposed,
              m.requester_done_at, m.responder_done_at,
              hr.requester_id, m.responder_id, hr.title, hr.description, hr.payload, hr.category,
              requester.name AS requester_name, responder.name AS responder_name,
              STRING_AGG(DISTINCT c.name, ', ') AS community_name,
              MIN(rc.community_id::text) AS community_id
       FROM requests.matches m
       JOIN requests.help_requests hr ON m.request_id = hr.id
       JOIN auth.users requester ON hr.requester_id = requester.id
       JOIN auth.users responder ON m.responder_id = responder.id
       LEFT JOIN requests.request_communities rc ON hr.id = rc.request_id
       LEFT JOIN communities.communities c ON rc.community_id = c.id
       WHERE (hr.requester_id = $1 OR m.responder_id = $1)
         AND m.status IN ('proposed', 'matched')
       GROUP BY m.id, m.request_id, m.status, m.created_at, m.admin_proposed, m.requester_done_at,
                m.responder_done_at, hr.requester_id, m.responder_id, hr.title,
                hr.description, hr.payload, hr.category, requester.name, responder.name`,
      [userId]
    );

    for (const m of matchRows.rows) {
      const isRequester = m.requester_id === userId;
      let actions: DecisionAction[] = [];
      if (m.status === 'proposed') {
        // S108: who owes the accept/decline flips on admin_proposed, and so does authorization.
        //  - admin_proposed = TRUE: the matchmaker suggested THIS member as helper, so only the
        //    RESPONDER owes (and PUT /matches/:id/accept authorizes only the responder, matches.ts:306).
        //    The requester just waits — surfacing a decision to them would be a 403 they can't action.
        //  - admin_proposed = FALSE (self-offer): only the REQUESTER owes; the responder's offer is
        //    awaiting the requester (offered-awaiting) and shows in Helping with a Withdraw action.
        if (m.admin_proposed ? isRequester : !isRequester) continue;
        actions = ['accept_offer', 'decline_offer'];
      } else if (m.status === 'matched') {
        // Only owe a mark-done if this member hasn't already confirmed (two-phase completion).
        const alreadyDone = isRequester ? m.requester_done_at != null : m.responder_done_at != null;
        if (alreadyDone) continue;
        actions = ['mark_done'];
      }
      decisions.push({
        subject_id: m.id,
        subject_kind: 'match',
        request_id: m.request_id,
        title: m.title,
        description: m.description ?? '',
        payload: m.payload ?? undefined,
        payload_type: categoryToPayloadType(m.category),
        community_name: m.community_name || '',
        counterparty_name: isRequester ? m.responder_name : m.requester_name,
        counterparty_id: isRequester ? m.responder_id : m.requester_id,
        community_id: m.community_id ?? undefined,
        member_role: isRequester ? 'requester' : 'responder',
        actions,
        created_at: m.created_at,
      });
    }
  } catch (e: any) {
    (req as any).logger?.error('home-feed match decisions failed', e instanceof Error ? e : new Error(String(e)), { service: 'request-service', step: 'home-decisions-matches' });
  }

  try {
    // A dib is a private first-ask the REQUESTER sent to a provider; the PROVIDER owes the
    // accept/decline (PUT /dibs/:id/accept|decline require dibs.provider_user_id === caller). So
    // the decision belongs to the provider (member_role 'responder'), with the requester as the
    // counterparty. Only surface live (non-expired) pending dibs — an expired one would 410.
    const dibsRows = await query(
      `SELECT d.id, d.request_id, d.created_at, hr.title, hr.description, hr.payload, hr.category,
              requester.name AS requester_name,
              STRING_AGG(DISTINCT c.name, ', ') AS community_name
       FROM requests.dibs d
       JOIN requests.help_requests hr ON d.request_id = hr.id
       JOIN auth.users requester ON hr.requester_id = requester.id
       LEFT JOIN requests.request_communities rc ON hr.id = rc.request_id
       LEFT JOIN communities.communities c ON rc.community_id = c.id
       WHERE d.provider_user_id = $1 AND d.status = 'pending' AND d.expires_at > NOW()
       GROUP BY d.id, d.request_id, d.created_at, hr.title, hr.description, hr.payload, hr.category, requester.name`,
      [userId]
    );

    for (const d of dibsRows.rows) {
      decisions.push({
        subject_id: d.id,
        subject_kind: 'dibs',
        request_id: d.request_id,
        title: d.title,
        description: d.description ?? '',
        payload: d.payload ?? undefined,
        payload_type: categoryToPayloadType(d.category),
        community_name: d.community_name || '',
        counterparty_name: d.requester_name,
        member_role: 'responder',
        actions: ['accept_dibs', 'decline_dibs'],
        created_at: d.created_at,
      });
    }
  } catch (e: any) {
    (req as any).logger?.error('home-feed dibs decisions failed', e instanceof Error ? e : new Error(String(e)), { service: 'request-service', step: 'home-decisions-dibs' });
  }

  try {
    // Provider (service-directory) offers on the member's OWN requests: the REQUESTER (request
    // owner) accepts/declines (PUT /requests/offers/:id/accept|decline). subject_kind 'offer' routes
    // the band to acceptOffer/declineOffer. Distinct from the match-as-offer flow above.
    const offerRows = await query(
      `SELECT o.id, o.request_id, o.created_at, hr.title, hr.description, hr.payload, hr.category,
              provider.name AS provider_name,
              STRING_AGG(DISTINCT c.name, ', ') AS community_name
       FROM provider.offers o
       JOIN requests.help_requests hr ON o.request_id = hr.id
       JOIN auth.users provider ON o.provider_user_id = provider.id
       LEFT JOIN requests.request_communities rc ON hr.id = rc.request_id
       LEFT JOIN communities.communities c ON rc.community_id = c.id
       WHERE hr.requester_id = $1 AND o.status = 'pending'
       GROUP BY o.id, o.request_id, o.created_at, hr.title, hr.description, hr.payload, hr.category, provider.name`,
      [userId]
    );

    for (const o of offerRows.rows) {
      decisions.push({
        subject_id: o.id,
        subject_kind: 'offer',
        request_id: o.request_id,
        title: o.title,
        description: o.description ?? '',
        payload: o.payload ?? undefined,
        payload_type: categoryToPayloadType(o.category),
        community_name: o.community_name || '',
        counterparty_name: o.provider_name,
        member_role: 'requester',
        actions: ['accept_offer', 'decline_offer'],
        created_at: o.created_at,
      });
    }
  } catch (e: any) {
    (req as any).logger?.error('home-feed offer decisions failed', e instanceof Error ? e : new Error(String(e)), { service: 'request-service', step: 'home-decisions-offers' });
  }

  try {
    // BUG-013: a fully-completed match (both parties marked done → status='completed') owes a
    // RATING from each participant. Today the rating only unlocks in-place for whoever clicked the
    // final mark_done; the other party (and a reload) lose it. Surface a durable `rate` decision for
    // BOTH parties until each has rated — scoped to completed matches the viewer has not yet rated
    // (NOT EXISTS against feedback.feedback, the reputation-service rating store). Same shared DB.
    const rateRows = await query(
      `SELECT m.id, m.request_id, m.completed_at,
              hr.requester_id, m.responder_id, hr.title, hr.description, hr.payload, hr.category,
              requester.name AS requester_name, responder.name AS responder_name,
              STRING_AGG(DISTINCT c.name, ', ') AS community_name,
              MIN(rc.community_id::text) AS community_id
       FROM requests.matches m
       JOIN requests.help_requests hr ON m.request_id = hr.id
       JOIN auth.users requester ON hr.requester_id = requester.id
       JOIN auth.users responder ON m.responder_id = responder.id
       LEFT JOIN requests.request_communities rc ON hr.id = rc.request_id
       LEFT JOIN communities.communities c ON rc.community_id = c.id
       WHERE (hr.requester_id = $1 OR m.responder_id = $1)
         AND m.status = 'completed'
         AND NOT EXISTS (
           SELECT 1 FROM feedback.feedback f
           WHERE f.request_match_id = m.id AND f.from_user_id = $1
         )
       GROUP BY m.id, m.request_id, m.completed_at, hr.requester_id, m.responder_id,
                hr.title, hr.description, hr.payload, hr.category, requester.name, responder.name`,
      [userId]
    );

    for (const m of rateRows.rows) {
      const isRequester = m.requester_id === userId;
      decisions.push({
        subject_id: m.id,
        subject_kind: 'match',
        request_id: m.request_id,
        title: m.title,
        description: m.description ?? '',
        payload: m.payload ?? undefined,
        payload_type: categoryToPayloadType(m.category),
        community_name: m.community_name || '',
        counterparty_name: isRequester ? m.responder_name : m.requester_name,
        counterparty_id: isRequester ? m.responder_id : m.requester_id,
        community_id: m.community_id ?? undefined,
        member_role: isRequester ? 'requester' : 'responder',
        actions: ['rate'],
        created_at: m.completed_at,
      });
    }
  } catch (e: any) {
    (req as any).logger?.error('home-feed rate decisions failed', e instanceof Error ? e : new Error(String(e)), { service: 'request-service', step: 'home-decisions-rate' });
  }

  return decisions.map(buildDecisionItem);
}

/** Sprint 85 / ADR-066 — assemble + send the Dashboard Home unified feed ({ items }). */
/**
 * Sprint 100 / G1 — how many open asks the member has OFFERED to help on and is still waiting to
 * hear back on (responder, match still 'proposed', request still open + unexpired). The curated feed
 * deliberately hides requests the viewer already offered on (BUG-002), and a responder's own pending
 * offer is awaiting the requester — not a decision they owe — so it isn't in the decision band. That
 * left an active helper's Home reading empty while they had many offers in flight (the live audit
 * found one member with 330 such offers). This count powers a single honest Home summary band that
 * points to the Helping tab, so the Home never feels empty for someone who is actively helping.
 * Fail-soft: any error degrades to 0 (the band simply doesn't render) — it never breaks the feed.
 */
/** A single open ask the member has already offered on, awaiting the requester's response. */
interface OfferedAwaitingItem {
  match_id: string;
  request_id: string;
  title: string;
  description: string;
  author_name: string;
  community_id?: string;
  community_name?: string;
  urgency?: string;
  request_type?: string;
  payload_type?: string;
  payload?: unknown;
  requirements?: unknown;
  status: 'proposed';
  offered_at: string;
}

function mapOfferedAwaitingRow(row: any): OfferedAwaitingItem {
  return {
    match_id: row.match_id,
    request_id: row.request_id,
    title: row.title,
    description: row.description,
    author_name: row.author_name || '',
    community_id: row.community_id || undefined,
    community_name: row.community_name || undefined,
    urgency: row.urgency,
    request_type: row.request_type || 'generic',
    // ADR-067 seam fix: normalize the fine payload subtype from the mixed-vocab `category` column.
    payload_type: categoryToPayloadType(row.category) as string | undefined,
    payload: row.payload || {},
    requirements: row.requirements || {},
    status: 'proposed',
    offered_at: row.offered_at,
  };
}

/**
 * Sprint 100/101/108 — distinct open, unexpired asks where the caller holds a `proposed` responder match, split by the
 * `admin_proposed` discriminator — the SAME predicate powers both Home preview bands so the count and
 * items can never disagree. `adminProposed = FALSE` = offered-awaiting (the member's self-offer is
 * awaiting the requester); `adminProposed = TRUE` = suggested-as-helper (the matchmaker proposed this
 * member and the member owes the accept/decline in Helping). COUNT(DISTINCT request_id) because a
 * helper can hold more than one proposed match row on one ask; the preview uses DISTINCT ON
 * (request_id) to dedupe to one item per ask. Fail-soft: any error degrades to an empty band.
 */
async function fetchProposedResponderAsks(
  userId: string,
  adminProposed: boolean,
  previewLimit: number
): Promise<{ count: number; items: OfferedAwaitingItem[] }> {
  try {
    const [countResult, itemResult] = await Promise.all([
      query(
        `SELECT COUNT(DISTINCT m.request_id)::int AS n
           FROM requests.matches m
           JOIN requests.help_requests hr ON hr.id = m.request_id
          WHERE m.responder_id = $1 AND m.status = 'proposed'
            AND m.admin_proposed = $2
            AND hr.status = 'open' AND hr.expired = FALSE`,
        [userId, adminProposed]
      ),
      query(
        // DISTINCT ON (request_id) keeps the preview one row per ask — the same dedupe the DISTINCT
        // count applies — picking the most recent proposed match per ask. Community is a scalar
        // subquery (a request can span communities; the card only needs one label).
        `SELECT DISTINCT ON (m.request_id)
                m.id AS match_id, m.request_id, m.created_at AS offered_at,
                hr.title, hr.description, hr.urgency, hr.request_type, hr.category,
                hr.payload, hr.requirements,
                u.name AS author_name,
                (SELECT rc.community_id::text FROM requests.request_communities rc
                  WHERE rc.request_id = hr.id LIMIT 1) AS community_id,
                (SELECT c.name FROM requests.request_communities rc
                   JOIN communities.communities c ON c.id = rc.community_id
                  WHERE rc.request_id = hr.id LIMIT 1) AS community_name
           FROM requests.matches m
           JOIN requests.help_requests hr ON hr.id = m.request_id
           LEFT JOIN auth.users u ON u.id = hr.requester_id
          WHERE m.responder_id = $1 AND m.status = 'proposed'
            AND m.admin_proposed = $2
            AND hr.status = 'open' AND hr.expired = FALSE
          ORDER BY m.request_id, m.created_at DESC
          LIMIT $3`,
        [userId, adminProposed, previewLimit]
      ),
    ]);
    return {
      count: Number(countResult.rows[0]?.n) || 0,
      items: itemResult.rows.map(mapOfferedAwaitingRow),
    };
  } catch {
    return { count: 0, items: [] };
  }
}

/** Self-offers awaiting the requester's response (admin_proposed = FALSE). */
function fetchOfferedAwaiting(userId: string, previewLimit = 3) {
  return fetchProposedResponderAsks(userId, false, previewLimit);
}

/**
 * Sprint 108 — admin/matchmaker-proposed asks where THIS member was suggested as helper and owes the
 * accept/decline (admin_proposed = TRUE). Home previews them in the calm SuggestedAsHelperPanel and
 * links to Helping, where the actionable DecisionBand lives (BUG-015 keeps decisions off Home).
 */
function fetchSuggestedAsHelper(userId: string, previewLimit = 3) {
  return fetchProposedResponderAsks(userId, true, previewLimit);
}

async function respondHomeFeed(req: Request, res: Response, userId: string, scoredRequests: any[]): Promise<void> {
  // Decisions, offered-awaiting, and suggested-as-helper are independent reads — fetch concurrently.
  const [decisionItems, offeredAwaiting, suggestedAsHelper] = await Promise.all([
    fetchDecisions(req, userId),
    fetchOfferedAwaiting(userId),
    fetchSuggestedAsHelper(userId),
  ]);
  // Sprint 112 (ADR-082): pass a non-reversible RANK (position in the already-feedScore-sorted list),
  // not the exact composite feedScore — priority must not encode a value from which requester trust
  // can be solved. Order is preserved (idx 0 = top); the exact feedScore stays internal.
  const requestItems = scoredRequests.map((r, idx) =>
    buildRequestItem(toRequestCardData(r), scoredRequests.length - idx));
  const { items } = assembleHomeFeed([...decisionItems, ...requestItems]);

  sendSuccess(
    res,
    {
      items,
      count: items.length,
      offeredAwaiting: offeredAwaiting.count,
      offeredAwaitingItems: offeredAwaiting.items,
      // S108: admin-proposed responder matches preview here (Home) and are actionable in Helping.
      suggestedAsHelper: { count: suggestedAsHelper.count, items: suggestedAsHelper.items },
    },
    HTTP_STATUS.OK,
    { requestId: (req as any).id }
  );
}

/** The community's weekly help-loop pulse (wire shape for GET /community/:id/pulse). */
interface CommunityPulse {
  communityName: string;
  helpedThisWeek: number;
  openAsks: number;
  timeSensitive: number;
  recentJoins: number;
  recentHelpers: { name: string; count: number }[];
}

/**
 * Sprint 86 / Sprint 89 (ADR-068) — the community's weekly help-loop pulse. SINGLE source of truth
 * for both the in-feed community-texture `ActivityCard` (`respondCommunityFeed`) and the hero-level
 * `GET /community/:id/pulse` endpoint, so the two numbers can never diverge. Read-only; all facts
 * derive from existing tables. `openAsks`/`timeSensitive` count only `status='open' AND expired=FALSE`
 * (so the pulse never overcounts vs the feed). Returns null when the community is unknown.
 */
async function fetchCommunityPulse(communityId: string): Promise<CommunityPulse | null> {
  const activityResult = await query(
    `SELECT
       c.name AS community_name,
       -- BUG-097-002: member-only semantics — count only exchanges whose responder is an active
       -- member of THIS community, the same subset surfaced in recentHelpers below. This keeps the
       -- "N helped this week" number from outrunning the named helpers (which would otherwise let
       -- the pulse claim exchanges while naming zero qualifying members).
       -- Sprint 100 / F1: COUNT(DISTINCT responder_id), not COUNT(*). The headline reads
       -- "N neighbours helped each other this week" — one neighbour who completes three exchanges is
       -- ONE helper, not three. Raw match rows let the number outrun recentHelpers (which is already
       -- grouped per responder), making the headline unreachable against the named list.
       (SELECT COUNT(DISTINCT m.responder_id) FROM requests.matches m
          JOIN requests.request_communities rc ON m.request_id = rc.request_id
          JOIN communities.members mem
            ON mem.community_id = rc.community_id
           AND mem.user_id = m.responder_id
           AND mem.status = 'active'
          WHERE rc.community_id = $1 AND m.status = 'completed'
            AND m.completed_at >= NOW() - INTERVAL '7 days') AS exchanges_completed_week,
       (SELECT COUNT(*) FROM communities.members mem
          WHERE mem.community_id = $1 AND mem.status = 'active'
            AND mem.joined_at >= NOW() - INTERVAL '7 days') AS new_members_count,
       (SELECT COUNT(*) FROM requests.help_requests hr
          JOIN requests.request_communities rc ON hr.id = rc.request_id
          WHERE rc.community_id = $1 AND hr.status = 'open' AND hr.expired = FALSE) AS open_requests_count,
       (SELECT COUNT(*) FROM requests.help_requests hr
          JOIN requests.request_communities rc ON hr.id = rc.request_id
          WHERE rc.community_id = $1 AND hr.status = 'open' AND hr.expired = FALSE
            AND hr.urgency IN ('urgent','high')) AS time_sensitive
     FROM communities.communities c
     WHERE c.id = $1`,
    [communityId]
  );
  const row = activityResult.rows[0];
  if (!row) return null;

  // BUG-097-002: scope recent helpers to active members of THIS community. Without the
  // communities.members join a responder who helped on a request cross-posted to this community —
  // but who belongs to a different community — would be named here, so the pulse could credit a
  // neighbour who is not actually in the community being rendered.
  // Sprint 100 / F1: group by responder_id (not name) so two distinct helpers who share a display
  // name stay distinct — otherwise they'd collapse into one named entry while helpedThisWeek counts
  // DISTINCT responder_id, breaking the "headline never outruns the named helpers" invariant.
  const helpersResult = await query(
    `SELECT u.name, COUNT(*)::int AS help_count
       FROM requests.matches m
       JOIN requests.request_communities rc ON m.request_id = rc.request_id
       JOIN communities.members mem
         ON mem.community_id = rc.community_id
        AND mem.user_id = m.responder_id
        AND mem.status = 'active'
       JOIN auth.users u ON m.responder_id = u.id
       WHERE rc.community_id = $1 AND m.status = 'completed'
         AND m.completed_at >= NOW() - INTERVAL '7 days'
       GROUP BY m.responder_id, u.name
       ORDER BY help_count DESC
       LIMIT 3`,
    [communityId]
  );

  return {
    communityName: row.community_name || '',
    helpedThisWeek: Number(row.exchanges_completed_week) || 0,
    openAsks: Number(row.open_requests_count) || 0,
    timeSensitive: Number(row.time_sensitive) || 0,
    recentJoins: Number(row.new_members_count) || 0,
    recentHelpers: helpersResult.rows.map((h: any) => ({ name: h.name, count: Number(h.help_count) })),
  };
}

/**
 * Sprint 86 / ADR-066 — assemble + send the Community Feed unified feed ({ items }): the requests
 * the member can fill in this community, then the community texture (one activity summary, then
 * stories). NO decision band — decisions are the member's cross-community queue, a Dashboard-Home
 * concern. Requires a community_id (400) and verifies the caller is a member (403) BEFORE any
 * texture read, so a non-member can never pull a community's texture. Texture queries are
 * best-effort: a failure degrades to "no texture" and logs, never breaking the feed.
 */
async function respondCommunityFeed(
  req: Request,
  res: Response,
  communityId: string | undefined,
  scoredRequests: any[],
): Promise<void> {
  const meta = { requestId: (req as any).id };

  // Guard 1: the community feed is community-scoped — a missing community_id is a client error.
  if (!communityId) {
    sendError(res, 'COMMUNITY_ID_REQUIRED', 'community_id is required for the community feed', HTTP_STATUS.BAD_REQUEST, undefined, meta);
    return;
  }

  // Guard 2: only members see a community's feed + texture (JWT `communities` claim).
  const memberships = (req as any).user?.communities ?? [];
  if (!memberships.some((c: any) => c.id === communityId)) {
    sendError(res, 'NOT_A_MEMBER', 'You must be a member of this community to view its feed', HTTP_STATUS.FORBIDDEN, undefined, meta);
    return;
  }

  // Requests the member can fill (the curated query already scoped these to this community).
  // Sprint 112 (ADR-082): non-reversible rank priority, not the exact composite feedScore (see view=home).
  const requestItems = scoredRequests.map((r, idx) =>
    buildRequestItem(toRequestCardData(r), scoredRequests.length - idx));

  // Texture: best-effort + non-fatal (same pattern as fetchDecisions). Ranked below requests.
  const textureItems: UnifiedFeedItem[] = [];

  try {
    // Reuse the single pulse aggregation so the in-feed ActivityCard and the /pulse endpoint
    // (Sprint 89 / ADR-068) report identical weekly numbers.
    const pulse = await fetchCommunityPulse(communityId);
    if (pulse) {
      textureItems.push(
        buildActivityItem({
          community_id: communityId,
          community_name: pulse.communityName,
          exchanges_completed_week: pulse.helpedThisWeek,
          new_members_count: pulse.recentJoins,
          open_requests_count: pulse.openAsks,
          ...(pulse.recentHelpers.length > 0
            ? { recent_helpers: pulse.recentHelpers.map((h) => ({ name: h.name, help_count: h.count })) }
            : {}),
        })
      );
    }
  } catch (e: any) {
    (req as any).logger?.error('community-feed activity failed', e instanceof Error ? e : new Error(String(e)), { service: 'request-service', step: 'community-activity' });
  }

  try {
    // First-exchange stories: a member whose FIRST completed exchange in this community is recent.
    const storyResult = await query(
      `SELECT u.name AS helper_name, hr.title, c.name AS community_name
         FROM requests.matches m
         JOIN requests.request_communities rc ON m.request_id = rc.request_id
         JOIN requests.help_requests hr ON m.request_id = hr.id
         JOIN auth.users u ON m.responder_id = u.id
         LEFT JOIN communities.communities c ON rc.community_id = c.id
         WHERE rc.community_id = $1 AND m.status = 'completed'
           AND m.completed_at >= NOW() - INTERVAL '14 days'
           AND NOT EXISTS (
             SELECT 1 FROM requests.matches m2
             JOIN requests.request_communities rc2 ON m2.request_id = rc2.request_id
             WHERE rc2.community_id = $1 AND m2.responder_id = m.responder_id
               AND m2.status = 'completed' AND m2.completed_at < m.completed_at
           )
         ORDER BY m.completed_at DESC
         LIMIT 3`,
      [communityId]
    );
    for (const s of storyResult.rows) {
      const story: StoryData = {
        type: 'first_timer',
        title: `${s.helper_name} helped for the first time`,
        description: `Completed "${s.title}" — a first exchange in the community.`,
        community_name: s.community_name || undefined,
      };
      textureItems.push(buildStoryItem(story));
    }
  } catch (e: any) {
    (req as any).logger?.error('community-feed stories failed', e instanceof Error ? e : new Error(String(e)), { service: 'request-service', step: 'community-stories' });
  }

  const { items } = assembleFeed([...requestItems, ...textureItems]);
  sendSuccess(res, { items, count: items.length }, HTTP_STATUS.OK, meta);
}

router.get('/curated', handleCuratedFeed);

/**
 * Sprint 89 / ADR-068 — GET /requests/community/:communityId/pulse
 * The community's weekly help-loop pulse for the warm community Home hero. Members-only: gated on
 * the JWT `communities` claim (NOT `communityMemberships`, which is always undefined → always 403).
 * Reuses the single S86 texture aggregation, so the hero pulse and the in-feed ActivityCard agree.
 */
router.get('/community/:communityId/pulse', async (req: Request, res: Response) => {
  const meta = { requestId: (req as any).id };
  const { communityId } = req.params;

  const memberships = (req as any).user?.communities ?? [];
  if (!memberships.some((c: any) => c.id === communityId)) {
    sendError(res, 'NOT_A_MEMBER', 'You must be a member of this community to view its pulse', HTTP_STATUS.FORBIDDEN, undefined, meta);
    return;
  }

  try {
    const pulse = await fetchCommunityPulse(communityId);
    if (!pulse) {
      sendNotFound(res, 'Community', meta);
      return;
    }
    sendSuccess(
      res,
      {
        helpedThisWeek: pulse.helpedThisWeek,
        openAsks: pulse.openAsks,
        timeSensitive: pulse.timeSensitive,
        recentJoins: pulse.recentJoins,
        recentHelpers: pulse.recentHelpers,
        windowDays: 7,
      },
      HTTP_STATUS.OK,
      meta
    );
  } catch (e: any) {
    (req as any).logger?.error('community pulse failed', e instanceof Error ? e : new Error(String(e)), { service: 'request-service', step: 'community-pulse' });
    sendInternalError(res, 'Failed to load community pulse', e instanceof Error ? e : undefined, meta);
  }
});

/**
 * Sprint 100 / F2 — GET /requests/community/:communityId/open-asks
 * The reachable, read-only backing for the pulse "N open asks across the community" row. Returns
 * EVERY open + unexpired ask attached to the community — INCLUDING the member's own asks and asks
 * they have already offered on — so the pulse number is reachable (the member can see exactly the
 * things it counts). This uses the identical predicate as the pulse `open_requests_count`
 * (`status='open' AND expired=FALSE`, scoped via `request_communities`), so the count and the rows
 * can never diverge. The view is browse-only; the frontend renders these cards read-only (no Offer).
 * Members-only, gated on the JWT `communities` claim (NOT `communityMemberships`).
 */
router.get('/community/:communityId/open-asks', async (req: Request, res: Response) => {
  const meta = { requestId: (req as any).id };
  const { communityId } = req.params;

  const memberships = (req as any).user?.communities ?? [];
  if (!memberships.some((c: any) => c.id === communityId)) {
    sendError(res, 'NOT_A_MEMBER', 'You must be a member of this community to view its open asks', HTTP_STATUS.FORBIDDEN, undefined, meta);
    return;
  }

  try {
    const result = await query(
      `SELECT r.id, r.requester_id, r.title, r.description, r.category, r.urgency, r.status,
              r.created_at, r.updated_at, r.request_type, r.payload, r.requirements,
              r.is_boosted, r.boosted_expires_at,
              u.name AS requester_name,
              c.name AS community_name
         FROM requests.help_requests r
         JOIN requests.request_communities rc ON r.id = rc.request_id AND rc.community_id = $1
         LEFT JOIN auth.users u ON r.requester_id = u.id
         LEFT JOIN communities.communities c ON c.id = $1
        WHERE r.status = 'open' AND r.expired = FALSE
        ORDER BY (r.urgency IN ('urgent','high')) DESC, r.created_at DESC`,
      [communityId]
    );

    // Map to the canonical request-card shape, scoped to THIS community. No match_score — this is a
    // browse view, not a scored feed — so the card simply omits the match signal.
    const items = result.rows.map((r: any) => ({
      request_id: r.id,
      requester_id: r.requester_id,
      title: r.title,
      description: r.description,
      author_name: r.requester_name,
      community_id: communityId,
      community_name: r.community_name || '',
      urgency: r.urgency,
      status: 'open',
      request_type: r.request_type || 'generic',
      payload_type: categoryToPayloadType(r.category),
      payload: r.payload || {},
      requirements: r.requirements || {},
      is_boosted: !!r.is_boosted,
      boosted_expires_at: r.boosted_expires_at || undefined,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));

    sendSuccess(res, { items, count: items.length }, HTTP_STATUS.OK, meta);
  } catch (e: any) {
    (req as any).logger?.error('community open-asks failed', e instanceof Error ? e : new Error(String(e)), { service: 'request-service', step: 'community-open-asks' });
    sendInternalError(res, 'Failed to load community open asks', e instanceof Error ? e : undefined, meta);
  }
});

/**
 * Sprint 107 / BUG-023 — canonical offered-awaiting read.
 * Home's summary band and Helping's explicit list must share the same backend predicate: distinct
 * open, unexpired asks where the caller has a proposed responder match and is waiting on the
 * requester. Route order: before `/:id`, or Express treats "offered-awaiting" as a request id.
 */
router.get('/offered-awaiting', async (req: Request, res: Response) => {
  const meta = { requestId: (req as any).id };
  const userId = (req as any).user?.userId;

  if (!userId) {
    sendError(res, 'AUTH_REQUIRED', 'Authentication required', HTTP_STATUS.UNAUTHORIZED, undefined, meta);
    return;
  }

  const offeredAwaiting = await fetchOfferedAwaiting(userId, 50);
  sendSuccess(res, offeredAwaiting, HTTP_STATUS.OK, meta);
});

/**
 * Sprint 90 / ADR-069 — GET /requests/retention-policy?communityId=
 * Backs the "What Karmyq remembers" transparency page: the resolved retention windows plus a count of
 * the member's OWN requests currently held vs already forgotten. Read-only, no PII (no titles/bodies).
 * Membership-gated on the JWT `communities` claim when a communityId is supplied.
 *
 * ⚠️ Route order: MUST be registered BEFORE `router.get('/:id', ...)` below — Express matches top-down,
 * so a later registration would let `/:id` capture "retention-policy" as an id.
 */
router.get('/retention-policy', async (req: Request, res: Response) => {
  const meta = { requestId: (req as any).id };
  const userId = (req as any).user?.userId;
  const communityId = req.query.communityId as string | undefined;

  // Gate: if scoped to a community, the caller must be a member of it.
  if (communityId) {
    const memberships = (req as any).user?.communities ?? [];
    if (!memberships.some((c: any) => c.id === communityId)) {
      sendError(res, 'NOT_A_MEMBER', 'You must be a member of this community to view its retention policy', HTTP_STATUS.FORBIDDEN, undefined, meta);
      return;
    }
  }

  try {
    const cfg = await query(
      `SELECT community_id, completed_request_window_days, expired_request_window_days, message_window_days
         FROM requests.retention_config`
    );
    const windows = resolveRetentionWindows(cfg.rows, communityId);

    // Counts of the member's own requests: held (free-text intact) vs forgotten (anonymized).
    const countsResult = await query(
      `SELECT
         COUNT(*) FILTER (WHERE r.content_forgotten_at IS NULL)     AS held,
         COUNT(*) FILTER (WHERE r.content_forgotten_at IS NOT NULL) AS forgotten
       FROM requests.help_requests r
       ${communityId ? 'JOIN requests.request_communities rc ON rc.request_id = r.id AND rc.community_id = $2' : ''}
       WHERE r.requester_id = $1`,
      communityId ? [userId, communityId] : [userId]
    );
    const row = countsResult.rows[0] ?? { held: 0, forgotten: 0 };

    sendSuccess(
      res,
      {
        windows,
        counts: { held: Number(row.held) || 0, forgotten: Number(row.forgotten) || 0 },
      },
      HTTP_STATUS.OK,
      meta
    );
  } catch (e: any) {
    (req as any).logger?.error('retention policy failed', e instanceof Error ? e : new Error(String(e)), { service: 'request-service', step: 'retention-policy' });
    sendInternalError(res, 'Failed to load retention policy', e instanceof Error ? e : undefined, meta);
  }
});

// GET /requests/:id - Get specific request (canonical viewer-aware detail read)
//
// Sprint 101: this is the action surface. `viewer_relation` is derived SERVER-SIDE so the UI never
// guesses eligibility (and never shows an Offer button that 403s on click). It is one of:
//   own_request    — the viewer is the requester
//   already_offered — the viewer has a live proposed/matched responder match on this ask
//   can_offer      — open + unexpired, not the viewer's own, no live match, AND the ask is within the
//                    viewer's feed-VISIBILITY audience (member, trust_network/platform scope, or
//                    sister-reachable) per getRequestReachability() — the same boundary POST /matches
//                    enforces. A community-scoped ask the viewer can't see is not_actionable, not
//                    can_offer (no fake Offer button on something outside their audience). The feed's
//                    stochastic RANKING within the visible set is NOT re-gated here.
//   not_actionable — anything else (completed/cancelled/matched, expired-open, or out-of-audience)
// Expired-open asks still return (so the detail page can render a finite state) but are
// not_actionable, which is why the WHERE no longer filters `expired = FALSE`.
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId as string | undefined;

    const result = await query(
      `SELECT
        r.id, r.requester_id, r.title, r.description,
        r.category, r.urgency, r.status, r.expired, r.created_at, r.updated_at,
        r.request_type, r.payload, r.requirements,
        r.visibility_scope, r.visibility_max_degrees,
        r.scheduled_for,
        u.name as requester_name, u.email as requester_email,
        STRING_AGG(DISTINCT c.name, ', ') as community_name,
        STRING_AGG(DISTINCT rc.community_id::text, ',') as community_ids,
        viewer_match.id AS viewer_match_id,
        viewer_match.status AS viewer_match_status
      FROM requests.help_requests r
      LEFT JOIN auth.users u ON r.requester_id = u.id
      LEFT JOIN requests.request_communities rc ON r.id = rc.request_id
      LEFT JOIN communities.communities c ON rc.community_id = c.id
      LEFT JOIN LATERAL (
        SELECT id, status
        FROM requests.matches
        WHERE request_id = r.id
          AND responder_id = $2
          AND status IN ('proposed', 'matched')
        ORDER BY created_at DESC
        LIMIT 1
      ) viewer_match ON TRUE
      WHERE r.id = $1
      GROUP BY r.id, r.requester_id, r.title, r.description, r.category, r.urgency, r.status, r.expired, r.created_at, r.updated_at, r.request_type, r.payload, r.requirements, r.visibility_scope, r.visibility_max_degrees, r.scheduled_for, u.name, u.email, viewer_match.id, viewer_match.status`,
      [id, userId ?? null]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Request not found',
      });
    }

    const row = result.rows[0];
    const isOpenAndUnexpired = row.status === 'open' && row.expired === false;
    const isOwn = !!userId && row.requester_id === userId;
    const alreadyOffered = !!row.viewer_match_id;
    // can_offer needs the request within the viewer's feed-visibility audience (shared boundary with
    // POST /matches). Only check when it could matter — own/already-offered/closed asks short-circuit
    // before the extra query.
    const needsReachability = !isOwn && !alreadyOffered && isOpenAndUnexpired;
    const reachable = needsReachability
      ? (await getRequestReachability(id, userId ?? null)).reachable
      : false;
    const viewerRelation: 'own_request' | 'already_offered' | 'can_offer' | 'not_actionable' =
      isOwn ? 'own_request'
      : alreadyOffered ? 'already_offered'
      : isOpenAndUnexpired && reachable ? 'can_offer'
      : 'not_actionable';

    // Strip the raw lateral-join columns from the wire shape; expose them as a clean contract.
    const { viewer_match_id, viewer_match_status, ...request } = row;
    res.json({
      success: true,
      data: {
        ...request,
        // ADR-067 seam: the fine payload subtype the detail page's RequestPayloadRenderer switches on,
        // normalized from the mixed-vocab `category` column (same derivation as the card path).
        payload_type: categoryToPayloadType(row.category),
        viewer_relation: viewerRelation,
        viewer_match: viewer_match_id ? { id: viewer_match_id, status: viewer_match_status } : null,
      },
    });
  } catch (error: any) {
    (req as any).logger?.error('Error fetching request', error instanceof Error ? error : new Error(String(error)), { service: 'request-service' });
    sendInternalError(res, 'Failed to fetch request', error instanceof Error ? error : undefined);
  }
});

// POST /requests - Create new help request
// SECURITY: requester_id comes from verified JWT token, not from request body
// Supports posting to a single community or all user's communities
// v9.0: Supports polymorphic requests (generic, ride, borrow, service, event)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { community_id, post_to_all_communities, request_type, title, description, urgency, payload, requirements, visibility_scope, visibility_max_degrees, preferred_provider_id, scheduled_for } = req.body;
    // SECURITY: Always use verified userId from JWT, never trust client-provided requester_id
    const requester_id = (req as any).user?.userId;

    // Validation
    if (!requester_id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Validate preferred_provider_id if provided
    let resolvedProviderUserId: string | null = null;
    if (preferred_provider_id) {
      const providerCheck = await query(
        'SELECT id, user_id, service_type, is_active FROM requests.provider_profiles WHERE id = $1',
        [preferred_provider_id]
      );
      if (providerCheck.rows.length === 0) {
        return res.status(400).json({ success: false, message: 'Provider not found', error: 'PROVIDER_NOT_FOUND' });
      }
      const provider = providerCheck.rows[0];
      if (!provider.is_active) {
        return res.status(400).json({ success: false, message: 'Provider is inactive', error: 'PROVIDER_INACTIVE' });
      }
      const resolvedRequestType = request_type || 'generic';
      if (resolvedRequestType !== 'generic' && provider.service_type !== resolvedRequestType) {
        return res.status(400).json({ success: false, message: 'Provider service type does not match request type', error: 'PROVIDER_TYPE_MISMATCH' });
      }
      resolvedProviderUserId = provider.user_id;
    }

    // Derive title from description if not provided (wizard UX omits a title field)
    const resolvedTitle: string = title || (description ? description.slice(0, 80).trim() : '');

    // Validate request using Zod schema (polymorphic validation)
    const requestData = {
      request_type: request_type || 'generic', // Default to generic for backward compatibility
      title: resolvedTitle,
      description,
      urgency: urgency || 'medium',
      ...(payload && { payload }),
      ...(requirements && { requirements }),
    };

    const validation = validateRequest(requestData);
    if (!validation.success) {
      const firstIssue = validation.error.issues[0];
      const fieldPath = firstIssue?.path?.join('.') || 'unknown field';
      const humanMessage = firstIssue
        ? `Invalid request data: ${fieldPath} — ${firstIssue.message}`
        : 'Invalid request data';
      return res.status(400).json({
        success: false,
        message: humanMessage,
        errors: validation.error.format(),
      });
    }

    const validatedData = validation.data;

    // Determine which communities to post to
    let targetCommunityIds: string[] = [];

    if (post_to_all_communities) {
      // Get all active communities for this user
      const userCommunitiesResult = await query(
        `SELECT community_id FROM communities.members
         WHERE user_id = $1 AND status = 'active'`,
        [requester_id]
      );

      if (userCommunitiesResult.rowCount === 0) {
        return res.status(400).json({
          success: false,
          message: 'You are not a member of any communities',
        });
      }

      targetCommunityIds = userCommunitiesResult.rows.map(row => row.community_id);
    } else {
      // Post to specific community
      if (!community_id) {
        return res.status(400).json({
          success: false,
          message: 'community_id is required when not posting to all communities',
        });
      }

      // Verify user is a member of the community
      const memberCheck = await query(
        `SELECT id FROM communities.members
         WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
        [community_id, requester_id]
      );

      if (memberCheck.rowCount === 0) {
        return res.status(403).json({
          success: false,
          message: 'Only community members can post requests',
        });
      }

      targetCommunityIds = [community_id];
    }

    // Get TTL settings, default_request_scope, and enabled_request_types from the first community
    const settingsResult = await query(
      `SELECT s.request_ttl_days, c.default_request_scope,
              cc.enabled_request_types
       FROM communities.settings s
       JOIN communities.communities c ON c.id = s.community_id
       LEFT JOIN communities.community_configs cc ON cc.community_id = s.community_id
       WHERE s.community_id = $1`,
      [targetCommunityIds[0]]
    );
    const ttlDays = settingsResult.rows[0]?.request_ttl_days || 60; // Default to 60 days

    // Validate request type against community's enabled types (if configured).
    // Only enforce against KNOWN built-in type names — legacy names (meal_share, tool_borrow,
    // childcare, … from older seed data) are ignored. If a config lists no built-in types
    // (all-legacy) it reads as unrestricted, matching the empty/null case and the frontend
    // CommunityConfigEditor normalization. See BUG-006.
    const enabledTypes = settingsResult.rows[0]?.enabled_request_types;
    if (Array.isArray(enabledTypes) && enabledTypes.length > 0) {
      const allowedNames = enabledTypes
        .map((t: { name: string }) => t.name)
        .filter((name: string) => (BUILTIN_REQUEST_TYPES as readonly string[]).includes(name));
      if (allowedNames.length > 0 && !allowedNames.includes(validatedData.request_type)) {
        return res.status(400).json({
          success: false,
          message: `Request type '${validatedData.request_type}' is not enabled in this community.`,
          error: 'REQUEST_TYPE_NOT_ENABLED',
        });
      }
    }
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    // ADR-022: Resolve visibility scope
    const validScopes = ['community', 'trust_network', 'platform'];
    const communityDefaultScope = settingsResult.rows[0]?.default_request_scope || 'community';
    const resolvedScope = visibility_scope && validScopes.includes(visibility_scope)
      ? visibility_scope
      : communityDefaultScope;
    const resolvedMaxDegrees = visibility_max_degrees
      ? Math.max(1, Math.min(6, parseInt(visibility_max_degrees)))
      : 3;

    // Sprint 42: Resolve scheduled_for — explicit field takes priority;
    // for ride/event requests fall back to payload datetime fields if not provided.
    // Critical fix: runtime type-check scheduled_for before use; fallback reads from
    // Zod-validated data (not raw payload) to guarantee valid datetime strings.
    const scheduledForRaw: unknown = scheduled_for;
    const resolvedScheduledFor: string | null =
      (typeof scheduledForRaw === 'string' ? scheduledForRaw : null) ??
      (validatedData as any).payload?.departure_time ??
      (validatedData as any).payload?.event_date ??
      null;

    // Validate scheduled_for if provided
    if (resolvedScheduledFor !== null) {
      const parsedDate = new Date(resolvedScheduledFor);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'scheduled_for must be a valid ISO 8601 datetime string',
          error: 'INVALID_SCHEDULED_FOR',
        });
      }
    }

    // Create ONE request (not multiple duplicates)
    // v9.0: Store polymorphic data in request_type, payload, requirements columns
    // ADR-022: Store visibility scope for multi-tier feed
    const result = await query(
      `INSERT INTO requests.help_requests
        (requester_id, title, description, category, urgency, status, request_type, payload, requirements, expires_at, visibility_scope, visibility_max_degrees, preferred_provider_id, scheduled_for)
      VALUES ($1, $2, $3, $4, $5, 'open', $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        requester_id,
        validatedData.title,
        validatedData.description,
        validatedData.request_type, // Store in legacy category field for backward compatibility
        validatedData.urgency,
        validatedData.request_type, // Store in new request_type column
        'payload' in validatedData ? JSON.stringify(validatedData.payload) : '{}',
        requirements ? JSON.stringify(requirements) : '{}',
        expiresAt,
        resolvedScope,
        resolvedMaxDegrees,
        preferred_provider_id ?? null,
        resolvedScheduledFor,
      ]
    );

    const request = result.rows[0];

    // Link the request to all target communities via junction table
    for (const targetCommunityId of targetCommunityIds) {
      await query(
        `INSERT INTO requests.request_communities (request_id, community_id)
        VALUES ($1, $2)`,
        [request.id, targetCommunityId]
      );

      // Publish event for each community (v9.0: includes request_type)
      await publishEvent('request_created', {
        request_id: request.id,
        community_id: targetCommunityId,
        requester_id,
        request_type: validatedData.request_type,
        // service_type aliases request_type for the notification subscriber's provider routing (Sprint 37)
        service_type: validatedData.request_type,
        urgency: request.urgency,
        title: request.title,
      });
    }

    // Publish preferred_provider_selected event if a provider was pre-selected
    if (preferred_provider_id && resolvedProviderUserId) {
      let requesterName = 'A user';
      try {
        const nameResult = await query('SELECT name FROM auth.users WHERE id = $1', [requester_id]);
        if (nameResult.rows.length > 0) requesterName = nameResult.rows[0].name;
      } catch (_) { /* non-blocking */ }

      await publishEvent('preferred_provider_selected', {
        request_id: request.id,
        requester_id,
        requester_name: requesterName,
        provider_id: preferred_provider_id,
        provider_user_id: resolvedProviderUserId,
        request_title: validatedData.title,
        request_type: validatedData.request_type,
      });
    }

    res.status(201).json({
      success: true,
      data: request,
      message: 'Request created successfully',
      communities: targetCommunityIds,
    });
  } catch (error: any) {
    (req as any).logger?.error('Error creating request', error instanceof Error ? error : new Error(String(error)), { service: 'request-service' });
    sendInternalError(res, 'Failed to create request', error instanceof Error ? error : undefined);
  }
});

// PUT /requests/:id - Update request
// SECURITY: user_id comes from verified JWT token, not from request body
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, status, urgency } = req.body;
    // SECURITY: Always use verified userId from JWT, never trust client-provided user_id
    const user_id = (req as any).user?.userId;

    if (!user_id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Check if user is the requester
    const requestCheck = await query(
      `SELECT requester_id FROM requests.help_requests WHERE id = $1`,
      [id]
    );

    if (requestCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Request not found',
      });
    }

    if (requestCheck.rows[0].requester_id !== user_id) {
      return res.status(403).json({
        success: false,
        message: 'Only the requester can update this request',
      });
    }

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }
    if (urgency !== undefined) {
      updates.push(`urgency = $${paramCount++}`);
      values.push(urgency);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await query(
      `UPDATE requests.help_requests
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    if (status === 'completed') {
      await publishEvent('request_completed', {
        request_id: id,
        requester_id: user_id,
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Request updated successfully',
    });
  } catch (error: any) {
    (req as any).logger?.error('Error updating request', error instanceof Error ? error : new Error(String(error)), { service: 'request-service' });
    sendInternalError(res, 'Failed to update request', error instanceof Error ? error : undefined);
  }
});

// DELETE /requests/:id - Cancel request
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    // Check if user is the requester
    const requestCheck = await query(
      `SELECT requester_id FROM requests.help_requests WHERE id = $1`,
      [id]
    );

    if (requestCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Request not found',
      });
    }

    if (requestCheck.rows[0].requester_id !== user_id) {
      return res.status(403).json({
        success: false,
        message: 'Only the requester can cancel this request',
      });
    }

    // Cancel request
    await query(
      `UPDATE requests.help_requests
       SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    // Publish event
    await publishEvent('request_cancelled', {
      request_id: id,
      requester_id: user_id,
    });

    res.json({
      success: true,
      message: 'Request cancelled successfully',
    });
  } catch (error: any) {
    (req as any).logger?.error('Error cancelling request', error instanceof Error ? error : new Error(String(error)), { service: 'request-service' });
    sendInternalError(res, 'Failed to cancel request', error instanceof Error ? error : undefined);
  }
});

/**
 * PUT /requests/:id/privacy
 * Update privacy settings for a request (Social Karma v2.0)
 */
router.put('/:id/privacy', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { is_public, requester_visibility_consent } = req.body;
    const user_id = (req as any).user?.userId;

    if (!user_id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Check if user is the requester
    const requestCheck = await query(
      `SELECT requester_id FROM requests.help_requests WHERE id = $1`,
      [id]
    );

    if (requestCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Request not found',
      });
    }

    if (requestCheck.rows[0].requester_id !== user_id) {
      return res.status(403).json({
        success: false,
        message: 'Only the requester can update privacy settings',
      });
    }

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (typeof is_public !== 'undefined') {
      updates.push(`is_public = $${paramCount++}`);
      values.push(is_public);
    }

    if (typeof requester_visibility_consent !== 'undefined') {
      updates.push(`requester_visibility_consent = $${paramCount++}`);
      values.push(requester_visibility_consent);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No privacy settings provided to update',
      });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await query(
      `UPDATE requests.help_requests
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, is_public, requester_visibility_consent`,
      values
    );

    // Publish privacy settings updated event
    await publishEvent('privacy_settings_updated', {
      entity_type: 'request',
      entity_id: id,
      user_id,
      is_public,
      requester_visibility_consent,
    });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Privacy settings updated',
    });
  } catch (error: any) {
    (req as any).logger?.error('Error updating privacy settings', error instanceof Error ? error : new Error(String(error)), { service: 'request-service' });
    sendInternalError(res, 'Failed to update privacy settings', error instanceof Error ? error : undefined);
  }
});

/**
 * PATCH /requests/:id/admin-triage
 * Admin/moderator endpoint to set urgency override and/or add a community-scoped admin note.
 * Caller must be an active admin or moderator of the specified community, and the request
 * must belong to that community.
 */
router.patch('/:id/admin-triage', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { id } = req.params;
    const { community_id, urgency, note } = req.body;

    if (!community_id) {
      return sendValidationError(res, 'community_id is required');
    }

    if (!urgency && !note) {
      return sendValidationError(res, 'At least one of urgency or note is required');
    }

    // Verify caller is an active admin or moderator of this community AND the request belongs to it
    const authCheck = await query(
      `SELECT m.role
       FROM requests.request_communities rc
       JOIN communities.members m ON rc.community_id = m.community_id
       WHERE rc.request_id = $1
         AND m.user_id = $2
         AND m.role IN ('admin', 'moderator')
         AND m.status = 'active'
         AND rc.community_id = $3
       LIMIT 1`,
      [id, userId, community_id]
    );

    if ((authCheck.rowCount ?? 0) === 0) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: must be an admin or moderator of the specified community',
      });
    }

    const VALID_URGENCY = ['urgent', 'high', 'medium', 'low'] as const;
    type UrgencyValue = typeof VALID_URGENCY[number];

    if (urgency) {
      if (!VALID_URGENCY.includes(urgency as UrgencyValue)) {
        return sendValidationError(res, `urgency must be one of: ${VALID_URGENCY.join(', ')}`);
      }
      await query(
        `UPDATE requests.help_requests SET urgency = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [urgency, id]
      );
    }

    if (note) {
      await query(
        `INSERT INTO requests.request_admin_notes (request_id, community_id, note, updated_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (request_id, community_id)
         DO UPDATE SET note = EXCLUDED.note, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP`,
        [id, community_id, note, userId]
      );
    }

    sendSuccess(res, { message: 'Triage saved' });
  } catch (error: any) {
    (req as any).logger?.error('Error saving admin triage', error instanceof Error ? error : new Error(String(error)), { service: 'request-service' });
    sendInternalError(res, 'Failed to save triage', error instanceof Error ? error : undefined, { requestId: (req as any).id });
  }
});

export default router;
