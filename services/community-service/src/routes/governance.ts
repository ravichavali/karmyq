import { Router, Response } from 'express';
import pool from '../database/db';
import { getGovernanceState, createNomination, addRatification } from '../database/governanceDb';

const router = Router();

// GET /communities/:communityId/governance
router.get('/:communityId/governance', async (req: any, res: Response) => {
  const { communityId } = req.params;
  const userId = req.user?.userId;
  try {
    const memberCheck = await pool.query(
      `SELECT id FROM communities.members WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
      [communityId, userId]
    );
    if (!memberCheck.rows.length) {
      return res.status(403).json({ success: false, message: 'Must be an active member' });
    }
    const state = await getGovernanceState(communityId);
    res.json({ success: true, data: state });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch governance state' });
  }
});

// POST /communities/:communityId/governance/nominate
router.post('/:communityId/governance/nominate', async (req: any, res: Response) => {
  const { communityId } = req.params;
  const nominatorId = req.user?.userId;
  const { nominated_user_id, role } = req.body;

  if (!nominated_user_id || !role || !['admin', 'moderator'].includes(role)) {
    return res.status(400).json({ success: false, message: 'nominated_user_id and valid role required' });
  }

  try {
    const settingsRes = await pool.query(
      `SELECT governance_settings FROM communities.communities WHERE id = $1`,
      [communityId]
    );
    const settings = settingsRes.rows[0]?.governance_settings ??
      { eligibility_threshold: 50, quorum_size: 3 };

    // Verify nominated user meets trust eligibility threshold
    const trustRes = await pool.query(`
      SELECT COALESCE(SUM(te.raw_weight), 0) AS trust_score
      FROM social_graph.trust_edges te
      WHERE te.community_id = $1
        AND (te.user_id_a = $2::uuid OR te.user_id_b = $2::uuid)
    `, [communityId, nominated_user_id]);
    const trustScore = parseFloat(trustRes.rows[0]?.trust_score) || 0;
    if (trustScore < settings.eligibility_threshold) {
      // Sprint 112 (ADR-082): the threshold check stays internal; the denial is coarse and never
      // reveals the nominee's trust score or the numeric threshold.
      return res.status(422).json({
        success: false,
        message: 'This member has not yet met the eligibility threshold through established community relationships.',
        error: 'GOVERNANCE_ELIGIBILITY_NOT_MET',
      });
    }

    const nomination = await createNomination(
      communityId, nominatorId, nominated_user_id, role, settings.quorum_size
    );
    res.status(201).json({ success: true, data: nomination });
  } catch (err: any) {
    if (err.message === 'DUPLICATE_NOMINATION') {
      return res.status(409).json({ success: false, message: 'A pending nomination already exists for this member and role' });
    }
    res.status(500).json({ success: false, message: 'Failed to create nomination' });
  }
});

// POST /communities/:communityId/governance/ratify/:nominationId
router.post('/:communityId/governance/ratify/:nominationId', async (req: any, res: Response) => {
  const { communityId, nominationId } = req.params;
  const ratifierId = req.user?.userId;

  try {
    // Any active member can ratify — quorum lets the community collectively elevate role-holders
    const memberCheck = await pool.query(`
      SELECT id FROM communities.members
      WHERE community_id = $1 AND user_id = $2 AND status = 'active'
    `, [communityId, ratifierId]);
    if (!memberCheck.rows.length) {
      return res.status(403).json({ success: false, message: 'Must be an active member to ratify' });
    }

    // Prevent the nominated person from ratifying their own elevation
    const nomCheck = await pool.query(`
      SELECT nominated_user_id FROM communities.governance_nominations
      WHERE id = $1 AND community_id = $2 AND status = 'pending'
    `, [nominationId, communityId]);
    if (!nomCheck.rows.length) {
      return res.status(404).json({ success: false, message: 'Nomination not found' });
    }
    if (nomCheck.rows[0].nominated_user_id === ratifierId) {
      return res.status(422).json({ success: false, message: 'Cannot ratify your own nomination' });
    }

    const result = await addRatification(nominationId, ratifierId);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to ratify nomination' });
  }
});

export default router;
