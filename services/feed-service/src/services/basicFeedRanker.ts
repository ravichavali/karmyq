/**
 * Basic Feed Ranking Service
 *
 * Implements a simple but effective ranking algorithm for the personalized feed.
 * Prioritizes requests based on:
 * 1. Social proximity (1°/2°/3° connections)
 * 2. Urgency level
 * 3. Recency
 */

import { query } from '../database/db';
import axios from 'axios';

const SOCIAL_GRAPH_SERVICE_URL = process.env.SOCIAL_GRAPH_SERVICE_URL || 'http://social-graph-service:3010';

interface FeedRequest {
  request_id: string;
  title: string;
  description: string;
  requester_id: string;
  requester_name: string;
  community_id: string;
  community_name: string;
  urgency: string;
  status: string;
  category: string;
  created_at: string;
  offers_count: number;
  is_boosted?: boolean; // optional: pre-migration rows have NULL; isBoostActive guards this safely
  boosted_expires_at?: string | null; // optional: same migration compatibility reason
}

interface SocialProximity {
  target_user_id: string;
  degrees_of_separation: number | null;
  trust_score?: number;
  cached?: boolean;
}

interface FeedItem {
  id: string;
  type: 'open_request' | 'suggested_request';
  priority: number;
  created_at: string;
  data: {
    request_id: string;
    title: string;
    description: string;
    author_id: string;
    author_name: string;
    requester_id: string;
    requester_name: string;
    community_id: string;
    community_name: string;
    urgency: string;
    status: string;
    request_type: string;
    category: string;
    created_at: string;
    offers_count: number;
    social_proximity?: {
      degrees: number;
      trust_score?: number;
    };
  };
}

/**
 * Returns true if the request currently has an active boost.
 * Copied inline from request-service — feed-service cannot import across service boundaries.
 */
function isBoostActive(req: { is_boosted?: boolean; boosted_expires_at?: string | null }): boolean {
  if (!req.is_boosted) return false
  if (!req.boosted_expires_at) return false
  return new Date(req.boosted_expires_at) > new Date()
}

export class BasicFeedRanker {
  /**
   * Generate a personalized feed for a user
   */
  async generateFeed(userId: string, limit: number = 20): Promise<FeedItem[]> {
    // Step 1: Fetch open requests from user's communities
    const requests = await this.fetchOpenRequests(userId);

    if (requests.length === 0) {
      return [];
    }

    // Step 2: Get social proximity data for all requesters
    const requesterIds = [...new Set(requests.map(r => r.requester_id))];
    const proximityMap = await this.fetchSocialProximity(userId, requesterIds);

    // Step 3: Score and rank each request
    const scoredItems = requests.map(request => {
      const proximity = proximityMap.get(request.requester_id);
      const score = this.calculateScore(request, proximity);

      return {
        request,
        proximity,
        score
      };
    });

    // Step 4: Sort by score (highest first)
    scoredItems.sort((a, b) => b.score - a.score);

    // Step 5: Convert to feed items
    const feedItems: FeedItem[] = scoredItems.slice(0, limit).map(item => ({
      id: `open_request_${item.request.request_id}`,
      type: 'open_request',
      priority: item.score,
      created_at: item.request.created_at,
      data: {
        request_id: item.request.request_id,
        title: item.request.title,
        description: item.request.description,
        author_id: item.request.requester_id,
        author_name: item.request.requester_name,
        requester_id: item.request.requester_id,
        requester_name: item.request.requester_name,
        community_id: item.request.community_id,
        community_name: item.request.community_name,
        urgency: item.request.urgency,
        status: item.request.status,
        request_type: item.request.category,
        category: item.request.category,
        created_at: item.request.created_at,
        offers_count: item.request.offers_count,
        social_proximity: item.proximity ? {
          degrees: item.proximity.degrees_of_separation!,
          trust_score: item.proximity.trust_score
        } : undefined
      }
    }));

    return feedItems;
  }

  /**
   * Fetch open requests from user's communities
   */
  private async fetchOpenRequests(userId: string): Promise<FeedRequest[]> {
    const result = await query(`
      SELECT
        hr.id as request_id,
        hr.title,
        hr.description,
        hr.requester_id,
        u.name as requester_name,
        c.id as community_id,
        c.name as community_name,
        hr.urgency,
        hr.status,
        hr.category,
        hr.created_at,
        hr.is_boosted,
        hr.boosted_expires_at,
        COUNT(DISTINCT ho.id) as offers_count
      FROM requests.help_requests hr
      JOIN auth.users u ON hr.requester_id = u.id
      JOIN requests.request_communities rc ON hr.id = rc.request_id
      JOIN communities.communities c ON rc.community_id = c.id
      LEFT JOIN requests.matches m ON hr.id = m.request_id
      LEFT JOIN requests.help_offers ho ON m.offer_id = ho.id
      -- dibs_pending requests are excluded by the status = 'open' equality check
      WHERE hr.status = 'open'
        AND hr.requester_id != $1
        AND c.id IN (
          SELECT community_id
          FROM communities.members
          WHERE user_id = $1
        )
      GROUP BY hr.id, u.name, c.id, c.name
      ORDER BY hr.created_at DESC
    `, [userId]);

    return result.rows;
  }

  /**
   * Fetch social proximity data from social graph service
   */
  private async fetchSocialProximity(
    userId: string,
    targetUserIds: string[]
  ): Promise<Map<string, SocialProximity>> {
    if (targetUserIds.length === 0) {
      return new Map();
    }

    try {
      // Call social graph service batch endpoint
      const response = await axios.post(
        `${SOCIAL_GRAPH_SERVICE_URL}/paths/batch`,
        { target_user_ids: targetUserIds },
        {
          headers: {
            'x-user-id': userId
          }
        }
      );

      const proximityMap = new Map<string, SocialProximity>();

      if (response.data.success && Array.isArray(response.data.data)) {
        response.data.data.forEach((item: SocialProximity) => {
          proximityMap.set(item.target_user_id, item);
        });
      }

      return proximityMap;
    } catch (error) {
      console.error('[BasicFeedRanker] Error fetching social proximity:', error);
      return new Map();
    }
  }

  /**
   * Calculate priority score for a request
   *
   * Scoring formula:
   * - Base score: 50
   * - Social proximity: +30 (1°), +20 (2°), +10 (3°)
   * - Urgency: +15 (urgent), +10 (high), +5 (medium), 0 (low)
   * - Recency: up to +10 (newer = higher)
   * - No offers yet: +5 (boost new requests)
   * - Active boost: +0.3 applied after normalization to 0.0–1.0 scale
   *
   * Max raw score: ~110 (normalized to 1.0 before boost)
   * Final score is capped at 1.0
   */
  private calculateScore(
    request: FeedRequest,
    proximity?: SocialProximity
  ): number {
    let score = 50; // Base score

    // Social proximity bonus
    if (proximity && proximity.degrees_of_separation !== null) {
      const degrees = proximity.degrees_of_separation;
      if (degrees === 1) score += 30;
      else if (degrees === 2) score += 20;
      else if (degrees === 3) score += 10;
    }

    // Urgency bonus
    switch (request.urgency) {
      case 'urgent':
        score += 15;
        break;
      case 'high':
        score += 10;
        break;
      case 'medium':
        score += 5;
        break;
      // 'low' gets no bonus
    }

    // Recency bonus (up to 10 points for requests created in last 24 hours)
    const ageInHours = (Date.now() - new Date(request.created_at).getTime()) / (1000 * 60 * 60);
    if (ageInHours < 24) {
      score += Math.floor(10 * (1 - ageInHours / 24));
    }

    // New request bonus (no offers yet)
    if (request.offers_count === 0) {
      score += 5;
    }

    // Normalize to 0.0–1.0 (max possible raw score is 110)
    const MAX_RAW_SCORE = 110;
    const baseScore = score / MAX_RAW_SCORE;

    // Boost bonus: +0.3 for requests with an active boost, capped at 1.0
    const boostBonus = isBoostActive(request) ? 0.3 : 0;
    return Math.min(1.0, baseScore + boostBonus);
  }
}
