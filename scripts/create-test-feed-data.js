/**
 * Create test data for feed via API
 * This bypasses RLS issues by using proper API authentication
 */

const https = require('http');

const API_BASE = 'http://localhost:3001';
const COMMUNITY_API = 'http://localhost:3002';
const REQUEST_API = 'http://localhost:3003';

// Login and get token
async function login(email, password) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ email, password });
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (result.success) {
            resolve(result.data.token);
          } else {
            reject(new Error('Login failed: ' + body));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Create community
async function createCommunity(token, name, description) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ name, description, location: 'Test City', category: 'general' });
    const options = {
      hostname: 'localhost',
      port: 3002,
      path: '/communities',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Create request
async function createRequest(token, communityId, title, description, category) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      community_ids: [communityId],
      title,
      description,
      category,
      urgency: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)]
    });
    const options = {
      hostname: 'localhost',
      port: 3003,
      path: '/requests',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  try {
    console.log('Logging in as new.user@test.com...');
    const token = await login('new.user@test.com', 'password123');
    console.log('✅ Logged in successfully');

    console.log('\nCreating test community...');
    const community = await createCommunity(token, 'Test Community', 'A community for testing the feed');
    const communityId = community.data?.id || community.community?.id;
    console.log(`✅ Created community: ${communityId}`);

    console.log('\nCreating 10 test requests...');
    const requests = [
      { title: 'Need help moving furniture', description: 'Looking for someone with a truck', category: 'moving' },
      { title: 'Math tutoring needed', description: 'Help with calculus homework', category: 'tutoring' },
      { title: 'Borrow a ladder', description: 'Need for weekend project', category: 'tools' },
      { title: 'Dog walking help', description: 'Need someone to walk my dog this week', category: 'pet_care' },
      { title: 'Ride to airport', description: 'Need ride to JFK on Friday', category: 'transport' },
      { title: 'Help with gardening', description: 'Spring cleanup assistance needed', category: 'gardening' },
      { title: 'Computer repair', description: 'Laptop won\'t start, need tech help', category: 'tech_support' },
      { title: 'Babysitter needed', description: 'Looking for evening babysitter', category: 'childcare' },
      { title: 'Spanish language exchange', description: 'Want to practice Spanish conversation', category: 'language_exchange' },
      { title: 'Home repair help', description: 'Fixing a leaky faucet', category: 'home_repair' }
    ];

    for (const req of requests) {
      const result = await createRequest(token, communityId, req.title, req.description, req.category);
      console.log(`✅ Created: ${req.title}`);
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
    }

    console.log('\n✅ All done! Created 1 community and 10 requests');
    console.log('You should now see data in the feed!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
