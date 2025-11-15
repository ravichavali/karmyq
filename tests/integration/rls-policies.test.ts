/**
 * Row-Level Security (RLS) Policy Tests
 *
 * Tests that all RLS policies are correctly configured and enforced
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Pool } from 'pg';

let pool: Pool;
let testUserId: string;
let testCommunityId: string;
let otherCommunityId: string;

beforeAll(async () => {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://karmyq_user:karmyq_password_dev@localhost:5432/karmyq_db'
  });

  // Create test user
  const userResult = await pool.query(
    `INSERT INTO auth.users (email, name, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [`rls-test-${Date.now()}@example.com`, 'RLS Test User', 'hashed']
  );
  testUserId = userResult.rows[0].id;

  // Create test communities
  const community1 = await pool.query(
    `INSERT INTO communities.communities (name, description, created_by)
     VALUES ($1, $2, $3)
     RETURNING id`,
    ['RLS Test Community 1', 'Test community', testUserId]
  );
  testCommunityId = community1.rows[0].id;

  const community2 = await pool.query(
    `INSERT INTO communities.communities (name, description, created_by)
     VALUES ($1, $2, $3)
     RETURNING id`,
    ['RLS Test Community 2', 'Other community', testUserId]
  );
  otherCommunityId = community2.rows[0].id;

  // Add user as member to first community
  await pool.query(
    `INSERT INTO communities.members (community_id, user_id, role, status)
     VALUES ($1, $2, 'admin', 'active')`,
    [testCommunityId, testUserId]
  );
});

afterAll(async () => {
  // Cleanup
  await pool.query('DELETE FROM auth.users WHERE id = $1', [testUserId]);
  await pool.end();
});

describe('RLS Policies - communities.communities', () => {
  it('should have RLS enabled', async () => {
    const result = await pool.query(`
      SELECT relrowsecurity
      FROM pg_class
      WHERE oid = 'communities.communities'::regclass
    `);
    expect(result.rows[0].relrowsecurity).toBe(true);
  });

  it('should filter based on current_community_id', async () => {
    // Set session variables
    await pool.query(`SELECT set_config('app.current_user_id', $1, true)`, [testUserId]);
    await pool.query(`SELECT set_config('app.current_community_id', $1, true)`, [testCommunityId]);

    const result = await pool.query('SELECT * FROM communities.communities');

    // Should only see the current community
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe(testCommunityId);
  });

  it('should return no rows without session variables', async () => {
    // Reset session variables
    await pool.query(`SELECT set_config('app.current_user_id', '', true)`);
    await pool.query(`SELECT set_config('app.current_community_id', '', true)`);

    const result = await pool.query('SELECT * FROM communities.communities WHERE id = $1', [testCommunityId]);

    // Should see no rows without proper context
    expect(result.rows).toHaveLength(0);
  });
});

describe('RLS Policies - communities.members', () => {
  it('should have RLS enabled', async () => {
    const result = await pool.query(`
      SELECT relrowsecurity
      FROM pg_class
      WHERE oid = 'communities.members'::regclass
    `);
    expect(result.rows[0].relrowsecurity).toBe(true);
  });

  it('should filter members by community_id', async () => {
    await pool.query(`SELECT set_config('app.current_user_id', $1, true)`, [testUserId]);
    await pool.query(`SELECT set_config('app.current_community_id', $1, true)`, [testCommunityId]);

    const result = await pool.query('SELECT * FROM communities.members');

    // Should only see members from current community
    result.rows.forEach(row => {
      expect(row.community_id).toBe(testCommunityId);
    });
  });
});

describe('RLS Policies - requests.help_requests', () => {
  let testRequestId: string;

  beforeAll(async () => {
    // Create a test request
    const result = await pool.query(
      `INSERT INTO requests.help_requests (community_id, requester_id, title, description, skills_needed, urgency, status)
       VALUES ($1, $2, 'RLS Test Request', 'Test description', ARRAY['test'], 'medium', 'open')
       RETURNING id`,
      [testCommunityId, testUserId]
    );
    testRequestId = result.rows[0].id;
  });

  it('should have RLS enabled', async () => {
    const result = await pool.query(`
      SELECT relrowsecurity
      FROM pg_class
      WHERE oid = 'requests.help_requests'::regclass
    `);
    expect(result.rows[0].relrowsecurity).toBe(true);
  });

  it('should filter by community_id', async () => {
    await pool.query(`SELECT set_config('app.current_user_id', $1, true)`, [testUserId]);
    await pool.query(`SELECT set_config('app.current_community_id', $1, true)`, [testCommunityId]);

    const result = await pool.query('SELECT * FROM requests.help_requests WHERE id = $1', [testRequestId]);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe(testRequestId);
  });

  it('should hide requests from other communities', async () => {
    await pool.query(`SELECT set_config('app.current_community_id', $1, true)`, [otherCommunityId]);

    const result = await pool.query('SELECT * FROM requests.help_requests WHERE id = $1', [testRequestId]);

    expect(result.rows).toHaveLength(0);
  });
});

describe('RLS Policies - requests.help_offers', () => {
  it('should have RLS enabled', async () => {
    const result = await pool.query(`
      SELECT relrowsecurity
      FROM pg_class
      WHERE oid = 'requests.help_offers'::regclass
    `);
    expect(result.rows[0].relrowsecurity).toBe(true);
  });

  it('should filter by community_id', async () => {
    await pool.query(`SELECT set_config('app.current_user_id', $1, true)`, [testUserId]);
    await pool.query(`SELECT set_config('app.current_community_id', $1, true)`, [testCommunityId]);

    const result = await pool.query('SELECT * FROM requests.help_offers');

    result.rows.forEach(row => {
      expect(row.community_id).toBe(testCommunityId);
    });
  });
});

describe('RLS Policies - requests.matches', () => {
  it('should have RLS enabled', async () => {
    const result = await pool.query(`
      SELECT relrowsecurity
      FROM pg_class
      WHERE oid = 'requests.matches'::regclass
    `);
    expect(result.rows[0].relrowsecurity).toBe(true);
  });

  it('should filter by community_id', async () => {
    await pool.query(`SELECT set_config('app.current_user_id', $1, true)`, [testUserId]);
    await pool.query(`SELECT set_config('app.current_community_id', $1, true)`, [testCommunityId]);

    const result = await pool.query('SELECT * FROM requests.matches');

    result.rows.forEach(row => {
      expect(row.community_id).toBe(testCommunityId);
    });
  });
});

describe('RLS Policies - reputation.karma_records', () => {
  it('should have RLS enabled', async () => {
    const result = await pool.query(`
      SELECT relrowsecurity
      FROM pg_class
      WHERE oid = 'reputation.karma_records'::regclass
    `);
    expect(result.rows[0].relrowsecurity).toBe(true);
  });

  it('should filter by community_id', async () => {
    await pool.query(`SELECT set_config('app.current_user_id', $1, true)`, [testUserId]);
    await pool.query(`SELECT set_config('app.current_community_id', $1, true)`, [testCommunityId]);

    const result = await pool.query('SELECT * FROM reputation.karma_records');

    result.rows.forEach(row => {
      expect(row.community_id).toBe(testCommunityId);
    });
  });
});

describe('RLS Policies - reputation.trust_scores', () => {
  it('should have RLS enabled', async () => {
    const result = await pool.query(`
      SELECT relrowsecurity
      FROM pg_class
      WHERE oid = 'reputation.trust_scores'::regclass
    `);
    expect(result.rows[0].relrowsecurity).toBe(true);
  });

  it('should filter by community_id', async () => {
    await pool.query(`SELECT set_config('app.current_user_id', $1, true)`, [testUserId]);
    await pool.query(`SELECT set_config('app.current_community_id', $1, true)`, [testCommunityId]);

    const result = await pool.query('SELECT * FROM reputation.trust_scores');

    result.rows.forEach(row => {
      expect(row.community_id).toBe(testCommunityId);
    });
  });
});

describe('RLS Policies - reputation.badges', () => {
  it('should have RLS enabled', async () => {
    const result = await pool.query(`
      SELECT relrowsecurity
      FROM pg_class
      WHERE oid = 'reputation.badges'::regclass
    `);
    expect(result.rows[0].relrowsecurity).toBe(true);
  });

  it('should filter by community_id', async () => {
    await pool.query(`SELECT set_config('app.current_user_id', $1, true)`, [testUserId]);
    await pool.query(`SELECT set_config('app.current_community_id', $1, true)`, [testCommunityId]);

    const result = await pool.query('SELECT * FROM reputation.badges');

    result.rows.forEach(row => {
      expect(row.community_id).toBe(testCommunityId);
    });
  });
});

describe('RLS Policies - notifications.notifications', () => {
  it('should have RLS enabled', async () => {
    const result = await pool.query(`
      SELECT relrowsecurity
      FROM pg_class
      WHERE oid = 'notifications.notifications'::regclass
    `);
    expect(result.rows[0].relrowsecurity).toBe(true);
  });

  it('should filter by community_id', async () => {
    await pool.query(`SELECT set_config('app.current_user_id', $1, true)`, [testUserId]);
    await pool.query(`SELECT set_config('app.current_community_id', $1, true)`, [testCommunityId]);

    const result = await pool.query('SELECT * FROM notifications.notifications');

    result.rows.forEach(row => {
      expect(row.community_id).toBe(testCommunityId);
    });
  });
});

describe('RLS Policies - notifications.preferences', () => {
  it('should have RLS enabled', async () => {
    const result = await pool.query(`
      SELECT relrowsecurity
      FROM pg_class
      WHERE oid = 'notifications.preferences'::regclass
    `);
    expect(result.rows[0].relrowsecurity).toBe(true);
  });

  it('should filter by community_id', async () => {
    await pool.query(`SELECT set_config('app.current_user_id', $1, true)`, [testUserId]);
    await pool.query(`SELECT set_config('app.current_community_id', $1, true)`, [testCommunityId]);

    const result = await pool.query('SELECT * FROM notifications.preferences');

    result.rows.forEach(row => {
      expect(row.community_id).toBe(testCommunityId);
    });
  });
});

describe('RLS Policies - messaging.messages', () => {
  it('should have RLS enabled', async () => {
    const result = await pool.query(`
      SELECT relrowsecurity
      FROM pg_class
      WHERE oid = 'messaging.messages'::regclass
    `);
    expect(result.rows[0].relrowsecurity).toBe(true);
  });

  it('should filter by community_id', async () => {
    await pool.query(`SELECT set_config('app.current_user_id', $1, true)`, [testUserId]);
    await pool.query(`SELECT set_config('app.current_community_id', $1, true)`, [testCommunityId]);

    const result = await pool.query('SELECT * FROM messaging.messages');

    result.rows.forEach(row => {
      expect(row.community_id).toBe(testCommunityId);
    });
  });
});

describe('RLS Policies - messaging.conversations', () => {
  it('should have RLS enabled', async () => {
    const result = await pool.query(`
      SELECT relrowsecurity
      FROM pg_class
      WHERE oid = 'messaging.conversations'::regclass
    `);
    expect(result.rows[0].relrowsecurity).toBe(true);
  });

  it('should filter by community_id', async () => {
    await pool.query(`SELECT set_config('app.current_user_id', $1, true)`, [testUserId]);
    await pool.query(`SELECT set_config('app.current_community_id', $1, true)`, [testCommunityId]);

    const result = await pool.query('SELECT * FROM messaging.conversations');

    result.rows.forEach(row => {
      expect(row.community_id).toBe(testCommunityId);
    });
  });
});

describe('RLS Policies - feed.user_feed_items', () => {
  it('should have RLS enabled', async () => {
    const result = await pool.query(`
      SELECT relrowsecurity
      FROM pg_class
      WHERE oid = 'feed.user_feed_items'::regclass
    `);
    expect(result.rows[0].relrowsecurity).toBe(true);
  });

  it('should filter by community_id', async () => {
    await pool.query(`SELECT set_config('app.current_user_id', $1, true)`, [testUserId]);
    await pool.query(`SELECT set_config('app.current_community_id', $1, true)`, [testCommunityId]);

    const result = await pool.query('SELECT * FROM feed.user_feed_items');

    result.rows.forEach(row => {
      expect(row.community_id).toBe(testCommunityId);
    });
  });
});

describe('RLS Policies - feed.user_preferences', () => {
  it('should have RLS enabled', async () => {
    const result = await pool.query(`
      SELECT relrowsecurity
      FROM pg_class
      WHERE oid = 'feed.user_preferences'::regclass
    `);
    expect(result.rows[0].relrowsecurity).toBe(true);
  });

  it('should filter by community_id', async () => {
    await pool.query(`SELECT set_config('app.current_user_id', $1, true)`, [testUserId]);
    await pool.query(`SELECT set_config('app.current_community_id', $1, true)`, [testCommunityId]);

    const result = await pool.query('SELECT * FROM feed.user_preferences');

    result.rows.forEach(row => {
      expect(row.community_id).toBe(testCommunityId);
    });
  });
});

describe('RLS Policy Completeness', () => {
  it('should verify all community-scoped tables have RLS enabled', async () => {
    const communityTables = [
      'communities.communities',
      'communities.members',
      'communities.norms',
      'requests.help_requests',
      'requests.help_offers',
      'requests.matches',
      'reputation.karma_records',
      'reputation.trust_scores',
      'reputation.badges',
      'reputation.milestones',
      'notifications.notifications',
      'notifications.preferences',
      'messaging.messages',
      'messaging.conversations',
      'messaging.conversation_participants',
      'feed.user_feed_items',
      'feed.user_preferences',
      'feed.item_interactions',
      'feed.exploration_log'
    ];

    for (const tableName of communityTables) {
      const result = await pool.query(`
        SELECT relrowsecurity
        FROM pg_class
        WHERE oid = $1::regclass
      `, [tableName]);

      expect(result.rows[0]?.relrowsecurity).toBe(true);
    }
  });

  it('should verify all RLS policies exist', async () => {
    const tables = [
      'communities.communities',
      'communities.members',
      'communities.norms',
      'requests.help_requests',
      'requests.help_offers',
      'requests.matches',
      'reputation.karma_records',
      'reputation.trust_scores',
      'reputation.badges',
      'reputation.milestones',
      'notifications.notifications',
      'notifications.preferences',
      'messaging.messages',
      'messaging.conversations',
      'messaging.conversation_participants',
      'feed.user_feed_items',
      'feed.user_preferences',
      'feed.item_interactions',
      'feed.exploration_log'
    ];

    for (const tableName of tables) {
      const [schema, table] = tableName.split('.');
      const result = await pool.query(`
        SELECT COUNT(*) as policy_count
        FROM pg_policies
        WHERE schemaname = $1 AND tablename = $2 AND policyname = 'community_isolation'
      `, [schema, table]);

      expect(parseInt(result.rows[0].policy_count)).toBeGreaterThan(0);
    }
  });
});
