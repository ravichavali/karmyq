/**
 * Operator backfill for the ADR-100 lost-enqueue gap: recompute every pair's `endorsement_count` from
 * `auth.skill_endorsements`. Both modes run the event handler's own reconcile under the pair lock; the
 * default dry run rolls back instead of writing, so the preview is exactly what `--apply` would write.
 *
 *   docker exec <social-graph container> node dist/scripts/reconcileEndorsementEdges.js           # dry run
 *   docker exec <social-graph container> node dist/scripts/reconcileEndorsementEdges.js --apply   # write
 *
 * Running --apply against the demo is a demo data operation: it needs its own maintainer authorization.
 */
import { pool } from '../config/database';
import { reconcileEndorsementPair } from '../services/endorsementReconcile';

export interface EndorsementDrift { user_id_a: string; user_id_b: string; community_id: string; stored: number | null; target: number }
export interface ReconcileRunResult { pairs: number; drifted: EndorsementDrift[]; applied: number }

export async function runReconcileEndorsementEdges(opts: { apply: boolean; log?: (line: string) => void }): Promise<ReconcileRunResult> {
  const log = opts.log ?? ((line: string) => console.log(line));
  // Every pair that has, or ever had, an endorsement, plus any edge still carrying a count.
  const pairs = (await pool.query(`
    SELECT LEAST(endorser_id::text, endorsee_id::text)::uuid AS a, GREATEST(endorser_id::text, endorsee_id::text)::uuid AS b
    FROM auth.skill_endorsements
    UNION
    SELECT user_id_a, user_id_b FROM social_graph.trust_edges WHERE endorsement_count <> 0`)).rows as Array<{ a: string; b: string }>;

  const drifted: EndorsementDrift[] = [];
  let applied = 0;
  for (const { a, b } of pairs) {
    const plan = await reconcileEndorsementPair(a, b, { dryRun: !opts.apply });
    const pairDrift = [
      ...plan.updates.map(u => ({ user_id_a: a, user_id_b: b, community_id: u.community_id, stored: u.from as number | null, target: u.n })),
      ...plan.inserts.map(i => ({ user_id_a: a, user_id_b: b, community_id: i.community_id, stored: null, target: i.n })),
    ];
    if (!pairDrift.length) continue;
    drifted.push(...pairDrift);
    for (const d of pairDrift) log(`drift ${d.user_id_a}/${d.user_id_b} in ${d.community_id}: stored ${d.stored ?? 'none'} -> target ${d.target}`);
    if (opts.apply) applied++;
  }
  log(`${pairs.length} pair(s) checked, ${drifted.length} drifted edge(s), ${opts.apply ? `${applied} pair(s) reconciled` : 'dry run: nothing written'}`);
  return { pairs: pairs.length, drifted, applied };
}

if (require.main === module) {
  runReconcileEndorsementEdges({ apply: process.argv.includes('--apply') })
    .then(() => pool.end())
    .catch(async error => {
      console.error('Endorsement edge reconcile failed:', error);
      await pool.end();
      process.exit(1);
    });
}
