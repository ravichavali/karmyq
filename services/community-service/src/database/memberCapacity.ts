/**
 * Atomic member capacity (Sprint 144, decision 5, ADR-106).
 *
 * The sync trigger on communities.members owns current_members, so an admitting write has already
 * moved the count by the time this runs. Call it AFTER the admitting write, on the same
 * withTransaction client: the trigger's UPDATE holds the community row lock until commit, so a
 * concurrent admitter waits on it and then re-reads the committed count. Throwing (never returning a
 * sentinel) is what makes withTransaction roll the member write and the trigger's increment back
 * together. A pre-write "is it full?" read alone lets two concurrent admissions both pass.
 */

import type { TxQuery } from './db';

export const COMMUNITY_FULL_MESSAGE = 'Community is full (Dunbar\'s number limit reached)';

export class CommunityFullError extends Error {
  constructor() {
    super(COMMUNITY_FULL_MESSAGE);
    this.name = 'CommunityFullError';
  }
}

export interface Capacity {
  current_members: number;
  max_members: number;
}

export async function assertWithinCapacity(q: TxQuery, communityId: string): Promise<Capacity> {
  const result = await q(
    `SELECT current_members, max_members FROM communities.communities WHERE id = $1`,
    [communityId]
  );
  const row = result.rows[0] as Capacity | undefined;
  if (row && row.current_members > row.max_members) {
    throw new CommunityFullError();
  }
  return row as Capacity;
}

/** The count the database holds now (for responses; never compute it in application code). */
export async function readMemberCount(q: TxQuery, communityId: string): Promise<number> {
  const result = await q(`SELECT current_members FROM communities.communities WHERE id = $1`, [communityId]);
  return Number(result.rows[0]?.current_members ?? 0);
}
