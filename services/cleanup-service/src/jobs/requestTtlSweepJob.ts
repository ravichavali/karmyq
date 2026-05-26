import pool from '../database/db';
import { logger } from '../utils/logger';

export async function sweepExpiredRequests(): Promise<number> {
  // Delete matches first (FK constraint: matches.request_id → help_requests.id)
  await pool.query(`
    DELETE FROM requests.matches
    WHERE request_id IN (
      SELECT hr.id FROM requests.help_requests hr
      WHERE hr.status = 'completed'
        AND hr.updated_at < NOW() - INTERVAL '30 days'
        AND EXISTS (
          SELECT 1 FROM requests.matches m
          WHERE m.request_id = hr.id
            AND m.requester_rating IS NOT NULL
            AND m.responder_rating IS NOT NULL
        )
    )
  `);

  const result = await pool.query(`
    DELETE FROM requests.help_requests
    WHERE status = 'completed'
      AND updated_at < NOW() - INTERVAL '30 days'
      AND NOT EXISTS (
        SELECT 1 FROM requests.matches m
        WHERE m.request_id = requests.help_requests.id
          AND (m.requester_rating IS NULL OR m.responder_rating IS NULL)
      )
  `);

  const deleted = result.rowCount ?? 0;
  logger.info('Request TTL sweep complete', { deleted });
  return deleted;
}
