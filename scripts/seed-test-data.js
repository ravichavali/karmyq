const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// Database connection
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'karmyq_db',
  user: process.env.POSTGRES_USER || 'karmyq_user',
  password: process.env.POSTGRES_PASSWORD || 'karmyq_password_dev',
});

// US Cities data for national distribution
const US_CITIES = [
  { city: 'New York', state: 'NY', region: 'Northeast', population: 8336817 },
  { city: 'Los Angeles', state: 'CA', region: 'West', population: 3979576 },
  { city: 'Chicago', state: 'IL', region: 'Midwest', population: 2693976 },
  { city: 'Houston', state: 'TX', region: 'South', population: 2320268 },
  { city: 'Phoenix', state: 'AZ', region: 'West', population: 1680992 },
  { city: 'Philadelphia', state: 'PA', region: 'Northeast', population: 1584064 },
  { city: 'San Antonio', state: 'TX', region: 'South', population: 1547253 },
  { city: 'San Diego', state: 'CA', region: 'West', population: 1423851 },
  { city: 'Dallas', state: 'TX', region: 'South', population: 1343573 },
  { city: 'San Jose', state: 'CA', region: 'West', population: 1021795 },
  { city: 'Austin', state: 'TX', region: 'South', population: 978908 },
  { city: 'Jacksonville', state: 'FL', region: 'South', population: 911507 },
  { city: 'Fort Worth', state: 'TX', region: 'South', population: 909585 },
  { city: 'Columbus', state: 'OH', region: 'Midwest', population: 898553 },
  { city: 'Charlotte', state: 'NC', region: 'South', population: 885708 },
  { city: 'San Francisco', state: 'CA', region: 'West', population: 881549 },
  { city: 'Indianapolis', state: 'IN', region: 'Midwest', population: 876384 },
  { city: 'Seattle', state: 'WA', region: 'West', population: 753675 },
  { city: 'Denver', state: 'CO', region: 'West', population: 727211 },
  { city: 'Boston', state: 'MA', region: 'Northeast', population: 692600 },
  { city: 'Nashville', state: 'TN', region: 'South', population: 689447 },
  { city: 'Detroit', state: 'MI', region: 'Midwest', population: 672662 },
  { city: 'Portland', state: 'OR', region: 'West', population: 652503 },
  { city: 'Las Vegas', state: 'NV', region: 'West', population: 641676 },
  { city: 'Memphis', state: 'TN', region: 'South', population: 633104 },
  { city: 'Louisville', state: 'KY', region: 'South', population: 633045 },
  { city: 'Baltimore', state: 'MD', region: 'South', population: 585708 },
  { city: 'Milwaukee', state: 'WI', region: 'Midwest', population: 577222 },
  { city: 'Albuquerque', state: 'NM', region: 'West', population: 564559 },
  { city: 'Tucson', state: 'AZ', region: 'West', population: 548073 },
  { city: 'Fresno', state: 'CA', region: 'West', population: 542107 },
  { city: 'Mesa', state: 'AZ', region: 'West', population: 518012 },
  { city: 'Sacramento', state: 'CA', region: 'West', population: 513624 },
  { city: 'Atlanta', state: 'GA', region: 'South', population: 498715 },
  { city: 'Kansas City', state: 'MO', region: 'Midwest', population: 495327 },
  { city: 'Colorado Springs', state: 'CO', region: 'West', population: 478961 },
  { city: 'Miami', state: 'FL', region: 'South', population: 467963 },
  { city: 'Raleigh', state: 'NC', region: 'South', population: 467665 },
  { city: 'Omaha', state: 'NE', region: 'Midwest', population: 486051 },
  { city: 'Minneapolis', state: 'MN', region: 'Midwest', population: 425336 },
];

// Community types and categories
const COMMUNITY_TYPES = [
  { type: 'Neighborhood', categories: ['Local Help', 'Community Events', 'Safety Watch', 'Garden Share'] },
  { type: 'Professional', categories: ['Tech Support', 'Career Mentoring', 'Freelance Network', 'Business Connect'] },
  { type: 'Interest', categories: ['Book Club', 'Gaming Group', 'Fitness Buddies', 'Food Enthusiasts'] },
  { type: 'Support', categories: ['Mental Health', 'Parents Support', 'Pet Care', 'Senior Care'] },
  { type: 'Education', categories: ['Study Group', 'Language Exchange', 'Skill Share', 'Tutoring Network'] },
  { type: 'Civic', categories: ['Volunteer Corps', 'Political Action', 'Environmental', 'Public Services'] },
];

// First names pool
const FIRST_NAMES = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth',
  'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Christopher', 'Karen',
  'Charles', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra',
  'Donald', 'Ashley', 'Steven', 'Kimberly', 'Andrew', 'Emily', 'Paul', 'Donna', 'Joshua', 'Michelle',
  'Kenneth', 'Carol', 'Kevin', 'Amanda', 'Brian', 'Dorothy', 'George', 'Melissa', 'Timothy', 'Deborah',
  'Ronald', 'Stephanie', 'Jason', 'Rebecca', 'Edward', 'Sharon', 'Jeffrey', 'Laura', 'Ryan', 'Cynthia',
  'Jacob', 'Kathleen', 'Gary', 'Amy', 'Nicholas', 'Angela', 'Eric', 'Shirley', 'Jonathan', 'Anna',
  'Stephen', 'Brenda', 'Larry', 'Pamela', 'Justin', 'Emma', 'Scott', 'Nicole', 'Brandon', 'Helen',
  'Benjamin', 'Samantha', 'Samuel', 'Katherine', 'Raymond', 'Christine', 'Patrick', 'Debra', 'Alexander', 'Rachel',
  'Jack', 'Carolyn', 'Dennis', 'Janet', 'Jerry', 'Catherine', 'Tyler', 'Maria', 'Aaron', 'Heather',
];

// Last names pool
const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
  'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes',
  'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper',
  'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson',
  'Watson', 'Brooks', 'Chavez', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza', 'Ruiz', 'Hughes',
  'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel', 'Myers', 'Long', 'Ross', 'Foster', 'Jimenez',
];

// Helper functions
function randomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateEmail(firstName, lastName, city) {
  const providers = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];
  const cityPrefix = city.toLowerCase().replace(/\s+/g, '');
  const num = randomInt(1, 999);
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${num}@${randomElement(providers)}`;
}

function generateCommunityName(city, state, type, category) {
  const patterns = [
    `${city} ${category}`,
    `${state} ${category} Network`,
    `${category} - ${city}`,
    `${city} ${type} ${category}`,
    `Greater ${city} ${category}`,
  ];
  return randomElement(patterns);
}

function generateCommunityDescription(category, city) {
  const descriptions = {
    'Local Help': `A community for ${city} neighbors to help each other with everyday tasks and build stronger local connections.`,
    'Community Events': `Connect with fellow ${city} residents and stay informed about local events, gatherings, and activities.`,
    'Safety Watch': `Dedicated to keeping ${city} neighborhoods safe through community vigilance and mutual support.`,
    'Garden Share': `Share gardening tips, seeds, and produce with fellow ${city} green thumbs.`,
    'Tech Support': `Get help with technology challenges from experienced ${city} tech professionals.`,
    'Career Mentoring': `Connect with mentors and mentees in ${city} to advance your career goals.`,
    'Freelance Network': `A network of ${city} freelancers supporting each other with projects and advice.`,
    'Business Connect': `Entrepreneurs and business owners in ${city} connecting for collaboration and growth.`,
    'Book Club': `Book lovers in ${city} sharing recommendations and discussing great reads.`,
    'Gaming Group': `Gamers in ${city} connecting for multiplayer sessions and gaming discussions.`,
    'Fitness Buddies': `Find workout partners and fitness motivation in the ${city} community.`,
    'Food Enthusiasts': `Share recipes, restaurant recommendations, and culinary adventures in ${city}.`,
    'Mental Health': `A supportive space for ${city} residents to discuss mental health and wellness.`,
    'Parents Support': `Parents in ${city} supporting each other through the challenges of raising children.`,
    'Pet Care': `Pet owners in ${city} sharing advice, organizing playdates, and helping each other.`,
    'Senior Care': `Supporting seniors and caregivers in the ${city} community.`,
    'Study Group': `Students in ${city} collaborating on coursework and academic goals.`,
    'Language Exchange': `Practice and learn new languages with fellow ${city} residents.`,
    'Skill Share': `Share your skills and learn from others in the ${city} community.`,
    'Tutoring Network': `Connect tutors with students in ${city} for academic support.`,
    'Volunteer Corps': `Organize and participate in volunteer activities across ${city}.`,
    'Political Action': `Engage in civic discourse and political action in ${city}.`,
    'Environmental': `Environmental activists in ${city} working together for sustainability.`,
    'Public Services': `Connecting ${city} residents with public services and community resources.`,
  };
  return descriptions[category] || `A ${category} community in ${city} for mutual aid and support.`;
}

async function seedTestData() {
  const client = await pool.connect();

  try {
    console.log('🌱 Starting test data generation...\n');

    await client.query('BEGIN');

    // 1. Create 2000 test users distributed across US cities
    console.log('👥 Creating 2000 test users...');
    const users = [];
    const hashedPassword = await bcrypt.hash('password123', 10);

    for (let i = 0; i < 2000; i++) {
      const city = randomElement(US_CITIES);
      const firstName = randomElement(FIRST_NAMES);
      const lastName = randomElement(LAST_NAMES);
      const email = generateEmail(firstName, lastName, city.city);

      const result = await client.query(
        `INSERT INTO auth.users (name, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, name, email`,
        [`${firstName} ${lastName}`, email, hashedPassword]
      );

      users.push({
        ...result.rows[0],
        city: city.city,
        state: city.state,
        region: city.region,
        location: `${city.city}, ${city.state}`, // Store in memory for request descriptions
      });

      if ((i + 1) % 200 === 0) {
        console.log(`   Created ${i + 1}/2000 users...`);
      }
    }
    console.log(`✅ Created ${users.length} users\n`);

    // 2. Create 200 communities distributed across cities and categories
    console.log('🏘️  Creating 200 communities...');
    const communities = [];

    for (let i = 0; i < 200; i++) {
      const city = randomElement(US_CITIES);
      const communityType = randomElement(COMMUNITY_TYPES);
      const category = randomElement(communityType.categories);
      const name = generateCommunityName(city.city, city.state, communityType.type, category);
      const description = generateCommunityDescription(category, city.city);
      const maxMembers = randomInt(20, 200);
      const accessType = Math.random() > 0.7 ? 'private' : 'public';

      // Find a creator from the same city
      const cityUsers = users.filter(u => u.city === city.city);
      const creator = cityUsers.length > 0 ? randomElement(cityUsers) : randomElement(users);

      const result = await client.query(
        `INSERT INTO communities.communities (name, description, creator_id, max_members, access_type)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, creator_id, max_members, access_type`,
        [name, description, creator.id, maxMembers, accessType]
      );

      communities.push({
        ...result.rows[0],
        city: city.city,
        state: city.state,
        category: category,
        type: communityType.type,
      });

      if ((i + 1) % 50 === 0) {
        console.log(`   Created ${i + 1}/200 communities...`);
      }
    }
    console.log(`✅ Created ${communities.length} communities\n`);

    // 3. Add members to communities (each user joins 2-8 communities)
    console.log('🤝 Adding community memberships...');
    let membershipCount = 0;

    for (const user of users) {
      const numCommunities = randomInt(2, 8);
      // Prefer communities from same city/region
      const cityCommunities = communities.filter(c => c.city === user.city);
      const regionCommunities = communities.filter(c => c.state === user.state);
      const availableCommunities = cityCommunities.length > 0 ? cityCommunities :
                                    regionCommunities.length > 0 ? regionCommunities :
                                    communities;

      const shuffled = [...availableCommunities].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, Math.min(numCommunities, availableCommunities.length));

      for (const community of selected) {
        // Check if community is not full
        const countResult = await client.query(
          `SELECT COUNT(*) as count FROM communities.members WHERE community_id = $1`,
          [community.id]
        );

        const currentMembers = parseInt(countResult.rows[0].count);
        if (currentMembers < community.max_members) {
          const role = community.creator_id === user.id ? 'admin' : 'member';

          await client.query(
            `INSERT INTO communities.members (user_id, community_id, role)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, community_id) DO NOTHING`,
            [user.id, community.id, role]
          );

          membershipCount++;
        }
      }

      if (users.indexOf(user) % 200 === 0) {
        console.log(`   Processed ${users.indexOf(user)}/2000 users...`);
      }
    }
    console.log(`✅ Created ${membershipCount} memberships\n`);

    // Update current_members count for all communities
    console.log('🔄 Updating community member counts...');
    await client.query(`
      UPDATE communities.communities c
      SET current_members = (
        SELECT COUNT(*)
        FROM communities.members m
        WHERE m.community_id = c.id AND m.status = 'active'
      )
    `);
    console.log(`✅ Updated member counts for all communities\n`);

    // 4. Create help requests (10% of users create 1-3 requests)
    console.log('📝 Creating help requests...');
    const requestTitles = [
      'Need help moving furniture',
      'Looking for pet sitter this weekend',
      'Can someone help with lawn mowing?',
      'Need a ride to the airport',
      'Looking for tutoring in math',
      'Need help with computer repair',
      'Looking for baby sitter',
      'Need help with grocery shopping',
      'Can someone help fix a leaky faucet?',
      'Looking for someone to walk my dog',
      'Need help with resume review',
      'Looking for meal prep assistance',
      'Need help setting up WiFi',
      'Can someone help with painting a room?',
      'Looking for gardening advice',
    ];

    let requestCount = 0;
    const requestCreators = users.slice(0, Math.floor(users.length * 0.1)); // 10% of users

    for (const user of requestCreators) {
      const numRequests = randomInt(1, 3);

      // Get user's communities
      const membershipResult = await client.query(
        `SELECT community_id FROM communities.members WHERE user_id = $1`,
        [user.id]
      );

      if (membershipResult.rows.length === 0) continue;

      for (let i = 0; i < numRequests; i++) {
        const membership = randomElement(membershipResult.rows);
        const title = randomElement(requestTitles);
        const categories = ['household', 'pet_care', 'transportation', 'education', 'technical', 'childcare', 'errands', 'professional', 'food'];
        const category = randomElement(categories);

        // Generate varied descriptions based on category
        const descriptionTemplates = {
          household: [
            `Need help moving some furniture this weekend. I'm in ${user.location}. Have a couch and dining table that need to go upstairs.`,
            `Looking for someone to help with yard work. I'm located in ${user.location}. Mainly need help raking leaves and trimming hedges.`,
            `Could use a hand with some painting. I'm in ${user.location}. Have 2 bedrooms that need fresh coats.`,
            `Need help assembling IKEA furniture. Located in ${user.location}. Instructions are in Swedish and I'm lost!`,
          ],
          pet_care: [
            `Need someone to walk my dog this Thursday. I'm in ${user.location}. She's a friendly golden retriever who loves long walks.`,
            `Looking for cat sitting help next week. Located in ${user.location}. Just need feeding and litter box cleaning once a day.`,
            `Can anyone help with pet transportation to vet? I'm in ${user.location} and don't have a car.`,
          ],
          transportation: [
            `Need a ride to the airport tomorrow morning. I'm in ${user.location}. Flight is at 8am, so would need to leave around 6am.`,
            `Looking for carpool buddy for daily commute. I'm in ${user.location} and work downtown. Can split gas costs.`,
            `Need help picking up groceries. I'm in ${user.location} and my car is in the shop.`,
          ],
          education: [
            `Looking for help with calculus homework. I'm a student in ${user.location} and struggling with derivatives.`,
            `Need a tutor for Spanish conversation practice. I'm in ${user.location} and intermediate level.`,
            `Can anyone help explain how to use Excel pivot tables? I'm in ${user.location} and have a project due.`,
          ],
          technical: [
            `Need help setting up my new router. I'm in ${user.location} and not very tech savvy.`,
            `Looking for someone to help fix my laptop. I'm in ${user.location}. It's running super slow lately.`,
            `Can anyone help me back up my phone? I'm in ${user.location} and worried about losing my photos.`,
          ],
          childcare: [
            `Need babysitter for Friday evening. I'm in ${user.location}. Two kids, ages 6 and 8, very well behaved.`,
            `Looking for someone to pick up my daughter from school. I'm in ${user.location} and have a work conflict next Tuesday.`,
            `Need help with homework supervision. I'm in ${user.location}. My son needs someone to keep him focused after school.`,
          ],
          errands: [
            `Can someone help me return items to the post office? I'm in ${user.location} and have mobility issues.`,
            `Need help picking up prescription. I'm in ${user.location} and recovering from surgery.`,
            `Looking for someone to help with grocery shopping. I'm in ${user.location} and don't drive.`,
          ],
          professional: [
            `Need help reviewing my resume. I'm in ${user.location} and applying for jobs. Would love feedback.`,
            `Looking for someone to practice interview questions with. I'm in ${user.location} and have an interview next week.`,
            `Can anyone help with my LinkedIn profile? I'm in ${user.location} and want to improve my professional presence.`,
          ],
          food: [
            `Looking for meal prep help this Sunday. I'm in ${user.location}. Want to cook healthy meals for the week.`,
            `Need someone to teach me how to make bread. I'm in ${user.location} and all my attempts have been disasters!`,
            `Can anyone share their chili recipe? I'm in ${user.location} and hosting a potluck soon.`,
          ],
        };

        const templates = descriptionTemplates[category] || [`I need help with ${title.toLowerCase()}. I'm in ${user.location}. Would really appreciate the support!`];
        const description = randomElement(templates);
        const status = Math.random() > 0.7 ? 'completed' : Math.random() > 0.5 ? 'matched' : 'open';
        const createdDaysAgo = randomInt(0, 30);
        const createdAt = new Date(Date.now() - createdDaysAgo * 24 * 60 * 60 * 1000);

        // Insert request without community_id (new schema)
        const requestResult = await client.query(
          `INSERT INTO requests.help_requests (requester_id, title, description, category, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [user.id, title, description, category, status, createdAt]
        );

        const requestId = requestResult.rows[0].id;

        // Get all communities for this user
        const userCommunitiesResult = await client.query(
          `SELECT community_id FROM communities.members WHERE user_id = $1`,
          [user.id]
        );

        // Decide how many communities to post to (30% to all, 70% to 1-3)
        const allUserCommunities = userCommunitiesResult.rows.map(r => r.community_id);
        const numCommunities = Math.random() < 0.3 ? allUserCommunities.length : randomInt(1, Math.min(3, allUserCommunities.length));
        const selectedCommunities = allUserCommunities.slice(0, numCommunities);

        // Link request to selected communities via junction table
        for (const communityId of selectedCommunities) {
          await client.query(
            `INSERT INTO requests.request_communities (request_id, community_id, created_at)
             VALUES ($1, $2, $3)`,
            [requestId, communityId, createdAt]
          );
        }

        requestCount++;
      }
    }
    console.log(`✅ Created ${requestCount} help requests\n`);

    // 5. Generate some karma records for active users
    console.log('⭐ Generating karma records...');
    let karmaCount = 0;
    const karmaUsers = users.slice(0, Math.floor(users.length * 0.3)); // 30% of users have karma

    for (const user of karmaUsers) {
      const membershipResult = await client.query(
        `SELECT community_id FROM communities.members WHERE user_id = $1`,
        [user.id]
      );

      for (const membership of membershipResult.rows) {
        const numKarmaRecords = randomInt(1, 5);

        for (let i = 0; i < numKarmaRecords; i++) {
          const points = randomElement([5, 10, 15, 20]);
          const reasons = [
            'Helped a community member',
            'First time helping',
            'Completed a help request',
            'Active community participation',
            'Milestone achievement',
          ];
          const reason = randomElement(reasons);

          await client.query(
            `INSERT INTO reputation.karma_records (user_id, community_id, points, reason)
             VALUES ($1, $2, $3, $4)`,
            [user.id, membership.community_id, points, reason]
          );

          karmaCount++;
        }
      }
    }
    console.log(`✅ Created ${karmaCount} karma records\n`);

    await client.query('COMMIT');

    console.log('🎉 Test data generation complete!\n');
    console.log('📊 Summary:');
    console.log(`   - Users: ${users.length}`);
    console.log(`   - Communities: ${communities.length}`);
    console.log(`   - Memberships: ${membershipCount}`);
    console.log(`   - Help Requests: ${requestCount}`);
    console.log(`   - Karma Records: ${karmaCount}`);
    console.log('\n✨ All test data has been seeded successfully!');
    console.log('\n🔐 Test user credentials:');
    console.log('   Email: Any email from generated users');
    console.log('   Password: password123');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding test data:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seed script
seedTestData().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
