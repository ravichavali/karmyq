import { Router, Request, Response } from 'express';
import { RouteParams } from '@karmyq/shared/middleware/auth';
import { getDecayConfig, getGlobalDecayConfig, upsertDecayConfig } from '../database/trustDecayConfigDb';
import { logger } from '../config/logger';
import { pool } from '../config/database';

const router = Router();

// Sprint 112 (ADR-082): the community-specific decay policy is a community_aggregate read — require
// active membership. (The global default config stays open; PUT remains admin-only.)
async function isActiveMember(communityId: string, userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  const r = await pool.query(
    `SELECT 1 FROM communities.members WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
    [communityId, userId]
  );
  return r.rows.length > 0;
}

// GET /trust/decay-config — global default config
router.get('/decay-config', async (_req: Request, res: Response) => {
  try {
    const config = await getGlobalDecayConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    logger.error('Error fetching global decay config', error instanceof Error ? error : undefined);
    res.status(500).json({ success: false, message: 'Failed to fetch decay config' });
  }
});

// GET /trust/decay-config/:communityId — community-specific config (falls back to global)
router.get('/decay-config/:communityId', async (req: Request<RouteParams>, res: Response) => {
  try {
    const { communityId } = req.params;
    if (!(await isActiveMember(communityId, (req as any).user?.userId))) {
      return res.status(404).json({ success: false, message: 'Decay config not available', error: 'DECAY_CONFIG_NOT_AVAILABLE' });
    }
    const config = await getDecayConfig(communityId);
    res.json({ success: true, data: config });
  } catch (error) {
    logger.error('Error fetching decay config', error instanceof Error ? error : undefined);
    res.status(500).json({ success: false, message: 'Failed to fetch decay config' });
  }
});

// PUT /trust/decay-config/:communityId — update community decay config (admin only)
router.put('/decay-config/:communityId', async (req: Request<RouteParams>, res: Response) => {
  try {
    const user = (req as any).user;
    const memberships = user?.communities ?? [];
    const { communityId } = req.params;

    const isAdmin =
      user?.role === 'admin' ||
      memberships.some((m: any) => m.id === communityId && m.role === 'admin');

    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Admin privileges required' });
    }

    const { baseHalfLifeDays, stabilityGrowthRate, disappearanceThreshold } = req.body;
    const config = await upsertDecayConfig(communityId, {
      baseHalfLifeDays,
      stabilityGrowthRate,
      disappearanceThreshold,
    });
    res.json({ success: true, data: config });
  } catch (error) {
    logger.error('Error updating decay config', error instanceof Error ? error : undefined);
    res.status(500).json({ success: false, message: 'Failed to update decay config' });
  }
});

export default router;
