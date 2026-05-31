/**
 * Community identity helpers (Sprint 77, ADR-062).
 *
 * A community's identity is the case-insensitive, trimmed pair of its name and
 * location. Two real communities may share a name in different cities, so
 * location is part of the key; a null/absent location coalesces to ''. This key
 * is what makes `POST /communities` idempotent and is enforced by a partial
 * unique index on active rows.
 */

export interface CommunityIdentityRow {
  id: string | number;
  created_at: string | Date;
}

const IDENTITY_SEP = ' ';

function norm(value?: string | null): string {
  return (value ?? '').toLowerCase().trim();
}

/**
 * Normalize a name + location into the canonical identity key used to detect
 * duplicate communities. Lowercased, trimmed, null location => ''.
 */
export function identityKey(name?: string | null, location?: string | null): string {
  return norm(name) + IDENTITY_SEP + norm(location);
}

/**
 * Pick the canonical survivor among rows sharing an identity: the oldest
 * (lowest created_at), tie-broken by lowest id. Returns null for an empty list.
 */
export function pickCanonical<T extends CommunityIdentityRow>(rows: T[]): T | null {
  if (!rows || rows.length === 0) return null;
  return rows.reduce((best, row) => {
    const bestTime = new Date(best.created_at).getTime();
    const rowTime = new Date(row.created_at).getTime();
    if (rowTime < bestTime) return row;
    if (rowTime > bestTime) return best;
    return String(row.id) < String(best.id) ? row : best;
  });
}
