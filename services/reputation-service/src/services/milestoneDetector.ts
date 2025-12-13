import { query } from '../database/db';
import { publishEvent } from '../events/publisher';

/**
 * Milestone configurations
 * Social Karma v2.0: Celebrate community achievements
 */
const MILESTONES = {
  matches: [
    { value: 10, description: 'Reached 10 successful help exchanges!' },
    { value: 50, description: 'Reached 50 successful help exchanges!' },
    { value: 100, description: 'Reached 100 successful help exchanges!' },
    { value: 500, description: 'Reached 500 successful help exchanges!' },
    { value: 1000, description: 'Reached 1000 successful help exchanges!' },
  ],
  participants: [
    { value: 10, description: '10 unique members have participated in help exchanges' },
    { value: 25, description: '25 unique members have participated in help exchanges' },
    { value: 50, description: '50 unique members have participated in help exchanges' },
    { value: 100, description: '100 unique members have participated in help exchanges' },
  ],
  quality: [
    { value: 4.0, description: 'Community average quality rating reached 4.0!' },
    { value: 4.5, description: 'Community average quality rating reached 4.5!' },
    { value: 4.8, description: 'Community average quality rating reached 4.8!' },
  ],
};

/**
 * Check for and record milestone achievements
 */
export async function detectMilestones(communityId: string): Promise<void> {
  try {
    console.log(`Detecting milestones for community: ${communityId}`);

    // Get latest metrics
    const metrics = await query(
      `SELECT
         total_matches_completed,
         unique_participant_count,
         avg_helpfulness,
         avg_responsiveness,
         avg_clarity
       FROM reputation.community_health_metrics
       WHERE community_id = $1
       ORDER BY snapshot_date DESC
       LIMIT 1`,
      [communityId]
    );

    if (metrics.rowCount === 0) {
      console.log(`No metrics found for community ${communityId}`);
      return;
    }

    const {
      total_matches_completed,
      unique_participant_count,
      avg_helpfulness,
      avg_responsiveness,
      avg_clarity,
    } = metrics.rows[0];

    // Check matches milestones
    for (const milestone of MILESTONES.matches) {
      if (total_matches_completed >= milestone.value) {
        await recordMilestone(
          communityId,
          `${milestone.value}_matches`,
          milestone.value,
          milestone.description
        );
      }
    }

    // Check participants milestones
    for (const milestone of MILESTONES.participants) {
      if (unique_participant_count >= milestone.value) {
        await recordMilestone(
          communityId,
          `${milestone.value}_participants`,
          milestone.value,
          milestone.description
        );
      }
    }

    // Check quality milestones
    const avgQuality = (
      parseFloat(avg_helpfulness || 0) +
      parseFloat(avg_responsiveness || 0) +
      parseFloat(avg_clarity || 0)
    ) / 3;

    for (const milestone of MILESTONES.quality) {
      if (avgQuality >= milestone.value) {
        const qualityValue = Math.floor(milestone.value * 10); // 4.5 -> 45
        await recordMilestone(
          communityId,
          `avg_quality_${qualityValue}`,
          qualityValue,
          milestone.description
        );
      }
    }

    console.log(`Milestone detection completed for community ${communityId}`);
  } catch (error) {
    console.error(`Error detecting milestones for community ${communityId}:`, error);
    throw error;
  }
}

/**
 * Record a milestone achievement (only once)
 */
async function recordMilestone(
  communityId: string,
  milestoneType: string,
  milestoneValue: number,
  description: string
): Promise<void> {
  try {
    // Check if milestone already exists
    const existing = await query(
      `SELECT id FROM reputation.milestone_events
       WHERE community_id = $1 AND milestone_type = $2`,
      [communityId, milestoneType]
    );

    if (existing.rowCount > 0) {
      // Milestone already recorded
      return;
    }

    // Record new milestone
    const result = await query(
      `INSERT INTO reputation.milestone_events (
         community_id,
         milestone_type,
         milestone_value,
         description,
         is_featured
       ) VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [communityId, milestoneType, milestoneValue, description]
    );

    const milestone = result.rows[0];

    console.log(`🎉 Milestone achieved for community ${communityId}: ${milestoneType}`);

    // Publish milestone event for feed service
    await publishEvent('milestone_achieved', {
      milestone_id: milestone.id,
      community_id: communityId,
      milestone_type: milestoneType,
      milestone_value: milestoneValue,
      description,
      achieved_at: milestone.achieved_at,
    });
  } catch (error) {
    // Ignore unique constraint violations (race condition)
    if ((error as any).code === '23505') {
      return;
    }
    throw error;
  }
}

/**
 * Detect milestones for all active communities
 */
export async function detectAllCommunityMilestones(): Promise<void> {
  try {
    console.log('Starting milestone detection for all communities');

    // Get all active communities
    const communities = await query(
      `SELECT id FROM communities.communities WHERE status = 'active'`
    );

    console.log(`Found ${communities.rowCount} active communities`);

    for (const community of communities.rows) {
      await detectMilestones(community.id);
    }

    console.log('Completed milestone detection for all communities');
  } catch (error) {
    console.error('Error in milestone detection:', error);
    throw error;
  }
}
