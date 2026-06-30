import { Router } from 'express';
import { logger } from '../config/logger';
import { isUuid } from '../services/communityContext';
import {
  buildRelationshipContext,
  RelationshipContextProjectionSchema,
} from '../services/relationshipContextService';

const router = Router();

function parseParticipantIds(body: unknown): { viewerId: string; counterpartId: string } | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  if (Object.keys(record).sort().join(',') !== 'counterpartId,viewerId') return null;
  if (!isUuid(record.viewerId) || !isUuid(record.counterpartId)) return null;
  if (record.viewerId === record.counterpartId) return null;
  return { viewerId: record.viewerId, counterpartId: record.counterpartId };
}

router.post('/', async (req, res) => {
  const participants = parseParticipantIds(req.body);
  if (!participants) {
    return res.status(400).json({
      success: false,
      message: 'Two different participant IDs are required',
      error: 'VALIDATION_ERROR',
    });
  }

  try {
    const { viewerId, counterpartId } = participants;
    const projection = await buildRelationshipContext(viewerId, counterpartId, { capPerSide: 8 });
    return res.json({
      success: true,
      data: RelationshipContextProjectionSchema.parse(projection),
    });
  } catch (error) {
    logger.error(
      'Unable to build internal relationship context',
      error instanceof Error ? error : undefined,
    );
    return res.status(500).json({
      success: false,
      message: 'Unable to build relationship context',
      error: 'INTERNAL_ERROR',
    });
  }
});

export default router;
