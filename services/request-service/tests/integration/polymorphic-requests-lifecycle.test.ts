/**
 * Polymorphic Requests Integration Tests - Days 9-10
 *
 * Tests complete request lifecycle for all 5 polymorphic types:
 * - Create (with validation)
 * - Retrieve (single and list)
 * - Update (status, not payload)
 * - Delete
 * - Multi-community posting
 *
 * Requires: PostgreSQL database connection
 */

import { query } from '../../src/database/db';

describe('Polymorphic Requests - Complete Lifecycle (Integration)', () => {
  let testUserId: string;
  let testCommunityId: string;
  let testCommunityId2: string;

  beforeAll(async () => {
    // Create test user
    const userResult = await query(
      `INSERT INTO auth.users (email, name, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id`,
      ['test-poly@example.com', 'Test User', 'hash123']
    );
    testUserId = userResult.rows[0].id;

    // Create test communities
    const community1 = await query(
      `INSERT INTO communities.communities (name, description)
       VALUES ($1, $2)
       RETURNING id`,
      ['Test Community 1', 'Test community for polymorphic requests']
    );
    testCommunityId = community1.rows[0].id;

    const community2 = await query(
      `INSERT INTO communities.communities (name, description)
       VALUES ($1, $2)
       RETURNING id`,
      ['Test Community 2', 'Second test community']
    );
    testCommunityId2 = community2.rows[0].id;

    // Add user to both communities
    await query(
      `INSERT INTO communities.members (community_id, user_id, role, status)
       VALUES ($1, $2, 'member', 'active'), ($3, $2, 'member', 'active')`,
      [testCommunityId, testUserId, testCommunityId2]
    );

    // Add user skills for matching tests
    await query(
      `INSERT INTO auth.user_skills (user_id, skill)
       VALUES ($1, 'plumbing'), ($1, 'driving'), ($1, 'event_planning')`,
      [testUserId]
    );
  });

  afterAll(async () => {
    // Cleanup: Delete test data
    await query('DELETE FROM communities.members WHERE user_id = $1', [testUserId]);
    await query('DELETE FROM auth.user_skills WHERE user_id = $1', [testUserId]);
    await query('DELETE FROM communities.communities WHERE id = $1 OR id = $2', [testCommunityId, testCommunityId2]);
    await query('DELETE FROM auth.users WHERE id = $1', [testUserId]);
  });

  describe('Generic Requests', () => {
    let genericRequestId: string;

    it('should create a generic request', async () => {
      const result = await query(
        `INSERT INTO requests.help_requests
         (requester_id, request_type, title, description, urgency, payload, requirements)
         VALUES ($1, 'generic', $2, $3, 'medium', '{}', '{}')
         RETURNING id, request_type, title, description, payload`,
        [testUserId, 'Need help moving boxes', 'Moving 10-15 boxes to storage unit this Saturday']
      );

      expect(result.rowCount).toBe(1);
      expect(result.rows[0].request_type).toBe('generic');
      expect(result.rows[0].title).toBe('Need help moving boxes');
      expect(result.rows[0].payload).toEqual({});

      genericRequestId = result.rows[0].id;

      // Link to community
      await query(
        `INSERT INTO requests.request_communities (request_id, community_id)
         VALUES ($1, $2)`,
        [genericRequestId, testCommunityId]
      );
    });

    it('should retrieve generic request with all fields', async () => {
      const result = await query(
        `SELECT id, requester_id, request_type, title, description, urgency, status, payload, requirements
         FROM requests.help_requests
         WHERE id = $1`,
        [genericRequestId]
      );

      expect(result.rowCount).toBe(1);
      const request = result.rows[0];

      expect(request.request_type).toBe('generic');
      expect(request.title).toBe('Need help moving boxes');
      expect(request.status).toBe('open');
      expect(request.payload).toEqual({});
      expect(request.requirements).toEqual({});
    });

    it('should update generic request status', async () => {
      await query(
        `UPDATE requests.help_requests
         SET status = 'matched'
         WHERE id = $1`,
        [genericRequestId]
      );

      const result = await query(
        `SELECT status FROM requests.help_requests WHERE id = $1`,
        [genericRequestId]
      );

      expect(result.rows[0].status).toBe('matched');
    });

    it('should delete generic request', async () => {
      await query('DELETE FROM requests.help_requests WHERE id = $1', [genericRequestId]);

      const result = await query(
        `SELECT id FROM requests.help_requests WHERE id = $1`,
        [genericRequestId]
      );

      expect(result.rowCount).toBe(0);
    });
  });

  describe('Ride Requests', () => {
    let rideRequestId: string;

    const ridePayload = {
      origin: {
        address: '123 Main St, New York, NY',
        lat: 40.7128,
        lng: -74.0060,
      },
      destination: {
        address: 'JFK Airport, Queens, NY',
        lat: 40.6413,
        lng: -73.7781,
      },
      seats_needed: 2,
      departure_time: '2024-06-15T10:00:00Z',
      preferences: {
        pet_friendly: true,
        luggage_space: 'large',
      },
    };

    it('should create a ride request with full payload', async () => {
      const result = await query(
        `INSERT INTO requests.help_requests
         (requester_id, request_type, title, description, urgency, payload)
         VALUES ($1, 'ride', $2, $3, 'high', $4)
         RETURNING id, request_type, title, payload`,
        [
          testUserId,
          'Need ride to JFK Airport',
          'Flying out tomorrow morning, need ride for 2 people with luggage',
          JSON.stringify(ridePayload),
        ]
      );

      expect(result.rowCount).toBe(1);
      expect(result.rows[0].request_type).toBe('ride');

      const payload = result.rows[0].payload;
      expect(payload.origin.address).toBe('123 Main St, New York, NY');
      expect(payload.destination.lat).toBe(40.6413);
      expect(payload.seats_needed).toBe(2);
      expect(payload.preferences.pet_friendly).toBe(true);

      rideRequestId = result.rows[0].id;

      await query(
        `INSERT INTO requests.request_communities (request_id, community_id)
         VALUES ($1, $2)`,
        [rideRequestId, testCommunityId]
      );
    });

    it('should retrieve ride request with typed payload', async () => {
      const result = await query(
        `SELECT request_type, payload
         FROM requests.help_requests
         WHERE id = $1`,
        [rideRequestId]
      );

      expect(result.rows[0].request_type).toBe('ride');

      const payload = result.rows[0].payload;
      expect(payload).toHaveProperty('origin');
      expect(payload).toHaveProperty('destination');
      expect(payload).toHaveProperty('seats_needed');
      expect(payload).toHaveProperty('departure_time');
      expect(payload.origin).toHaveProperty('lat');
      expect(payload.origin).toHaveProperty('lng');
    });

    afterAll(async () => {
      await query('DELETE FROM requests.help_requests WHERE id = $1', [rideRequestId]);
    });
  });

  describe('Service Requests', () => {
    let serviceRequestId: string;

    const servicePayload = {
      service_category: 'plumbing',
      skill_level_required: 'intermediate',
      estimated_duration_hours: 2,
      budget_range: {
        min: 50,
        max: 100,
        currency: 'USD',
      },
      location_type: 'on_site',
      certifications_required: ['Licensed Plumber'],
    };

    it('should create a service request with structured payload', async () => {
      const result = await query(
        `INSERT INTO requests.help_requests
         (requester_id, request_type, title, description, urgency, payload)
         VALUES ($1, 'service', $2, $3, 'high', $4)
         RETURNING id, request_type, payload`,
        [
          testUserId,
          'Leaky pipe needs urgent repair',
          'Kitchen sink pipe is leaking, needs professional plumber ASAP',
          JSON.stringify(servicePayload),
        ]
      );

      expect(result.rowCount).toBe(1);
      expect(result.rows[0].request_type).toBe('service');

      const payload = result.rows[0].payload;
      expect(payload.service_category).toBe('plumbing');
      expect(payload.skill_level_required).toBe('intermediate');
      expect(payload.budget_range.min).toBe(50);
      expect(payload.certifications_required).toContain('Licensed Plumber');

      serviceRequestId = result.rows[0].id;

      await query(
        `INSERT INTO requests.request_communities (request_id, community_id)
         VALUES ($1, $2)`,
        [serviceRequestId, testCommunityId]
      );
    });

    it('should query service requests by category', async () => {
      const result = await query(
        `SELECT id, request_type, payload
         FROM requests.help_requests
         WHERE request_type = 'service'
         AND payload->>'service_category' = 'plumbing'`
      );

      expect(result.rowCount).toBeGreaterThanOrEqual(1);
      const found = result.rows.find((row: any) => row.id === serviceRequestId);
      expect(found).toBeDefined();
      expect(found.payload.service_category).toBe('plumbing');
    });

    afterAll(async () => {
      await query('DELETE FROM requests.help_requests WHERE id = $1', [serviceRequestId]);
    });
  });

  describe('Event Requests', () => {
    let eventRequestId: string;

    const eventPayload = {
      event_type: 'community_cleanup',
      event_date: '2024-07-04T09:00:00Z',
      event_duration_hours: 4,
      location: {
        address: 'Central Park, New York, NY',
        lat: 40.785091,
        lng: -73.968285,
        is_virtual: false,
      },
      participants_needed: 20,
      roles: [
        {
          role_name: 'Team Leader',
          count: 2,
          description: 'Coordinate cleanup teams',
        },
        {
          role_name: 'Volunteer',
          count: 18,
          description: 'General cleanup tasks',
        },
      ],
    };

    it('should create an event request with nested objects', async () => {
      const result = await query(
        `INSERT INTO requests.help_requests
         (requester_id, request_type, title, description, urgency, payload)
         VALUES ($1, 'event', $2, $3, 'medium', $4)
         RETURNING id, request_type, payload`,
        [
          testUserId,
          'Community Cleanup Day - July 4th',
          'Annual park cleanup event, need volunteers!',
          JSON.stringify(eventPayload),
        ]
      );

      expect(result.rowCount).toBe(1);
      expect(result.rows[0].request_type).toBe('event');

      const payload = result.rows[0].payload;
      expect(payload.event_type).toBe('community_cleanup');
      expect(payload.participants_needed).toBe(20);
      expect(payload.location.is_virtual).toBe(false);
      expect(payload.roles).toHaveLength(2);
      expect(payload.roles[0].role_name).toBe('Team Leader');

      eventRequestId = result.rows[0].id;

      await query(
        `INSERT INTO requests.request_communities (request_id, community_id)
         VALUES ($1, $2)`,
        [eventRequestId, testCommunityId]
      );
    });

    it('should query event requests by type and date', async () => {
      const result = await query(
        `SELECT id, request_type, payload
         FROM requests.help_requests
         WHERE request_type = 'event'
         AND payload->>'event_type' = 'community_cleanup'
         AND (payload->>'event_date')::timestamp > NOW()`
      );

      expect(result.rowCount).toBeGreaterThanOrEqual(1);
    });

    afterAll(async () => {
      await query('DELETE FROM requests.help_requests WHERE id = $1', [eventRequestId]);
    });
  });

  describe('Borrow Requests', () => {
    let borrowRequestId: string;

    const borrowPayload = {
      item_category: 'tools',
      item_name: 'Power Drill',
      duration_days: 3,
      condition_min: 'good',
      images: [
        'https://example.com/drill1.jpg',
        'https://example.com/drill2.jpg',
      ],
    };

    it('should create a borrow request with item details', async () => {
      const result = await query(
        `INSERT INTO requests.help_requests
         (requester_id, request_type, title, description, urgency, payload)
         VALUES ($1, 'borrow', $2, $3, 'low', $4)
         RETURNING id, request_type, payload`,
        [
          testUserId,
          'Need to borrow power drill for weekend project',
          'Working on home improvement project, need a drill for 3 days',
          JSON.stringify(borrowPayload),
        ]
      );

      expect(result.rowCount).toBe(1);
      expect(result.rows[0].request_type).toBe('borrow');

      const payload = result.rows[0].payload;
      expect(payload.item_category).toBe('tools');
      expect(payload.item_name).toBe('Power Drill');
      expect(payload.duration_days).toBe(3);
      expect(payload.images).toHaveLength(2);

      borrowRequestId = result.rows[0].id;

      await query(
        `INSERT INTO requests.request_communities (request_id, community_id)
         VALUES ($1, $2)`,
        [borrowRequestId, testCommunityId]
      );
    });

    it('should query borrow requests by item category', async () => {
      const result = await query(
        `SELECT id, request_type, payload
         FROM requests.help_requests
         WHERE request_type = 'borrow'
         AND payload->>'item_category' = 'tools'`
      );

      expect(result.rowCount).toBeGreaterThanOrEqual(1);
      const found = result.rows.find((row: any) => row.id === borrowRequestId);
      expect(found).toBeDefined();
    });

    afterAll(async () => {
      await query('DELETE FROM requests.help_requests WHERE id = $1', [borrowRequestId]);
    });
  });

  describe('Multi-Community Posting', () => {
    let multiCommunityRequestId: string;

    it('should create request linked to multiple communities', async () => {
      // Create request
      const requestResult = await query(
        `INSERT INTO requests.help_requests
         (requester_id, request_type, title, description, urgency)
         VALUES ($1, 'generic', $2, $3, 'medium')
         RETURNING id`,
        [
          testUserId,
          'Multi-community help request',
          'This request is visible in multiple communities',
        ]
      );

      multiCommunityRequestId = requestResult.rows[0].id;

      // Link to both communities
      await query(
        `INSERT INTO requests.request_communities (request_id, community_id)
         VALUES ($1, $2), ($1, $3)`,
        [multiCommunityRequestId, testCommunityId, testCommunityId2]
      );

      // Verify links
      const linksResult = await query(
        `SELECT community_id FROM requests.request_communities
         WHERE request_id = $1`,
        [multiCommunityRequestId]
      );

      expect(linksResult.rowCount).toBe(2);
      const communityIds = linksResult.rows.map((row: any) => row.community_id);
      expect(communityIds).toContain(testCommunityId);
      expect(communityIds).toContain(testCommunityId2);
    });

    it('should retrieve request with multiple community names', async () => {
      const result = await query(
        `SELECT
           r.id,
           r.title,
           STRING_AGG(c.name, ', ') as community_names
         FROM requests.help_requests r
         LEFT JOIN requests.request_communities rc ON r.id = rc.request_id
         LEFT JOIN communities.communities c ON rc.community_id = c.id
         WHERE r.id = $1
         GROUP BY r.id, r.title`,
        [multiCommunityRequestId]
      );

      expect(result.rowCount).toBe(1);
      const communityNames = result.rows[0].community_names;
      expect(communityNames).toContain('Test Community 1');
      expect(communityNames).toContain('Test Community 2');
    });

    afterAll(async () => {
      await query('DELETE FROM requests.help_requests WHERE id = $1', [multiCommunityRequestId]);
    });
  });

  describe('Type Consistency and Validation', () => {
    it('should enforce request_type enum constraint', async () => {
      await expect(
        query(
          `INSERT INTO requests.help_requests
           (requester_id, request_type, title, description)
           VALUES ($1, 'invalid_type', $2, $3)`,
          [testUserId, 'Test', 'Test description']
        )
      ).rejects.toThrow();
    });

    it('should allow NULL payload for generic requests', async () => {
      const result = await query(
        `INSERT INTO requests.help_requests
         (requester_id, request_type, title, description, payload)
         VALUES ($1, 'generic', $2, $3, NULL)
         RETURNING id, payload`,
        [testUserId, 'Null payload test', 'Testing NULL payload']
      );

      expect(result.rowCount).toBe(1);
      expect(result.rows[0].payload).toBeNull();

      await query('DELETE FROM requests.help_requests WHERE id = $1', [result.rows[0].id]);
    });

    it('should store complex nested JSONB structures', async () => {
      const complexPayload = {
        event_type: 'workshop',
        event_date: '2024-08-01T14:00:00Z',
        event_duration_hours: 3,
        location: {
          address: 'Community Center, Room 101',
          lat: 40.7589,
          lng: -73.9851,
          is_virtual: false,
        },
        participants_needed: 15,
        roles: [
          {
            role_name: 'Instructor',
            count: 1,
            description: 'Lead the workshop',
          },
        ],
        requirements: {
          age_minimum: 18,
          experience_required: true,
        },
        recurring: {
          is_recurring: true,
          frequency: 'weekly',
          end_date: '2024-12-31T23:59:59Z',
        },
      };

      const result = await query(
        `INSERT INTO requests.help_requests
         (requester_id, request_type, title, description, payload)
         VALUES ($1, 'event', $2, $3, $4)
         RETURNING id, payload`,
        [
          testUserId,
          'Complex nested structure test',
          'Testing deep JSON nesting',
          JSON.stringify(complexPayload),
        ]
      );

      expect(result.rowCount).toBe(1);
      const retrievedPayload = result.rows[0].payload;

      expect(retrievedPayload.location.address).toBe('Community Center, Room 101');
      expect(retrievedPayload.roles[0].role_name).toBe('Instructor');
      expect(retrievedPayload.requirements.age_minimum).toBe(18);
      expect(retrievedPayload.recurring.frequency).toBe('weekly');

      await query('DELETE FROM requests.help_requests WHERE id = $1', [result.rows[0].id]);
    });
  });
});
