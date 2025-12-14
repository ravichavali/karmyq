import { query } from '../database/db';

/**
 * Social Karma v2.0 Feed Composer
 * Composes milestone posts and featured stories for the feed
 */

export interface MilestonePost {
  id: string;
  type: 'milestone';
  milestoneType: string;
  description: string;
  achievedAt: Date;
  networkStrength: number;
  strengthChange: number;
  celebrationCount: number;
  isPinned: boolean;
  communityId: string;
  communityName: string;
}

export interface FeaturedStory {
  id: string;
  type: 'featured_story';
  comment: string | null;
  helpfulness: number;
  responsiveness: number;
  clarity: number;
  interactionCategory: string | null;
  createdAt: Date;

  // Privacy-aware fields
  isAnonymous: boolean;
  requesterName: string | null;
  responderName: string | null;
  communityId: string;
  communityName: string;
}

export interface CommunityHealthSummary {
  communityId: string;
  communityName: string;
  networkStrength: number;
  networkStrengthLabel: string;
  totalMatches: number;
  activeHelpers: number;
  growthRate: number;
  trendDirection: 'growing' | 'stable' | 'declining';
}

export class SocialKarmaFeedComposer {
  /**
   * Get milestone posts for a community
   * Pinned for 48 hours after achievement
   */
  async getMilestonePosts(communityId: string, limit: number = 5): Promise<MilestonePost[]> {
    const result = await query(
      `SELECT
        m.id,
        m.milestone_type,
        m.description,
        m.achieved_at,
        m.community_id,
        c.name as community_name,
        c.health_summary
      FROM reputation.milestone_events m
      JOIN communities.communities c ON m.community_id = c.id
      WHERE m.community_id = $1
      ORDER BY m.achieved_at DESC
      LIMIT $2`,
      [communityId, limit]
    );

    return result.rows.map(row => {
      const healthSummary = row.health_summary || {};
      const isPinned = this.isMilestonePinned(row.achieved_at);

      return {
        id: row.id,
        type: 'milestone',
        milestoneType: row.milestone_type,
        description: row.description,
        achievedAt: new Date(row.achieved_at),
        networkStrength: healthSummary.network_strength || 0,
        strengthChange: healthSummary.growth_7d || 0,
        celebrationCount: 0, // TODO: Implement celebration reactions
        isPinned,
        communityId: row.community_id,
        communityName: row.community_name,
      };
    });
  }

  /**
   * Get featured stories for a community
   * Privacy-aware: only stories with consent or anonymous
   */
  async getFeaturedStories(communityId: string, limit: number = 10): Promise<FeaturedStory[]> {
    const result = await query(
      `SELECT
        fs.id,
        fs.match_id,
        fs.requester_id,
        fs.responder_id,
        fs.requester_visible,
        fs.responder_visible,
        fs.interaction_category,
        fs.created_at,
        fs.community_id,
        c.name as community_name,
        f.helpfulness,
        f.responsiveness,
        f.clarity,
        f.comment,
        u_req.name as requester_name,
        u_resp.name as responder_name
      FROM feed.featured_stories fs
      JOIN communities.communities c ON fs.community_id = c.id
      LEFT JOIN requests.interaction_feedback f ON fs.match_id = f.match_id
      LEFT JOIN auth.users u_req ON fs.requester_id = u_req.id
      LEFT JOIN auth.users u_resp ON fs.responder_id = u_resp.id
      WHERE fs.community_id = $1
        AND fs.is_active = true
      ORDER BY fs.created_at DESC
      LIMIT $2`,
      [communityId, limit]
    );

    return result.rows.map(row => {
      // Determine if anonymous based on visibility flags
      const isAnonymous = !row.requester_visible || !row.responder_visible;

      // Calculate average quality for sorting
      const avgQuality = (
        (row.helpfulness || 0) +
        (row.responsiveness || 0) +
        (row.clarity || 0)
      ) / 3;

      return {
        id: row.id,
        type: 'featured_story',
        comment: row.comment,
        helpfulness: row.helpfulness || 0,
        responsiveness: row.responsiveness || 0,
        clarity: row.clarity || 0,
        interactionCategory: row.interaction_category,
        createdAt: new Date(row.created_at),

        // Privacy-aware naming
        isAnonymous,
        requesterName: row.requester_visible ? row.requester_name : null,
        responderName: row.responder_visible ? row.responder_name : null,
        communityId: row.community_id,
        communityName: row.community_name,
      };
    });
  }

  /**
   * Get community health summary for dashboard hero
   */
  async getCommunityHealthSummary(communityId: string): Promise<CommunityHealthSummary | null> {
    const result = await query(
      `SELECT
        c.id as community_id,
        c.name as community_name,
        c.health_summary
      FROM communities.communities c
      WHERE c.id = $1`,
      [communityId]
    );

    if (result.rowCount === 0) {
      return null;
    }

    const row = result.rows[0];
    const healthSummary = row.health_summary || {};

    // Calculate network strength label
    const networkStrength = healthSummary.network_strength || 0;
    const networkStrengthLabel = this.getNetworkStrengthLabel(networkStrength);

    // Determine trend direction
    const growthRate = healthSummary.growth_7d || 0;
    const trendDirection = this.getTrendDirection(growthRate);

    return {
      communityId: row.community_id,
      communityName: row.community_name,
      networkStrength,
      networkStrengthLabel,
      totalMatches: healthSummary.total_matches || 0,
      activeHelpers: healthSummary.active_helpers || 0,
      growthRate,
      trendDirection,
    };
  }

  /**
   * Compose mixed feed with milestones, stories, and requests
   * Prioritizes pinned milestones, then interleaves other content
   */
  async composeMixedFeed(
    communityId: string,
    userId: string,
    limit: number = 20
  ): Promise<Array<MilestonePost | FeaturedStory>> {
    const [milestones, stories] = await Promise.all([
      this.getMilestonePosts(communityId, 5),
      this.getFeaturedStories(communityId, 15),
    ]);

    // Separate pinned and unpinned milestones
    const pinnedMilestones = milestones.filter(m => m.isPinned);
    const unpinnedMilestones = milestones.filter(m => !m.isPinned);

    // Interleave unpinned milestones and stories
    const interleaved = this.interleaveContent(unpinnedMilestones, stories);

    // Pinned milestones always at top
    const feed = [...pinnedMilestones, ...interleaved];

    return feed.slice(0, limit);
  }

  /**
   * Helper: Determine if milestone should be pinned (48 hours)
   */
  private isMilestonePinned(achievedAt: Date): boolean {
    const fortyEightHoursAgo = new Date();
    fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);
    return new Date(achievedAt) > fortyEightHoursAgo;
  }

  /**
   * Helper: Get network strength label
   */
  private getNetworkStrengthLabel(score: number): string {
    if (score >= 80) return 'Thriving';
    if (score >= 60) return 'Strong';
    if (score >= 40) return 'Growing';
    if (score >= 20) return 'Developing';
    return 'Building';
  }

  /**
   * Helper: Determine trend direction from growth rate
   */
  private getTrendDirection(growthRate: number): 'growing' | 'stable' | 'declining' {
    if (growthRate > 5) return 'growing';
    if (growthRate < -5) return 'declining';
    return 'stable';
  }

  /**
   * Helper: Interleave two arrays of content
   * Pattern: 1 milestone, 2 stories, 1 milestone, 2 stories, etc.
   */
  private interleaveContent<T, U>(arr1: T[], arr2: U[]): Array<T | U> {
    const result: Array<T | U> = [];
    let i = 0, j = 0;

    while (i < arr1.length || j < arr2.length) {
      // Add 1 from arr1 (milestones)
      if (i < arr1.length) {
        result.push(arr1[i]);
        i++;
      }

      // Add 2 from arr2 (stories)
      if (j < arr2.length) {
        result.push(arr2[j]);
        j++;
      }
      if (j < arr2.length) {
        result.push(arr2[j]);
        j++;
      }
    }

    return result;
  }
}
