import type { PoolClient } from 'pg';
import { getInteractionWeightsForCommunity, normalizePair, updateRawWeightInPlace, withPairLock } from '../database/trustEdgeDb';

/**
 * Sprint 133 PR B / ADR-100: skill endorsements feed `trust_edges.endorsement_count` by RECONCILE, never
 * by increment. For the pair (a, b) in community c the count is the number of DISTINCT endorsers among
 * {a, b} holding at least one active endorsement of the other whose qualifying match's request belongs
 * to c — always 0, 1 or 2. Recomputing from source makes redelivery, withdrawal and tag deletion exact.
 */

export interface EndorsementTarget { community_id: string; n: number }
export interface StoredEdge { id: string; community_id: string; endorsement_count: number }
export interface EndorsementWritePlan {
  updates: Array<{ id: string; community_id: string; n: number; increased: boolean }>;
  inserts: Array<{ community_id: string; n: number }>;
}

/** Decide the writes: set every stored edge to its target (0 when absent), insert a missing edge only for n > 0. */
export function planEndorsementWrites(targets: EndorsementTarget[], edges: StoredEdge[]): EndorsementWritePlan {
  const wanted = new Map<string, number>();
  for (const t of targets) {
    if (!Number.isInteger(t.n) || t.n < 0 || t.n > 2) throw new Error(`endorsement pair count must be 0..2, got ${t.n} for ${t.community_id}`);
    wanted.set(t.community_id, t.n);
  }
  const plan: EndorsementWritePlan = { updates: [], inserts: [] };
  for (const edge of edges) {
    const n = wanted.get(edge.community_id) ?? 0;
    if (n !== edge.endorsement_count) plan.updates.push({ id: edge.id, community_id: edge.community_id, n, increased: n > edge.endorsement_count });
    wanted.delete(edge.community_id);
  }
  for (const [community_id, n] of wanted) if (n > 0) plan.inserts.push({ community_id, n });
  return plan;
}

// Per-community distinct endorsers for the normalized pair ($1 < $2), from active endorsements only.
export const ENDORSEMENT_TARGETS_SQL = `
  SELECT rc.community_id, COUNT(DISTINCT se.endorser_id)::int AS n
  FROM auth.skill_endorsements se
  JOIN requests.matches m ON m.id = se.match_id
  JOIN requests.request_communities rc ON rc.request_id = m.request_id
  WHERE se.withdrawn_at IS NULL
    AND ((se.endorser_id = $1 AND se.endorsee_id = $2) OR (se.endorser_id = $2 AND se.endorsee_id = $1))
  GROUP BY rc.community_id`;

type Barrier = (pair: { userIdA: string; userIdB: string }) => Promise<void>;
let barrier: Barrier | null = null;
/** Test-only pause between the source read and the edge write (Critical Note 6 (f)/(g)). Production never sets it. */
export function setReconcileBarrierForTests(fn: Barrier | null): void { barrier = fn; }

/** The reconcile body. Callers MUST hold the pair lock; only the negative-control test runs it without. */
export async function reconcileEndorsementPairLocked(client: PoolClient, userIdA: string, userIdB: string): Promise<EndorsementWritePlan> {
  const targets = (await client.query(ENDORSEMENT_TARGETS_SQL, [userIdA, userIdB])).rows as EndorsementTarget[];
  if (barrier) await barrier({ userIdA, userIdB });
  const edges = (await client.query(
    `SELECT id, community_id, endorsement_count FROM social_graph.trust_edges
     WHERE user_id_a = $1 AND user_id_b = $2 FOR UPDATE`, [userIdA, userIdB])).rows as StoredEdge[];
  const plan = planEndorsementWrites(targets, edges);

  for (const u of plan.updates) {
    await client.query(
      `UPDATE social_graph.trust_edges
       SET endorsement_count = $1, updated_at = NOW(),
           last_interaction_at = CASE WHEN $2::boolean THEN NOW() ELSE last_interaction_at END
       WHERE id = $3`, [u.n, u.increased, u.id]);
    await updateRawWeightInPlace(client, [u.id], await getInteractionWeightsForCommunity(u.community_id));
  }
  for (const ins of plan.inserts) {
    const inserted = await client.query(
      `INSERT INTO social_graph.trust_edges (user_id_a, user_id_b, community_id, endorsement_count, raw_weight, last_interaction_at)
       VALUES ($1, $2, $3, $4, 0, NOW())
       ON CONFLICT (user_id_a, user_id_b, community_id) DO UPDATE SET
         endorsement_count = EXCLUDED.endorsement_count, last_interaction_at = NOW(), updated_at = NOW()
       RETURNING id`, [userIdA, userIdB, ins.community_id, ins.n]);
    await updateRawWeightInPlace(client, [inserted.rows[0].id], await getInteractionWeightsForCommunity(ins.community_id));
  }
  return plan;
}

/** Reconcile one pair under its advisory lock. Idempotent: running it 1 or 10 times yields the same rows. */
export async function reconcileEndorsementPair(userA: string, userB: string): Promise<EndorsementWritePlan> {
  const { userIdA, userIdB } = normalizePair(userA, userB);
  return withPairLock(userIdA, userIdB, client => reconcileEndorsementPairLocked(client, userIdA, userIdB));
}
