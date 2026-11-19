/**
 * The one UUID shape check for community-service (Sprint 144, BUG-104).
 *
 * PostgreSQL renders uuid values lowercase. Any request-supplied id that route code compares in
 * JavaScript against a DB value must go through canonicalUuid first: comparing the raw string lets
 * an uppercase spelling of the same UUID miss a match, which is how the staff PUT's last-admin guard
 * was skipped. Ids taken from the verified JWT were issued from DB values and are compared as issued.
 */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The lowercase form of a well-formed UUID string, or null. Never trims. */
export function canonicalUuid(value: unknown): string | null {
  return typeof value === 'string' && UUID_RE.test(value) ? value.toLowerCase() : null;
}
