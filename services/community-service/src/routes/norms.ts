import { Router, Request, Response } from 'express';
import { query } from '../database/db';
import { publishEvent } from '../events/publisher';

const router = Router();

// GET /communities/:communityId/norms - Get all norms for a community
router.get('/:communityId/norms', async (req: Request, res: Response) => {
  try {
    const { communityId } = req.params;
    const { status } = req.query;

    let queryText = `
      SELECT
        n.id, n.description, n.rationale, n.status,
        n.created_at, n.updated_at,
        n.created_by,
        u.name as creator_name,
        COUNT(DISTINCT na.id) as approval_count
      FROM communities.norms n
      LEFT JOIN auth.users u ON n.created_by = u.id
      LEFT JOIN communities.norm_approvals na ON n.id = na.norm_id
      WHERE n.community_id = $1
    `;

    const params: any[] = [communityId];

    if (status) {
      queryText += ` AND n.status = $2`;
      params.push(status);
    }

    queryText += `
      GROUP BY n.id, u.name
      ORDER BY n.created_at DESC
    `;

    const result = await query(queryText, params);

    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount,
    });
  } catch (error: any) {
    console.error('Error fetching norms:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch norms',
      error: error.message,
    });
  }
});

// GET /communities/:communityId/norms/:normId - Get specific norm with approvals
router.get('/:communityId/norms/:normId', async (req: Request, res: Response) => {
  try {
    const { communityId, normId } = req.params;

    // Get norm details
    const normResult = await query(
      `SELECT
        n.id, n.description, n.rationale, n.status,
        n.created_at, n.updated_at,
        n.created_by,
        u.name as creator_name
      FROM communities.norms n
      LEFT JOIN auth.users u ON n.created_by = u.id
      WHERE n.id = $1 AND n.community_id = $2`,
      [normId, communityId]
    );

    if (normResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Norm not found',
      });
    }

    // Get approvals
    const approvalsResult = await query(
      `SELECT
        na.id, na.approved_by, na.approved_at,
        u.name as approver_name
      FROM communities.norm_approvals na
      LEFT JOIN auth.users u ON na.approved_by = u.id
      WHERE na.norm_id = $1
      ORDER BY na.approved_at ASC`,
      [normId]
    );

    const norm = normResult.rows[0];
    norm.approvals = approvalsResult.rows;
    norm.approval_count = approvalsResult.rowCount;

    res.json({
      success: true,
      data: norm,
    });
  } catch (error: any) {
    console.error('Error fetching norm:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch norm',
      error: error.message,
    });
  }
});

// POST /communities/:communityId/norms - Create new norm proposal
router.post('/:communityId/norms', async (req: Request, res: Response) => {
  try {
    const { communityId } = req.params;
    const { description, rationale, created_by } = req.body;

    // Validation
    if (!description || !created_by) {
      return res.status(400).json({
        success: false,
        message: 'Description and created_by are required',
      });
    }

    // Verify user is a member of the community
    const memberCheck = await query(
      `SELECT id FROM communities.members
       WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
      [communityId, created_by]
    );

    if (memberCheck.rowCount === 0) {
      return res.status(403).json({
        success: false,
        message: 'Only community members can propose norms',
      });
    }

    // Create norm
    const result = await query(
      `INSERT INTO communities.norms
        (community_id, description, rationale, created_by, status)
      VALUES ($1, $2, $3, $4, 'proposed')
      RETURNING *`,
      [communityId, description, rationale || null, created_by]
    );

    const norm = result.rows[0];

    // Automatically approve by creator
    await query(
      `INSERT INTO communities.norm_approvals
        (norm_id, approved_by)
      VALUES ($1, $2)`,
      [norm.id, created_by]
    );

    // Publish event
    await publishEvent('norm_proposed', {
      community_id: communityId,
      norm_id: norm.id,
      created_by,
      description,
    });

    res.status(201).json({
      success: true,
      data: norm,
      message: 'Norm proposed successfully',
    });
  } catch (error: any) {
    console.error('Error creating norm:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create norm',
      error: error.message,
    });
  }
});

// POST /communities/:communityId/norms/:normId/approve - Approve a norm
router.post('/:communityId/norms/:normId/approve', async (req: Request, res: Response) => {
  try {
    const { communityId, normId } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'user_id is required',
      });
    }

    // Verify user is a member
    const memberCheck = await query(
      `SELECT id FROM communities.members
       WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
      [communityId, user_id]
    );

    if (memberCheck.rowCount === 0) {
      return res.status(403).json({
        success: false,
        message: 'Only community members can approve norms',
      });
    }

    // Check if norm exists and is still proposed
    const normCheck = await query(
      `SELECT status FROM communities.norms
       WHERE id = $1 AND community_id = $2`,
      [normId, communityId]
    );

    if (normCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Norm not found',
      });
    }

    if (normCheck.rows[0].status !== 'proposed') {
      return res.status(400).json({
        success: false,
        message: 'Norm is not in proposed status',
      });
    }

    // Check if user already approved
    const existingApproval = await query(
      `SELECT id FROM communities.norm_approvals
       WHERE norm_id = $1 AND approved_by = $2`,
      [normId, user_id]
    );

    if (existingApproval.rowCount && existingApproval.rowCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'You have already approved this norm',
      });
    }

    // Add approval
    await query(
      `INSERT INTO communities.norm_approvals
        (norm_id, approved_by)
      VALUES ($1, $2)`,
      [normId, user_id]
    );

    // Check if norm should be accepted (simple majority: >50% of active members)
    const memberCount = await query(
      `SELECT COUNT(*) as count FROM communities.members
       WHERE community_id = $1 AND status = 'active'`,
      [communityId]
    );

    const approvalCount = await query(
      `SELECT COUNT(*) as count FROM communities.norm_approvals
       WHERE norm_id = $1`,
      [normId]
    );

    const totalMembers = parseInt(memberCount.rows[0].count);
    const totalApprovals = parseInt(approvalCount.rows[0].count);
    const approvalThreshold = Math.ceil(totalMembers / 2);

    let normStatus = 'proposed';
    let message = 'Norm approved successfully';

    if (totalApprovals >= approvalThreshold) {
      // Accept norm
      await query(
        `UPDATE communities.norms
         SET status = 'active', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [normId]
      );
      normStatus = 'active';
      message = 'Norm approved and accepted by the community';

      // Publish event
      await publishEvent('norm_established', {
        community_id: communityId,
        norm_id: normId,
        approval_count: totalApprovals,
        member_count: totalMembers,
      });
    }

    res.json({
      success: true,
      message,
      data: {
        norm_id: normId,
        status: normStatus,
        approvals: totalApprovals,
        required: approvalThreshold,
        total_members: totalMembers,
      },
    });
  } catch (error: any) {
    console.error('Error approving norm:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve norm',
      error: error.message,
    });
  }
});

// DELETE /communities/:communityId/norms/:normId - Remove/archive a norm
router.delete('/:communityId/norms/:normId', async (req: Request, res: Response) => {
  try {
    const { communityId, normId } = req.params;
    const { user_id } = req.body;

    // Verify user is admin or creator
    const memberCheck = await query(
      `SELECT role FROM communities.members
       WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
      [communityId, user_id]
    );

    const normCheck = await query(
      `SELECT created_by FROM communities.norms
       WHERE id = $1 AND community_id = $2`,
      [normId, communityId]
    );

    if (normCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Norm not found',
      });
    }

    const isAdmin = memberCheck.rowCount && memberCheck.rowCount > 0 && memberCheck.rows[0].role === 'admin';
    const isCreator = normCheck.rows[0].created_by === user_id;

    if (!isAdmin && !isCreator) {
      return res.status(403).json({
        success: false,
        message: 'Only admins or the creator can remove norms',
      });
    }

    // Archive norm
    await query(
      `UPDATE communities.norms
       SET status = 'archived', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [normId]
    );

    res.json({
      success: true,
      message: 'Norm archived successfully',
    });
  } catch (error: any) {
    console.error('Error archiving norm:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to archive norm',
      error: error.message,
    });
  }
});

export default router;
