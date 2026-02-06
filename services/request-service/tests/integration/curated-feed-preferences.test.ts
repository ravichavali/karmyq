/**
 * Curated Feed with Preferences Integration Tests - Days 9-10
 *
 * Tests the complete curated feed flow:
 * - User preferences (subscribe/unsubscribe request types)
 * - User interests (service categories, item categories, event types)
 * - Curated feed filtering (by type, skills, match score)
 * - Match score calculation with real data
 *
 * Requires: PostgreSQL database connection
 */

import { query } from '../../src/database/db';

describe('Curated Feed with Preferences (Integration)', () => {
  let testUserId: string;
  let testCommunityId: string;
  let requestIds: string[] = [];

  beforeAll(async () => {
    // Create test user
    const userResult = await query(
      `INSERT INTO auth.users (email, name, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id`,
      ['feed-test@example.com', 'Feed Test User', 'hash123']
    );
    testUserId = userResult.rows[0].id;

    // Create test community
    const communityResult = await query(
      `INSERT INTO communities.communities (name, description)
       VALUES ($1, $2)
       RETURNING id`,
      ['Feed Test Community', 'Community for curated feed testing']
    );
    testCommunityId = communityResult.rows[0].id;

    // Add user to community
    await query(
      `INSERT INTO communities.members (community_id, user_id, role, status)
       VALUES ($1, $2, 'member', 'active')`,
      [testCommunityId, testUserId]
    );

    // Add user skills (plumbing and carpentry)
    await query(
      `INSERT INTO auth.user_skills (user_id, skill)
       VALUES ($1, 'plumbing'), ($1, 'carpentry')`,
      [testUserId]
    );

    // Create sample requests of different types
    const requests = [
      // Service - Plumbing (should match)
      {
        type: 'service',
        title: 'Need plumber for leak repair',
        description: 'Kitchen pipe leaking',
        payload: { service_category: 'plumbing', skill_level_required: 'intermediate' },
      },
      // Service - Tech support (should NOT match skills)
      {
        type: 'service',
        title: 'Need tech support',
        description: 'Computer not working',
        payload: { service_category: 'tech_support', skill_level_required: 'expert' },
      },
      // Ride request
      {
        type: 'ride',
        title: 'Need ride to airport',
        description: 'Flying out tomorrow',
        payload: {
          origin: { address: '123 Main St', lat: 40.7, lng: -74.0 },
          destination: { address: 'JFK Airport', lat: 40.6, lng: -73.7 },
          seats_needed: 1,
          departure_time: '2024-06-15T10:00:00Z',
        },
      },
      // Event request
      {
        type: 'event',
        title: 'Community cleanup volunteers needed',
        description: 'Annual park cleanup',
        payload: {
          event_type: 'community_cleanup',
          event_date: '2024-07-01T09:00:00Z',
          event_duration_hours: 4,
          location: { address: 'Central Park', is_virtual: false },
          participants_needed: 20,
        },
      },
      // Generic request
      {
        type: 'generic',
        title: 'Help moving furniture',
        description: 'Need help moving couch',
        payload: {},
      },
    ];

    for (const req of requests) {
      const result = await query(
        `INSERT INTO requests.help_requests
         (requester_id, request_type, title, description, status, payload)
         VALUES ($1, $2, $3, $4, 'open', $5)
         RETURNING id`,
        [testUserId, req.type, req.title, req.description, JSON.stringify(req.payload)]
      );

      const requestId = result.rows[0].id;
      requestIds.push(requestId);

      // Link to community
      await query(
        `INSERT INTO requests.request_communities (request_id, community_id)
         VALUES ($1, $2)`,
        [requestId, testCommunityId]
      );
    }
  });

  afterAll(async () => {
    // Cleanup
    if (requestIds.length > 0) {
      await query(
        `DELETE FROM requests.help_requests WHERE id = ANY($1)`,
        [requestIds]
      );
    }
    await query('DELETE FROM auth.user_interests WHERE user_id = $1', [testUserId]);
    await query('DELETE FROM auth.user_request_preferences WHERE user_id = $1', [testUserId]);
    await query('DELETE FROM auth.user_skills WHERE user_id = $1', [testUserId]);
    await query('DELETE FROM communities.members WHERE user_id = $1', [testUserId]);
    await query('DELETE FROM communities.communities WHERE id = $1', [testCommunityId]);
    await query('DELETE FROM auth.users WHERE id = $1', [testUserId]);
  });

  describe('User Preferences - Request Types', () => {
    it('should create default preferences (all subscribed)', async () => {
      // Insert default preferences
      await query(
        `INSERT INTO auth.user_request_preferences (user_id, request_type, subscribed)
         VALUES
           ($1, 'generic', true),
           ($1, 'ride', true),
           ($1, 'service', true),
           ($1, 'event', true),
           ($1, 'borrow', true)
         ON CONFLICT (user_id, request_type) DO UPDATE SET subscribed = EXCLUDED.subscribed`,
        [testUserId]
      );

      const result = await query(
        `SELECT request_type, subscribed
         FROM auth.user_request_preferences
         WHERE user_id = $1
         ORDER BY request_type`,
        [testUserId]
      );

      expect(result.rowCount).toBe(5);
      result.rows.forEach((row: any) => {
        expect(row.subscribed).toBe(true);
      });
    });

    it('should update preference to unsubscribe from ride requests', async () => {
      await query(
        `UPDATE auth.user_request_preferences
         SET subscribed = false
         WHERE user_id = $1 AND request_type = 'ride'`,
        [testUserId]
      );

      const result = await query(
        `SELECT subscribed
         FROM auth.user_request_preferences
         WHERE user_id = $1 AND request_type = 'ride'`,
        [testUserId]
      );

      expect(result.rows[0].subscribed).toBe(false);
    });

    it('should query only subscribed request types', async () => {
      const result = await query(
        `SELECT request_type
         FROM auth.user_request_preferences
         WHERE user_id = $1 AND subscribed = true
         ORDER BY request_type`,
        [testUserId]
      );

      const subscribedTypes = result.rows.map((row: any) => row.request_type);

      expect(subscribedTypes).toContain('generic');
      expect(subscribedTypes).toContain('service');
      expect(subscribedTypes).toContain('event');
      expect(subscribedTypes).toContain('borrow');
      expect(subscribedTypes).not.toContain('ride'); // Unsubscribed
    });
  });

  describe('User Interests', () => {
    it('should add service category interest (plumbing)', async () => {
      const result = await query(
        `INSERT INTO auth.user_interests (user_id, interest_type, interest_value)
         VALUES ($1, 'service_category', 'plumbing')
         ON CONFLICT (user_id, interest_type, interest_value) DO NOTHING
         RETURNING id`,
        [testUserId]
      );

      expect(result.rowCount).toBeGreaterThan(0);
    });

    it('should add multiple service interests', async () => {
      await query(
        `INSERT INTO auth.user_interests (user_id, interest_type, interest_value)
         VALUES
           ($1, 'service_category', 'carpentry'),
           ($1, 'service_category', 'electrical')
         ON CONFLICT (user_id, interest_type, interest_value) DO NOTHING`,
        [testUserId]
      );

      const result = await query(
        `SELECT interest_value
         FROM auth.user_interests
         WHERE user_id = $1 AND interest_type = 'service_category'
         ORDER BY interest_value`,
        [testUserId]
      );

      expect(result.rowCount).toBeGreaterThanOrEqual(2);
      const interests = result.rows.map((row: any) => row.interest_value);
      expect(interests).toContain('plumbing');
      expect(interests).toContain('carpentry');
    });

    it('should query interests grouped by type', async () => {
      // Add event type interests
      await query(
        `INSERT INTO auth.user_interests (user_id, interest_type, interest_value)
         VALUES
           ($1, 'event_type', 'volunteer'),
           ($1, 'event_type', 'community_cleanup')
         ON CONFLICT (user_id, interest_type, interest_value) DO NOTHING`,
        [testUserId]
      );

      const result = await query(
        `SELECT interest_type, ARRAY_AGG(interest_value) as values
         FROM auth.user_interests
         WHERE user_id = $1
         GROUP BY interest_type
         ORDER BY interest_type`,
        [testUserId]
      );

      expect(result.rowCount).toBeGreaterThan(0);

      const grouped = result.rows.reduce((acc: any, row: any) => {
        acc[row.interest_type] = row.values;
        return acc;
      }, {});

      expect(grouped.service_category).toContain('plumbing');
      expect(grouped.event_type).toContain('volunteer');
    });

    it('should remove an interest', async () => {
      const interestResult = await query(
        `SELECT id FROM auth.user_interests
         WHERE user_id = $1 AND interest_type = 'service_category' AND interest_value = 'electrical'
         LIMIT 1`,
        [testUserId]
      );

      if (interestResult.rowCount > 0) {
        const interestId = interestResult.rows[0].id;

        await query(
          `DELETE FROM auth.user_interests WHERE id = $1 AND user_id = $2`,
          [interestId, testUserId]
        );

        const checkResult = await query(
          `SELECT id FROM auth.user_interests WHERE id = $1`,
          [interestId]
        );

        expect(checkResult.rowCount).toBe(0);
      }
    });
  });

  describe('Curated Feed - Filter by Preferences', () => {
    it('should filter requests by subscribed types only', async () => {
      // User is subscribed to: generic, service, event, borrow (NOT ride)
      const result = await query(
        `SELECT r.id, r.request_type, r.title
         FROM requests.help_requests r
         INNER JOIN requests.request_communities rc ON r.id = rc.request_id
         WHERE rc.community_id = $1
         AND r.status = 'open'
         AND r.request_type IN (
           SELECT request_type
           FROM auth.user_request_preferences
           WHERE user_id = $2 AND subscribed = true
         )
         ORDER BY r.created_at DESC`,
        [testCommunityId, testUserId]
      );

      const types = result.rows.map((row: any) => row.request_type);

      expect(types).toContain('generic');
      expect(types).toContain('service');
      expect(types).toContain('event');
      expect(types).not.toContain('ride'); // Should be filtered out
    });

    it('should get user skills for matching', async () => {
      const result = await query(
        `SELECT skill FROM auth.user_skills WHERE user_id = $1`,
        [testUserId]
      );

      const skills = result.rows.map((row: any) => row.skill);

      expect(skills).toContain('plumbing');
      expect(skills).toContain('carpentry');
    });

    it('should filter service requests by user interests', async () => {
      // Get service requests matching user's service category interests
      const result = await query(
        `SELECT r.id, r.title, r.payload->>'service_category' as category
         FROM requests.help_requests r
         INNER JOIN requests.request_communities rc ON r.id = rc.request_id
         WHERE rc.community_id = $1
         AND r.request_type = 'service'
         AND r.status = 'open'
         AND r.payload->>'service_category' IN (
           SELECT interest_value
           FROM auth.user_interests
           WHERE user_id = $2
           AND interest_type = 'service_category'
         )`,
        [testCommunityId, testUserId]
      );

      expect(result.rowCount).toBeGreaterThanOrEqual(1);

      const categories = result.rows.map((row: any) => row.category);
      expect(categories).toContain('plumbing');
    });
  });

  describe('Complete Curated Feed Flow', () => {
    it('should simulate complete curated feed query', async () => {
      // This simulates the full curated endpoint logic:
      // 1. Get subscribed request types
      // 2. Get user skills
      // 3. Fetch requests from user's communities
      // 4. Filter by subscribed types
      // 5. Calculate match scores (simplified here)

      // Step 1: Get subscribed types
      const prefsResult = await query(
        `SELECT request_type
         FROM auth.user_request_preferences
         WHERE user_id = $1 AND subscribed = true`,
        [testUserId]
      );

      const subscribedTypes = prefsResult.rows.map((row: any) => row.request_type);

      // Step 2: Get user skills
      const skillsResult = await query(
        `SELECT skill FROM auth.user_skills WHERE user_id = $1`,
        [testUserId]
      );

      const userSkills = skillsResult.rows.map((row: any) => row.skill);

      // Step 3: Fetch requests
      const requestsResult = await query(
        `SELECT
           r.id,
           r.request_type,
           r.title,
           r.description,
           r.urgency,
           r.payload,
           r.created_at
         FROM requests.help_requests r
         INNER JOIN requests.request_communities rc ON r.id = rc.request_id
         INNER JOIN communities.members m ON rc.community_id = m.community_id
         WHERE r.status = 'open'
         AND m.user_id = $1
         AND m.status = 'active'
         ORDER BY r.created_at DESC`,
        [testUserId]
      );

      // Step 4: Filter by subscribed types
      const filteredRequests = requestsResult.rows.filter((req: any) =>
        subscribedTypes.includes(req.request_type)
      );

      // Verify filtering worked
      expect(filteredRequests.length).toBeGreaterThan(0);
      expect(filteredRequests.length).toBeLessThan(requestsResult.rowCount);

      const filteredTypes = filteredRequests.map((req: any) => req.request_type);
      expect(filteredTypes).not.toContain('ride'); // Unsubscribed

      // Step 5: Simplified match score calculation
      // In real implementation, this uses the matching algorithm
      const requestsWithScores = filteredRequests.map((req: any) => {
        let matchScore = 0;

        // Simple scoring: +50 for skill match, +30 for interest match
        if (req.request_type === 'service') {
          const serviceCategory = req.payload?.service_category;
          if (serviceCategory === 'plumbing' && userSkills.includes('plumbing')) {
            matchScore += 50;
          }
        }

        // Generic gets base score
        if (req.request_type === 'generic') {
          matchScore = 30;
        }

        return {
          ...req,
          matchScore,
        };
      });

      // Filter by minimum match score (e.g., 30%)
      const highQualityMatches = requestsWithScores.filter((req: any) => req.matchScore >= 30);

      expect(highQualityMatches.length).toBeGreaterThan(0);

      // Sort by match score
      highQualityMatches.sort((a: any, b: any) => b.matchScore - a.matchScore);

      // Verify plumbing request is highly ranked
      const plumbingRequest = highQualityMatches.find((req: any) =>
        req.title.toLowerCase().includes('plumber')
      );

      expect(plumbingRequest).toBeDefined();
      expect(plumbingRequest.matchScore).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Edge Cases', () => {
    it('should handle user with no preferences (default to all)', async () => {
      // Create a new user with no preferences
      const newUserResult = await query(
        `INSERT INTO auth.users (email, name, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id`,
        ['no-prefs@example.com', 'No Prefs User', 'hash123']
      );

      const newUserId = newUserResult.rows[0].id;

      // Query preferences (should be empty)
      const prefsResult = await query(
        `SELECT request_type
         FROM auth.user_request_preferences
         WHERE user_id = $1 AND subscribed = true`,
        [newUserId]
      );

      // No preferences means show all types
      const subscribedTypes =
        prefsResult.rowCount > 0
          ? prefsResult.rows.map((row: any) => row.request_type)
          : ['generic', 'ride', 'service', 'event', 'borrow'];

      expect(subscribedTypes).toHaveLength(5);

      // Cleanup
      await query('DELETE FROM auth.users WHERE id = $1', [newUserId]);
    });

    it('should handle user with all types unsubscribed', async () => {
      // Create user with all types unsubscribed
      const newUserResult = await query(
        `INSERT INTO auth.users (email, name, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id`,
        ['all-unsub@example.com', 'All Unsubscribed User', 'hash123']
      );

      const newUserId = newUserResult.rows[0].id;

      // Set all to unsubscribed
      await query(
        `INSERT INTO auth.user_request_preferences (user_id, request_type, subscribed)
         VALUES
           ($1, 'generic', false),
           ($1, 'ride', false),
           ($1, 'service', false),
           ($1, 'event', false),
           ($1, 'borrow', false)`,
        [newUserId]
      );

      const prefsResult = await query(
        `SELECT request_type
         FROM auth.user_request_preferences
         WHERE user_id = $1 AND subscribed = true`,
        [newUserId]
      );

      // No subscribed types
      expect(prefsResult.rowCount).toBe(0);

      // Cleanup
      await query('DELETE FROM auth.user_request_preferences WHERE user_id = $1', [newUserId]);
      await query('DELETE FROM auth.users WHERE id = $1', [newUserId]);
    });

    it('should handle user with no skills', async () => {
      const skillsResult = await query(
        `SELECT skill FROM auth.user_skills WHERE user_id = $1`,
        ['non-existent-user']
      );

      expect(skillsResult.rowCount).toBe(0);

      // Empty skills array should still work
      const userSkills = skillsResult.rows.map((row: any) => row.skill);
      expect(userSkills).toEqual([]);
    });
  });
});
