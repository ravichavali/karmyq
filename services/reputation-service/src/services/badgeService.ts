/**
 * badgeService.ts — Prestige Badge logic (ADR-016, Phase 1)
 *
 * Badge types:
 *   first_helper   — first completed match as helper
 *   milestone_10   — 10 completed matches as helper
 *   milestone_50   — 50 completed matches as helper
 *   milestone_100  — 100 completed matches as helper
 *   connector      — helped 10+ distinct people
 */

import { query } from '../database/db';

export const BADGE_TYPES = ['first_helper', 'milestone_10', 'milestone_50', 'milestone_100', 'connector'] as const;
export type BadgeType = typeof BADGE_TYPES[number];

interface BadgeRow {
  id: string;
  user_id: string;
  community_id: string | null;
  badge_type: BadgeType;
  earned_at: string;
}

/** Return all badges a user has already earned. */
export async function getUserBadges(userId: string): Promise<BadgeRow[]> {
  const result = await query(
    `SELECT id, user_id, community_id, badge_type, earned_at
     FROM reputation.badges
     WHERE user_id = $1
     ORDER BY earned_at ASC`,
    [userId]
  );
  return result.rows as BadgeRow[];
}

/**
 * Check badge criteria for a user after a completed match and award any newly earned badges.
 * Called from the match_completed event handler.
 *
 * @param responderId  The helper (responder) user_id
 * @returns            Array of newly awarded badge types (empty if none)
 */
export async function checkAndAwardBadges(responderId: string): Promise<BadgeType[]> {
  // Count total completed matches where this user was the helper
  const statsResult = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'completed') AS completed_as_helper,
       COUNT(DISTINCT requester_id) FILTER (WHERE status = 'completed') AS distinct_people_helped
     FROM requests.matches
     WHERE responder_id = $1`,
    [responderId]
  );

  const completedAsHelper = parseInt(statsResult.rows[0]?.completed_as_helper || '0');
  const distinctPeopleHelped = parseInt(statsResult.rows[0]?.distinct_people_helped || '0');

  // Fetch badges already earned to avoid duplicates
  const existing = await getUserBadges(responderId);
  const alreadyEarned = new Set(existing.map(b => b.badge_type));

  const toAward: BadgeType[] = [];

  if (!alreadyEarned.has('first_helper') && completedAsHelper >= 1) {
    toAward.push('first_helper');
  }
  if (!alreadyEarned.has('milestone_10') && completedAsHelper >= 10) {
    toAward.push('milestone_10');
  }
  if (!alreadyEarned.has('milestone_50') && completedAsHelper >= 50) {
    toAward.push('milestone_50');
  }
  if (!alreadyEarned.has('milestone_100') && completedAsHelper >= 100) {
    toAward.push('milestone_100');
  }
  if (!alreadyEarned.has('connector') && distinctPeopleHelped >= 10) {
    toAward.push('connector');
  }

  if (toAward.length === 0) return [];

  // Insert new badges (ON CONFLICT DO NOTHING for safety)
  for (const badge_type of toAward) {
    await query(
      `INSERT INTO reputation.badges (user_id, badge_type)
       VALUES ($1, $2)
       ON CONFLICT (user_id, badge_type) DO NOTHING`,
      [responderId, badge_type]
    );
    console.log(`🏅 Badge awarded: user=${responderId} badge=${badge_type}`);
  }

  return toAward;
}
