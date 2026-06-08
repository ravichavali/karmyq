import { query } from '../../database/db';
import {
  FeedItem,
  FeedComposition,
  UserBehavior,
  CommunityActivity,
  OpenRequest,
  SuggestedRequest,
  Story
} from '../../types/feed';

export class FeedComposer {
  /**
   * Calculate feed composition ratio based on user behavior
   */
  async calculateFeedRatio(userId: string): Promise<FeedComposition> {
    const behavior = await this.getUserBehavior(userId);

    // New users: More exploration
    if (behavior.communities_count <= 2 && behavior.recent_helps_count <= 3) {
      return {
        your_communities: 40,
        suggested_requests: 40,
        broader_stories: 20
      };
    }

    // Active users: More from their communities
    if (behavior.recent_helps_count > 10) {
      return {
        your_communities: 70,
        suggested_requests: 20,
        broader_stories: 10
      };
    }

    // Standard: Balanced
    return {
      your_communities: 60,
      suggested_requests: 25,
      broader_stories: 15
    };
  }

  /**
   * Get user behavior metrics
   */
  private async getUserBehavior(userId: string): Promise<UserBehavior> {
    // Get recent helps count (last 30 days)
    // Note: responder_id is used in matches table, not helper_id
    const helpsResult = await query(`
      SELECT COUNT(*) as count
      FROM requests.matches m
      JOIN requests.help_requests r ON m.request_id = r.id
      WHERE (m.responder_id = $1 OR r.requester_id = $1)
        AND m.status = 'completed'
        AND m.completed_at > NOW() - INTERVAL '30 days'
    `, [userId]);

    // Get communities count
    const communitiesResult = await query(`
      SELECT COUNT(*) as count
      FROM communities.members
      WHERE user_id = $1
    `, [userId]);

    // Get user's skills (inferred from completed helps by category)
    // Note: help_requests uses 'category' not 'required_skills'
    const skillsResult = await query(`
      SELECT DISTINCT r.category as skill
      FROM requests.matches m
      JOIN requests.help_requests r ON m.request_id = r.id
      WHERE m.responder_id = $1 AND m.status = 'completed'
      LIMIT 10
    `, [userId]);

    // Get user registration date
    const userResult = await query(`
      SELECT created_at
      FROM auth.users
      WHERE id = $1
    `, [userId]);

    return {
      recent_helps_count: parseInt(helpsResult.rows[0]?.count || '0'),
      communities_count: parseInt(communitiesResult.rows[0]?.count || '0'),
      skills: skillsResult.rows.map((row: { skill: string }) => row.skill),
      member_since: userResult.rows[0]?.created_at || new Date()
    };
  }

  /**
   * Compose full feed for user
   */
  async composeFeed(userId: string, limit: number = 20): Promise<FeedItem[]> {
    const preferences = await this.getUserPreferences(userId);
    const composition = await this.calculateFeedRatio(userId);
    const dismissed = await this.getDismissedItems(userId);

    const feed: FeedItem[] = [];

    // Calculate item counts based on composition percentages
    const yourCommunitiesCount = Math.floor(limit * composition.your_communities / 100);
    const suggestedRequestsCount = Math.floor(limit * composition.suggested_requests / 100);
    const broaderStoriesCount = limit - yourCommunitiesCount - suggestedRequestsCount;

    // 1. Your Communities Activity (if enabled)
    if (preferences.show_community_activity || preferences.show_open_requests) {
      const communityItems = await this.getCommunityActivityItems(
        userId,
        yourCommunitiesCount,
        preferences,
        dismissed
      );
      feed.push(...communityItems);
    }

    // 2. Suggested Requests (if enabled)
    if (preferences.suggest_adjacent_requests) {
      const suggestedItems = await this.getSuggestedRequestItems(
        userId,
        suggestedRequestsCount,
        preferences,
        dismissed
      );
      feed.push(...suggestedItems);
    }

    // 3. Broader Stories (if enabled)
    if (preferences.show_broader_stories) {
      const storyItems = await this.getBroaderStoryItems(
        userId,
        broaderStoriesCount,
        dismissed
      );
      feed.push(...storyItems);
    }

    // Sort by priority and created_at
    feed.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // Higher priority first
      }
      return b.created_at.getTime() - a.created_at.getTime(); // Newer first
    });

    return feed.slice(0, limit);
  }

  /**
   * Get community activity items
   */
  private async getCommunityActivityItems(
    userId: string,
    limit: number,
    preferences: any,
    dismissed: Set<string>
  ): Promise<FeedItem[]> {
    const items: FeedItem[] = [];

    // Get user's communities
    const communities = await query(`
      SELECT c.id, c.name, c.description
      FROM communities.communities c
      JOIN communities.members m ON c.id = m.community_id
      WHERE m.user_id = $1
      ORDER BY m.joined_at DESC
    `, [userId]);

    for (const community of communities.rows) {
      // Get community activity stats
      // Note: Table is help_requests, not requests
      const statsResult = await query(`
        SELECT
          COUNT(DISTINCT CASE WHEN m.completed_at > NOW() - INTERVAL '7 days' THEN m.id END) as exchanges_week,
          COUNT(DISTINCT CASE WHEN cm.joined_at > NOW() - INTERVAL '7 days' THEN cm.user_id END) as new_members
        FROM communities.communities c
        LEFT JOIN requests.help_requests r ON r.community_id = c.id
        LEFT JOIN requests.matches m ON m.request_id = r.id AND m.status = 'completed'
        LEFT JOIN communities.members cm ON cm.community_id = c.id
        WHERE c.id = $1
      `, [community.id]);

      // Get recent helpers
      // Note: Column is responder_id, not helper_id
      const helpersResult = await query(`
        SELECT u.name, COUNT(*) as help_count
        FROM requests.matches m
        JOIN requests.help_requests r ON m.request_id = r.id
        JOIN auth.users u ON m.responder_id = u.id
        WHERE r.community_id = $1
          AND m.status = 'completed'
          AND m.completed_at > NOW() - INTERVAL '7 days'
        GROUP BY u.id, u.name
        ORDER BY help_count DESC
        LIMIT 3
      `, [community.id]);

      // Get open requests count
      // Note: Table is help_requests, not requests
      const openRequestsResult = await query(`
        SELECT COUNT(*) as count
        FROM requests.help_requests r
        WHERE r.community_id = $1
          -- dibs_pending requests are excluded by the status = 'open' equality check
          AND r.status = 'open'
          AND NOT EXISTS (
            SELECT 1 FROM requests.matches m
            WHERE m.request_id = r.id AND m.status IN ('accepted', 'completed')
          )
      `, [community.id]);

      const stats = statsResult.rows[0];
      const activityData: CommunityActivity = {
        community_id: community.id,
        community_name: community.name,
        exchanges_completed_week: parseInt(stats?.exchanges_week || '0'),
        recent_helpers: helpersResult.rows.map((row: any) => ({
          name: row.name,
          help_count: parseInt(row.help_count)
        })),
        open_requests_count: parseInt(openRequestsResult.rows[0]?.count || '0'),
        new_members_count: parseInt(stats?.new_members || '0')
      };

      // Add community activity item
      const itemId = `community_activity_${community.id}`;
      if (!dismissed.has(itemId)) {
        items.push({
          id: itemId,
          type: 'community_activity',
          priority: 100,
          created_at: new Date(),
          data: activityData
        });
      }

      // Add open requests if enabled
      if (preferences.show_open_requests && activityData.open_requests_count > 0) {
        const openRequests = await this.getOpenRequestsForCommunity(community.id, 2);
        for (const request of openRequests) {
          const requestItemId = `open_request_${request.request_id}`;
          if (!dismissed.has(requestItemId)) {
            items.push({
              id: requestItemId,
              type: 'open_request',
              priority: this.calculateRequestPriority(request),
              created_at: request.created_at,
              data: request
            });
          }
        }
      }

      if (items.length >= limit) break;
    }

    return items.slice(0, limit);
  }

  /**
   * Get open requests for a community
   */
  private async getOpenRequestsForCommunity(communityId: string, limit: number): Promise<OpenRequest[]> {
    // Note: Table is help_requests, column is requester_id, no required_skills column
    const result = await query(`
      SELECT
        r.id as request_id,
        r.title,
        r.description,
        r.requester_id as author_id,
        u.name as author_name,
        r.community_id,
        c.name as community_name,
        r.urgency,
        r.category,
        r.created_at,
        COUNT(DISTINCT m.id) as offers_count
      FROM requests.help_requests r
      JOIN auth.users u ON r.requester_id = u.id
      JOIN communities.communities c ON r.community_id = c.id
      LEFT JOIN requests.matches m ON r.id = m.request_id AND m.status = 'proposed'
      WHERE r.community_id = $1
        -- dibs_pending requests are excluded by the status = 'open' equality check
        AND r.status = 'open'
        AND NOT EXISTS (
          SELECT 1 FROM requests.matches m2
          WHERE m2.request_id = r.id AND m2.status IN ('accepted', 'completed')
        )
      GROUP BY r.id, u.name, c.name
      ORDER BY
        CASE r.urgency
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          ELSE 4
        END,
        r.created_at DESC
      LIMIT $2
    `, [communityId, limit]);

    return result.rows.map((row: any) => ({
      request_id: row.request_id,
      title: row.title,
      description: row.description,
      author_id: row.author_id,
      author_name: row.author_name,
      requester_id: row.author_id, // alias — same field, needed by useTrustPath
      community_id: row.community_id,
      community_name: row.community_name,
      urgency: row.urgency,
      expected_duration: null, // Column doesn't exist, use null
      created_at: row.created_at,
      offers_count: parseInt(row.offers_count || '0'),
      required_skills: row.category ? [row.category] : [] // Use category as skill proxy
    }));
  }

  /**
   * Get suggested request items from adjacent communities
   */
  private async getSuggestedRequestItems(
    userId: string,
    limit: number,
    preferences: any,
    dismissed: Set<string>
  ): Promise<FeedItem[]> {
    const items: FeedItem[] = [];
    const userBehavior = await this.getUserBehavior(userId);

    // Get adjacent communities
    const adjacentCommunities = await this.findAdjacentCommunities(userId, preferences.exploration_level);

    for (const adjCommunity of adjacentCommunities) {
      // Get open requests from this adjacent community
      // Note: Table is help_requests, column is requester_id, use category instead of required_skills
      const requests = await query(`
        SELECT
          r.id as request_id,
          r.requester_id,
          r.title,
          r.description,
          r.community_id,
          c.name as community_name,
          r.urgency,
          r.category,
          COUNT(DISTINCT m.id) as offers_count
        FROM requests.help_requests r
        JOIN communities.communities c ON r.community_id = c.id
        LEFT JOIN requests.matches m ON r.id = m.request_id AND m.status = 'proposed'
        WHERE r.community_id = $1
          -- dibs_pending requests are excluded by the status = 'open' equality check
          AND r.status = 'open'
          AND r.requester_id != $2
          AND NOT EXISTS (
            SELECT 1 FROM requests.matches m2
            WHERE m2.request_id = r.id AND m2.status IN ('accepted', 'completed')
          )
        GROUP BY r.id, c.name
        HAVING COUNT(DISTINCT m.id) < 3
        ORDER BY r.created_at DESC
        LIMIT 2
      `, [adjCommunity.community_id, userId]);

      for (const row of requests.rows) {
        // Use category as skill proxy
        const requiredSkills = row.category ? [row.category] : [];
        const matchScore = this.calculateSkillMatchScore(
          requiredSkills,
          userBehavior.skills
        );

        const reason = this.generateSuggestionReason(adjCommunity, userBehavior, matchScore);

        const suggestedRequest: SuggestedRequest = {
          request_id: row.request_id,
          requester_id: row.requester_id,
          title: row.title,
          description: row.description,
          community_id: row.community_id,
          community_name: row.community_name,
          urgency: row.urgency,
          reason: reason,
          match_score: matchScore,
          required_skills: requiredSkills
        };

        const itemId = `suggested_request_${row.request_id}`;
        if (!dismissed.has(itemId)) {
          items.push({
            id: itemId,
            type: 'suggested_request',
            priority: 50 + matchScore,
            created_at: new Date(),
            data: suggestedRequest
          });
        }

        if (items.length >= limit) break;
      }

      if (items.length >= limit) break;
    }

    return items.slice(0, limit);
  }

  /**
   * Find adjacent communities
   */
  private async findAdjacentCommunities(
    userId: string,
    explorationLevel: 'conservative' | 'balanced' | 'adventurous'
  ): Promise<Array<{ community_id: number; community_name: string; relevance_score: number }>> {
    const multiplier = explorationLevel === 'adventurous' ? 1.5 :
                       explorationLevel === 'conservative' ? 0.5 : 1.0;

    // Get communities user is NOT part of
    const result = await query(`
      WITH user_communities AS (
        SELECT community_id FROM communities.members WHERE user_id = $1
      ),
      adjacent_scores AS (
        SELECT
          c.id as community_id,
          c.name as community_name,
          (
            -- Shared members score
            (SELECT COUNT(DISTINCT m2.user_id)
             FROM communities.members m2
             WHERE m2.community_id = c.id
               AND m2.user_id IN (
                 SELECT user_id FROM communities.members
                 WHERE community_id IN (SELECT community_id FROM user_communities)
               )
            ) * 2 +
            -- Skill overlap score (would need skill tags on communities)
            5
          ) * $2 as relevance_score
        FROM communities.communities c
        WHERE c.id NOT IN (SELECT community_id FROM user_communities)
      )
      SELECT community_id, community_name, relevance_score
      FROM adjacent_scores
      WHERE relevance_score > 0
      ORDER BY relevance_score DESC
      LIMIT 5
    `, [userId, multiplier]);

    return result.rows;
  }

  /**
   * Calculate skill match score
   */
  private calculateSkillMatchScore(requiredSkills: string[], userSkills: string[]): number {
    if (requiredSkills.length === 0) return 50;

    const matchingSkills = requiredSkills.filter(skill =>
      userSkills.some(userSkill =>
        userSkill.toLowerCase().includes(skill.toLowerCase()) ||
        skill.toLowerCase().includes(userSkill.toLowerCase())
      )
    );

    return Math.round((matchingSkills.length / requiredSkills.length) * 100);
  }

  /**
   * Generate suggestion reason text
   */
  private generateSuggestionReason(
    adjCommunity: any,
    userBehavior: UserBehavior,
    matchScore: number
  ): string {
    const reasons: string[] = [];

    if (matchScore > 70) {
      reasons.push(`Strong skill match (${matchScore}%)`);
    } else if (matchScore > 40) {
      reasons.push(`Good skill match (${matchScore}%)`);
    }

    reasons.push(`Members from your communities are also in ${adjCommunity.community_name}`);

    return reasons.join('. ');
  }

  /**
   * Get broader story items
   */
  private async getBroaderStoryItems(
    userId: string,
    limit: number,
    dismissed: Set<string>
  ): Promise<FeedItem[]> {
    const items: FeedItem[] = [];

    // Get first-time helpers (last 7 days)
    // Note: Column is responder_id, table is help_requests
    const firstTimers = await query(`
      SELECT
        u.name as helper_name,
        c.name as community_name,
        c.id as community_id,
        m.completed_at
      FROM requests.matches m
      JOIN auth.users u ON m.responder_id = u.id
      JOIN requests.help_requests r ON m.request_id = r.id
      JOIN communities.communities c ON r.community_id = c.id
      WHERE m.status = 'completed'
        AND m.completed_at > NOW() - INTERVAL '7 days'
        AND m.responder_id != $1
        AND (
          SELECT COUNT(*) FROM requests.matches m2
          WHERE m2.responder_id = m.responder_id AND m2.status = 'completed'
        ) = 1
      ORDER BY m.completed_at DESC
      LIMIT 2
    `, [userId]);

    for (const row of firstTimers.rows) {
      const story: Story = {
        story_id: `first_timer_${row.helper_name}_${row.completed_at}`,
        type: 'first_timer',
        title: 'First-time helper!',
        description: `${row.helper_name} completed their first help in "${row.community_name}"`,
        community_id: row.community_id,
        community_name: row.community_name,
        created_at: row.completed_at
      };

      if (!dismissed.has(story.story_id)) {
        items.push({
          id: story.story_id,
          type: 'story',
          priority: 30,
          created_at: story.created_at,
          data: story
        });
      }
    }

    // Get milestone achievements
    // Note: Column is responder_id, not helper_id
    const milestones = await query(`
      SELECT
        u.name as helper_name,
        COUNT(*) as help_count,
        MAX(m.completed_at) as latest_help
      FROM requests.matches m
      JOIN auth.users u ON m.responder_id = u.id
      WHERE m.status = 'completed'
        AND m.responder_id != $1
        AND m.completed_at > NOW() - INTERVAL '7 days'
      GROUP BY u.id, u.name
      HAVING COUNT(*) IN (10, 50, 100)
      ORDER BY latest_help DESC
      LIMIT 2
    `, [userId]);

    for (const row of milestones.rows) {
      const story: Story = {
        story_id: `milestone_${row.helper_name}_${row.help_count}`,
        type: 'milestone',
        title: `${row.help_count} helps milestone!`,
        description: `${row.helper_name} just completed their ${row.help_count}th help!`,
        created_at: row.latest_help
      };

      if (!dismissed.has(story.story_id)) {
        items.push({
          id: story.story_id,
          type: 'story',
          priority: 25,
          created_at: story.created_at,
          data: story
        });
      }
    }

    return items.slice(0, limit);
  }

  /**
   * Calculate request priority
   */
  private calculateRequestPriority(request: OpenRequest): number {
    let priority = 80; // Base priority

    // Urgency boost
    if (request.urgency === 'urgent') priority += 20;
    else if (request.urgency === 'high') priority += 10;
    else if (request.urgency === 'medium') priority += 5;

    // Fewer offers = higher priority
    if (request.offers_count === 0) priority += 15;
    else if (request.offers_count === 1) priority += 5;

    // Recent requests get priority
    const ageHours = (Date.now() - request.created_at.getTime()) / (1000 * 60 * 60);
    if (ageHours < 2) priority += 10;
    else if (ageHours < 24) priority += 5;

    return priority;
  }

  /**
   * Get user preferences
   */
  private async getUserPreferences(userId: string): Promise<any> {
    const result = await query(`
      SELECT * FROM feed.preferences WHERE user_id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      // Return default preferences
      return {
        show_community_activity: true,
        show_open_requests: true,
        show_completed_exchanges: false,
        suggest_adjacent_requests: true,
        exploration_level: 'balanced',
        show_explanations: true,
        show_broader_stories: true,
        allow_public_featuring: true
      };
    }

    return result.rows[0];
  }

  /**
   * Get dismissed items
   */
  private async getDismissedItems(userId: string): Promise<Set<string>> {
    const result = await query(`
      SELECT item_type || '_' || item_id as full_id
      FROM feed.dismissed_items
      WHERE user_id = $1
        AND dismissed_at > NOW() - INTERVAL '7 days'
    `, [userId]);

    return new Set(result.rows.map((row: any) => row.full_id));
  }
}
