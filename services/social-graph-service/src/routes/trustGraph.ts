import { Router, Request, Response } from 'express';
import { classifyDecayTier, DecayTier } from '@karmyq/shared';
import { getTrustGraphForCommunity, getTrustGraphAggregate } from '../services/trustEdgeService';
import { getTrustEdge, getFullCommunityGraph, getCommunityDepthGraph } from '../database/trustEdgeDb';
import { computeEffectiveWeight } from '../services/trustEdgeService';
import { getDecayConfig } from '../database/trustDecayConfigDb';
import { logger } from '../config/logger';
import { pool } from '../config/database';

const router = Router();

// ─── Sprint 90: Visible Decay (ADR-070) ──────────────────────────────────────────────────────────
// Pure helpers shared by the graph + memory endpoints and their tests. The band math lives ONLY in
// the shared classifyDecayTier — these just shape it into the API responses.

interface DecayableLink {
  effective_weight: number;
}

/** Attach currentWeight / disappearanceThreshold / decayTier to each graph edge (effective_weight is
 *  the live decayed weight already; currentWeight is its public alias). */
export function enrichLinksWithDecay<T extends DecayableLink>(
  links: T[],
  threshold: number
): (T & { currentWeight: number; disappearanceThreshold: number; decayTier: DecayTier })[] {
  return links.map((link) => {
    const currentWeight = Number(link.effective_weight) || 0;
    return {
      ...link,
      currentWeight,
      disappearanceThreshold: threshold,
      decayTier: classifyDecayTier(currentWeight, threshold),
    };
  });
}

export interface RelationshipRow {
  peer_id: string;
  peer_name: string;
  current_weight: number | string;
  last_interaction_at: Date | string | null;
  match_completed_count: number | string;
}

export interface Relationship {
  peerId: string;
  peerName: string;
  currentWeight: number;
  decayTier: DecayTier;
  lastInteractionAt: Date | string | null;
  matchCompletedCount: number;
}

export interface MemoryResponse {
  activeCount: number;
  fading: Relationship[];
  nearlyForgotten: Relationship[];
}

/** Partition a member's relationships into active (strong/warm) count + fading + nearly_forgotten lists.
 *  Swept edges (r < 1) are excluded — they no longer exist as bonds. */
export function buildMemoryResponse(rows: RelationshipRow[], threshold: number): MemoryResponse {
  const rels: Relationship[] = rows.map((r) => {
    const currentWeight = Number(r.current_weight) || 0;
    return {
      peerId: r.peer_id,
      peerName: r.peer_name,
      currentWeight,
      decayTier: classifyDecayTier(currentWeight, threshold),
      lastInteractionAt: r.last_interaction_at,
      matchCompletedCount: Number(r.match_completed_count) || 0,
    };
  });
  return {
    activeCount: rels.filter((r) => r.decayTier === 'strong' || r.decayTier === 'warm').length,
    fading: rels.filter((r) => r.decayTier === 'fading'),
    nearlyForgotten: rels.filter((r) => r.decayTier === 'nearly_forgotten'),
  };
}

/** Resolve a community's disappearance threshold (community row → global → 0.5 fallback). */
async function resolveThreshold(communityId: string): Promise<number> {
  try {
    const cfg = await getDecayConfig(communityId);
    return cfg.disappearanceThreshold ?? 0.5;
  } catch {
    return 0.5;
  }
}

/** Verify the calling user is an active member of the community. */
async function isActiveMember(communityId: string, userId: string): Promise<boolean> {
  const check = await pool.query(
    `SELECT 1 FROM communities.members
     WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
    [communityId, userId]
  );
  return check.rows.length > 0;
}

/** Fetch the calling user's relationships in a community from the decay-adjusted live view. */
async function fetchRelationships(communityId: string, userId: string): Promise<RelationshipRow[]> {
  const result = await pool.query(
    `SELECT
        CASE WHEN tel.user_id_a = $2 THEN tel.user_id_b ELSE tel.user_id_a END AS peer_id,
        u.name AS peer_name,
        tel.current_weight,
        tel.last_interaction_at,
        tel.match_completed_count
     FROM social_graph.trust_edges_live tel
     JOIN auth.users u
       ON u.id = CASE WHEN tel.user_id_a = $2 THEN tel.user_id_b ELSE tel.user_id_a END
     WHERE tel.community_id = $1
       AND (tel.user_id_a = $2 OR tel.user_id_b = $2)`,
    [communityId, userId]
  );
  return result.rows as RelationshipRow[];
}

// GET /trust/graph — aggregate ego-network across all of the calling user's communities
// MUST be declared before /:communityId to avoid param matching
router.get('/graph', async (req: Request, res: Response) => {
  try {
    const callingUserId = (req as any).user?.userId;
    const graph = await getTrustGraphAggregate(callingUserId);
    res.json({ success: true, data: graph });
  } catch (error) {
    logger.error('Error fetching aggregate trust graph', error instanceof Error ? error : undefined);
    res.status(500).json({ success: false, message: 'Failed to fetch aggregate trust graph' });
  }
});

// GET /trust/graph/:communityId/full — full community trust graph (up to 150 members + all inter-member edges)
// MUST be declared before /graph/:communityId — Express matches "full" as a communityId otherwise
router.get('/graph/:communityId/full', async (req: Request, res: Response) => {
  try {
    const { communityId } = req.params;
    const callingUserId = (req as any).user?.userId;

    const memberCheck = await pool.query(
      `SELECT 1 FROM communities.members
       WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
      [communityId, callingUserId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Not a member of this community',
      });
    }

    const graph = await getFullCommunityGraph(communityId, callingUserId);
    const threshold = await resolveThreshold(communityId);

    res.json({
      success: true,
      data: { ...graph, links: enrichLinksWithDecay(graph.links, threshold) },
    });
  } catch (error) {
    logger.error('Error fetching full community trust graph', error instanceof Error ? error : undefined);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch full community trust graph',
    });
  }
});

// GET /trust/graph/:communityId — ego-network centered on calling user (or ?center=userId for expansion)
router.get('/graph/:communityId', async (req: Request, res: Response) => {
  try {
    const { communityId } = req.params;
    const callingUserId = (req as any).user?.userId;
    const centerUserId = (req.query.center as string) || callingUserId;

    // Verify caller is a member of the community
    const memberCheck = await pool.query(
      `SELECT 1 FROM communities.members
       WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
      [communityId, callingUserId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Not a member of this community',
      });
    }

    // When center differs from caller, verify center user is also a member
    if (centerUserId !== callingUserId) {
      const centerCheck = await pool.query(
        `SELECT 1 FROM communities.members
         WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
        [communityId, centerUserId]
      );
      if (centerCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Center user is not a member of this community' });
      }
    }

    const graph = await getTrustGraphForCommunity(communityId, centerUserId);
    const threshold = await resolveThreshold(communityId);

    res.json({
      success: true,
      data: { ...graph, links: enrichLinksWithDecay(graph.links, threshold) },
    });
  } catch (error) {
    logger.error('Error fetching trust graph', error instanceof Error ? error : undefined);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trust graph',
    });
  }
});

// GET /trust/edge?userA=X&userB=Y&communityId=Z — single edge lookup
router.get('/edge', async (req: Request, res: Response) => {
  try {
    const { userA, userB, communityId } = req.query as {
      userA: string;
      userB: string;
      communityId: string;
    };

    if (!userA || !userB || !communityId) {
      return res.status(400).json({
        success: false,
        message: 'userA, userB, and communityId are required',
      });
    }

    const edge = await getTrustEdge(userA, userB, communityId);

    if (!edge) {
      return res.json({ success: true, data: null });
    }

    res.json({
      success: true,
      data: {
        source: edge.user_id_a,
        target: edge.user_id_b,
        raw_weight: edge.raw_weight,
        effective_weight: computeEffectiveWeight(edge.raw_weight, edge.last_interaction_at),
        match_completed_count: edge.match_completed_count,
        endorsement_count: edge.endorsement_count,
        karma_given_count: edge.karma_given_count,
        event_count: edge.event_count,
        last_interaction_at: edge.last_interaction_at,
      },
    });
  } catch (error) {
    logger.error('Error fetching trust edge', error instanceof Error ? error : undefined);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trust edge',
    });
  }
});

/**
 * GET /trust/communities
 * Inter-community depth graph for the calling user: their communities (plus
 * edge/lineage-reachable ones) as nodes, with organic trust edges and fission
 * lineage edges. Distinct literal path — does not collide with /graph/:communityId.
 */
router.get('/communities', async (req: Request, res: Response) => {
  try {
    const callingUserId = (req as any).user?.userId;

    const graph = await getCommunityDepthGraph(callingUserId);

    res.json({ success: true, data: graph });
  } catch (error) {
    logger.error('Error fetching community depth graph', error instanceof Error ? error : undefined);
    res.status(500).json({ success: false, message: 'Failed to fetch community depth graph' });
  }
});

/**
 * GET /trust/me/memory?communityId=
 * The calling member's relationship memory: how many active bonds, which are fading, which are nearly
 * forgotten (about to be swept). Backs the profile Memory section. Membership-gated; no PII beyond
 * peer names the member already sees in the graph.
 */
router.get('/me/memory', async (req: Request, res: Response) => {
  try {
    const callingUserId = (req as any).user?.userId;
    const communityId = req.query.communityId as string;
    if (!communityId) {
      return res.status(400).json({ success: false, message: 'communityId is required' });
    }
    if (!(await isActiveMember(communityId, callingUserId))) {
      return res.status(403).json({ success: false, message: 'Not a member of this community' });
    }

    const threshold = await resolveThreshold(communityId);
    const rows = await fetchRelationships(communityId, callingUserId);
    res.json({ success: true, data: buildMemoryResponse(rows, threshold) });
  } catch (error) {
    logger.error('Error fetching relationship memory', error instanceof Error ? error : undefined);
    res.status(500).json({ success: false, message: 'Failed to fetch relationship memory' });
  }
});

/**
 * GET /trust/relationships/fading?communityId=
 * Nearly-forgotten bonds for the re-warming nudge (decayTier === 'nearly_forgotten'). A focused slice
 * of /me/memory so the nudge can fetch just what it needs.
 */
router.get('/relationships/fading', async (req: Request, res: Response) => {
  try {
    const callingUserId = (req as any).user?.userId;
    const communityId = req.query.communityId as string;
    if (!communityId) {
      return res.status(400).json({ success: false, message: 'communityId is required' });
    }
    if (!(await isActiveMember(communityId, callingUserId))) {
      return res.status(403).json({ success: false, message: 'Not a member of this community' });
    }

    const threshold = await resolveThreshold(communityId);
    const rows = await fetchRelationships(communityId, callingUserId);
    const { nearlyForgotten } = buildMemoryResponse(rows, threshold);
    res.json({ success: true, data: nearlyForgotten });
  } catch (error) {
    logger.error('Error fetching fading relationships', error instanceof Error ? error : undefined);
    res.status(500).json({ success: false, message: 'Failed to fetch fading relationships' });
  }
});

export default router;
