import { Router, Request, Response } from 'express';
import { getDecayConfig, getGlobalDecayConfig, upsertDecayConfig } from '../database/trustDecayConfigDb';
import { logger } from '../config/logger';

const router = Router();

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
router.get('/decay-config/:communityId', async (req: Request, res: Response) => {
  try {
    const { communityId } = req.params;
    const config = await getDecayConfig(communityId);
    res.json({ success: true, data: config });
  } catch (error) {
    logger.error('Error fetching decay config', error instanceof Error ? error : undefined);
    res.status(500).json({ success: false, message: 'Failed to fetch decay config' });
  }
});

// PUT /trust/decay-config/:communityId — update community decay config (admin only)
router.put('/decay-config/:communityId', async (req: Request, res: Response) => {
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
