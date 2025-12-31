/**
 * Time Travel Factory - Backdating utilities for aged test data
 *
 * Allows creating records with historical timestamps to test:
 * - Karma decay (6-month half-life)
 * - Ephemeral data cleanup (60-day TTL)
 * - Trust score evolution
 * - Reputation system behavior
 *
 * Approach:
 * 1. Create record via API (triggers business logic)
 * 2. Update timestamps directly in database
 * 3. Optionally trigger decay calculations
 */

import { Pool } from 'pg';
import { TestUser, TestCommunity } from './index';

export interface BackdateOptions {
  monthsAgo?: number;
  daysAgo?: number;
  hoursAgo?: number;
}

export class TimeTravelFactory {
  constructor(private pool: Pool) {}

  /**
   * Calculate a backdated timestamp
   */
  private calculatePastDate(options: BackdateOptions): Date {
    const now = new Date();
    const { monthsAgo = 0, daysAgo = 0, hoursAgo = 0 } = options;

    const pastDate = new Date(now);
    pastDate.setMonth(pastDate.getMonth() - monthsAgo);
    pastDate.setDate(pastDate.getDate() - daysAgo);
    pastDate.setHours(pastDate.getHours() - hoursAgo);

    return pastDate;
  }

  /**
   * Backdate a user's creation timestamp
   * Useful for testing "account age" features
   */
  async backdateUser(userId: string, options: BackdateOptions): Promise<void> {
    const createdAt = this.calculatePastDate(options);

    await this.pool.query(
      `UPDATE auth.users SET created_at = $1 WHERE id = $2`,
      [createdAt, userId]
    );
  }

  /**
   * Create backdated karma record
   * Useful for testing karma decay
   */
  async createBackdatedKarma(
    userId: string,
    communityId: string,
    options: BackdateOptions & {
      points: number;
      eventType: string;
      matchId?: string;
      description?: string;
    }
  ): Promise<string> {
    const createdAt = this.calculatePastDate(options);
    const { points, eventType, matchId, description } = options;

    const result = await this.pool.query(
      `INSERT INTO reputation.karma_records
       (user_id, community_id, event_type, points_awarded, match_id, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [userId, communityId, eventType, points, matchId || null, description || null, createdAt]
    );

    return result.rows[0].id;
  }

  /**
   * Create expired help request (older than 60 days)
   * Useful for testing ephemeral data cleanup
   */
  async createExpiredRequest(
    communityId: string,
    requesterId: string,
    options: BackdateOptions & {
      title: string;
      description: string;
      category?: string;
    }
  ): Promise<string> {
    const createdAt = this.calculatePastDate(options);
    const expiresAt = new Date(createdAt);
    expiresAt.setDate(expiresAt.getDate() + 60); // 60-day TTL

    const result = await this.pool.query(
      `INSERT INTO requests.help_requests
       (requester_id, title, description, category, status, created_at, expires_at)
       VALUES ($1, $2, $3, $4, 'expired', $5, $6)
       RETURNING id`,
      [requesterId, options.title, options.description, options.category || 'general', createdAt, expiresAt]
    );

    const requestId = result.rows[0].id;

    // Link to community
    await this.pool.query(
      `INSERT INTO requests.request_communities (request_id, community_id)
       VALUES ($1, $2)`,
      [requestId, communityId]
    );

    return requestId;
  }

  /**
   * Create a complete aged workflow:
   * Request → Offer → Match → Messages → Karma
   *
   * Timeline example (all in the past):
   * - Day 30: Request created
   * - Day 29: Offer made
   * - Day 28: Match accepted
   * - Days 28-25: Messages exchanged
   * - Day 25: Match completed
   * - Day 25: Karma awarded
   */
  async createAgedWorkflow(
    community: TestCommunity,
    requester: TestUser,
    helper: TestUser,
    timeline: {
      requestCreatedDaysAgo: number;
      offerCreatedDaysAgo: number;
      matchCreatedDaysAgo: number;
      matchCompletedDaysAgo: number;
    }
  ): Promise<{
    requestId: string;
    matchId: string;
    karmaRecords: string[];
  }> {
    const {
      requestCreatedDaysAgo,
      offerCreatedDaysAgo,
      matchCreatedDaysAgo,
      matchCompletedDaysAgo
    } = timeline;

    // 1. Create request
    const requestCreatedAt = this.calculatePastDate({ daysAgo: requestCreatedDaysAgo });
    const requestResult = await this.pool.query(
      `INSERT INTO requests.help_requests
       (requester_id, title, description, category, status, created_at)
       VALUES ($1, $2, $3, 'general', 'matched', $4)
       RETURNING id`,
      [
        requester.id,
        'Need help with moving furniture',
        'Looking for someone to help move a couch this weekend',
        requestCreatedAt
      ]
    );
    const requestId = requestResult.rows[0].id;

    // Link to community
    await this.pool.query(
      `INSERT INTO requests.request_communities (request_id, community_id)
       VALUES ($1, $2)`,
      [requestId, community.id]
    );

    // 2. Create match (completed)
    const matchCreatedAt = this.calculatePastDate({ daysAgo: matchCreatedDaysAgo });
    const matchCompletedAt = this.calculatePastDate({ daysAgo: matchCompletedDaysAgo });

    const matchResult = await this.pool.query(
      `INSERT INTO requests.matches
       (request_id, responder_id, status, created_at, completed_at)
       VALUES ($1, $2, 'completed', $3, $4)
       RETURNING id`,
      [requestId, helper.id, matchCreatedAt, matchCompletedAt]
    );
    const matchId = matchResult.rows[0].id;

    // 3. Create conversation and messages
    const conversationResult = await this.pool.query(
      `INSERT INTO messaging.conversations (request_match_id, created_at)
       VALUES ($1, $2)
       RETURNING id`,
      [matchId, matchCreatedAt]
    );
    const conversationId = conversationResult.rows[0].id;

    // Messages exchanged over a few days
    const messages = [
      { sender: requester.id, content: 'Thanks for offering to help!', hoursLater: 1 },
      { sender: helper.id, content: 'Happy to help! When works for you?', hoursLater: 3 },
      { sender: requester.id, content: 'How about Saturday at 2pm?', hoursLater: 24 },
      { sender: helper.id, content: 'Perfect, see you then!', hoursLater: 26 }
    ];

    for (const msg of messages) {
      const messageTime = new Date(matchCreatedAt);
      messageTime.setHours(messageTime.getHours() + msg.hoursLater);

      await this.pool.query(
        `INSERT INTO messaging.messages (sender_id, conversation_id, content, created_at)
         VALUES ($1, $2, $3, $4)`,
        [msg.sender, conversationId, msg.content, messageTime]
      );
    }

    // 4. Award karma
    const karmaRecords: string[] = [];

    // Helper gets 10 points for helping
    const helperKarmaId = await this.createBackdatedKarma(helper.id, community.id, {
      daysAgo: matchCompletedDaysAgo,
      points: 10,
      eventType: 'help_given',
      matchId,
      description: 'Completed help request'
    });
    karmaRecords.push(helperKarmaId);

    // Requester gets 5 points for receiving help
    const requesterKarmaId = await this.createBackdatedKarma(requester.id, community.id, {
      daysAgo: matchCompletedDaysAgo,
      points: 5,
      eventType: 'help_received',
      matchId,
      description: 'Received help'
    });
    karmaRecords.push(requesterKarmaId);

    return { requestId, matchId, karmaRecords };
  }

  /**
   * Backdate a community's creation
   */
  async backdateCommunity(communityId: string, options: BackdateOptions): Promise<void> {
    const createdAt = this.calculatePastDate(options);

    await this.pool.query(
      `UPDATE communities.communities SET created_at = $1 WHERE id = $2`,
      [createdAt, communityId]
    );
  }

  /**
   * Backdate a membership
   */
  async backdateMembership(membershipId: string, options: BackdateOptions): Promise<void> {
    const joinedAt = this.calculatePastDate(options);

    await this.pool.query(
      `UPDATE communities.members SET joined_at = $1 WHERE id = $2`,
      [joinedAt, membershipId]
    );
  }
}
