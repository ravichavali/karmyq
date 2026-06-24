import { Router, Response } from 'express';
import { AuthenticatedRequest } from '@karmyq/shared/middleware/auth';
import { sendValidationError } from '@karmyq/shared';
import { logger } from '../config/logger';
import { computeTrustPath, computeInvitationPath } from '../services/pathComputation';
import { resolveCommunityContext } from '../services/communityContext';

const router = Router();

// Map internal connectionType to API path_type
function mapConnectionType(connectionType: string): string {
  if (connectionType === 'community_member') return 'community';
  return connectionType; // 'exchange' | 'invitation_chain'
}

router.get('/:targetUserId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { targetUserId } = req.params;
    const currentUserId = req.user?.userId;

    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (currentUserId === targetUserId) {
      return res.status(400).json({ success: false, message: 'Cannot view trust card for yourself' });
    }

    // Compute primary trust path (exchange → community → invitation).
    // Same community-context semantics as /paths (see communityContext resolver docs).
    const resolved = resolveCommunityContext(
      req.headers['x-community-id'] as string | undefined,
      req.user?.currentCommunityId
    );
    if (!resolved.ok) {
      return sendValidationError(res, resolved.reason);
    }
    const { communityId, scope } = resolved.context;

    const pathResult = await computeTrustPath(currentUserId, targetUserId, communityId);

    // Compute invitation path separately (for display alongside exchange/community path)
    let invitationPath = null;
    if (!pathResult || pathResult.connectionType !== 'invitation_chain') {
      const invPath = await computeInvitationPath(currentUserId, targetUserId);
      if (invPath) {
        invitationPath = invPath.path;
      }
    }

    // Sprint 112 (ADR-082): the trust card shows authorized identity + path structure + a coarse
    // path type. It no longer fetches or returns the target's karma or a karma-derived trust tier —
    // another ordinary member's exact reputation is self-only.
    const targetNode = pathResult?.path?.at(-1);
    res.json({
      success: true,
      data: {
        targetUser: {
          id: targetUserId,
          name: targetNode?.name ?? 'Unknown',
        },
        trustPath: pathResult?.path ?? [],
        invitationPath,
        degrees: pathResult?.degrees ?? null,
        path_type: pathResult ? mapConnectionType(pathResult.connectionType) : null,
        scope,
      },
    });
  } catch (err) {
    logger.error('trust-card error', err instanceof Error ? err : undefined);
    res.status(500).json({ success: false, message: 'Failed to load trust card' });
  }
});

export default router;
