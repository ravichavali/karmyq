/**
 * Simple test to verify simulation service can connect to Karmyq API
 */

import { ApiClient } from './src/api-client';

async function testConnection() {
  console.log('🧪 Testing Simulation Service Connection...\n');

  // For local testing, connect directly to auth service
  const client = new ApiClient('http://localhost:3001');

  try {
    // Test 1: Try to login with a test user
    console.log('Test 1: Login with test user...');
    try {
      const loginResult = await client.login('alice@test.com', 'password123');
      console.log('✅ Login successful');
      console.log(`   Token: ${loginResult.token.substring(0, 20)}...`);
      console.log(`   User: ${loginResult.user.name || loginResult.user.email}`);
    } catch (error: any) {
      console.log('❌ Login failed:', error.message);
      console.log('   This is expected if test user doesn\'t exist yet');
    }

    // Test 2: Try to browse requests (should fail without auth)
    console.log('\nTest 2: Browse requests without auth...');
    try {
      const requests = await client.browseRequests({ limit: 5 });
      console.log(`✅ Browse successful: Found ${requests.length} requests`);
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.log('✅ Got expected 401 Unauthorized (auth required)');
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }

    console.log('\n✅ Connection test complete!');
    console.log('\nNext steps:');
    console.log('1. Seed test data: npm run seed');
    console.log('2. Run simulation: npm run dev');

  } catch (error: any) {
    console.error('\n❌ Connection test failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('- Is Docker running? (docker-compose ps)');
    console.error('- Are services healthy? (check logs)');
    console.error('- Is frontend accessible? (curl http://localhost:3000)');
    process.exit(1);
  }
}

testConnection();
