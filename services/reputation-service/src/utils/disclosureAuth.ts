/**
 * Sprint 112 — Reputation disclosure authorization helpers (ADR-082).
 *
 * The authenticated identity always comes from the verified JWT; a path parameter never grants
 * access to another member's metrics. These helpers centralize the self / active-membership /
 * community-admin / aggregate-cohort checks and assemble the canonical self summary so each route
 * stays a thin projection boundary.
 */
import { query } from '../database/db';
import {
  getUserKarmaWithDecay,
  getUserTrustScore,
} from '../services/karmaService';
import {
  SelfCommunityReputationSchema,
  type SelfCommunityReputation,
  type ReputationTier,
} from '@karmyq/shared';

/** Aggregates are outward-safe only when they cover at least this many distinct active members. */
export const MIN_AGGREGATE_COHORT = 5;

/** Karma decay half-life used by getUserKarmaWithDecay (6 months ≈ 180 days, ADR-011). */
const KARMA_HALF_LIFE_DAYS = 180;

/**
 * Map a normalized 0–100 reputation score to the canonical self-facing tier. These bands are a
 * presentation choice (ADR-082); they never expose the underlying threshold to other members.
 */
export function reputationTier(score: number): ReputationTier {
  if (score >= 75) return 'highly_trusted';
  if (score >= 50) return 'trusted';
  if (score >= 20) return 'active';
  return 'new';
}

export interface ActiveMembership {
  community_id: string;
  community_name: string;
  role: string;
}

/** Return the caller's active membership (with community name) or null if not an active member. */
export async function getActiveMembership(
  userId: string,
  communityId: string,
): Promise<ActiveMembership | null> {
  const result = await query(
    `SELECT m.community_id, m.role, c.name AS community_name
       FROM communities.members m
       JOIN communities.communities c ON c.id = m.community_id
      WHERE m.user_id = $1 AND m.community_id = $2 AND m.status = 'active'
      LIMIT 1`,
    [userId, communityId],
  );
  return result.rows[0] ?? null;
}

/** Count distinct active members in a community (cohort size for aggregate suppression). */
export async function countActiveMembers(communityId: string): Promise<number> {
  const result = await query(
    `SELECT COUNT(*)::int AS n FROM communities.members WHERE community_id = $1 AND status = 'active'`,
    [communityId],
  );
  return result.rows[0]?.n ?? 0;
}

/** True when the JWT memberships mark the caller as an admin of the community. */
export function isCommunityAdmin(
  memberships: Array<{ id?: string; role?: string }> | undefined,
  communityId: string,
): boolean {
  return (memberships ?? []).some((m) => m.id === communityId && m.role === 'admin');
}

/**
 * Build the canonical community-scoped self summary for the caller, or null when the caller is not
 * an active member of the community. Composes the existing karma-with-decay and trust-score
 * calculations WITHOUT changing their math, then projects to the strict outward DTO.
 */
export async function getSelfCommunityReputation(
  userId: string,
  communityId: string,
): Promise<SelfCommunityReputation | null> {
  const membership = await getActiveMembership(userId, communityId);
  if (!membership) return null;

  const [trust, karma] = await Promise.all([
    getUserTrustScore(userId, communityId),
    getUserKarmaWithDecay(userId, communityId),
  ]);

  const now = new Date().toISOString();
  const karmaCalculatedAt =
    karma.last_updated instanceof Date ? karma.last_updated.toISOString() : now;

  return SelfCommunityReputationSchema.parse({
    scope: {
      type: 'community',
      community_id: communityId,
      community_name: membership.community_name,
    },
    reputation: {
      score: trust.score,
      scale_min: 0,
      scale_max: 100,
      tier: reputationTier(trust.score),
      calculated_at: now,
    },
    karma: {
      current: karma.karma,
      trend: karma.trend,
      half_life_days: KARMA_HALF_LIFE_DAYS,
      calculated_at: karmaCalculatedAt,
    },
    activity: {
      recent_helps: karma.recent_helps,
      recent_requests: karma.recent_requests,
      window_days: 30,
    },
  });
}
