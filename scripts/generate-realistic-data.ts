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
import bcrypt from 'bcrypt';

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
  creatorId: string;
  createdAt: Date;
}

class DataGenerator {
  private pool: Pool;
  private users: GeneratedUser[] = [];
  private communities: GeneratedCommunity[] = [];
  private startDate: Date;
  private endDate: Date;
  private passwordHash: string = '';

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'karmyq_db',
      user: process.env.DB_USER || 'karmyq_user',
      password: process.env.DB_PASSWORD || 'karmyq_password_dev',
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

  private generateCommunityDescription(name: string): string {
    const isNeighborhood = name.includes(' - ');
    const city = name.split(' ')[0];

    if (isNeighborhood) {
      const templates = [
        `A mutual aid community for ${name} neighbors helping neighbors with everyday tasks and building local connections.`,
        `Local ${name} community supporting each other through skill sharing, errands, and neighborly assistance.`,
        `${name} residents connecting to help one another with rides, moving, childcare, and more.`,
        `Neighborhood mutual aid group for ${name} focused on building a caring, supportive community.`,
        `Community-driven support network for ${name} where locals help each other thrive.`,
      ];
      return this.randomElement(templates);
    }

    // Interest-based communities
    if (name.includes('Parents Network')) {
      const templates = [
        `${city} parents supporting each other with childcare swaps, playdates, school pickups, and parenting advice.`,
        `A community for ${city} area parents to exchange childcare help, share resources, and build friendships.`,
        `Parents in ${city} helping each other balance family life through babysitting exchanges and mutual support.`,
      ];
      return this.randomElement(templates);
    }

    if (name.includes('Tech Professionals')) {
      const templates = [
        `${city} tech workers helping each other with career advice, technical troubleshooting, and professional networking.`,
        `A community of ${city} technologists sharing skills, mentoring, and assisting with tech-related projects.`,
        `Tech professionals in ${city} offering mutual support for coding help, resume reviews, and tech repairs.`,
      ];
      return this.randomElement(templates);
    }

    if (name.includes('DIY & Makers')) {
      const templates = [
        `${city} makers and DIY enthusiasts sharing tools, skills, and helping with home improvement projects.`,
        `A community for ${city} area DIYers to exchange help with repairs, building projects, and skill-sharing.`,
        `Hands-on community in ${city} for folks who love making, fixing, and building things together.`,
      ];
      return this.randomElement(templates);
    }

    // Generic template for other interest groups
    const interestType = name.split(' ').slice(1).join(' ');
    return `${city} ${interestType} community where members support each other through shared interests and mutual aid.`;
  }

  private generateRequestDescription(type: string, title: string): string {
    const templates = {
      transportation: [
        `I'm looking for help getting to my appointment. ${faker.helpers.arrayElement(['Happy to compensate for gas!', 'Can return the favor anytime!', 'Very flexible with timing.'])}`,
        `Need a reliable ride for this regular commute. ${faker.helpers.arrayElement(['Can chip in for gas and tolls.', 'Could arrange a recurring schedule.', 'Open to carpooling arrangement.'])}`,
        `Would really appreciate assistance with this trip. ${faker.helpers.arrayElement(['I can help you out with something in return.', 'This would really help me out.', 'Let me know if you can help!'])}`,
      ],
      moving_help: [
        `Moving to a new place and need some extra hands. ${faker.helpers.arrayElement(['Have most things packed already.', 'Will provide pizza and drinks!', 'Mostly just heavy furniture.'])} ${faker.helpers.arrayElement(['Should take about 2-3 hours.', 'Ground floor to ground floor.', 'Just a few blocks away.'])}`,
        `Looking for help moving some furniture. ${faker.helpers.arrayElement(['Have a truck already.', 'Will help with your move anytime!', 'Pretty straightforward job.'])}`,
      ],
      childcare: [
        `Need someone trustworthy to watch my ${faker.helpers.arrayElement(['two kids (ages 5 and 7)', 'toddler', '8-year-old', 'infant'])}. ${faker.helpers.arrayElement(['They are well-behaved and love to play.', 'Just need someone to supervise.', 'CPR certified preferred but not required.'])}`,
        `Looking for help with after-school care. ${faker.helpers.arrayElement(['Can do pickup swap if helpful!', 'Regular arrangement would be great.', 'Very flexible with the schedule.'])}`,
      ],
      tech_help: [
        `Having trouble with my ${faker.helpers.arrayElement(['laptop', 'phone', 'Wi-Fi router', 'smart TV'])}. ${faker.helpers.arrayElement(['Not very tech-savvy!', 'Would really appreciate some guidance.', 'Happy to buy you coffee!'])}`,
        `Need help setting up ${faker.helpers.arrayElement(['my new computer', 'home network', 'smart home devices', 'printer'])}. ${faker.helpers.arrayElement(['Shouldn\'t take too long.', 'Can work around your schedule.', 'Will have everything ready.'])}`,
      ],
      home_repair: [
        `Need help with a ${faker.helpers.arrayElement(['minor plumbing issue', 'light fixture installation', 'leaky faucet', 'cabinet repair'])}. ${faker.helpers.arrayElement(['Have all the parts already.', 'Should be a quick fix.', 'Can help with your projects too!'])}`,
        `Looking for someone handy to help with ${faker.helpers.arrayElement(['assembling furniture', 'hanging shelves', 'fixing a door', 'painting'])}. ${faker.helpers.arrayElement(['Will provide all materials.', 'Pretty straightforward job.', 'Happy to return the favor!'])}`,
      ],
      food: [
        `Would love help with ${faker.helpers.arrayElement(['meal prep for the week', 'learning to cook healthy meals', 'grocery shopping', 'cooking for a family gathering'])}. ${faker.helpers.arrayElement(['Can share the food!', 'Want to learn new recipes.', 'Happy to trade skills!'])}`,
      ],
      professional: [
        `Looking for feedback on my ${faker.helpers.arrayElement(['resume', 'cover letter', 'LinkedIn profile', 'portfolio'])}. ${faker.helpers.arrayElement(['Applying for jobs soon.', 'Want to make sure it looks professional.', 'Could use a fresh perspective.'])}`,
        `Could use some career advice about ${faker.helpers.arrayElement(['transitioning fields', 'negotiating salary', 'interview prep', 'professional development'])}. ${faker.helpers.arrayElement(['Happy to grab coffee!', 'Video call works great.', 'Very appreciative of any insights.'])}`,
      ],
      other: [
        `Need help with ${faker.helpers.arrayElement(['a small project', 'organizing', 'yard work', 'miscellaneous tasks'])}. ${faker.helpers.arrayElement(['Should take about an hour.', 'Pretty easy work.', 'Happy to help you in return!'])}`,
      ],
    };

    const typeTemplates = templates[type as keyof typeof templates] || templates.other;
    return this.randomElement(typeTemplates);
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

  async initialize() {
    console.log('\n🔐 Generating password hash...');
    // Generate one bcrypt hash to use for all users (password: "password123")
    this.passwordHash = await bcrypt.hash('password123', 10);
    console.log('✓ Password hash generated');
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
        '${this.passwordHash}',
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

      const description = this.generateCommunityDescription(name);
      const admin = this.randomElement(this.users);
      const createdAt = this.randomDate(this.startDate, this.endDate);

      this.communities.push({ id, name, city, creatorId: admin.id, createdAt });

      values.push(`(
        '${id}',
        '${name.replace(/'/g, "''")}',
        '${description.replace(/'/g, "''")}',
        '${admin.id}',
        '${createdAt.toISOString()}'
      )`);

      if (values.length >= 50 || i === CONFIG.COMMUNITIES - 1) {
        await this.pool.query(`
          INSERT INTO communities.communities (id, name, description, creator_id, created_at)
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
        const role = community.creatorId === user.id ? 'admin' : 'member';
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

    // Update current_members count for all communities
    await this.pool.query(`
      UPDATE communities.communities c
      SET current_members = (
        SELECT COUNT(*)
        FROM communities.members m
        WHERE m.community_id = c.id
      )
    `);

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
      // Clean the name - remove apostrophes and special chars, take only letters
      const cleanFirstName = inviter.name.split(' ')[0].replace(/[^A-Za-z]/g, '').toUpperCase();
      const invitationCode = `KARMYQ-${cleanFirstName}-${user.joinedAt.getFullYear()}-${faker.string.alphanumeric(4).toUpperCase()}`;

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

  private generateRequestPayload(type: string, city: typeof US_CITIES[0]): any {
    const payloads: Record<string, any> = {
      transportation: {
        pickup_location: {
          address: faker.location.streetAddress(),
          city: city.name,
          state: city.state,
          lat: city.lat + (Math.random() - 0.5) * 0.1,
          lng: city.lng + (Math.random() - 0.5) * 0.1,
        },
        dropoff_location: {
          address: faker.location.streetAddress(),
          city: Math.random() < 0.8 ? city.name : faker.helpers.arrayElement(US_CITIES).name,
          state: city.state,
          lat: city.lat + (Math.random() - 0.5) * 0.15,
          lng: city.lng + (Math.random() - 0.5) * 0.15,
        },
        passengers: faker.number.int({ min: 1, max: 4 }),
        luggage: faker.helpers.arrayElement(['none', 'small', 'medium', 'large']),
        return_trip: Math.random() < 0.3,
      },
      moving_help: {
        current_address: {
          address: faker.location.streetAddress(),
          city: city.name,
          state: city.state,
          floor: faker.number.int({ min: 1, max: 5 }),
          has_elevator: Math.random() < 0.4,
        },
        new_address: {
          address: faker.location.streetAddress(),
          city: Math.random() < 0.7 ? city.name : faker.helpers.arrayElement(US_CITIES).name,
          state: city.state,
          floor: faker.number.int({ min: 1, max: 5 }),
          has_elevator: Math.random() < 0.4,
        },
        distance_miles: faker.number.int({ min: 1, max: 50 }),
        estimated_duration_hours: faker.number.int({ min: 2, max: 8 }),
        truck_needed: Math.random() < 0.6,
        heavy_items: Math.random() < 0.7,
        num_helpers_needed: faker.number.int({ min: 1, max: 4 }),
      },
      childcare: {
        children: Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, () => ({
          age: faker.number.int({ min: 0, max: 12 }),
          special_needs: Math.random() < 0.1,
        })),
        location: {
          address: faker.location.streetAddress(),
          city: city.name,
          state: city.state,
        },
        duration_hours: faker.number.int({ min: 2, max: 8 }),
        meal_prep_needed: Math.random() < 0.5,
        homework_help_needed: Math.random() < 0.3,
      },
      tech_help: {
        device_type: faker.helpers.arrayElement(['laptop', 'desktop', 'phone', 'tablet', 'smart_home', 'network']),
        issue_description: faker.helpers.arrayElement([
          'won\'t turn on',
          'slow performance',
          'software installation',
          'virus removal',
          'setup assistance',
          'data recovery',
        ]),
        remote_help_acceptable: Math.random() < 0.6,
        urgency_level: faker.helpers.arrayElement(['can_wait', 'soon', 'urgent']),
      },
      home_repair: {
        repair_type: faker.helpers.arrayElement([
          'plumbing',
          'electrical',
          'carpentry',
          'painting',
          'appliance',
        ]),
        location_in_home: faker.helpers.arrayElement([
          'kitchen',
          'bathroom',
          'bedroom',
          'living_room',
          'garage',
        ]),
        tools_available: Math.random() < 0.5,
        materials_needed: Math.random() < 0.6,
        estimated_duration_hours: faker.number.int({ min: 1, max: 6 }),
      },
      food: {
        service_type: faker.helpers.arrayElement([
          'meal_prep',
          'cooking_lesson',
          'grocery_shopping',
          'food_delivery',
        ]),
        dietary_restrictions: faker.helpers.arrayElements(
          ['vegetarian', 'vegan', 'gluten_free', 'dairy_free', 'none'],
          faker.number.int({ min: 0, max: 2 })
        ),
        num_servings: faker.number.int({ min: 2, max: 8 }),
        cuisine_preference: faker.helpers.arrayElement([
          'american',
          'italian',
          'mexican',
          'asian',
          'mediterranean',
        ]),
      },
      professional: {
        service_type: faker.helpers.arrayElement([
          'resume_review',
          'interview_prep',
          'career_coaching',
          'portfolio_review',
        ]),
        industry: faker.helpers.arrayElement([
          'tech',
          'healthcare',
          'education',
          'finance',
          'marketing',
        ]),
        experience_level: faker.helpers.arrayElement(['entry', 'mid', 'senior']),
        session_duration_minutes: faker.number.int({ min: 30, max: 120 }),
        virtual_ok: Math.random() < 0.8,
      },
      other: {
        task_description: faker.lorem.sentence(),
        estimated_duration_hours: faker.number.int({ min: 1, max: 4 }),
      },
    };

    return payloads[type] || payloads.other;
  }

  private generateRequestRequirements(type: string): any {
    const baseRequirements = {
      background_check: Math.random() < 0.2,
      references_required: Math.random() < 0.3,
      experience_level: faker.helpers.arrayElement(['any', 'some', 'extensive']),
    };

    const typeSpecificRequirements: Record<string, any> = {
      transportation: {
        valid_license: true,
        insurance_required: Math.random() < 0.5,
        vehicle_type: faker.helpers.arrayElement(['any', 'sedan', 'suv', 'truck']),
      },
      childcare: {
        cpr_certified: Math.random() < 0.6,
        first_aid: Math.random() < 0.5,
        age_experience: faker.helpers.arrayElement(['infant', 'toddler', 'school_age', 'any']),
      },
      tech_help: {
        technical_level: faker.helpers.arrayElement(['basic', 'intermediate', 'expert']),
        certifications: Math.random() < 0.2,
      },
      home_repair: {
        licensed: Math.random() < 0.3,
        insured: Math.random() < 0.4,
        own_tools: Math.random() < 0.6,
      },
    };

    return {
      ...baseRequirements,
      ...(typeSpecificRequirements[type] || {}),
    };
  }

  async generateRequests() {
    console.log(`\n🆘 Generating help requests...`);

    const totalRequests = Math.floor(CONFIG.USERS * CONFIG.REQUESTS_PER_USER_AVG);
    const requestValues: string[] = [];
    const communityLinkValues: string[] = [];
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
      const description = this.generateRequestDescription(requestType, title);
      const urgency = this.randomElement(['low', 'medium', 'high']);
      const createdAt = this.randomDate(user.joinedAt, this.endDate);
      const status = Math.random() < 0.3 ? 'open' : (Math.random() < 0.7 ? 'matched' : 'fulfilled');

      // Generate polymorphic payload based on request type
      const payload = this.generateRequestPayload(requestType, user.city);
      const requirements = this.generateRequestRequirements(requestType);

      // Generate time windows for time-sensitive requests
      const preferredStartDate = ['transportation', 'childcare', 'moving_help'].includes(requestType)
        ? new Date(createdAt.getTime() + Math.random() * 86400000 * 14) // 0-14 days after request
        : null;
      const preferredEndDate = preferredStartDate
        ? new Date(preferredStartDate.getTime() + Math.random() * 86400000 * 7) // 0-7 days window
        : null;

      requestValues.push(`(
        '${id}',
        '${user.id}',
        '${title.replace(/'/g, "''")}',
        '${description.replace(/'/g, "''")}',
        '${requestType}',
        '${urgency}',
        ${preferredStartDate ? `'${preferredStartDate.toISOString()}'` : 'NULL'},
        ${preferredEndDate ? `'${preferredEndDate.toISOString()}'` : 'NULL'},
        '${status}',
        '${createdAt.toISOString()}',
        '${createdAt.toISOString()}',
        '${requestType}',
        '${JSON.stringify(payload).replace(/'/g, "''")}'::jsonb,
        '${JSON.stringify(requirements).replace(/'/g, "''")}'::jsonb
      )`);

      // Link request to community
      communityLinkValues.push(`(
        '${faker.string.uuid()}',
        '${id}',
        '${communityId}',
        '${createdAt.toISOString()}'
      )`);

      requestCount++;

      if (requestValues.length >= 100 || i === totalRequests - 1) {
        // Insert requests
        await this.pool.query(`
          INSERT INTO requests.help_requests (id, requester_id, title, description, category, urgency, preferred_start_date, preferred_end_date, status, created_at, updated_at, request_type, payload, requirements)
          VALUES ${requestValues.join(',\n')}
        `);

        // Link requests to communities
        await this.pool.query(`
          INSERT INTO requests.request_communities (id, request_id, community_id, created_at)
          VALUES ${communityLinkValues.join(',\n')}
        `);

        requestValues.length = 0;
        communityLinkValues.length = 0;
      }
    }

    console.log(`✓ ${requestCount} requests created`);
    return requestCount;
  }

  private generateOfferDescription(type: string, title: string): string {
    const templates = {
      transportation: [
        `I have a car and flexible schedule, happy to help with rides! ${faker.helpers.arrayElement(['Available most evenings and weekends.', 'Can do regular pickups if needed.', 'Just let me know when you need help.'])}`,
        `Regular commuter here, can offer carpooling. ${faker.helpers.arrayElement(['Going downtown daily.', 'Happy to pick up on the way.', 'Save gas and help out!'])}`,
      ],
      moving_help: [
        `I've helped friends move many times, have experience with heavy lifting. ${faker.helpers.arrayElement(['Have a truck available.', 'Used to work as a mover.', 'Strong back and willing attitude!'])}`,
        `Available to help with your move! ${faker.helpers.arrayElement(['Can bring basic tools.', 'Done plenty of moves before.', 'Let me know what you need.'])}`,
      ],
      childcare: [
        `Parent of ${faker.helpers.arrayElement(['two', 'three'])} kids, CPR certified, lots of experience. ${faker.helpers.arrayElement(['Love working with children!', 'References available.', 'Very reliable and patient.'])}`,
        `Former teacher, great with kids of all ages. ${faker.helpers.arrayElement(['Can help with homework too!', 'Very flexible schedule.', 'Happy to do playdate swaps.'])}`,
      ],
      tech_help: [
        `Software engineer with ${faker.number.int({ min: 5, max: 15 })} years experience. ${faker.helpers.arrayElement(['Can fix most tech issues.', 'Patient with non-technical folks.', 'Love helping people with tech!'])}`,
        `Tech-savvy and happy to help troubleshoot. ${faker.helpers.arrayElement(['No problem too small.', 'Can explain things clearly.', 'Been doing this for years.'])}`,
      ],
      home_repair: [
        `Handy person with lots of DIY experience. ${faker.helpers.arrayElement(['Have most tools needed.', 'Love helping with home projects.', 'Former contractor.'])}`,
        `Good with repairs and installations. ${faker.helpers.arrayElement(['Can usually fix it quick.', 'Enjoy working with my hands.', 'Happy to share my skills!'])}`,
      ],
      food: [
        `Love to cook and teach! ${faker.helpers.arrayElement(['Specialized in healthy meals.', 'Been cooking for 20+ years.', 'Can teach you my favorite recipes.'])}`,
        `Experienced with meal planning and prep. ${faker.helpers.arrayElement(['Can show you time-saving tricks.', 'Love sharing food culture.', 'Happy to help shop and cook.'])}`,
      ],
      professional: [
        `${faker.helpers.arrayElement(['HR professional', 'Career coach', 'Hiring manager'])} with ${faker.number.int({ min: 8, max: 20 })} years experience. ${faker.helpers.arrayElement(['Happy to review and provide feedback.', 'Love helping people advance their careers.', 'Can do mock interviews too.'])}`,
        `Work in ${faker.helpers.arrayElement(['tech recruiting', 'consulting', 'management'])} and can provide insights. ${faker.helpers.arrayElement(['Reviewed hundreds of resumes.', 'Know what employers look for.', 'Happy to share what I know.'])}`,
      ],
      other: [
        `Jack of all trades, happy to help however I can! ${faker.helpers.arrayElement(['Very reliable.', 'Love helping neighbors.', 'Just ask!'])}`,
      ],
    };

    const typeTemplates = templates[type as keyof typeof templates] || templates.other;
    return this.randomElement(typeTemplates);
  }

  async generateOffersAndMatches() {
    console.log(`\n🤝 Generating offers and matches...`);

    const offerValues: string[] = [];
    const matchValues: string[] = [];
    let offerCount = 0;
    let matchCount = 0;

    // Get all requests
    const requests = await this.pool.query(`
      SELECT hr.id, hr.requester_id, hr.category, hr.created_at, rc.community_id
      FROM requests.help_requests hr
      JOIN requests.request_communities rc ON hr.id = rc.request_id
    `);

    for (const request of requests.rows) {
      // 60% chance of getting offers
      if (Math.random() > 0.6) continue;

      // Get community members who could offer help (not the requester)
      const potentialHelpers = await this.pool.query(
        `SELECT user_id FROM communities.members
         WHERE community_id = $1 AND user_id != $2
         LIMIT 10`,
        [request.community_id, request.requester_id]
      );

      if (potentialHelpers.rows.length === 0) continue;

      // Generate 1-3 offers for this request
      const numOffers = Math.floor(Math.random() * 3) + 1;
      const requestOfferIds: string[] = [];

      for (let i = 0; i < Math.min(numOffers, potentialHelpers.rows.length); i++) {
        const offerer = potentialHelpers.rows[i];
        const offerId = faker.string.uuid();
        const offerTitle = `I can help with ${request.category}`;
        const offerDescription = this.generateOfferDescription(request.category, offerTitle);
        const offerCreatedAt = new Date(new Date(request.created_at).getTime() + Math.random() * 86400000 * 3); // 0-3 days after request

        offerValues.push(`(
          '${offerId}',
          '${request.community_id}',
          '${offerer.user_id}',
          '${offerTitle}',
          '${offerDescription.replace(/'/g, "''")}',
          '${request.category}',
          'active',
          '${offerCreatedAt.toISOString()}',
          '${offerCreatedAt.toISOString()}'
        )`);

        requestOfferIds.push(offerId);
        offerCount++;

        if (offerValues.length >= 100) {
          await this.pool.query(`
            INSERT INTO requests.help_offers (id, community_id, offerer_id, title, description, category, status, created_at, updated_at)
            VALUES ${offerValues.join(',\n')}
          `);
          offerValues.length = 0;
        }
      }

      // Create match for some requests (60% of requests that have offers)
      if (requestOfferIds.length > 0 && Math.random() < CONFIG.MATCHES_RATE) {
        const selectedOfferId = this.randomElement(requestOfferIds);
        const offerResult = await this.pool.query(
          'SELECT offerer_id FROM requests.help_offers WHERE id = $1',
          [selectedOfferId]
        );

        if (offerResult.rows.length > 0) {
          const matchId = faker.string.uuid();
          const matchStatus = this.randomElement(['proposed', 'accepted', 'completed']);
          const matchCreatedAt = new Date(new Date(request.created_at).getTime() + Math.random() * 86400000 * 5);
          const completedAt = matchStatus === 'completed'
            ? new Date(matchCreatedAt.getTime() + Math.random() * 86400000 * 7).toISOString()
            : 'NULL';

          matchValues.push(`(
            '${matchId}',
            '${request.id}',
            '${selectedOfferId}',
            '${offerResult.rows[0].offerer_id}',
            '${matchStatus}',
            ${completedAt !== 'NULL' ? `'${completedAt}'` : 'NULL'},
            '${matchCreatedAt.toISOString()}',
            '${matchCreatedAt.toISOString()}'
          )`);

          matchCount++;

          if (matchValues.length >= 100) {
            await this.pool.query(`
              INSERT INTO requests.matches (id, request_id, offer_id, responder_id, status, completed_at, created_at, updated_at)
              VALUES ${matchValues.join(',\n')}
            `);
            matchValues.length = 0;
          }
        }
      }
    }

    // Insert remaining values
    if (offerValues.length > 0) {
      await this.pool.query(`
        INSERT INTO requests.help_offers (id, community_id, offerer_id, title, description, category, status, created_at, updated_at)
        VALUES ${offerValues.join(',\n')}
      `);
    }

    if (matchValues.length > 0) {
      await this.pool.query(`
        INSERT INTO requests.matches (id, request_id, offer_id, responder_id, status, completed_at, created_at, updated_at)
        VALUES ${matchValues.join(',\n')}
      `);
    }

    console.log(`✓ ${offerCount} offers created`);
    console.log(`✓ ${matchCount} matches created`);
  }

  async generateFeedbackAndKarma() {
    console.log(`\n⭐ Generating feedback and karma based on completed matches...`);

    const feedbackValues: string[] = [];
    const karmaRecordValues: string[] = [];
    let feedbackCount = 0;
    let karmaRecordCount = 0;

    // Get all completed matches
    const completedMatches = await this.pool.query(`
      SELECT
        m.id as match_id,
        m.request_id,
        m.responder_id,
        m.completed_at,
        hr.requester_id,
        hr.category,
        rc.community_id
      FROM requests.matches m
      JOIN requests.help_requests hr ON m.request_id = hr.id
      JOIN requests.request_communities rc ON hr.id = rc.request_id
      WHERE m.status = 'completed' AND m.completed_at IS NOT NULL
    `);

    console.log(`Found ${completedMatches.rows.length} completed matches to process`);

    for (const match of completedMatches.rows) {
      // Generate feedback from requester to helper
      const rating = faker.number.int({ min: 3, max: 5 });
      const feedbackTemplates = {
        5: [
          'Amazing help! Went above and beyond expectations.',
          'Couldn\'t have done it without them. Highly recommend!',
          'Super helpful and professional. Will definitely work with again!',
          'Exceeded all expectations. True community spirit!',
        ],
        4: [
          'Great experience, very helpful and reliable.',
          'Did a wonderful job. Would work with again.',
          'Very satisfied with the help provided.',
          'Helpful and professional throughout.',
        ],
        3: [
          'Got the job done. No complaints.',
          'Helpful overall. Met expectations.',
          'Good experience, would recommend.',
        ],
      };

      const feedbackText = this.randomElement(
        feedbackTemplates[rating as keyof typeof feedbackTemplates] || feedbackTemplates[3]
      );

      const feedbackId = faker.string.uuid();
      const completedAtISO = new Date(match.completed_at).toISOString();
      feedbackValues.push(`(
        '${feedbackId}',
        '${match.requester_id}',
        '${match.responder_id}',
        '${match.match_id}',
        '${match.community_id}',
        ${rating},
        '${feedbackText.replace(/'/g, "''")}',
        '${completedAtISO}'
      )`);
      feedbackCount++;

      // Award karma to helper (responder) based on rating
      const karmaPoints = rating === 5 ? 15 : rating === 4 ? 10 : 5;
      karmaRecordValues.push(`(
        '${faker.string.uuid()}',
        '${match.responder_id}',
        '${match.community_id}',
        ${karmaPoints},
        'Request completed - ${match.category}',
        '${match.match_id}',
        '${completedAtISO}'
      )`);

      // Small karma to requester for posting request that got fulfilled
      karmaRecordValues.push(`(
        '${faker.string.uuid()}',
        '${match.requester_id}',
        '${match.community_id}',
        3,
        'Posted request that was fulfilled',
        '${match.match_id}',
        '${completedAtISO}'
      )`);
      karmaRecordCount += 2;

      // Batch insert
      if (feedbackValues.length >= 100) {
        await this.pool.query(`
          INSERT INTO feedback.feedback (id, from_user_id, to_user_id, request_match_id, community_id, rating, comment, created_at)
          VALUES ${feedbackValues.join(',\n')}
        `);
        feedbackValues.length = 0;
      }

      if (karmaRecordValues.length >= 200) {
        await this.pool.query(`
          INSERT INTO reputation.karma_records (id, user_id, community_id, points, reason, related_entity_id, created_at)
          VALUES ${karmaRecordValues.join(',\n')}
        `);
        karmaRecordValues.length = 0;
      }
    }

    // Insert remaining values
    if (feedbackValues.length > 0) {
      await this.pool.query(`
        INSERT INTO feedback.feedback (id, from_user_id, to_user_id, request_match_id, community_id, rating, comment, created_at)
        VALUES ${feedbackValues.join(',\n')}
      `);
    }

    if (karmaRecordValues.length > 0) {
      await this.pool.query(`
        INSERT INTO reputation.karma_records (id, user_id, community_id, points, reason, related_entity_id, created_at)
        VALUES ${karmaRecordValues.join(',\n')}
      `);
    }

    console.log(`✓ ${feedbackCount} feedback entries created`);
    console.log(`✓ ${karmaRecordCount} karma records created from matches`);

    // Now generate trust scores based on actual data
    await this.generateTrustScores();
  }

  async generateTrustScores() {
    console.log(`\n🎯 Calculating trust scores from actual activity...`);

    const trustScoreValues: string[] = [];
    let trustScoreCount = 0;

    for (const user of this.users) {
      // Get user's communities
      const userCommunities = await this.pool.query(
        'SELECT community_id FROM communities.members WHERE user_id = $1',
        [user.id]
      );

      for (const { community_id } of userCommunities.rows) {
        // Count actual completed requests where user was the helper
        const helperStats = await this.pool.query(`
          SELECT COUNT(*) as completed_count, COALESCE(AVG(f.rating), 0) as avg_rating
          FROM requests.matches m
          LEFT JOIN feedback.feedback f ON m.id = f.request_match_id AND f.to_user_id = $1
          JOIN requests.request_communities rc ON m.request_id = rc.request_id
          WHERE m.responder_id = $1
            AND rc.community_id = $2
            AND m.status = 'completed'
        `, [user.id, community_id]);

        // Count actual completed requests where user was the requester
        const requesterStats = await this.pool.query(`
          SELECT COUNT(*) as completed_count
          FROM requests.matches m
          JOIN requests.help_requests hr ON m.request_id = hr.id
          JOIN requests.request_communities rc ON hr.id = rc.request_id
          WHERE hr.requester_id = $1
            AND rc.community_id = $2
            AND m.status = 'completed'
        `, [user.id, community_id]);

        const offersAccepted = parseInt(helperStats.rows[0].completed_count) || 0;
        const requestsCompleted = parseInt(requesterStats.rows[0].completed_count) || 0;
        const averageFeedback = parseFloat(helperStats.rows[0].avg_rating) || 0;

        // Calculate score based on actual activity
        const baseScore = 50;
        const activityScore = Math.min(30, requestsCompleted * 2 + offersAccepted * 3);
        const feedbackBonus = averageFeedback > 0 ? Math.floor((averageFeedback - 3) * 10) : 0;
        const score = Math.min(100, baseScore + activityScore + feedbackBonus);

        trustScoreValues.push(`(
          '${faker.string.uuid()}',
          '${user.id}',
          '${community_id}',
          ${score},
          ${requestsCompleted},
          ${offersAccepted},
          ${averageFeedback.toFixed(2)},
          NOW()
        )`);
        trustScoreCount++;

        if (trustScoreValues.length >= 500) {
          await this.pool.query(`
            INSERT INTO reputation.trust_scores (id, user_id, community_id, score, requests_completed, offers_accepted, average_feedback, last_updated)
            VALUES ${trustScoreValues.join(',\n')}
            ON CONFLICT (user_id, community_id) DO NOTHING
          `);
          trustScoreValues.length = 0;
        }
      }
    }

    // Insert remaining values
    if (trustScoreValues.length > 0) {
      await this.pool.query(`
        INSERT INTO reputation.trust_scores (id, user_id, community_id, score, requests_completed, offers_accepted, average_feedback, last_updated)
        VALUES ${trustScoreValues.join(',\n')}
        ON CONFLICT (user_id, community_id) DO NOTHING
      `);
    }

    console.log(`✓ ${trustScoreCount} trust scores calculated`);
  }

  async run() {
    console.log('\n🚀 Starting Realistic Data Generation');
    console.log('=====================================');
    console.log(`Users: ${CONFIG.USERS}`);
    console.log(`Communities: ${CONFIG.COMMUNITIES}`);
    console.log(`Timeline: ${CONFIG.TIMELINE_DAYS} days`);
    console.log('=====================================\n');

    try {
      await this.initialize();
      await this.generateUsers();
      await this.generateCommunities();
      await this.generateCommunityMembers();
      await this.generateInvitations();
      await this.generateRequests();
      await this.generateOffersAndMatches();
      await this.generateFeedbackAndKarma();

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
