/**
 * Helper functions for querying requests with junction table architecture
 *
 * After v5.3.0, help_requests no longer has a community_id column.
 * Instead, requests are linked to communities via the request_communities junction table.
 */

import { Pool } from 'pg';

export interface HelpRequest {
  id: string;
  requester_id: string;
  title?: string;
  description: string;
  type: string;
  status: string;
  location?: string;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  expired?: boolean;
}

/**
 * Get all requests for a specific community
 */
export async function getRequestsByCommunity(
  pool: Pool,
  communityId: string
): Promise<HelpRequest[]> {
  const result = await pool.query<HelpRequest>(`
    SELECT DISTINCT r.*
    FROM requests.help_requests r
    JOIN requests.request_communities rc ON r.id = rc.request_id
    WHERE rc.community_id = $1
    ORDER BY r.created_at DESC
  `, [communityId]);

  return result.rows;
}

/**
 * Get all communities a request is posted to
 */
export async function getRequestCommunities(
  pool: Pool,
  requestId: string
): Promise<string[]> {
  const result = await pool.query<{ community_id: string }>(`
    SELECT community_id
    FROM requests.request_communities
    WHERE request_id = $1
  `, [requestId]);

  return result.rows.map(r => r.community_id);
}

/**
 * Check if a request is posted to a specific community
 */
export async function isRequestInCommunity(
  pool: Pool,
  requestId: string,
  communityId: string
): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(`
    SELECT EXISTS(
      SELECT 1
      FROM requests.request_communities
      WHERE request_id = $1 AND community_id = $2
    ) as exists
  `, [requestId, communityId]);

  return result.rows[0]?.exists || false;
}

/**
 * Get request details with all its communities
 */
export async function getRequestWithCommunities(
  pool: Pool,
  requestId: string
): Promise<HelpRequest & { community_ids: string[] } | null> {
  const requestResult = await pool.query<HelpRequest>(`
    SELECT *
    FROM requests.help_requests
    WHERE id = $1
  `, [requestId]);

  if (requestResult.rows.length === 0) {
    return null;
  }

  const communities = await getRequestCommunities(pool, requestId);

  return {
    ...requestResult.rows[0],
    community_ids: communities,
  };
}

/**
 * Count requests in a community
 */
export async function countRequestsInCommunity(
  pool: Pool,
  communityId: string,
  status?: string
): Promise<number> {
  let query = `
    SELECT COUNT(DISTINCT r.id) as count
    FROM requests.help_requests r
    JOIN requests.request_communities rc ON r.id = rc.request_id
    WHERE rc.community_id = $1
  `;

  const params: any[] = [communityId];

  if (status) {
    query += ` AND r.status = $2`;
    params.push(status);
  }

  const result = await pool.query<{ count: string }>(query, params);

  return parseInt(result.rows[0]?.count || '0', 10);
}

/**
 * Get requests that are posted to multiple communities
 */
export async function getMultiCommunityRequests(
  pool: Pool
): Promise<(HelpRequest & { community_count: number })[]> {
  const result = await pool.query<HelpRequest & { community_count: number }>(`
    SELECT r.*, COUNT(rc.community_id) as community_count
    FROM requests.help_requests r
    JOIN requests.request_communities rc ON r.id = rc.request_id
    GROUP BY r.id
    HAVING COUNT(rc.community_id) > 1
    ORDER BY r.created_at DESC
  `);

  return result.rows.map(row => ({
    ...row,
    community_count: parseInt(row.community_count as any, 10),
  }));
}

/**
 * Get requests by user in a specific community
 */
export async function getUserRequestsInCommunity(
  pool: Pool,
  userId: string,
  communityId: string
): Promise<HelpRequest[]> {
  const result = await pool.query<HelpRequest>(`
    SELECT DISTINCT r.*
    FROM requests.help_requests r
    JOIN requests.request_communities rc ON r.id = rc.request_id
    WHERE r.requester_id = $1 AND rc.community_id = $2
    ORDER BY r.created_at DESC
  `, [userId, communityId]);

  return result.rows;
}

/**
 * Delete all request-community associations for a request
 * (useful for test cleanup)
 */
export async function deleteRequestCommunities(
  pool: Pool,
  requestId: string
): Promise<void> {
  await pool.query(`
    DELETE FROM requests.request_communities
    WHERE request_id = $1
  `, [requestId]);
}

/**
 * Add a request to a community (useful for tests)
 */
export async function addRequestToCommunity(
  pool: Pool,
  requestId: string,
  communityId: string
): Promise<void> {
  await pool.query(`
    INSERT INTO requests.request_communities (request_id, community_id)
    VALUES ($1, $2)
    ON CONFLICT (request_id, community_id) DO NOTHING
  `, [requestId, communityId]);
}

/**
 * Remove a request from a community (useful for tests)
 */
export async function removeRequestFromCommunity(
  pool: Pool,
  requestId: string,
  communityId: string
): Promise<void> {
  await pool.query(`
    DELETE FROM requests.request_communities
    WHERE request_id = $1 AND community_id = $2
  `, [requestId, communityId]);
}
