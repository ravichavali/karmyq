import { query } from '../database/db';

/**
 * BUG-064: owner-only reads of a standing offer (`requests.help_offers`) look it up by id AND offerer, so a
 * foreign offer answers exactly like a missing one. Callers 404 on zero rows; only the owner sees `status`.
 */
export async function findOwnOffer(id: unknown, userId: string) {
  return query(`SELECT id, status FROM requests.help_offers WHERE id = $1 AND offerer_id = $2`, [id, userId]);
}
