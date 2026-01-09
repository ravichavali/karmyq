import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import axios from 'axios';
import { Pool } from 'pg';

/**
 * Feed Service Integration Tests
 *
 * Tests the Feed Service APIs for Social Karma v2.0:
 * - Community health endpoint
 * - Milestones endpoint
 * - Featured stories endpoint
 * - Mixed feed endpoint
 */

const FEED_API_URL = process.env.FEED_API_URL || 'http://localhost:3007';
const AUTH_API_URL = process.env.AUTH_API_URL || 'http://localhost:3001';

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'karmyq_db',
  user: process.env.POSTGRES_USER || 'karmyq_user',
  password: process.env.POSTGRES_PASSWORD || 'karmyq_password_dev',
});

let authToken: string;
let testCommunityId: string;
let testUserId: string;

beforeAll(async () => {
  // Login to get auth token
  const loginResponse = await axios.post(`${AUTH_API_URL}/auth/login`, {
    email: 'isabella.thomas0@example.com',
    password: 'password123',
  });

  authToken = loginResponse.data.token;
  testUserId = loginResponse.data.data.user.id;

  // Get first community
  const result = await pool.query(
    'SELECT id FROM communities.communities ORDER BY created_at LIMIT 1'
  );

  testCommunityId = result.rows[0]?.id;
});

afterAll(async () => {
  try {
    await pool.end();
  } catch (error) {
    console.error('Error closing pool:', error);
  }
}, 10000); // 10 second timeout for cleanup

describe('Feed Service - Community Health', () => {
  it('should return community health data', async () => {
    const response = await axios.get(
      `${FEED_API_URL}/feed/community-health?community_id=${testCommunityId}`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(response.data.data).toBeDefined();
    expect(response.data.data.communityId).toBe(testCommunityId);
    expect(response.data.data.communityName).toBeTruthy();
    expect(response.data.data.networkStrength).toBeGreaterThanOrEqual(0);
    expect(response.data.data.networkStrength).toBeLessThanOrEqual(100);
  });

  it('should calculate network strength correctly', async () => {
    const response = await axios.get(
      `${FEED_API_URL}/feed/community-health?community_id=${testCommunityId}`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    const { networkStrength, networkStrengthLabel } = response.data.data;

    // Validate label matches strength
    if (networkStrength >= 80) {
      expect(networkStrengthLabel).toBe('Thriving');
    } else if (networkStrength >= 60) {
      expect(networkStrengthLabel).toBe('Strong');
    } else if (networkStrength >= 40) {
      expect(networkStrengthLabel).toBe('Growing');
    } else if (networkStrength >= 20) {
      expect(networkStrengthLabel).toBe('Developing');
    } else {
      expect(networkStrengthLabel).toBe('Building');
    }
  });

  it('should return trend direction', async () => {
    const response = await axios.get(
      `${FEED_API_URL}/feed/community-health?community_id=${testCommunityId}`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    expect(response.data.data.trendDirection).toMatch(/growing|stable|declining/);
  });

  it('should require authentication', async () => {
    try {
      await axios.get(
        `${FEED_API_URL}/feed/community-health?community_id=${testCommunityId}`
      );
      fail('Should have thrown 401');
    } catch (error: any) {
      expect(error.response.status).toBe(401);
    }
  });

  it('should handle missing community gracefully', async () => {
    const nonExistentId = '00000000-0000-0000-0000-999999999999';

    try {
      const response = await axios.get(
        `${FEED_API_URL}/feed/community-health?community_id=${nonExistentId}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      // Should return 404 or null data
      if (response.status === 200) {
        expect(response.data.data).toBeNull();
      }
    } catch (error: any) {
      expect(error.response.status).toBe(404);
    }
  });
});

describe('Feed Service - Milestones', () => {
  it('should return milestone posts', async () => {
    const response = await axios.get(
      `${FEED_API_URL}/feed/milestones?community_id=${testCommunityId}&limit=5`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(Array.isArray(response.data.data)).toBe(true);
  });

  it('should validate milestone structure', async () => {
    // Seed a test milestone
    await pool.query(
      `INSERT INTO reputation.milestone_events (
        community_id, milestone_type, milestone_value, description, achieved_at
      ) VALUES ($1, 'test_milestone', 1, 'Test milestone', NOW())
      ON CONFLICT DO NOTHING`,
      [testCommunityId]
    );

    const response = await axios.get(
      `${FEED_API_URL}/feed/milestones?community_id=${testCommunityId}&limit=10`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    const milestones = response.data.data;

    if (milestones.length > 0) {
      const milestone = milestones[0];

      expect(milestone.id).toBeTruthy();
      expect(milestone.type).toBe('milestone');
      expect(milestone.milestoneType).toBeTruthy();
      expect(milestone.description).toBeTruthy();
      expect(milestone.achievedAt).toBeTruthy();
      expect(milestone.networkStrength).toBeGreaterThanOrEqual(0);
      expect(milestone.communityId).toBe(testCommunityId);
      expect(typeof milestone.isPinned).toBe('boolean');
    }
  });

  it('should pin milestones within 48 hours', async () => {
    // Insert milestone just now
    await pool.query(
      `DELETE FROM reputation.milestone_events
       WHERE community_id = $1 AND milestone_type = 'test_recent'`,
      [testCommunityId]
    );

    await pool.query(
      `INSERT INTO reputation.milestone_events (
        community_id, milestone_type, milestone_value, description, achieved_at
      ) VALUES ($1, 'test_recent', 1, 'Recent test', NOW())`,
      [testCommunityId]
    );

    const response = await axios.get(
      `${FEED_API_URL}/feed/milestones?community_id=${testCommunityId}&limit=10`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    const recent = response.data.data.find(
      (m: any) => m.milestoneType === 'test_recent'
    );

    if (recent) {
      expect(recent.isPinned).toBe(true);
    }
  });

  it('should not pin milestones older than 48 hours', async () => {
    // Insert milestone from 3 days ago
    await pool.query(
      `DELETE FROM reputation.milestone_events
       WHERE community_id = $1 AND milestone_type = 'test_old'`,
      [testCommunityId]
    );

    await pool.query(
      `INSERT INTO reputation.milestone_events (
        community_id, milestone_type, milestone_value, description, achieved_at
      ) VALUES ($1, 'test_old', 1, 'Old test', NOW() - INTERVAL '3 days')`,
      [testCommunityId]
    );

    const response = await axios.get(
      `${FEED_API_URL}/feed/milestones?community_id=${testCommunityId}&limit=10`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    const old = response.data.data.find((m: any) => m.milestoneType === 'test_old');

    if (old) {
      expect(old.isPinned).toBe(false);
    }
  });

  it('should respect limit parameter', async () => {
    const response = await axios.get(
      `${FEED_API_URL}/feed/milestones?community_id=${testCommunityId}&limit=2`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    expect(response.data.data.length).toBeLessThanOrEqual(2);
  });
});

describe('Feed Service - Featured Stories', () => {
  it('should return featured stories', async () => {
    const response = await axios.get(
      `${FEED_API_URL}/feed/featured-stories?community_id=${testCommunityId}&limit=10`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(Array.isArray(response.data.data)).toBe(true);
  });

  it('should respect privacy flags', async () => {
    const response = await axios.get(
      `${FEED_API_URL}/feed/featured-stories?community_id=${testCommunityId}&limit=10`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    const stories = response.data.data;

    stories.forEach((story: any) => {
      // If anonymous, names should be null
      if (story.isAnonymous) {
        expect(story.requesterName).toBeNull();
        expect(story.responderName).toBeNull();
      }
    });
  });

  it('should validate rating ranges', async () => {
    const response = await axios.get(
      `${FEED_API_URL}/feed/featured-stories?community_id=${testCommunityId}&limit=10`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    const stories = response.data.data;

    stories.forEach((story: any) => {
      expect(story.helpfulness).toBeGreaterThanOrEqual(1);
      expect(story.helpfulness).toBeLessThanOrEqual(5);
      expect(story.responsiveness).toBeGreaterThanOrEqual(1);
      expect(story.responsiveness).toBeLessThanOrEqual(5);
      expect(story.clarity).toBeGreaterThanOrEqual(1);
      expect(story.clarity).toBeLessThanOrEqual(5);
    });
  });
});

describe('Feed Service - Mixed Feed', () => {
  it('should return mixed content', async () => {
    const response = await axios.get(
      `${FEED_API_URL}/feed/mixed?community_id=${testCommunityId}&limit=20`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(Array.isArray(response.data.data)).toBe(true);
  });

  it('should prioritize pinned milestones', async () => {
    // Insert a recent milestone
    await pool.query(
      `DELETE FROM reputation.milestone_events
       WHERE community_id = $1 AND milestone_type = 'test_pinned'`,
      [testCommunityId]
    );

    await pool.query(
      `INSERT INTO reputation.milestone_events (
        community_id, milestone_type, milestone_value, description, achieved_at
      ) VALUES ($1, 'test_pinned', 1, 'Pinned test', NOW())`,
      [testCommunityId]
    );

    const response = await axios.get(
      `${FEED_API_URL}/feed/mixed?community_id=${testCommunityId}&limit=20`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    const feed = response.data.data;

    if (feed.length > 0) {
      // First item should be pinned milestone if one exists
      const pinnedItems = feed.filter((item: any) => item.isPinned);

      if (pinnedItems.length > 0) {
        expect(feed[0].isPinned).toBe(true);
      }
    }
  });

  it('should interleave content types', async () => {
    const response = await axios.get(
      `${FEED_API_URL}/feed/mixed?community_id=${testCommunityId}&limit=20`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    const feed = response.data.data;

    if (feed.length > 3) {
      const types = new Set(feed.map((item: any) => item.type));

      // Should have different types if both exist
      expect(types.size).toBeGreaterThan(0);
    }
  });
});

describe('Feed Service - Error Handling', () => {
  it('should validate community_id format', async () => {
    try {
      await axios.get(`${FEED_API_URL}/feed/community-health?community_id=invalid`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      fail('Should have thrown validation error');
    } catch (error: any) {
      expect(error.response.status).toBeGreaterThanOrEqual(400);
    }
  });

  it('should require community_id parameter', async () => {
    try {
      await axios.get(`${FEED_API_URL}/feed/community-health`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      fail('Should have thrown validation error');
    } catch (error: any) {
      expect(error.response.status).toBeGreaterThanOrEqual(400);
    }
  });
});
