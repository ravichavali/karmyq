import { Router, type Response } from 'express';
import {
  RelationshipContextSchema,
  type RelationshipContext,
} from '@karmyq/shared';
import type { AuthenticatedRequest } from '@karmyq/shared/middleware/auth';
import {
  resolveMatchPair,
  resolveProviderOfferPair,
  resolveRequestPair,
  type ContextPair,
  type ContextResolution,
} from '../db/relationshipContextDb';
import {
  fetchRelationshipTopology,
  RelationshipContextUnavailableError,
  type RelationshipTopology,
} from '../services/socialGraphContextClient';

const router = Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function composeRelationshipContext(
  pair: ContextPair,
  topology: RelationshipTopology,
): RelationshipContext {
  const counterpart = pair.provider
    ? { ...topology.counterpart, role: 'provider' as const, provider: pair.provider }
    : { ...topology.counterpart, role: 'member' as const };
  return RelationshipContextSchema.parse({
    ...topology,
    counterpart,
    request: {
      id: pair.requestId,
      visibilityScope: pair.visibilityScope,
      reachability: pair.reachability,
    },
  }) as RelationshipContext;
}

function validIds(...ids: string[]): boolean {
  return ids.every(id => UUID_RE.test(id));
}

async function respondWithContext(
  req: AuthenticatedRequest,
  res: Response,
  resolutionPromise: Promise<ContextResolution>,
) {
  try {
    const resolution = await resolutionPromise;
    if (resolution.kind === 'not_found') {
      return res.status(404).json({ success: false, message: 'Context resource not found', error: 'NOT_FOUND' });
    }
    if (resolution.kind === 'forbidden') {
      return res.status(403).json({ success: false, message: 'Not authorized', error: 'FORBIDDEN' });
    }
    if (resolution.kind === 'unavailable') {
      return res.status(503).json({
        success: false,
        message: 'Relationship context is temporarily unavailable',
        error: 'RELATIONSHIP_CONTEXT_UNAVAILABLE',
      });
    }
    if (resolution.kind === 'no_context') return res.status(204).send();

    const topology = await fetchRelationshipTopology(
      resolution.pair.viewerId,
      resolution.pair.counterpartId,
    );
    return res.json({ success: true, data: composeRelationshipContext(resolution.pair, topology) });
  } catch (error) {
    if (error instanceof RelationshipContextUnavailableError) {
      return res.status(503).json({
        success: false,
        message: 'Relationship context is temporarily unavailable',
        error: 'RELATIONSHIP_CONTEXT_UNAVAILABLE',
      });
    }
    (req as any).logger?.error(
      'Unable to return request-scoped relationship context',
      error instanceof Error ? error : new Error(String(error)),
      { service: 'request-service' },
    );
    return res.status(500).json({
      success: false,
      message: 'Unable to return relationship context',
      error: 'INTERNAL_ERROR',
    });
  }
}

router.get('/:requestId/matches/:matchId/relationship-context', (req: AuthenticatedRequest, res) => {
  const { requestId, matchId } = req.params;
  if (!validIds(requestId, matchId)) {
    return res.status(400).json({ success: false, message: 'Valid IDs are required', error: 'VALIDATION_ERROR' });
  }
  return respondWithContext(
    req,
    res,
    resolveMatchPair(requestId, matchId, req.user!.userId),
  );
});

router.get('/:requestId/provider-offers/:offerId/relationship-context', (req: AuthenticatedRequest, res) => {
  const { requestId, offerId } = req.params;
  if (!validIds(requestId, offerId)) {
    return res.status(400).json({ success: false, message: 'Valid IDs are required', error: 'VALIDATION_ERROR' });
  }
  return respondWithContext(
    req,
    res,
    resolveProviderOfferPair(requestId, offerId, req.user!.userId),
  );
});

router.get('/:requestId/relationship-context', (req: AuthenticatedRequest, res) => {
  const { requestId } = req.params;
  if (!validIds(requestId)) {
    return res.status(400).json({ success: false, message: 'A valid request ID is required', error: 'VALIDATION_ERROR' });
  }
  return respondWithContext(req, res, resolveRequestPair(requestId, req.user!.userId));
});

export default router;
