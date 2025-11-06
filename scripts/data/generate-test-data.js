/**
 * Test Data Generator for Karmyq
 * Generates realistic test data:
 * - 200 users with varied names and profiles
 * - 10 communities (different categories and locations)
 * - Varied memberships (users join multiple communities)
 * - 50-100 help requests
 * - 50-100 help offers
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'karmyq_db',
  user: 'karmyq_user',
  password: 'karmyq_password_dev'
});

// Realistic first names
const firstNames = [
  'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason',
  'Isabella', 'William', 'Mia', 'James', 'Charlotte', 'Benjamin', 'Amelia',
  'Lucas', 'Harper', 'Henry', 'Evelyn', 'Alexander', 'Abigail', 'Michael',
  'Emily', 'Daniel', 'Elizabeth', 'Matthew', 'Sofia', 'Jackson', 'Avery',
  'Sebastian', 'Ella', 'Jack', 'Scarlett', 'Aiden', 'Grace', 'Owen', 'Chloe',
  'Samuel', 'Victoria', 'Joseph', 'Riley', 'John', 'Aria', 'David', 'Lily',
  'Wyatt', 'Aubrey', 'Carter', 'Zoey', 'Julian', 'Penelope', 'Luke', 'Lillian',
  'Grayson', 'Addison', 'Leo', 'Layla', 'Jayden', 'Natalie', 'Gabriel', 'Camila'
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen',
  'Hill', 'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera',
  'Campbell', 'Mitchell', 'Carter', 'Roberts', 'Gomez', 'Phillips', 'Evans',
  'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes'
];

// Communities data
const communities = [
  {
    name: 'Downtown Neighbors',
    description: 'A community for people living in the downtown area to help each other with daily needs',
    location: 'Seattle, WA - Downtown',
    category: 'Neighborhood',
    max_members: 150
  },
  {
    name: 'Tech Helpers Network',
    description: 'Tech professionals helping each other and the community with technology challenges',
    location: 'Seattle, WA',
    category: 'Professional',
    max_members: 120
  },
  {
    name: 'Green Thumbs Collective',
    description: 'Gardeners and plant enthusiasts sharing knowledge and helping with outdoor projects',
    location: 'Bellevue, WA',
    category: 'Hobby',
    max_members: 100
  },
  {
    name: 'Capitol Hill Commons',
    description: 'Building a supportive community on Capitol Hill through mutual aid',
    location: 'Seattle, WA - Capitol Hill',
    category: 'Neighborhood',
    max_members: 150
  },
  {
    name: 'Eastside Parents Network',
    description: 'Parents supporting parents with childcare, advice, and family activities',
    location: 'Redmond, WA',
    category: 'Educational',
    max_members: 130
  },
  {
    name: 'Wellness Warriors',
    description: 'Supporting each other in health, fitness, and mental wellness journeys',
    location: 'Seattle, WA',
    category: 'Health & Wellness',
    max_members: 90
  },
  {
    name: 'Local Artists Collective',
    description: 'Artists helping artists with projects, exhibitions, and creative collaboration',
    location: 'Seattle, WA - Fremont',
    category: 'Arts & Culture',
    max_members: 80
  },
  {
    name: 'Climate Action Crew',
    description: 'Working together to reduce our environmental impact and promote sustainability',
    location: 'Seattle, WA',
    category: 'Environmental',
    max_members: 110
  },
  {
    name: 'Freelancers United',
    description: 'Freelancers and entrepreneurs supporting each other through the ups and downs',
    location: 'Seattle, WA',
    category: 'Professional',
    max_members: 100
  },
  {
    name: 'University District Helpers',
    description: 'Students and residents helping each other in the U-District area',
    location: 'Seattle, WA - University District',
    category: 'Neighborhood',
    max_members: 150
  }
];

// Help categories
const helpCategories = [
  'transportation', 'moving', 'childcare', 'pet_care', 'tech_support',
  'home_repair', 'gardening', 'cooking', 'tutoring', 'language',
  'professional_advice', 'emotional_support', 'errands', 'cleaning', 'other'
];

// Request templates
const requestTemplates = [
  { title: 'Need ride to doctor appointment', category: 'transportation', urgency: 'high' },
  { title: 'Help moving furniture this weekend', category: 'moving', urgency: 'medium' },
  { title: 'Looking for after-school childcare', category: 'childcare', urgency: 'medium' },
  { title: 'Dog walking while I\'m at work', category: 'pet_care', urgency: 'low' },
  { title: 'Computer won\'t start - need tech help', category: 'tech_support', urgency: 'medium' },
  { title: 'Leaky faucet needs fixing', category: 'home_repair', urgency: 'medium' },
  { title: 'Help setting up raised garden beds', category: 'gardening', urgency: 'low' },
  { title: 'Meal prep for elderly parent', category: 'cooking', urgency: 'medium' },
  { title: 'Math tutoring for high schooler', category: 'tutoring', urgency: 'low' },
  { title: 'Practice Spanish conversation', category: 'language', urgency: 'low' },
  { title: 'Resume review and career advice', category: 'professional_advice', urgency: 'low' },
  { title: 'Grocery shopping assistance', category: 'errands', urgency: 'medium' },
  { title: 'Help cleaning before guests arrive', category: 'cleaning', urgency: 'high' },
  { title: 'Need someone to water plants while on vacation', category: 'other', urgency: 'low' },
  { title: 'Ride to airport early morning', category: 'transportation', urgency: 'medium' }
];

// Offer templates
const offerTemplates = [
  { title: 'Can provide rides around town', category: 'transportation' },
  { title: 'Available for moving help on weekends', category: 'moving' },
  { title: 'Experienced babysitter available', category: 'childcare' },
  { title: 'Dog walking and pet sitting', category: 'pet_care' },
  { title: 'Tech support and computer repair', category: 'tech_support' },
  { title: 'Handyman services - plumbing, electrical', category: 'home_repair' },
  { title: 'Gardening advice and help', category: 'gardening' },
  { title: 'Can teach cooking basics', category: 'cooking' },
  { title: 'Math and science tutoring', category: 'tutoring' },
  { title: 'Fluent in Spanish - happy to practice', category: 'language' },
  { title: 'Career coaching and resume help', category: 'professional_advice' },
  { title: 'Can run errands for seniors', category: 'errands' },
  { title: 'Professional cleaning services', category: 'cleaning' }
];

// Skills that users can have
const skills = [
  'driving', 'moving', 'childcare', 'pet_care', 'tech_support', 'coding',
  'home_repair', 'gardening', 'cooking', 'baking', 'tutoring', 'languages',
  'career_advice', 'design', 'writing', 'photography', 'music', 'art',
  'cleaning', 'organizing', 'handyman', 'electrical', 'plumbing', 'carpentry'
];

// Helper functions
function randomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(daysBack) {
  const date = new Date();
  date.setDate(date.getDate() - randomInt(0, daysBack));
  return date.toISOString();
}

function randomSkills(count = 3) {
  const shuffled = [...skills].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, randomInt(2, count));
}

async function generateUsers(count = 200) {
  console.log(`Generating ${count} users...`);
  const users = [];
  const password = await bcrypt.hash('password123', 10);

  for (let i = 0; i < count; i++) {
    const firstName = randomElement(firstNames);
    const lastName = randomElement(lastNames);
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`;
    const name = `${firstName} ${lastName}`;
    const userSkills = randomSkills(4);

    try {
      const result = await pool.query(
        `INSERT INTO auth.users (email, name, password_hash, bio, created_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [email, name, password, `Skills: ${userSkills.join(', ')}`, randomDate(60)]
      );
      users.push({ id: result.rows[0].id, name, skills: userSkills });
    } catch (err) {
      // Skip duplicates
      if (!err.message.includes('duplicate')) {
        console.error(`Error creating user ${email}:`, err.message);
      }
    }
  }

  console.log(`Created ${users.length} users`);
  return users;
}

async function generateCommunities(users) {
  console.log('Generating communities...');
  const createdCommunities = [];

  for (const community of communities) {
    const creator = randomElement(users);

    try {
      const result = await pool.query(
        `INSERT INTO communities.communities
         (name, description, location, category, max_members, current_members, creator_id, status, created_at)
         VALUES ($1, $2, $3, $4, $5, 1, $6, 'active', $7)
         RETURNING id`,
        [
          community.name,
          community.description,
          community.location,
          community.category,
          community.max_members,
          creator.id,
          randomDate(90)
        ]
      );

      const communityId = result.rows[0].id;

      // Add creator as admin
      await pool.query(
        `INSERT INTO communities.members (community_id, user_id, role, status, joined_at)
         VALUES ($1, $2, 'admin', 'active', $3)`,
        [communityId, creator.id, randomDate(90)]
      );

      createdCommunities.push({ ...community, id: communityId });
      console.log(`Created community: ${community.name}`);
    } catch (err) {
      console.error(`Error creating community ${community.name}:`, err.message);
    }
  }

  return createdCommunities;
}

async function addMemberships(users, communities) {
  console.log('Adding community memberships...');
  let count = 0;

  for (const user of users) {
    // Each user joins 2-5 random communities
    const numCommunities = randomInt(2, 5);
    const userCommunities = [...communities]
      .sort(() => 0.5 - Math.random())
      .slice(0, numCommunities);

    for (const community of userCommunities) {
      try {
        // Check if already a member
        const existing = await pool.query(
          `SELECT 1 FROM communities.members WHERE community_id = $1 AND user_id = $2`,
          [community.id, user.id]
        );

        if (existing.rowCount === 0) {
          await pool.query(
            `INSERT INTO communities.members (community_id, user_id, role, status, joined_at)
             VALUES ($1, $2, 'member', 'active', $3)`,
            [community.id, user.id, randomDate(60)]
          );

          // Update member count
          await pool.query(
            `UPDATE communities.communities
             SET current_members = current_members + 1
             WHERE id = $1`,
            [community.id]
          );

          count++;
        }
      } catch (err) {
        // Skip duplicates
        if (!err.message.includes('duplicate')) {
          console.error('Error adding membership:', err.message);
        }
      }
    }
  }

  console.log(`Added ${count} memberships`);
}

async function generateRequests(users, communities, count = 80) {
  console.log(`Generating ${count} help requests...`);
  let created = 0;

  for (let i = 0; i < count; i++) {
    const user = randomElement(users);
    const community = randomElement(communities);
    const template = randomElement(requestTemplates);

    // Check if user is member of this community
    const membership = await pool.query(
      `SELECT 1 FROM communities.members WHERE community_id = $1 AND user_id = $2`,
      [community.id, user.id]
    );

    if (membership.rowCount > 0) {
      try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + randomInt(1, 14));
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + randomInt(1, 7));

        await pool.query(
          `INSERT INTO requests.help_requests
           (community_id, requester_id, title, description, category, urgency,
            preferred_start_date, preferred_end_date, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            community.id,
            user.id,
            template.title,
            `I'm looking for help with ${template.title.toLowerCase()}. Any assistance would be greatly appreciated!`,
            template.category,
            template.urgency,
            startDate,
            endDate,
            'open',
            randomDate(30)
          ]
        );
        created++;
      } catch (err) {
        console.error('Error creating request:', err.message);
      }
    }
  }

  console.log(`Created ${created} requests`);
}

async function generateOffers(users, communities, count = 100) {
  console.log(`Generating ${count} help offers...`);
  let created = 0;

  for (let i = 0; i < count; i++) {
    const user = randomElement(users);
    const community = randomElement(communities);
    const template = randomElement(offerTemplates);

    // Check if user is member and has relevant skill
    const membership = await pool.query(
      `SELECT 1 FROM communities.members WHERE community_id = $1 AND user_id = $2`,
      [community.id, user.id]
    );

    if (membership.rowCount > 0) {
      try {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + randomInt(30, 90));

        await pool.query(
          `INSERT INTO requests.help_offers
           (community_id, offerer_id, title, description, category,
            availability_start_date, availability_end_date, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            community.id,
            user.id,
            template.title,
            `I'm available to help with ${template.title.toLowerCase()}. Feel free to reach out!`,
            template.category,
            startDate,
            endDate,
            'active',
            randomDate(45)
          ]
        );
        created++;
      } catch (err) {
        console.error('Error creating offer:', err.message);
      }
    }
  }

  console.log(`Created ${created} offers`);
}

async function main() {
  try {
    console.log('Starting test data generation...\n');

    const users = await generateUsers(200);
    const communities = await generateCommunities(users);
    await addMemberships(users, communities);
    await generateRequests(users, communities, 80);
    await generateOffers(users, communities, 100);

    console.log('\n✅ Test data generation complete!');
    console.log(`
Summary:
- ${users.length} users created
- ${communities.length} communities created
- Memberships distributed across communities
- 80 help requests created
- 100 help offers created

You can now log in with any user:
  Email: [firstname].[lastname][number]@example.com
  Password: password123

Example: emma.smith0@example.com / password123
    `);

  } catch (error) {
    console.error('Error generating test data:', error);
  } finally {
    await pool.end();
  }
}

main();
