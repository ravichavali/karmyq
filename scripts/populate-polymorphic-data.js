/**
 * Populate database with polymorphic test data
 * Creates examples of all 5 request types: generic, ride, service, event, borrow
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

// Login user
async function login(email, password = 'password123') {
  const result = await request(`${API.AUTH}/auth/login`, 'POST', { email, password });
  return result.data.token;
}

// Create polymorphic request
async function createPolymorphicRequest(token, communityId, requestData) {
  try {
    const result = await request(`${API.REQUEST}/requests`, 'POST',
      { community_id: communityId, ...requestData }, token);
    return result.data;
  } catch (e) {
    console.error(`Failed to create ${requestData.request_type} request:`, e.message);
    return null;
  }
}

async function main() {
  console.log('🚀 Populating database with polymorphic test data...\n');

  // Step 1: Login as existing users
  console.log('🔐 Logging in as test users...');
  const aliceToken = await login('alice@test.com');
  const bobToken = await login('bob@test.com');
  const charlieToken = await login('charlie@test.com');
  const dianaToken = await login('diana@test.com');
  const eveToken = await login('eve@test.com');
  console.log('✅ Logged in successfully\n');

  // Step 2: Get communities
  console.log('🏘️  Fetching communities...');
  const aliceData = await request(`${API.AUTH}/auth/login`, 'POST',
    { email: 'alice@test.com', password: 'password123' });
  const communities = aliceData.data.user.communities;
  console.log(`✅ Found ${communities.length} communities\n`);

  if (communities.length === 0) {
    console.error('❌ No communities found. Please run populate-fresh-database.js first.');
    return;
  }

  const downtownId = communities.find(c => c.name.includes('Downtown'))?.id;
  const techId = communities.find(c => c.name.includes('Tech'))?.id;
  const gardenId = communities.find(c => c.name.includes('Garden'))?.id;

  // Use first community if specific ones not found
  const comm1 = downtownId || communities[0].id;
  const comm2 = techId || communities[1]?.id || communities[0].id;
  const comm3 = gardenId || communities[2]?.id || communities[0].id;

  // Step 3: Create RIDE requests
  console.log('🚗 Creating RIDE requests...');
  const rideRequests = [
    {
      token: aliceToken,
      communityId: comm1,
      data: {
        request_type: 'ride',
        title: 'Ride to airport needed',
        description: 'Need ride to SFO for 6am flight on Friday',
        urgency: 'high',
        payload: {
          origin: {
            address: '123 Main St, San Francisco, CA',
            lat: 37.7749,
            lng: -122.4194
          },
          destination: {
            address: 'San Francisco International Airport',
            lat: 37.6213,
            lng: -122.3790
          },
          seats_needed: 2,
          departure_time: '2024-06-15T05:30:00Z',
          preferences: {
            pet_friendly: false,
            wheelchair_accessible: false
          }
        }
      }
    },
    {
      token: dianaToken,
      communityId: comm1,
      data: {
        request_type: 'ride',
        title: 'Carpool to downtown',
        description: 'Looking for daily carpool buddy to downtown',
        urgency: 'low',
        payload: {
          origin: {
            address: 'Sunset District, SF',
            lat: 37.7516,
            lng: -122.4779
          },
          destination: {
            address: 'Financial District, SF',
            lat: 37.7946,
            lng: -122.3999
          },
          seats_needed: 1,
          departure_time: '2024-06-15T08:00:00Z',
          preferences: {
            women_only: true
          }
        }
      }
    }
  ];

  for (const req of rideRequests) {
    const created = await createPolymorphicRequest(req.token, req.communityId, req.data);
    if (created) {
      console.log(`  ✓ Created ride: "${req.data.title}"`);
    }
  }
  console.log('');

  // Step 4: Create SERVICE requests
  console.log('🔧 Creating SERVICE requests...');
  const serviceRequests = [
    {
      token: bobToken,
      communityId: comm2,
      data: {
        request_type: 'service',
        title: 'Plumbing repair needed',
        description: 'Kitchen sink is leaking, need professional help',
        urgency: 'high',
        payload: {
          service_category: 'plumbing',
          location_type: 'on_site',
          estimated_duration_hours: 2,
          skill_level_required: 'professional'
        },
        requirements: {
          certifications: ['licensed_plumber'],
          tools_required: ['pipe_wrench', 'plumbers_tape', 'basin_wrench']
        }
      }
    },
    {
      token: eveToken,
      communityId: comm1,
      data: {
        request_type: 'service',
        title: 'Guitar lessons wanted',
        description: 'Beginner looking to learn acoustic guitar',
        urgency: 'low',
        payload: {
          service_category: 'tutoring',
          location_type: 'remote',
          estimated_duration_hours: 1,
          skill_level_required: 'intermediate'
        }
      }
    }
  ];

  for (const req of serviceRequests) {
    const created = await createPolymorphicRequest(req.token, req.communityId, req.data);
    if (created) {
      console.log(`  ✓ Created service: "${req.data.title}"`);
    }
  }
  console.log('');

  // Step 5: Create EVENT requests
  console.log('🎉 Creating EVENT requests...');
  const eventRequests = [
    {
      token: charlieToken,
      communityId: comm3,
      data: {
        request_type: 'event',
        title: 'Community garden planting day',
        description: 'Need volunteers to help plant spring vegetables',
        urgency: 'medium',
        payload: {
          event_type: 'volunteer',
          start_time: '2024-06-20T09:00:00Z',
          end_time: '2024-06-20T13:00:00Z',
          location: {
            address: 'Community Garden, 456 Oak St',
            lat: 37.7699,
            lng: -122.4469
          },
          max_participants: 15,
          roles_needed: ['planter', 'tool_coordinator', 'lunch_helper']
        }
      }
    },
    {
      token: dianaToken,
      communityId: comm1,
      data: {
        request_type: 'event',
        title: 'Neighborhood cleanup',
        description: 'Monthly neighborhood cleanup and beautification',
        urgency: 'low',
        payload: {
          event_type: 'volunteer',
          start_time: '2024-06-22T10:00:00Z',
          end_time: '2024-06-22T12:00:00Z',
          location: {
            address: 'Main Street Park',
            lat: 37.7833,
            lng: -122.4167
          },
          max_participants: 20,
          roles_needed: ['trash_pickup', 'graffiti_removal', 'planting']
        }
      }
    }
  ];

  for (const req of eventRequests) {
    const created = await createPolymorphicRequest(req.token, req.communityId, req.data);
    if (created) {
      console.log(`  ✓ Created event: "${req.data.title}"`);
    }
  }
  console.log('');

  // Step 6: Create BORROW requests
  console.log('📦 Creating BORROW requests...');
  const borrowRequests = [
    {
      token: aliceToken,
      communityId: comm1,
      data: {
        request_type: 'borrow',
        title: 'Need ladder for weekend project',
        description: 'Painting exterior, need 10ft ladder for 2 days',
        urgency: 'medium',
        payload: {
          item_category: 'tools',
          item_description: '10-foot extension ladder',
          start_date: '2024-06-15',
          end_date: '2024-06-17',
          pickup_delivery: 'pickup'
        },
        requirements: {
          condition_required: 'good',
          insurance_offered: true
        }
      }
    },
    {
      token: bobToken,
      communityId: comm2,
      data: {
        request_type: 'borrow',
        title: 'Camping gear for weekend trip',
        description: 'Need tent and sleeping bags for 3 people',
        urgency: 'low',
        payload: {
          item_category: 'recreation',
          item_description: '3-person tent, 3 sleeping bags',
          start_date: '2024-06-21',
          end_date: '2024-06-24',
          pickup_delivery: 'delivery'
        },
        requirements: {
          condition_required: 'excellent'
        }
      }
    }
  ];

  for (const req of borrowRequests) {
    const created = await createPolymorphicRequest(req.token, req.communityId, req.data);
    if (created) {
      console.log(`  ✓ Created borrow: "${req.data.title}"`);
    }
  }
  console.log('');

  // Step 7: Create GENERIC requests (backward compatibility)
  console.log('📝 Creating GENERIC requests...');
  const genericRequests = [
    {
      token: eveToken,
      communityId: comm1,
      data: {
        request_type: 'generic',
        title: 'Help moving boxes',
        description: 'Need strong person to help move boxes to storage',
        urgency: 'medium'
      }
    },
    {
      token: charlieToken,
      communityId: comm3,
      data: {
        request_type: 'generic',
        title: 'Pet sitting for vacation',
        description: 'Going away for a week, need someone to feed my cat',
        urgency: 'high'
      }
    }
  ];

  for (const req of genericRequests) {
    const created = await createPolymorphicRequest(req.token, req.communityId, req.data);
    if (created) {
      console.log(`  ✓ Created generic: "${req.data.title}"`);
    }
  }
  console.log('');

  console.log('🎉 Polymorphic data population complete!');
  console.log('\n📊 Summary:');
  console.log('   Ride requests: 2');
  console.log('   Service requests: 2');
  console.log('   Event requests: 2');
  console.log('   Borrow requests: 2');
  console.log('   Generic requests: 2');
  console.log('   Total: 10 polymorphic requests');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
