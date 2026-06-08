/**
 * Load/Performance Testing for Karmyq Platform
 *
 * Uses k6-style approach but runs natively with Node.js for simplicity.
 * Tests API endpoints under concurrent load to verify rate limiting
 * and performance characteristics.
 *
 * Usage:
 *   npx ts-node tests/load/load-test.ts
 *
 * Configure load test with environment variables:
 *   LOAD_TEST_USERS=10       Number of concurrent users
 *   LOAD_TEST_DURATION=30    Duration in seconds
 *   LOAD_TEST_RAMP_UP=5      Ramp-up time in seconds
 */

import * as dotenv from 'dotenv';
dotenv.config();

// API Configuration
const API_CONFIG = {
  AUTH_URL: process.env.AUTH_API_URL || 'http://localhost:3001',
  COMMUNITY_URL: process.env.COMMUNITY_API_URL || 'http://localhost:3002',
  REQUEST_URL: process.env.REQUEST_API_URL || 'http://localhost:3003',
  REPUTATION_URL: process.env.REPUTATION_API_URL || 'http://localhost:3004',
  NOTIFICATION_URL: process.env.NOTIFICATION_API_URL || 'http://localhost:3005',
  MESSAGING_URL: process.env.MESSAGING_API_URL || 'http://localhost:3006',
};

// Load test configuration
const CONFIG = {
  CONCURRENT_USERS: parseInt(process.env.LOAD_TEST_USERS || '10'),
  DURATION_SECONDS: parseInt(process.env.LOAD_TEST_DURATION || '30'),
  RAMP_UP_SECONDS: parseInt(process.env.LOAD_TEST_RAMP_UP || '5'),
};

// Metrics tracking
interface Metrics {
  requests: number;
  successes: number;
  failures: number;
  totalLatency: number;
  minLatency: number;
  maxLatency: number;
  statusCodes: Record<number, number>;
  errors: string[];
}

const metrics: Metrics = {
  requests: 0,
  successes: 0,
  failures: 0,
  totalLatency: 0,
  minLatency: Infinity,
  maxLatency: 0,
  statusCodes: {},
  errors: [],
};

// Helper function for making HTTP requests with timing
async function makeRequest(
  url: string,
  options: RequestInit = {}
): Promise<{ status: number; latency: number; body: any }> {
  const start = Date.now();

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const latency = Date.now() - start;
    let body;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    return { status: response.status, latency, body };
  } catch (error: any) {
    const latency = Date.now() - start;
    return { status: 0, latency, body: { error: error.message } };
  }
}

// Track request metrics
function trackMetrics(status: number, latency: number, error?: string): void {
  metrics.requests++;
  metrics.totalLatency += latency;
  metrics.minLatency = Math.min(metrics.minLatency, latency);
  metrics.maxLatency = Math.max(metrics.maxLatency, latency);

  if (!metrics.statusCodes[status]) {
    metrics.statusCodes[status] = 0;
  }
  metrics.statusCodes[status]++;

  if (status >= 200 && status < 400) {
    metrics.successes++;
  } else {
    metrics.failures++;
    if (error && metrics.errors.length < 10) {
      metrics.errors.push(error);
    }
  }
}

// Test scenarios
interface TestUser {
  email: string;
  password: string;
  token?: string;
  userId?: string;
}

// Create a test user
async function createTestUser(index: number): Promise<TestUser> {
  const email = `loadtest-${Date.now()}-${index}@test.com`;
  const password = 'loadtest123';

  const { status, latency, body } = await makeRequest(
    `${API_CONFIG.AUTH_URL}/auth/register`,
    {
      method: 'POST',
      body: JSON.stringify({ email, password, name: `Load Test User ${index}` }),
    }
  );

  trackMetrics(status, latency, status >= 400 ? body?.error : undefined);

  if (status === 201 && body?.token) {
    return { email, password, token: body.token, userId: body.user?.id };
  }

  // If registration fails, try login (user might already exist)
  const loginResult = await makeRequest(`${API_CONFIG.AUTH_URL}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  trackMetrics(loginResult.status, loginResult.latency);

  return {
    email,
    password,
    token: loginResult.body?.token,
    userId: loginResult.body?.user?.id,
  };
}

// Simulate user activity
async function simulateUserActivity(user: TestUser, durationMs: number): Promise<void> {
  if (!user.token) return;

  const endTime = Date.now() + durationMs;
  const authHeaders = { Authorization: `Bearer ${user.token}` };

  while (Date.now() < endTime) {
    // Randomly choose an API operation
    const operation = Math.floor(Math.random() * 5);

    switch (operation) {
      case 0: {
        // List communities
        const { status, latency, body } = await makeRequest(
          `${API_CONFIG.COMMUNITY_URL}/communities`,
          { headers: authHeaders }
        );
        trackMetrics(status, latency, status >= 400 ? body?.error : undefined);
        break;
      }

      case 1: {
        // List requests
        const { status, latency, body } = await makeRequest(
          `${API_CONFIG.REQUEST_URL}/requests`,
          { headers: authHeaders }
        );
        trackMetrics(status, latency, status >= 400 ? body?.error : undefined);
        break;
      }

      case 2: {
        // Get notifications
        if (user.userId) {
          const { status, latency, body } = await makeRequest(
            `${API_CONFIG.NOTIFICATION_URL}/notifications/${user.userId}`,
            { headers: authHeaders }
          );
          trackMetrics(status, latency, status >= 400 ? body?.error : undefined);
        }
        break;
      }

      case 3: {
        // Get karma
        if (user.userId) {
          const { status, latency, body } = await makeRequest(
            `${API_CONFIG.REPUTATION_URL}/reputation/karma/${user.userId}`,
            { headers: authHeaders }
          );
          trackMetrics(status, latency, status >= 400 ? body?.error : undefined);
        }
        break;
      }

      case 4: {
        // Get feed
        const { status, latency, body } = await makeRequest(
          `${API_CONFIG.REQUEST_URL}/requests/feed`,
          { headers: authHeaders }
        );
        trackMetrics(status, latency, status >= 400 ? body?.error : undefined);
        break;
      }
    }

    // Small delay between requests (100-500ms)
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 400));
  }
}

// Rate limit stress test
async function rateLimitStressTest(user: TestUser): Promise<void> {
  if (!user.token) return;

  console.log('\n📊 Running rate limit stress test...');

  const authHeaders = { Authorization: `Bearer ${user.token}` };
  const requests: Promise<void>[] = [];

  // Fire 100 rapid requests
  for (let i = 0; i < 100; i++) {
    requests.push(
      (async () => {
        const { status, latency, body } = await makeRequest(
          `${API_CONFIG.COMMUNITY_URL}/communities`,
          { headers: authHeaders }
        );
        trackMetrics(status, latency, status >= 400 ? body?.error : undefined);
      })()
    );
  }

  await Promise.all(requests);
}

// Print metrics report
function printReport(): void {
  console.log('\n' + '='.repeat(60));
  console.log('                    LOAD TEST RESULTS');
  console.log('='.repeat(60));

  console.log(`\n📈 Request Statistics:`);
  console.log(`   Total Requests:     ${metrics.requests}`);
  console.log(`   Successful:         ${metrics.successes} (${((metrics.successes / metrics.requests) * 100).toFixed(1)}%)`);
  console.log(`   Failed:             ${metrics.failures} (${((metrics.failures / metrics.requests) * 100).toFixed(1)}%)`);

  console.log(`\n⏱️  Latency Statistics:`);
  console.log(`   Average:            ${(metrics.totalLatency / metrics.requests).toFixed(0)}ms`);
  console.log(`   Min:                ${metrics.minLatency === Infinity ? 'N/A' : metrics.minLatency + 'ms'}`);
  console.log(`   Max:                ${metrics.maxLatency}ms`);

  console.log(`\n📊 Status Code Distribution:`);
  Object.entries(metrics.statusCodes)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .forEach(([code, count]) => {
      const percentage = ((count / metrics.requests) * 100).toFixed(1);
      console.log(`   ${code}: ${count} (${percentage}%)`);
    });

  if (metrics.errors.length > 0) {
    console.log(`\n❌ Sample Errors:`);
    metrics.errors.forEach((error, i) => {
      console.log(`   ${i + 1}. ${error}`);
    });
  }

  // Performance assessment
  console.log('\n' + '='.repeat(60));
  const avgLatency = metrics.totalLatency / metrics.requests;
  const successRate = (metrics.successes / metrics.requests) * 100;
  const rateLimitHits = metrics.statusCodes[429] || 0;

  if (successRate >= 95 && avgLatency < 500) {
    console.log('✅ PASSED: System performing well under load');
  } else if (successRate >= 80) {
    console.log('⚠️  WARNING: Some degradation under load');
  } else {
    console.log('❌ FAILED: Significant performance issues detected');
  }

  if (rateLimitHits > 0) {
    console.log(`📋 Rate limiting triggered ${rateLimitHits} times (expected behavior)`);
  }

  console.log('='.repeat(60) + '\n');
}

// Main test runner
async function runLoadTest(): Promise<void> {
  console.log('🚀 Karmyq Load Testing Tool');
  console.log('='.repeat(60));
  console.log(`Configuration:`);
  console.log(`  Concurrent Users: ${CONFIG.CONCURRENT_USERS}`);
  console.log(`  Duration:         ${CONFIG.DURATION_SECONDS}s`);
  console.log(`  Ramp-up:          ${CONFIG.RAMP_UP_SECONDS}s`);
  console.log('='.repeat(60));

  // Phase 1: Create test users
  console.log('\n📝 Phase 1: Creating test users...');
  const users: TestUser[] = [];

  for (let i = 0; i < CONFIG.CONCURRENT_USERS; i++) {
    const user = await createTestUser(i);
    if (user.token) {
      users.push(user);
      console.log(`  ✓ User ${i + 1} created`);
    } else {
      console.log(`  ✗ User ${i + 1} failed`);
    }

    // Ramp-up delay
    if (i < CONFIG.CONCURRENT_USERS - 1) {
      const delay = (CONFIG.RAMP_UP_SECONDS * 1000) / CONFIG.CONCURRENT_USERS;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  console.log(`\n✅ Created ${users.length} test users`);

  // Phase 2: Concurrent activity
  console.log(`\n🔄 Phase 2: Running concurrent activity for ${CONFIG.DURATION_SECONDS}s...`);
  const activityPromises = users.map(user =>
    simulateUserActivity(user, CONFIG.DURATION_SECONDS * 1000)
  );
  await Promise.all(activityPromises);

  // Phase 3: Rate limit test
  if (users.length > 0) {
    await rateLimitStressTest(users[0]);
  }

  // Print final report
  printReport();
}

// Run if executed directly
runLoadTest().catch(console.error);
