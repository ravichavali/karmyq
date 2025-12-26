/**
 * Populate fresh database with comprehensive test data
 * Creates users, communities, requests, offers, and matches via API
 */

const http = require('http');

const API = {
  AUTH: 'http://localhost:3001',
  COMMUNITY: 'http://localhost:3002',
  REQUEST: 'http://localhost:3003'
};

// Helper to make HTTP requests
function request(url, method, data, token = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

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
          reject(new Error(`Parse error: ${e.message}, body: ${body}`));
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Register a new user
async function registerUser(email, name, password = 'password123') {
  try {
    const result = await request(`${API.AUTH}/auth/register`, 'POST', { email, name, password });
    return result.data;
  } catch (e) {
    console.error(`Failed to register ${email}:`, e.message);
    return null;
  }
}

// Login user
async function login(email, password = 'password123') {
  const result = await request(`${API.AUTH}/auth/login`, 'POST', { email, password });
  return result.data.token;
}

// Create community
async function createCommunity(token, name, description, location = 'Test City', category = 'general') {
  const result = await request(`${API.COMMUNITY}/communities`, 'POST',
    { name, description, location, category }, token);
  return result.data || result.community;
}

// Join community
async function joinCommunity(token, inviteCode) {
  try {
    const result = await request(`${API.COMMUNITY}/communities/join`, 'POST',
      { invite_code: inviteCode }, token);
    return result.data || result;
  } catch (e) {
    console.error('Failed to join community:', e.message);
    return null;
  }
}

// Create request
async function createRequest(token, communityId, title, description, request_type, urgency = 'medium') {
  try {
    const result = await request(`${API.REQUEST}/requests`, 'POST',
      { community_id: communityId, title, description, request_type, urgency }, token);
    return result.data;
  } catch (e) {
    console.error('Failed to create request:', e.message);
    return null;
  }
}

// Get user ID from token by decoding JWT (simple base64 decode of middle section)
function getUserIdFromToken(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload.userId;
  } catch (e) {
    return null;
  }
}

// Create offer
async function createOffer(token, communityId, title, description, type) {
  try {
    const offerer_id = getUserIdFromToken(token);
    if (!offerer_id) {
      console.error('Failed to extract user ID from token');
      return null;
    }
    const result = await request(`${API.REQUEST}/offers`, 'POST',
      { community_id: communityId, offerer_id, title, description, type }, token);
    return result.data;
  } catch (e) {
    console.error('Failed to create offer:', e.message);
    return null;
  }
}

async function main() {
  console.log('🚀 Populating fresh database with test data...\n');

  // Step 1: Create test users
  console.log('👥 Creating test users...');
  const users = [
    { email: 'alice@test.com', name: 'Alice Johnson' },
    { email: 'bob@test.com', name: 'Bob Smith' },
    { email: 'charlie@test.com', name: 'Charlie Brown' },
    { email: 'diana@test.com', name: 'Diana Prince' },
    { email: 'eve@test.com', name: 'Eve Davis' },
    { email: 'frank@test.com', name: 'Frank Miller' },
    { email: 'grace@test.com', name: 'Grace Lee' },
    { email: 'henry@test.com', name: 'Henry Wilson' }
  ];

  const createdUsers = [];
  for (const user of users) {
    const created = await registerUser(user.email, user.name);
    if (created) {
      createdUsers.push({ ...user, ...created });
      console.log(`  ✓ Created ${user.name}`);
    }
  }
  console.log(`✅ Created ${createdUsers.length} users\n`);

  // Step 2: Create communities
  console.log('🏘️  Creating communities...');
  const aliceToken = await login('alice@test.com');
  const bobToken = await login('bob@test.com');
  const charlieToken = await login('charlie@test.com');

  const communities = [
    {
      token: aliceToken,
      name: 'Downtown Helpers',
      description: 'Community for downtown residents',
      location: 'Downtown',
      category: 'neighborhood'
    },
    {
      token: bobToken,
      name: 'Tech Support Group',
      description: 'Help each other with tech problems',
      location: 'Online',
      category: 'tech'
    },
    {
      token: charlieToken,
      name: 'Green Gardeners',
      description: 'Share gardening tips and tools',
      location: 'Westside',
      category: 'hobby'
    }
  ];

  const createdCommunities = [];
  for (const comm of communities) {
    const created = await createCommunity(comm.token, comm.name, comm.description, comm.location, comm.category);
    createdCommunities.push({ ...comm, ...created });
    console.log(`  ✓ Created "${comm.name}"`);
  }
  console.log(`✅ Created ${createdCommunities.length} communities\n`);

  // Step 3: Have other users join communities
  console.log('🤝 Adding members to communities...');
  const tokens = {
    diana: await login('diana@test.com'),
    eve: await login('eve@test.com'),
    frank: await login('frank@test.com'),
    grace: await login('grace@test.com'),
    henry: await login('henry@test.com')
  };

  // Join Downtown Helpers
  await joinCommunity(tokens.diana, createdCommunities[0].invite_code);
  await joinCommunity(tokens.eve, createdCommunities[0].invite_code);
  console.log(`  ✓ 2 users joined Downtown Helpers`);

  // Join Tech Support Group
  await joinCommunity(tokens.frank, createdCommunities[1].invite_code);
  await joinCommunity(tokens.grace, createdCommunities[1].invite_code);
  console.log(`  ✓ 2 users joined Tech Support Group`);

  // Join Green Gardeners
  await joinCommunity(tokens.henry, createdCommunities[2].invite_code);
  await joinCommunity(tokens.diana, createdCommunities[2].invite_code);
  console.log(`  ✓ 2 users joined Green Gardeners\n`);

  // Step 4: Create diverse requests
  console.log('📝 Creating help requests...');
  const requests = [
    // Downtown Helpers requests
    { token: aliceToken, communityId: createdCommunities[0].id, title: 'Need help moving furniture', description: 'Moving a couch to 3rd floor', request_type: 'generic', urgency: 'medium' },
    { token: tokens.diana, communityId: createdCommunities[0].id, title: 'Ride to airport needed', description: 'Flight at 6am, need ride from downtown', request_type: 'generic', urgency: 'high' },
    { token: tokens.eve, communityId: createdCommunities[0].id, title: 'Dog walking help', description: 'Need someone to walk my dog this week', request_type: 'generic', urgency: 'low' },

    // Tech Support Group requests
    { token: bobToken, communityId: createdCommunities[1].id, title: 'Laptop won\'t start', description: 'Need help troubleshooting hardware issue', request_type: 'generic', urgency: 'high' },
    { token: tokens.frank, communityId: createdCommunities[1].id, title: 'Learn Python basics', description: 'Want to learn programming, need tutor', request_type: 'generic', urgency: 'low' },
    { token: tokens.grace, communityId: createdCommunities[1].id, title: 'WiFi setup help', description: 'New router, need help configuring', request_type: 'generic', urgency: 'medium' },

    // Green Gardeners requests
    { token: charlieToken, communityId: createdCommunities[2].id, title: 'Borrow lawn mower', description: 'Need for weekend yard work', request_type: 'generic', urgency: 'low' },
    { token: tokens.henry, communityId: createdCommunities[2].id, title: 'Garden cleanup help', description: 'Spring cleanup, heavy lifting involved', request_type: 'generic', urgency: 'medium' },
    { token: tokens.diana, communityId: createdCommunities[2].id, title: 'Vegetable garden advice', description: 'First time growing tomatoes', request_type: 'generic', urgency: 'low' }
  ];

  let requestCount = 0;
  for (const req of requests) {
    const created = await createRequest(req.token, req.communityId, req.title, req.description, req.request_type, req.urgency);
    if (created) {
      requestCount++;
      console.log(`  ✓ Created: "${req.title}"`);
    }
  }
  console.log(`✅ Created ${requestCount} requests\n`);

  // Step 5: Create offers
  console.log('🎁 Creating help offers...');
  const offers = [
    { token: tokens.eve, communityId: createdCommunities[0].id, title: 'Can help with moving', description: 'Have a truck, available weekends', type: 'moving' },
    { token: tokens.diana, communityId: createdCommunities[0].id, title: 'Airport rides available', description: 'Flexible schedule, can drive to airport', type: 'transport' },
    { token: tokens.grace, communityId: createdCommunities[1].id, title: 'Tech support available', description: 'IT professional, happy to help with computer issues', type: 'tech_support' },
    { token: bobToken, communityId: createdCommunities[1].id, title: 'Python tutoring', description: 'Software engineer, can teach programming basics', type: 'tutoring' },
    { token: tokens.henry, communityId: createdCommunities[2].id, title: 'Garden tools to lend', description: 'Have lawn mower, trimmer, and other tools', type: 'tools' },
    { token: charlieToken, communityId: createdCommunities[2].id, title: 'Gardening help offered', description: '20 years experience, love helping new gardeners', type: 'gardening' }
  ];

  let offerCount = 0;
  for (const offer of offers) {
    const created = await createOffer(offer.token, offer.communityId, offer.title, offer.description, offer.type);
    if (created) {
      offerCount++;
      console.log(`  ✓ Created: "${offer.title}"`);
    }
  }
  console.log(`✅ Created ${offerCount} offers\n`);

  console.log('🎉 Database population complete!');
  console.log('\n📊 Summary:');
  console.log(`   Users: ${createdUsers.length}`);
  console.log(`   Communities: ${createdCommunities.length}`);
  console.log(`   Requests: ${requestCount}`);
  console.log(`   Offers: ${offerCount}`);
  console.log('\n✨ You can now log in with any of these users (password: password123):');
  createdUsers.slice(0, 3).forEach(u => console.log(`   - ${u.email}`));
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
