/**
 * Test Fixtures and Data Factories
 *
 * Centralized test data management for integration and performance tests.
 * Supports different user types, community configurations, and test scenarios.
 */

import request from 'supertest';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

// Service URLs
export const ServiceUrls = {
  AUTH: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  COMMUNITY: process.env.COMMUNITY_SERVICE_URL || 'http://localhost:3002',
  REQUEST: process.env.REQUEST_SERVICE_URL || 'http://localhost:3003',
  REPUTATION: process.env.REPUTATION_SERVICE_URL || 'http://localhost:3004',
  NOTIFICATION: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005',
  MESSAGING: process.env.MESSAGING_SERVICE_URL || 'http://localhost:3006',
  FEED: process.env.FEED_SERVICE_URL || 'http://localhost:3007',
  CLEANUP: process.env.CLEANUP_SERVICE_URL || 'http://localhost:3008',
};

// Database connection
export function createPool(): Pool {
  return new Pool({
    connectionString: process.env.DATABASE_URL ||
      'postgresql://karmyq_user:karmyq_password_dev@localhost:5432/karmyq_db',
  });
}

/**
 * User types for different test scenarios
 */
export type UserRole = 'admin' | 'member' | 'moderator' | 'outsider';

export interface TestUser {
  id: string;
  email: string;
  name: string;
  token: string;
  role?: UserRole;
}

export interface TestCommunity {
  id: string;
  name: string;
  description: string;
  creator_id: string;
  invite_code?: string;  // Optional invite code for joining
  location?: string;
}

export interface TestRequest {
  id: string;
  title: string;
  description: string;
  communityId: string;
  requesterId: string;
}

export interface TestOffer {
  id: string;
  requestId: string;
  responderId: string;
  message: string;
}

/**
 * User Factory - Creates test users with different roles
 */
export class UserFactory {
  private static counter = 0;

  /**
   * Generate a unique email for testing
   */
  static generateEmail(prefix: string = 'test'): string {
    this.counter++;
    return `${prefix}-${Date.now()}-${this.counter}@test.karmyq.com`;
  }

  /**
   * Create a new user via the auth service with retry logic for rate limiting
   */
  static async create(options: {
    name?: string;
    email?: string;
    password?: string;
    prefix?: string;
  } = {}): Promise<TestUser | null> {
    const {
      name = `Test User ${this.counter}`,
      email = this.generateEmail(options.prefix || 'user'),
      password = 'TestPassword123!',
    } = options;

    const maxRetries = 5;
    const baseDelay = 2000; // 2 seconds

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await request(ServiceUrls.AUTH)
          .post('/auth/register')
          .send({ email, name, password });

        // Handle both old and new response formats
        const data = response.body.data || response.body;
        const user = data.user;
        const token = data.token;

        if (response.status !== 201 || !user) {
          // Check for rate limit error
          if (response.body && response.body.error &&
              (response.body.error.includes('Too many') || response.body.retryAfter)) {

            if (attempt < maxRetries) {
              const retryAfter = response.body.retryAfter || (baseDelay / 1000);
              const delay = Math.min(retryAfter * 1000 * Math.pow(2, attempt), 60000); // Max 60s
              console.log(`Rate limited. Retrying in ${delay/1000}s... (attempt ${attempt + 1}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
          }

          console.log(`User creation failed: ${JSON.stringify(response.body)}`);
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          token: token,
        };
      } catch (error) {
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`User creation error. Retrying in ${delay/1000}s... (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        console.log('User creation error:', error);
        return null;
      }
    }

    return null;
  }

  /**
   * Login with existing demo user (for production/E2E environments)
   */
  static async loginDemoUser(email: string, password: string = 'password123'): Promise<TestUser | null> {
    const maxRetries = 3;
    const baseDelay = 1000;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await request(ServiceUrls.AUTH)
          .post('/auth/login')
          .send({ email, password });

        const data = response.body.data || response.body;
        const user = data.user;
        const token = data.token;

        if (response.status !== 200 || !user || !token) {
          console.log(`Login failed for ${email}: ${JSON.stringify(response.body)}`);
          if (attempt < maxRetries) {
            const delay = baseDelay * Math.pow(2, attempt);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          token: token,
        };
      } catch (error) {
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`Login error for ${email}. Retrying in ${delay/1000}s... (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        console.log(`Login error for ${email}:`, error);
        return null;
      }
    }

    return null;
  }

  /**
   * Get existing user from database and generate token (for integration tests)
   * This bypasses the auth service completely
   */
  static async getExistingUser(pool: Pool, email: string): Promise<TestUser | null> {
    try {
      const result = await pool.query(
        'SELECT id, email, name FROM auth.users WHERE email = $1 LIMIT 1',
        [email]
      );

      if (result.rows.length === 0) {
        console.log(`User not found: ${email}`);
        return null;
      }

      const user = result.rows[0];
      const jwtSecret = process.env.JWT_SECRET || 'dev-secret-key';

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          communityMemberships: []  // Will be populated as needed
        },
        jwtSecret,
        { expiresIn: '24h' }
      );

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        token: token,
      };
    } catch (error) {
      console.log(`Error fetching user ${email}:`, error);
      return null;
    }
  }

  /**
   * Get demo users for integration tests (use existing database users)
   * Uses first 3 stable test users from the database
   */
  static async getDemoUsers(pool: Pool): Promise<{ requester: TestUser; helper1: TestUser; helper2: TestUser } | null> {
    try {
      // Get 3 existing users from database
      const result = await pool.query(
        `SELECT id, email, name FROM auth.users
         WHERE email LIKE 'user%@test.karmyq.com'
         ORDER BY email
         LIMIT 3`
      );

      if (result.rows.length < 3) {
        console.log('Not enough test users in database');
        return null;
      }

      const jwtSecret = process.env.JWT_SECRET || 'dev-secret-key';

      const users = result.rows.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        token: jwt.sign(
          {
            userId: user.id,
            email: user.email,
            communityMemberships: []
          },
          jwtSecret,
          { expiresIn: '24h' }
        ),
      }));

      return {
        requester: users[0],
        helper1: users[1],
        helper2: users[2],
      };
    } catch (error) {
      console.log('Error getting demo users:', error);
      return null;
    }
  }

  /**
   * Create multiple users at once
   */
  static async createMany(count: number, prefix: string = 'batch'): Promise<TestUser[]> {
    const users: TestUser[] = [];
    for (let i = 0; i < count; i++) {
      const user = await this.create({ prefix: `${prefix}-${i}` });
      if (user) users.push(user);
    }
    return users;
  }

  /**
   * Create a user and make them admin of a community
   */
  static async createAdmin(communityId: string, adminToken: string): Promise<TestUser | null> {
    const user = await this.create({ prefix: 'admin' });
    if (!user) return null;

    // Add as member first
    await request(ServiceUrls.COMMUNITY)
      .post(`/communities/${communityId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-community-id', communityId)
      .send({ user_id: user.id, role: 'admin' });

    user.role = 'admin';
    return user;
  }

  /**
   * Delete a test user (cleanup)
   */
  static async delete(pool: Pool, userId: string): Promise<void> {
    try {
      await pool.query('DELETE FROM auth.users WHERE id = $1', [userId]);
    } catch (error) {
      console.log(`Failed to delete user ${userId}:`, error);
    }
  }
}

/**
 * Community Factory - Creates test communities
 */
export class CommunityFactory {
  private static counter = 0;

  /**
   * Create a new community
   */
  static async create(options: {
    creatorToken: string;
    creatorId: string;
    name?: string;
    description?: string;
    location?: string;
    settings?: {
      request_ttl_days?: number;
      offer_ttl_days?: number;
      reputation_decay_half_life_months?: number;
    };
  }): Promise<TestCommunity | null> {
    this.counter++;
    const {
      creatorToken,
      creatorId,
      name = `Test Community ${Date.now()}-${this.counter}`,
      description = 'A test community for integration testing',
      location = 'Test City',
    } = options;

    try {
      const response = await request(ServiceUrls.COMMUNITY)
        .post('/communities')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          name,
          description,
          location,
          creator_id: creatorId,
        });

      const community = response.body.data || response.body.community;
      if (!community?.id) {
        console.log(`Community creation failed: ${JSON.stringify(response.body)}`);
        return null;
      }

      return {
        id: community.id,
        name: community.name,
        description: community.description,
        creator_id: creatorId,
        invite_code: community.invite_code,
        location: community.location,
      };
    } catch (error) {
      console.log('Community creation error:', error);
      return null;
    }
  }

  /**
   * Add a member to a community
   */
  static async addMember(
    communityId: string,
    userId: string,
    adminToken: string,
    role: UserRole = 'member'
  ): Promise<boolean> {
    try {
      const response = await request(ServiceUrls.COMMUNITY)
        .post(`/communities/${communityId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-community-id', communityId)
        .send({ user_id: userId, role });

      return response.status === 200 || response.status === 201;
    } catch (error) {
      return false;
    }
  }

  /**
   * Update community settings
   */
  static async updateSettings(
    communityId: string,
    adminToken: string,
    settings: Record<string, any>
  ): Promise<boolean> {
    try {
      const response = await request(ServiceUrls.COMMUNITY)
        .patch(`/communities/${communityId}/settings`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-community-id', communityId)
        .send(settings);

      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Delete a community (cleanup)
   */
  static async delete(pool: Pool, communityId: string): Promise<void> {
    try {
      await pool.query('DELETE FROM communities.communities WHERE id = $1', [communityId]);
    } catch (error) {
      console.log(`Failed to delete community ${communityId}:`, error);
    }
  }
}

/**
 * Request Factory - Creates help requests
 */
export class RequestFactory {
  private static counter = 0;

  /**
   * Create a help request
   */
  static async create(options: {
    communityId: string;
    requesterId: string;
    requesterToken: string;
    title?: string;
    description?: string;
    type?: string;
  }): Promise<TestRequest | null> {
    this.counter++;
    const {
      communityId,
      requesterId,
      requesterToken,
      title = `Test Request ${Date.now()}-${this.counter}`,
      description = 'A test help request',
      type = 'general',
    } = options;

    try {
      const response = await request(ServiceUrls.REQUEST)
        .post('/requests')
        .set('Authorization', `Bearer ${requesterToken}`)
        .set('x-community-id', communityId)
        .send({
          community_id: communityId,
          requester_id: requesterId,
          title,
          description,
          type,
        });

      const req = response.body.data || response.body.request;
      if (!req?.id) {
        console.log(`Request creation failed: ${JSON.stringify(response.body)}`);
        return null;
      }

      return {
        id: req.id,
        title: req.title,
        description: req.description,
        communityId,
        requesterId,
      };
    } catch (error) {
      console.log('Request creation error:', error);
      return null;
    }
  }

  /**
   * Create multiple requests
   */
  static async createMany(
    count: number,
    options: {
      communityId: string;
      requesterId: string;
      requesterToken: string;
    }
  ): Promise<TestRequest[]> {
    const requests: TestRequest[] = [];
    for (let i = 0; i < count; i++) {
      const req = await this.create({
        ...options,
        title: `Batch Request ${i + 1}`,
      });
      if (req) requests.push(req);
    }
    return requests;
  }
}

/**
 * Offer Factory - Creates help offers
 */
export class OfferFactory {
  static async create(options: {
    requestId: string;
    responderId: string;
    responderToken: string;
    communityId: string;
    message?: string;
  }): Promise<TestOffer | null> {
    const {
      requestId,
      responderId,
      responderToken,
      communityId,
      message = 'I can help with this!',
    } = options;

    try {
      const response = await request(ServiceUrls.REQUEST)
        .post('/offers')
        .set('Authorization', `Bearer ${responderToken}`)
        .set('x-community-id', communityId)
        .send({
          request_id: requestId,
          responder_id: responderId,
          message,
        });

      const offer = response.body.data || response.body.offer;
      if (!offer?.id) {
        console.log(`Offer creation failed: ${JSON.stringify(response.body)}`);
        return null;
      }

      return {
        id: offer.id,
        requestId,
        responderId,
        message: offer.message,
      };
    } catch (error) {
      console.log('Offer creation error:', error);
      return null;
    }
  }
}

/**
 * Test Scenario - Pre-configured test environments
 */
export class TestScenario {
  // Non-enumerable to prevent Jest serialization issues with circular references
  private _pool!: Pool;

  users: TestUser[] = [];
  communities: TestCommunity[] = [];
  requests: TestRequest[] = [];

  constructor() {
    // Make pool non-enumerable to prevent Jest from trying to serialize it
    Object.defineProperty(this, '_pool', {
      value: createPool(),
      writable: true,
      enumerable: false,
      configurable: true
    });
  }

  // Getter for backward compatibility
  get pool(): Pool {
    return this._pool;
  }

  /**
   * Setup a basic scenario with one admin, one community, and optional members
   */
  async setupBasic(memberCount: number = 2): Promise<{
    admin: TestUser;
    community: TestCommunity;
    members: TestUser[];
  } | null> {
    // Create admin
    const admin = await UserFactory.create({ prefix: 'scenario-admin' });
    if (!admin) return null;
    this.users.push(admin);

    // Create community
    const community = await CommunityFactory.create({
      creatorToken: admin.token,
      creatorId: admin.id,
    });
    if (!community) return null;
    this.communities.push(community);

    // Create members
    const members: TestUser[] = [];
    for (let i = 0; i < memberCount; i++) {
      const member = await UserFactory.create({ prefix: `scenario-member-${i}` });
      if (member) {
        await CommunityFactory.addMember(community.id, member.id, admin.token);
        member.role = 'member';
        members.push(member);
        this.users.push(member);
      }
    }

    return { admin, community, members };
  }

  /**
   * Setup a scenario with requests and offers
   */
  async setupWithRequests(requestCount: number = 3): Promise<{
    admin: TestUser;
    community: TestCommunity;
    requester: TestUser;
    helper: TestUser;
    requests: TestRequest[];
  } | null> {
    const basic = await this.setupBasic(2);
    if (!basic || basic.members.length < 2) return null;

    const [requester, helper] = basic.members;
    const requests = await RequestFactory.createMany(requestCount, {
      communityId: basic.community.id,
      requesterId: requester.id,
      requesterToken: requester.token,
    });

    this.requests = requests;

    return {
      admin: basic.admin,
      community: basic.community,
      requester,
      helper,
      requests,
    };
  }

  /**
   * Cleanup all created test data
   */
  async cleanup(): Promise<void> {
    // Delete in correct dependency order:
    // 1. Requests (depend on users and communities)
    // 2. Communities (depend on users)
    // 3. Users (no dependencies)

    try {
      // Delete all help requests for test users
      for (const user of this.users) {
        await this.pool.query(
          'DELETE FROM requests.help_requests WHERE requester_id = $1',
          [user.id]
        );
      }

      // Delete all communities
      for (const community of this.communities) {
        await CommunityFactory.delete(this.pool, community.id);
      }

      // Delete all users
      for (const user of this.users) {
        await UserFactory.delete(this.pool, user.id);
      }
    } catch (error) {
      console.log('Error during test cleanup:', error);
    }

    await this._pool.end();
  }
}

/**
 * Test Data Presets - Common test data configurations
 */
export const TestPresets = {
  users: {
    validUser: {
      name: 'Valid Test User',
      password: 'ValidPassword123!',
    },
    weakPassword: {
      name: 'Weak Password User',
      password: '123', // Too short
    },
    invalidEmail: {
      name: 'Invalid Email User',
      email: 'not-an-email',
      password: 'ValidPassword123!',
    },
  },
  communities: {
    standard: {
      description: 'A standard test community',
      location: 'Test City',
    },
    withCustomTTL: {
      description: 'Community with custom TTL settings',
      settings: {
        request_ttl_days: 7,
        offer_ttl_days: 3,
      },
    },
    withDecayConfig: {
      description: 'Community with custom decay settings',
      settings: {
        reputation_decay_half_life_months: 3,
        activity_types_for_decay_reset: ['complete_request', 'complete_offer'],
      },
    },
  },
  requests: {
    general: {
      type: 'general',
      description: 'General help request',
    },
    urgent: {
      type: 'urgent',
      description: 'Urgent help needed',
    },
  },
};
