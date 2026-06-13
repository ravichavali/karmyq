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
