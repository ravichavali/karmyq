/**
 * Integration Test Setup
 *
 * This setup file configures environment variables for integration tests.
 * Integration tests run inside Docker Compose network where services use Docker DNS.
 *
 * Prerequisites:
 * - Docker Compose test environment must be running:
 *   npm run test:integration:setup
 *
 * Environment Detection:
 * - If running inside Docker (test-runner container), uses Docker service names
 * - If running on host, uses localhost URLs (requires port forwarding)
 */

import { config } from 'dotenv';
import * as path from 'path';

// Detect if running inside Docker container
const isDockerEnvironment = process.env.DOCKER_ENV === 'test' ||
                            process.env.DATABASE_URL?.includes('postgres-test');

if (isDockerEnvironment) {
  console.log('🐳 Running integration tests in Docker environment');
  // Environment variables are set by docker-compose.test.yml
  // Services use Docker DNS: auth-service-test, postgres-test, etc.
} else {
  console.log('💻 Running integration tests on host (requires services on localhost)');

  // Load .env.test if it exists
  const envPath = path.join(__dirname, '..', '.env.test');
  config({ path: envPath });

  // Set defaults for host-based testing
  process.env.DATABASE_URL = process.env.DATABASE_URL ||
    'postgresql://karmyq_test:test_password@localhost:5433/karmyq_test';
  process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380';
  process.env.AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
  process.env.COMMUNITY_SERVICE_URL = process.env.COMMUNITY_SERVICE_URL || 'http://localhost:3002';
  process.env.REQUEST_SERVICE_URL = process.env.REQUEST_SERVICE_URL || 'http://localhost:3003';
  process.env.REPUTATION_SERVICE_URL = process.env.REPUTATION_SERVICE_URL || 'http://localhost:3004';
  process.env.NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005';
}

// Common test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_change_me';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Increase timeout for integration tests (service-to-service calls)
jest.setTimeout(30000);

// Suppress noisy logs during tests
global.console = {
  ...console,
  log: jest.fn(),      // Suppress info logs
  debug: jest.fn(),    // Suppress debug logs
  info: jest.fn(),     // Suppress info logs
  warn: console.warn,  // Keep warnings
  error: console.error // Keep errors
};

console.info('Integration test environment configured');
console.info(`Database: ${process.env.DATABASE_URL?.replace(/:[^:]*@/, ':****@')}`);
console.info(`Auth Service: ${process.env.AUTH_SERVICE_URL}`);
