import pool from '../database/db';
import { logger } from '../utils/logger';

export async function sweepDeadTrustEdges(): Promise<number> {
  const result = await pool.query(`
    DELETE FROM social_graph.trust_edges
    WHERE id IN (
      SELECT te.id
      FROM social_graph.trust_edges_live tel
      JOIN social_graph.trust_edges te ON te.id = tel.id
      WHERE tel.current_weight < COALESCE(
        (SELECT disappearance_threshold FROM social_graph.trust_decay_config
         WHERE community_id = te.community_id LIMIT 1),
        (SELECT disappearance_threshold FROM social_graph.trust_decay_config
         WHERE community_id IS NULL LIMIT 1),
        0.5
      )
    )
  `);
  const deleted = result.rowCount ?? 0;
  logger.info('Trust edge sweep complete', { deleted });
  return deleted;
}
