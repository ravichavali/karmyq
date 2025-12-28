/**
 * Realistic Data Generator for Karmyq
 *
 * Generates:
 * - 2000 users across the US
 * - 200 communities (cities, neighborhoods, interest groups)
 * - Historical data spanning 1 year
 * - Realistic request/offer patterns
 * - Social graph via invitations
 * - Karma and reputation scores
 */

import { Pool } from 'pg';
import { faker } from '@faker-js/faker';

// Configuration
const CONFIG = {
  USERS: 2000,
  COMMUNITIES: 200,
  REQUESTS_PER_USER_AVG: 3,
  OFFERS_PER_USER_AVG: 2,
  MATCHES_RATE: 0.6, // 60% of requests get matched
  TIMELINE_DAYS: 365,
  INVITATION_RATE: 0.7, // 70% of users were invited by someone
};

// US Cities for realistic locations
const US_CITIES = [
  { name: 'New York', state: 'NY', lat: 40.7128, lng: -74.0060 },
  { name: 'Los Angeles', state: 'CA', lat: 34.0522, lng: -118.2437 },
  { name: 'Chicago', state: 'IL', lat: 41.8781, lng: -87.6298 },
  { name: 'Houston', state: 'TX', lat: 29.7604, lng: -95.3698 },
  { name: 'Phoenix', state: 'AZ', lat: 33.4484, lng: -112.0740 },
  { name: 'Philadelphia', state: 'PA', lat: 39.9526, lng: -75.1652 },
  { name: 'San Antonio', state: 'TX', lat: 29.4241, lng: -98.4936 },
  { name: 'San Diego', state: 'CA', lat: 32.7157, lng: -117.1611 },
  { name: 'Dallas', state: 'TX', lat: 32.7767, lng: -96.7970 },
  { name: 'San Jose', state: 'CA', lat: 37.3382, lng: -121.8863 },
  { name: 'Austin', state: 'TX', lat: 30.2672, lng: -97.7431 },
  { name: 'Jacksonville', state: 'FL', lat: 30.3322, lng: -81.6557 },
  { name: 'Fort Worth', state: 'TX', lat: 32.7555, lng: -97.3308 },
  { name: 'Columbus', state: 'OH', lat: 39.9612, lng: -82.9988 },
  { name: 'Charlotte', state: 'NC', lat: 35.2271, lng: -80.8431 },
  { name: 'San Francisco', state: 'CA', lat: 37.7749, lng: -122.4194 },
  { name: 'Indianapolis', state: 'IN', lat: 39.7684, lng: -86.1581 },
  { name: 'Seattle', state: 'WA', lat: 47.6062, lng: -122.3321 },
  { name: 'Denver', state: 'CO', lat: 39.7392, lng: -104.9903 },
  { name: 'Boston', state: 'MA', lat: 42.3601, lng: -71.0589 },
];

// Request types and their distribution
const REQUEST_TYPES = {
  'transportation': 0.20,
  'moving_help': 0.15,
  'food': 0.15,
  'childcare': 0.10,
  'tech_help': 0.10,
  'home_repair': 0.10,
  'professional': 0.10,
  'other': 0.10,
};

// Skills distribution
const SKILLS = [
  'driving', 'moving', 'cooking', 'childcare', 'tutoring',
  'computer_repair', 'web_development', 'plumbing', 'electrical',
  'carpentry', 'painting', 'gardening', 'pet_care', 'language_help',
  'legal_advice', 'accounting', 'photography', 'graphic_design',
];

interface GeneratedUser {
  id: string;
  name: string;
  email: string;
  city: typeof US_CITIES[0];
  joinedAt: Date;
  invitedBy: string | null;
}

interface GeneratedCommunity {
  id: string;
  name: string;
  city: typeof US_CITIES[0];
  adminId: string;
  createdAt: Date;
}

class DataGenerator {
  private pool: Pool;
  private users: GeneratedUser[] = [];
  private communities: GeneratedCommunity[] = [];
  private startDate: Date;
  private endDate: Date;

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'karmyq_db',
      user: process.env.DB_USER || 'karmyq_user',
      password: process.env.DB_PASSWORD,
    });

    this.endDate = new Date();
    this.startDate = new Date();
    this.startDate.setDate(this.startDate.getDate() - CONFIG.TIMELINE_DAYS);
  }

  private randomDate(start: Date, end: Date): Date {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  }

  private randomCity() {
    return US_CITIES[Math.floor(Math.random() * US_CITIES.length)];
  }

  private randomElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  private generateRequestTitle(type: string): string {
    const templates = {
      transportation: [
        'Need a ride to {destination}',
        'Looking for carpool to {destination}',
        'Transportation help needed',
      ],
      moving_help: [
        'Help moving to new apartment',
        'Need help loading/unloading truck',
        'Moving boxes - need strong backs!',
      ],
      food: [
        'Meal prep assistance needed',
        'Looking for someone to teach cooking',
        'Food delivery help',
      ],
      childcare: [
        'Babysitter needed for {time}',
        'After-school care needed',
        'Looking for playdate buddy',
      ],
      tech_help: [
        'Computer won\'t start - help!',
        'Website setup assistance needed',
        'Phone setup help',
      ],
      home_repair: [
        'Leaky faucet needs fixing',
        'Door hinge repair',
        'Help hanging pictures',
      ],
      professional: [
        'Resume review needed',
        'Interview practice',
        'Career advice session',
      ],
      other: [
        'General help needed',
        'Miscellaneous task',
        'Odd job assistance',
      ],
    };

    const typeTemplates = templates[type as keyof typeof templates] || templates.other;
    let title = this.randomElement(typeTemplates);

    // Replace placeholders
    title = title.replace('{destination}', faker.location.street());
    title = title.replace('{time}', `${Math.floor(Math.random() * 4) + 2} hours`);

    return title;
  }

  async generateUsers() {
    console.log(`\n📝 Generating ${CONFIG.USERS} users...`);

    const userIds: string[] = [];
    const values: string[] = [];

    for (let i = 0; i < CONFIG.USERS; i++) {
      const id = faker.string.uuid();
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const name = `${firstName} ${lastName}`;
      const email = faker.internet.email({ firstName, lastName }).toLowerCase();
      const passwordHash = '$2b$10$hashedpassword'; // Dummy hash
      const city = this.randomCity();
      const joinedAt = this.randomDate(this.startDate, this.endDate);

      let invitedBy = null;
      if (i > 0 && Math.random() < CONFIG.INVITATION_RATE) {
        // Invited by a user who joined before them
        const eligibleInviters = this.users.filter(u => u.joinedAt < joinedAt);
        if (eligibleInviters.length > 0) {
          invitedBy = this.randomElement(eligibleInviters).id;
        }
      }

      this.users.push({ id, name, email, city, joinedAt, invitedBy });

      values.push(`(
        '${id}',
        '${name.replace(/'/g, "''")}',
        '${email}',
        '${passwordHash}',
        ${invitedBy ? `'${invitedBy}'` : 'NULL'},
        ${invitedBy ? `'${joinedAt.toISOString()}'` : 'NULL'},
        '${joinedAt.toISOString()}'
      )`);

      userIds.push(id);

      if (values.length >= 100 || i === CONFIG.USERS - 1) {
        await this.pool.query(`
          INSERT INTO auth.users (id, name, email, password_hash, invited_by, invitation_accepted_at, created_at)
          VALUES ${values.join(',\n')}
          ON CONFLICT (email) DO NOTHING
        `);
        values.length = 0;
      }
    }

    console.log(`✓ ${this.users.length} users created`);
  }

  async generateCommunities() {
    console.log(`\n🏘️  Generating ${CONFIG.COMMUNITIES} communities...`);

    const values: string[] = [];

    for (let i = 0; i < CONFIG.COMMUNITIES; i++) {
      const id = faker.string.uuid();
      const city = this.randomCity();

      // Mix of city-based and interest-based communities
      let name: string;
      if (Math.random() < 0.6) {
        // City-based
        const neighborhood = faker.location.streetName();
        name = `${city.name} - ${neighborhood}`;
      } else {
        // Interest-based
        const interests = [
          'Parents Network',
          'Tech Professionals',
          'Outdoor Enthusiasts',
          'Book Club',
          'DIY & Makers',
          'Food Lovers',
          'Pet Owners',
          'Gardeners',
          'Artists',
          'Musicians',
        ];
        name = `${city.name} ${this.randomElement(interests)}`;
      }

      const description = faker.lorem.sentence();
      const admin = this.randomElement(this.users);
      const createdAt = this.randomDate(this.startDate, this.endDate);

      this.communities.push({ id, name, city, adminId: admin.id, createdAt });

      values.push(`(
        '${id}',
        '${name.replace(/'/g, "''")}',
        '${description.replace(/'/g, "''")}',
        '${admin.id}',
        '${createdAt.toISOString()}'
      )`);

      if (values.length >= 50 || i === CONFIG.COMMUNITIES - 1) {
        await this.pool.query(`
          INSERT INTO communities.communities (id, name, description, admin_id, created_at)
          VALUES ${values.join(',\n')}
          ON CONFLICT DO NOTHING
        `);
        values.length = 0;
      }
    }

    console.log(`✓ ${this.communities.length} communities created`);
  }

  async generateCommunityMembers() {
    console.log(`\n👥 Assigning users to communities...`);

    const values: string[] = [];
    let memberCount = 0;

    for (const user of this.users) {
      // Each user joins 1-5 communities in their city or nearby
      const numCommunities = Math.floor(Math.random() * 4) + 1;
      const userCommunities = this.communities
        .filter(c => c.city.name === user.city.name || Math.random() < 0.2) // Mostly local, some remote
        .sort(() => Math.random() - 0.5)
        .slice(0, numCommunities);

      for (const community of userCommunities) {
        const role = community.adminId === user.id ? 'admin' : 'member';
        const joinedAt = new Date(Math.max(user.joinedAt.getTime(), community.createdAt.getTime()));

        values.push(`(
          '${community.id}',
          '${user.id}',
          '${role}',
          '${joinedAt.toISOString()}'
        )`);

        memberCount++;

        if (values.length >= 500) {
          await this.pool.query(`
            INSERT INTO communities.members (community_id, user_id, role, joined_at)
            VALUES ${values.join(',\n')}
            ON CONFLICT (community_id, user_id) DO NOTHING
          `);
          values.length = 0;
        }
      }
    }

    if (values.length > 0) {
      await this.pool.query(`
        INSERT INTO communities.members (community_id, user_id, role, joined_at)
        VALUES ${values.join(',\n')}
        ON CONFLICT (community_id, user_id) DO NOTHING
      `);
    }

    console.log(`✓ ${memberCount} community memberships created`);
  }

  async generateInvitations() {
    console.log(`\n📨 Creating invitation records...`);

    const values: string[] = [];
    let invitationCount = 0;

    for (const user of this.users) {
      if (!user.invitedBy) continue;

      const inviter = this.users.find(u => u.id === user.invitedBy);
      if (!inviter) continue;

      // Find a common community
      const inviterCommunities = await this.pool.query(
        'SELECT community_id FROM communities.members WHERE user_id = $1 LIMIT 5',
        [inviter.id]
      );

      if (inviterCommunities.rows.length === 0) continue;

      const communityId = this.randomElement(inviterCommunities.rows).community_id;
      const invitationCode = `KARMYQ-${inviter.name.split(' ')[0].toUpperCase()}-${user.joinedAt.getFullYear()}-${faker.string.alphanumeric(4).toUpperCase()}`;

      values.push(`(
        '${inviter.id}',
        '${user.id}',
        '${communityId}',
        '${invitationCode}',
        '${new Date(user.joinedAt.getTime() - 86400000).toISOString()}',
        '${user.joinedAt.toISOString()}',
        'link'
      )`);

      invitationCount++;

      if (values.length >= 100) {
        await this.pool.query(`
          INSERT INTO auth.user_invitations (inviter_id, invitee_id, community_id, invitation_code, invited_at, invitation_accepted_at, invitation_method)
          VALUES ${values.join(',\n')}
          ON CONFLICT (invitation_code) DO NOTHING
        `);
        values.length = 0;
      }
    }

    if (values.length > 0) {
      await this.pool.query(`
        INSERT INTO auth.user_invitations (inviter_id, invitee_id, community_id, invitation_code, invited_at, invitation_accepted_at, invitation_method)
        VALUES ${values.join(',\n')}
        ON CONFLICT (invitation_code) DO NOTHING
      `);
    }

    console.log(`✓ ${invitationCount} invitations created`);
  }

  async generateRequests() {
    console.log(`\n🆘 Generating help requests...`);

    const totalRequests = Math.floor(CONFIG.USERS * CONFIG.REQUESTS_PER_USER_AVG);
    const values: string[] = [];
    let requestCount = 0;

    for (let i = 0; i < totalRequests; i++) {
      const user = this.randomElement(this.users);

      // Get user's communities
      const userCommunities = await this.pool.query(
        'SELECT community_id FROM communities.members WHERE user_id = $1 LIMIT 5',
        [user.id]
      );

      if (userCommunities.rows.length === 0) continue;

      const communityId = this.randomElement(userCommunities.rows).community_id;

      // Determine request type
      const rand = Math.random();
      let cumulativeProbability = 0;
      let requestType = 'other';

      for (const [type, probability] of Object.entries(REQUEST_TYPES)) {
        cumulativeProbability += probability;
        if (rand < cumulativeProbability) {
          requestType = type;
          break;
        }
      }

      const id = faker.string.uuid();
      const title = this.generateRequestTitle(requestType);
      const description = faker.lorem.paragraphs(2);
      const urgency = this.randomElement(['low', 'medium', 'high']);
      const createdAt = this.randomDate(user.joinedAt, this.endDate);
      const status = Math.random() < 0.3 ? 'open' : (Math.random() < 0.7 ? 'matched' : 'fulfilled');

      values.push(`(
        '${id}',
        '${communityId}',
        '${user.id}',
        '${title.replace(/'/g, "''")}',
        '${description.replace(/'/g, "''")}',
        '${requestType}',
        '${urgency}',
        '${status}',
        '${createdAt.toISOString()}',
        '${createdAt.toISOString()}'
      )`);

      requestCount++;

      if (values.length >= 100 || i === totalRequests - 1) {
        await this.pool.query(`
          INSERT INTO requests.help_requests (id, community_id, requester_id, title, description, type, urgency, status, created_at, updated_at)
          VALUES ${values.join(',\n')}
        `);
        values.length = 0;
      }
    }

    console.log(`✓ ${requestCount} requests created`);
    return requestCount;
  }

  async generateKarma() {
    console.log(`\n⭐ Generating karma records...`);

    const values: string[] = [];
    let karmaCount = 0;

    for (const user of this.users) {
      // Get user's communities
      const userCommunities = await this.pool.query(
        'SELECT community_id FROM communities.members WHERE user_id = $1',
        [user.id]
      );

      for (const { community_id } of userCommunities.rows) {
        // Calculate karma based on account age and random activity
        const daysSinceJoin = Math.floor((this.endDate.getTime() - user.joinedAt.getTime()) / 86400000);
        const baseKarma = Math.floor(Math.random() * 50);
        const activityKarma = Math.floor(daysSinceJoin / 10) * Math.floor(Math.random() * 5);
        const totalKarma = Math.max(0, baseKarma + activityKarma);

        values.push(`(
          '${user.id}',
          '${community_id}',
          ${totalKarma},
          ${totalKarma},
          NOW(),
          NOW()
        )`);

        karmaCount++;

        if (values.length >= 500) {
          await this.pool.query(`
            INSERT INTO reputation.karma_records (user_id, community_id, current_karma, total_karma_earned, created_at, updated_at)
            VALUES ${values.join(',\n')}
            ON CONFLICT (user_id, community_id) DO NOTHING
          `);
          values.length = 0;
        }
      }
    }

    if (values.length > 0) {
      await this.pool.query(`
        INSERT INTO reputation.karma_records (user_id, community_id, current_karma, total_karma_earned, created_at, updated_at)
        VALUES ${values.join(',\n')}
        ON CONFLICT (user_id, community_id) DO NOTHING
      `);
    }

    console.log(`✓ ${karmaCount} karma records created`);
  }

  async run() {
    console.log('\n🚀 Starting Realistic Data Generation');
    console.log('=====================================');
    console.log(`Users: ${CONFIG.USERS}`);
    console.log(`Communities: ${CONFIG.COMMUNITIES}`);
    console.log(`Timeline: ${CONFIG.TIMELINE_DAYS} days`);
    console.log('=====================================\n');

    try {
      await this.generateUsers();
      await this.generateCommunities();
      await this.generateCommunityMembers();
      await this.generateInvitations();
      await this.generateRequests();
      await this.generateKarma();

      console.log('\n✅ Data generation complete!');
      console.log('\n📊 Summary:');
      console.log(`   Users: ${this.users.length}`);
      console.log(`   Communities: ${this.communities.length}`);
      console.log(`   Invitations: ~${Math.floor(this.users.length * CONFIG.INVITATION_RATE)}`);
      console.log(`   Requests: ~${Math.floor(CONFIG.USERS * CONFIG.REQUESTS_PER_USER_AVG)}`);
      console.log(`   Timeline: ${this.startDate.toLocaleDateString()} to ${this.endDate.toLocaleDateString()}`);

    } catch (error) {
      console.error('\n❌ Error during data generation:', error);
      throw error;
    } finally {
      await this.pool.end();
    }
  }
}

// Run if called directly
if (require.main === module) {
  const generator = new DataGenerator();
  generator.run().catch(console.error);
}

export { DataGenerator };
