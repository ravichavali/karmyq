/**
 * Test simulation workflows with real data
 * Runs a short simulation session to verify everything works
 */

import { ApiClient } from './src/api-client';
import { browseWorkflow, createRequestWorkflow, offerHelpWorkflow } from './src/workflows';

const config = {
  enabled: true,
  environment: 'dev' as const,
  schedule: {
    type: 'continuous' as const,
    businessHours: {
      start: '09:00',
      end: '21:00',
      timezone: 'America/Los_Angeles'
    }
  },
  users: {
    total: 8,
    concurrentSessions: { min: 2, max: 3 },
    profiles: {
      activeHelper: 0.3,
      requester: 0.25,
      browser: 0.25,
      communityBuilder: 0.1,
      socialUser: 0.1
    }
  },
  rateLimit: {
    respectLimits: true,
    minDelayMs: 2000,
    maxRetries: 3
  },
  apiBaseUrl: 'http://localhost:3000/api'
};

async function testWorkflows() {
  console.log('🧪 Testing Simulation Workflows\n');

  const testUsers = [
    { email: 'alice@test.com', password: 'password123' },
    { email: 'bob@test.com', password: 'password123' },
    { email: 'charlie@test.com', password: 'password123' }
  ];

  for (const user of testUsers) {
    console.log(`\n📝 Testing user: ${user.email}`);

    try {
      // Login
      const client = new ApiClient(config.apiBaseUrl);
      const loginResult = await client.login(user.email, user.password);

      console.log(`✅ Login successful`);

      // Create session
      const session = {
        user: loginResult.user,
        startedAt: new Date(),
        actions: [],
        isActive: true
      };

      // Test Browse Workflow
      console.log(`\n🔍 Testing Browse Workflow...`);
      await browseWorkflow({ session, config });
      console.log(`✅ Browse workflow completed`);

      // Test Create Request Workflow
      console.log(`\n📝 Testing Create Request Workflow...`);
      await createRequestWorkflow({ session, config });
      console.log(`✅ Create request workflow completed`);

      // Test Offer Help Workflow
      console.log(`\n🤝 Testing Offer Help Workflow...`);
      await offerHelpWorkflow({ session, config });
      console.log(`✅ Offer help workflow completed`);

      console.log(`\n✅ All workflows passed for ${user.email}`);

    } catch (error: any) {
      console.error(`❌ Error testing ${user.email}:`, error.message);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Data:`, error.response.data);
      }
    }

    // Small delay between users
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  console.log('\n\n🎉 Workflow testing complete!');
  console.log('\nCheck database for:');
  console.log('- New requests created');
  console.log('- New offers made');
  console.log('- Activity logged');
}

testWorkflows().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
