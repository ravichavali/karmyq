import express, { Request, Response } from 'express';
import { query } from '../database/db';
import { publishEvent } from '../events/publisher';

const router = express.Router();

/**
 * POST /matches/:id/feedback
 * Submit interaction feedback for a completed match
 *
 * Social Karma v2.0: Rate the interaction quality, not the person
 */
router.post('/:matchId/feedback', async (req: Request, res: Response) => {
  const { matchId } = req.params;
  const { from_user_id, helpfulness, responsiveness, clarity, comment, allow_featuring } = req.body;

  try {
    // Validate required fields
    if (!from_user_id) {
      return res.status(400).json({
        success: false,
        message: 'from_user_id is required',
      });
    }

    // Validate ratings are 1-5
    if (helpfulness && (helpfulness < 1 || helpfulness > 5)) {
      return res.status(400).json({
        success: false,
        message: 'helpfulness must be between 1 and 5',
      });
    }

    if (responsiveness && (responsiveness < 1 || responsiveness > 5)) {
      return res.status(400).json({
        success: false,
        message: 'responsiveness must be between 1 and 5',
      });
    }

    if (clarity && (clarity < 1 || clarity > 5)) {
      return res.status(400).json({
        success: false,
        message: 'clarity must be between 1 and 5',
      });
    }

    // Get match details
    const matchResult = await query(
      `SELECT m.id, m.status, r.requester_id, m.responder_id, r.category, r.community_id
       FROM requests.matches m
       INNER JOIN requests.help_requests r ON m.request_id = r.id
       WHERE m.id = $1`,
      [matchId]
    );

    if (matchResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Match not found',
      });
    }

    const match = matchResult.rows[0];

    // Verify match is completed
    if (match.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Can only submit feedback for completed matches',
      });
    }

    // Verify from_user_id is requester or responder
    const isRequester = match.requester_id === from_user_id;
    const isResponder = match.responder_id === from_user_id;

    if (!isRequester && !isResponder) {
      return res.status(403).json({
        success: false,
        message: 'Only participants can submit feedback',
      });
    }

    const to_user_id = isRequester ? match.responder_id : match.requester_id;

    // Check if feedback already exists
    const existingFeedback = await query(
      `SELECT id FROM requests.interaction_feedback
       WHERE match_id = $1 AND from_user_id = $2`,
      [matchId, from_user_id]
    );

    if (existingFeedback.rowCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Feedback already submitted for this match',
      });
    }

    // Insert feedback
    const feedbackResult = await query(
      `INSERT INTO requests.interaction_feedback
        (match_id, from_user_id, to_user_id, helpfulness, responsiveness, clarity, comment, allow_featuring)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [matchId, from_user_id, to_user_id, helpfulness, responsiveness, clarity, comment, allow_featuring || false]
    );

    const feedback = feedbackResult.rows[0];

    // Check if both parties have submitted feedback
    const allFeedback = await query(
      `SELECT from_user_id, allow_featuring FROM requests.interaction_feedback
       WHERE match_id = $1`,
      [matchId]
    );

    if (allFeedback.rowCount === 2) {
      // Both parties submitted feedback - check for two-way consent
      const bothAllowFeaturing = allFeedback.rows.every(f => f.allow_featuring);

      if (bothAllowFeaturing) {
        // Check requester and responder visibility consent
        const visibilityCheck = await query(
          `SELECT
            r.requester_visibility_consent,
            o.offerer_visibility_consent
           FROM requests.matches m
           INNER JOIN requests.help_requests r ON m.request_id = r.id
           LEFT JOIN requests.help_offers o ON m.offer_id = o.id
           WHERE m.id = $1`,
          [matchId]
        );

        const requesterConsent = visibilityCheck.rows[0]?.requester_visibility_consent || false;
        const responderConsent = visibilityCheck.rows[0]?.offerer_visibility_consent !== false; // Default true if no offer

        // Update match visibility flags
        await query(
          `UPDATE requests.matches
           SET requester_visible = $1,
               responder_visible = $2,
               interaction_category = $3
           WHERE id = $4`,
          [requesterConsent, responderConsent, match.category, matchId]
        );
      }
    }

    // Publish event for reputation service to update trust scores
    await publishEvent('interaction_feedback_submitted', {
      feedback_id: feedback.id,
      match_id: matchId,
      from_user_id,
      to_user_id,
      helpfulness,
      responsiveness,
      clarity,
      community_id: match.community_id,
    });

    res.json({
      success: true,
      data: {
        id: feedback.id,
        match_id: feedback.match_id,
        helpfulness: feedback.helpfulness,
        responsiveness: feedback.responsiveness,
        clarity: feedback.clarity,
        allow_featuring: feedback.allow_featuring,
        created_at: feedback.created_at,
      },
      message: 'Feedback submitted successfully',
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit feedback',
    });
  }
});

/**
 * GET /matches/:id/feedback
 * Get feedback for a match
 *
 * Only participants can view feedback
 */
router.get('/:matchId/feedback', async (req: Request, res: Response) => {
  const { matchId } = req.params;
  const { user_id } = req.query;

  try {
    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'user_id query parameter is required',
      });
    }

    // Get match details to verify user is participant
    const matchResult = await query(
      `SELECT m.id, r.requester_id, m.responder_id, m.requester_visible, m.responder_visible
       FROM requests.matches m
       INNER JOIN requests.help_requests r ON m.request_id = r.id
       WHERE m.id = $1`,
      [matchId]
    );

    if (matchResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Match not found',
      });
    }

    const match = matchResult.rows[0];

    // Verify user is participant
    if (match.requester_id !== user_id && match.responder_id !== user_id) {
      return res.status(403).json({
        success: false,
        message: 'Only participants can view feedback',
      });
    }

    // Get all feedback for this match
    const feedbackResult = await query(
      `SELECT
        f.id,
        f.from_user_id,
        f.helpfulness,
        f.responsiveness,
        f.clarity,
        f.comment,
        f.allow_featuring,
        f.created_at
       FROM requests.interaction_feedback f
       WHERE f.match_id = $1
       ORDER BY f.created_at ASC`,
      [matchId]
    );

    const feedback_from_requester = feedbackResult.rows.find(f => f.from_user_id === match.requester_id);
    const feedback_from_responder = feedbackResult.rows.find(f => f.from_user_id === match.responder_id);

    const both_allow_featuring =
      feedback_from_requester?.allow_featuring &&
      feedback_from_responder?.allow_featuring;

    res.json({
      success: true,
      data: {
        feedback_from_requester: feedback_from_requester ? {
          id: feedback_from_requester.id,
          helpfulness: feedback_from_requester.helpfulness,
          responsiveness: feedback_from_requester.responsiveness,
          clarity: feedback_from_requester.clarity,
          comment: feedback_from_requester.comment,
          created_at: feedback_from_requester.created_at,
        } : null,
        feedback_from_responder: feedback_from_responder ? {
          id: feedback_from_responder.id,
          helpfulness: feedback_from_responder.helpfulness,
          responsiveness: feedback_from_responder.responsiveness,
          clarity: feedback_from_responder.clarity,
          comment: feedback_from_responder.comment,
          created_at: feedback_from_responder.created_at,
        } : null,
        both_allow_featuring,
        requester_visible: match.requester_visible,
        responder_visible: match.responder_visible,
      },
    });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feedback',
    });
  }
});

export default router;
