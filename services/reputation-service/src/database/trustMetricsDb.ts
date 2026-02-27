import { query } from './db';

export interface TrustMetrics {
  repeat_interaction_pairs: number;   // unique counterparties seen 2+ times (bonding capital)
  distinct_people_count: number;      // unique counterparties ever (helper or requester)
  distinct_communities_count: number; // communities where user completed an interaction
}

/**
 * Compute trust metrics for a user in a community (ADR-037).
 *
 * Uses karma_records as the source of truth for completed interactions:
 *   reason = 'Provided help'  → user was the helper
 *   reason = 'Received help'  → user was the requester
 *
 * distinct_people: looks up the match record (via related_entity_id = match_id) to find
 * the other participant in each completed interaction. Approximated via the karma_records
 * for the same match — the "other party" also has a record for the same match_id.
 *
 * distinct_communities: communities where karma was awarded (not just memberships).
 *
 * repeat_pairs: counterparties who appear in 2+ separate matches with this user.
 */
export async function getTrustMetrics(userId: string, communityId: string): Promise<TrustMetrics> {
  // Distinct communities where the user has completed an interaction
  const commResult = await query(
    `SELECT COUNT(DISTINCT community_id) AS distinct_communities
     FROM reputation.karma_records
     WHERE user_id = $1
       AND reason IN ('Provided help', 'Received help')`,
    [userId],
  );

  // Distinct counterparties: for each match the user participated in, find the other party.
  // "Other party" = a karma record for the same match_id, different user_id.
  const peopleResult = await query(
    `SELECT COUNT(DISTINCT other.user_id) AS distinct_people
     FROM reputation.karma_records AS me
     JOIN reputation.karma_records AS other
       ON other.related_entity_id = me.related_entity_id
      AND other.user_id != me.user_id
      AND other.reason IN ('Provided help', 'Received help')
     WHERE me.user_id = $1
       AND me.community_id = $2
       AND me.reason IN ('Provided help', 'Received help')`,
    [userId, communityId],
  );

  // Repeat pairs: counterparties seen in 2+ distinct matches in this community
  const repeatResult = await query(
    `SELECT COUNT(*) AS repeat_pairs
     FROM (
       SELECT other.user_id
       FROM reputation.karma_records AS me
       JOIN reputation.karma_records AS other
         ON other.related_entity_id = me.related_entity_id
        AND other.user_id != me.user_id
        AND other.reason IN ('Provided help', 'Received help')
       WHERE me.user_id = $1
         AND me.community_id = $2
         AND me.reason IN ('Provided help', 'Received help')
       GROUP BY other.user_id
       HAVING COUNT(DISTINCT me.related_entity_id) >= 2
     ) AS pairs`,
    [userId, communityId],
  );

  return {
    repeat_interaction_pairs: parseInt(repeatResult.rows[0]?.repeat_pairs || 0),
    distinct_people_count: parseInt(peopleResult.rows[0]?.distinct_people || 0),
    distinct_communities_count: parseInt(commResult.rows[0]?.distinct_communities || 0),
  };
}
