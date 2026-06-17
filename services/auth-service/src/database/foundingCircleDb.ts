/**
 * Founding-circle submissions data access (Sprint 96, ADR-076).
 *
 * Parameterized inserts for public, unauthenticated landing-page intake.
 */

import { query } from './db';

export interface FoundingCircleSubmission {
  email: string;
  lens: string | null;
  contribution: string | null;
  concern: string | null;
  source_page: string;
}

export type FoundingCircleStatus = 'new' | 'reviewed' | 'contacted' | 'archived';

export interface FoundingCircleSubmissionRecord extends FoundingCircleSubmission {
  id: string;
  status: FoundingCircleStatus;
  created_at: string;
  reviewed_at: string | null;
}

export interface ListFoundingCircleSubmissionsOptions {
  status?: FoundingCircleStatus;
  limit: number;
  offset: number;
}

/**
 * Insert a founding-circle submission and return its generated id.
 * Parameterized — no string interpolation of user input.
 */
export async function insertFoundingCircleSubmission(
  value: FoundingCircleSubmission
): Promise<string> {
  const result = await query(
    `INSERT INTO auth.founding_circle_submissions
       (email, lens, contribution, concern, source_page)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [value.email, value.lens, value.contribution, value.concern, value.source_page]
  );
  return result.rows[0].id;
}

export async function isFoundingCircleReviewer(userId: string): Promise<boolean> {
  const result = await query(
    `SELECT 1
     FROM communities.members
     WHERE user_id = $1 AND role = 'admin' AND status = 'active'
     LIMIT 1`,
    [userId]
  );
  return result.rows.length > 0;
}

export async function listFoundingCircleSubmissions(
  options: ListFoundingCircleSubmissionsOptions
): Promise<{ items: FoundingCircleSubmissionRecord[]; count: number; limit: number; offset: number }> {
  const params: Array<string | number> = [];
  const where = options.status ? 'WHERE status = $1' : '';
  if (options.status) params.push(options.status);

  const limitParam = params.length + 1;
  const offsetParam = params.length + 2;
  const rowsResult = await query(
    `SELECT id, email, lens, contribution, concern, source_page, status, created_at, reviewed_at
     FROM auth.founding_circle_submissions
     ${where}
     ORDER BY created_at DESC
     LIMIT $${limitParam} OFFSET $${offsetParam}`,
    [...params, options.limit, options.offset]
  );
  const countResult = await query(
    `SELECT COUNT(*)::int AS count
     FROM auth.founding_circle_submissions
     ${where}`,
    params
  );

  return {
    items: rowsResult.rows,
    count: countResult.rows[0]?.count ?? 0,
    limit: options.limit,
    offset: options.offset,
  };
}

export async function updateFoundingCircleSubmissionStatus(
  id: string,
  status: FoundingCircleStatus
): Promise<FoundingCircleSubmissionRecord | null> {
  const result = await query(
    `UPDATE auth.founding_circle_submissions
     SET status = $2,
         reviewed_at = CASE
           WHEN status = 'new' AND $2 <> 'new' AND reviewed_at IS NULL THEN CURRENT_TIMESTAMP
           ELSE reviewed_at
         END
     WHERE id = $1
     RETURNING id, email, lens, contribution, concern, source_page, status, created_at, reviewed_at`,
    [id, status]
  );

  return result.rows[0] ?? null;
}
