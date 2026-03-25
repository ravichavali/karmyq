import { Router, Response } from 'express';
import { AuthenticatedRequest } from '@karmyq/shared/middleware/auth';
import { computeTrustPath, computeInvitationPath } from '../services/pathComputation';
import axios from 'axios';

const router = Router();

const TIER_THRESHOLDS = { PILLAR: 100, TRUSTED: 30 } as const;
function getTrustTier(karma: number): 'Pillar' | 'Trusted' | 'Emerging' {
  if (karma >= TIER_THRESHOLDS.PILLAR) return 'Pillar';
  if (karma >= TIER_THRESHOLDS.TRUSTED) return 'Trusted';
  return 'Emerging';
}

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

    // Compute primary trust path (exchange → community → invitation)
    const communityId = req.headers['x-community-id'] as string
      || req.user?.currentCommunityId
      || 'platform';

    const pathResult = await computeTrustPath(currentUserId, targetUserId, communityId);

    // Compute invitation path separately (for display alongside exchange/community path)
    let invitationPath = null;
    if (!pathResult || pathResult.connectionType !== 'invitation_chain') {
      const invPath = await computeInvitationPath(currentUserId, targetUserId);
      if (invPath) {
        invitationPath = invPath.path;
      }
    }

    // Fetch target user's karma from reputation service
    const reputationUrl = process.env.REPUTATION_API_URL || 'http://reputation-service:3004';
    let karma = 0;
    try {
      const karmaRes = await axios.get(
        `${reputationUrl}/reputation/karma/${targetUserId}`,
        { headers: { Authorization: req.headers.authorization } }
      );
      karma = karmaRes.data?.data?.total_karma ?? 0;
    } catch {
      // karma stays 0 — trust tier will be Emerging
    }

    const trust_tier = getTrustTier(karma);

    const targetNode = pathResult?.path?.at(-1);
    res.json({
      success: true,
      data: {
        targetUser: {
          id: targetUserId,
          name: targetNode?.name ?? 'Unknown',
          karma,
          trust_tier,
        },
        trustPath: pathResult?.path ?? [],
        invitationPath,
        degrees: pathResult?.degrees ?? null,
        path_type: pathResult ? mapConnectionType(pathResult.connectionType) : null,
      },
    });
  } catch (err) {
    console.error('trust-card error:', err);
    res.status(500).json({ success: false, message: 'Failed to load trust card' });
  }
});

export default router;
