/**
 * Generate Large Polymorphic Dataset
 * Creates 100-500 polymorphic requests of all types
 *
 * Usage:
 *   node generate-large-dataset.js           # Creates 100 requests
 *   node generate-large-dataset.js 500       # Creates 500 requests
 */

const http = require('http');

const API = {
  AUTH: 'http://localhost:3001',
  REQUEST: 'http://localhost:3003'
};

const args = process.argv.slice(2);
const TARGET_COUNT = parseInt(args[0]) || 100;

// Helper to make HTTP requests
function request(url, method, data, token = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };

    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    if (data) {
      const body = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(result);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function login(email) {
  const result = await request(`${API.AUTH}/auth/login`, 'POST',
    { email, password: 'password123' });
  return {
    token: result.data.token,
    communities: result.data.user.communities
  };
}

// Random generators
function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(daysFromNow) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
}

function randomCoordinate() {
  return {
    lat: 37.7 + (Math.random() * 0.2 - 0.1),  // SF area
    lng: -122.4 + (Math.random() * 0.2 - 0.1)
  };
}

// Request generators
const USERS = [
  'alice@test.com', 'bob@test.com', 'charlie@test.com',
  'diana@test.com', 'eve@test.com', 'frank@test.com',
  'grace@test.com', 'henry@test.com'
];

const RIDE_TITLES = [
  'Ride to airport needed',
  'Carpool to downtown',
  'Need ride to grocery store',
  'Ride share for concert',
  'Airport pickup needed',
  'Ride to doctor appointment'
];

const SERVICE_TITLES = [
  'Plumber needed urgently',
  'Need tutoring in math',
  'Tech support for computer',
  'Guitar lessons wanted',
  'Electrician needed',
  'House cleaning service'
];

const EVENT_TITLES = [
  'Community cleanup volunteers',
  'Garden planting day',
  'Neighborhood block party',
  'Workshop volunteers needed',
  'Charity fundraiser help',
  'Sports tournament organizers'
];

const BORROW_TITLES = [
  'Need ladder for weekend',
  'Borrow camping gear',
  'Need power drill',
  'Borrow folding tables',
  'Need tent for trip',
  'Borrow sound system'
];

function generateRideRequest() {
  const origin = randomCoordinate();
  const dest = randomCoordinate();
  return {
    request_type: 'ride',
    title: randomElement(RIDE_TITLES),
    description: `Looking for a ride ${randomInt(1, 5)} days from now`,
    urgency: randomElement(['low', 'medium', 'high']),
    payload: {
      origin: {
        address: `${randomInt(100, 999)} Main St`,
        ...origin
      },
      destination: {
        address: `${randomInt(100, 999)} Market St`,
        ...dest
      },
      seats_needed: randomInt(1, 4),
      departure_time: randomDate(randomInt(1, 14))
    }
  };
}

function generateServiceRequest() {
  const categories = ['plumbing', 'electrical', 'tutoring', 'tech_support', 'cleaning', 'gardening'];
  const skills = ['beginner', 'intermediate', 'expert'];

  return {
    request_type: 'service',
    title: randomElement(SERVICE_TITLES),
    description: `Need help with ${randomElement(categories)} service`,
    urgency: randomElement(['low', 'medium', 'high']),
    payload: {
      service_category: randomElement(categories),
      skill_level_required: randomElement(skills),
      estimated_duration_hours: randomInt(1, 4),
      location_type: randomElement(['remote', 'on_site', 'hybrid'])
    }
  };
}

function generateEventRequest() {
  const types = ['volunteer', 'community_cleanup', 'workshop', 'meetup', 'social'];
  const coord = randomCoordinate();

  return {
    request_type: 'event',
    title: randomElement(EVENT_TITLES),
    description: `Join us for a community ${randomElement(types)} event`,
    urgency: randomElement(['low', 'medium', 'high']),
    payload: {
      event_type: randomElement(types),
      event_date: randomDate(randomInt(7, 30)),
      event_duration_hours: randomInt(2, 6),
      location: {
        address: `${randomInt(100, 999)} Community Center`,
        ...coord,
        is_virtual: false
      },
      participants_needed: randomInt(5, 30)
    }
  };
}

function generateBorrowRequest() {
  const categories = ['tools', 'electronics', 'kitchen', 'sports', 'camping', 'party'];

  return {
    request_type: 'borrow',
    title: randomElement(BORROW_TITLES),
    description: `Need to borrow ${randomElement(categories)} equipment`,
    urgency: randomElement(['low', 'medium', 'high']),
    payload: {
      item_category: randomElement(categories),
      duration_days: randomInt(1, 7)
    }
  };
}

function generateGenericRequest() {
  const titles = [
    'Help moving boxes',
    'Pet sitting needed',
    'Plant watering while away',
    'Package pickup needed',
    'Help assembling furniture'
  ];

  return {
    request_type: 'generic',
    title: randomElement(titles),
    description: `General help needed for ${randomElement(titles).toLowerCase()}`,
    urgency: randomElement(['low', 'medium', 'high'])
  };
}

const GENERATORS = [
  generateRideRequest,
  generateServiceRequest,
  generateEventRequest,
  generateBorrowRequest,
  generateGenericRequest
];

async function createRequest(token, communityId, requestData) {
  try {
    await request(`${API.REQUEST}/requests`, 'POST',
      { community_id: communityId, ...requestData }, token);
    return true;
  } catch (e) {
    console.error(`Failed: ${requestData.request_type} - ${e.message}`);
    return false;
  }
}

async function main() {
  console.log(`🚀 Generating ${TARGET_COUNT} polymorphic requests...\n`);

  const userSessions = [];

  // Login all users
  console.log('🔐 Logging in users...');
  for (const email of USERS) {
    try {
      const session = await login(email);
      if (session.communities.length > 0) {
        userSessions.push({ email, ...session });
      }
    } catch (e) {
      console.log(`  ⚠️  ${email} login failed`);
    }
  }
  console.log(`✅ ${userSessions.length} users logged in\n`);

  if (userSessions.length === 0) {
    console.error('❌ No users available. Run populate-fresh-database.js first.');
    return;
  }

  // Generate requests
  console.log(`📝 Creating ${TARGET_COUNT} requests...\n`);
  let created = 0;
  let failed = 0;
  const typeCount = { ride: 0, service: 0, event: 0, borrow: 0, generic: 0 };

  for (let i = 0; i < TARGET_COUNT; i++) {
    // Pick random user and community
    const user = randomElement(userSessions);
    const community = randomElement(user.communities);

    // Pick random generator
    const generator = randomElement(GENERATORS);
    const requestData = generator();

    // Create request
    const success = await createRequest(user.token, community.id, requestData);

    if (success) {
      created++;
      typeCount[requestData.request_type]++;

      // Progress indicator
      if (created % 10 === 0) {
        process.stdout.write(`\r  Progress: ${created}/${TARGET_COUNT} requests created`);
      }
    } else {
      failed++;
    }

    // Small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  console.log('\n\n🎉 Generation complete!\n');
  console.log('📊 Summary:');
  console.log(`   Total created: ${created}`);
  console.log(`   Failed: ${failed}`);
  console.log(`\n   By type:`);
  console.log(`   - Ride:    ${typeCount.ride}`);
  console.log(`   - Service: ${typeCount.service}`);
  console.log(`   - Event:   ${typeCount.event}`);
  console.log(`   - Borrow:  ${typeCount.borrow}`);
  console.log(`   - Generic: ${typeCount.generic}`);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
