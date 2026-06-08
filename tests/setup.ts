/**
 * Jest setup file
 * Runs before all tests
 */

// Load environment variables from .env.demo (falls back to .env.production for backward compat)
import { config } from 'dotenv';
import * as path from 'path';

const envPathDemo = path.join(__dirname, '..', '.env.demo');
const envPathLegacy = path.join(__dirname, '..', '.env.production');
config({ path: envPathDemo });
config({ path: envPathLegacy }); // fallback — dotenv won't overwrite already-set vars

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';

// Convert Docker service names to localhost for integration tests
// .env.demo uses service names like "http://auth-service:3001" which work in Docker
// but tests run on host and need "http://localhost:3001"
const serviceMapping: Record<string, { env: string; port: string }> = {
  'auth-service': { env: 'AUTH_SERVICE_URL', port: '3001' },
  'community-service': { env: 'COMMUNITY_SERVICE_URL', port: '3002' },
  'request-service': { env: 'REQUEST_SERVICE_URL', port: '3003' },
  'reputation-service': { env: 'REPUTATION_SERVICE_URL', port: '3004' },
  'notification-service': { env: 'NOTIFICATION_SERVICE_URL', port: '3005' },
  'messaging-service': { env: 'MESSAGING_SERVICE_URL', port: '3006' },
  'cleanup-service': { env: 'CLEANUP_SERVICE_URL', port: '3008' },
  'geocoding-service': { env: 'GEOCODING_SERVICE_URL', port: '3009' },
  'social-graph-service': { env: 'SOCIAL_GRAPH_API_URL', port: '3010' },
};

// Replace Docker service names with localhost
Object.entries(serviceMapping).forEach(([serviceName, config]) => {
  const envValue = process.env[config.env];
  if (envValue && envValue.includes(serviceName)) {
    process.env[config.env] = `http://localhost:${config.port}`;
  }
});

if (process.env.MESSAGING_API_URL && process.env.MESSAGING_API_URL.includes('messaging-service')) {
  process.env.MESSAGING_API_URL = 'http://localhost:3006';
}

// Set defaults for any missing service URLs
process.env.AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
process.env.COMMUNITY_SERVICE_URL = process.env.COMMUNITY_SERVICE_URL || 'http://localhost:3002';
process.env.REQUEST_SERVICE_URL = process.env.REQUEST_SERVICE_URL || 'http://localhost:3003';
process.env.REPUTATION_SERVICE_URL = process.env.REPUTATION_SERVICE_URL || 'http://localhost:3004';
process.env.NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005';
process.env.MESSAGING_SERVICE_URL = process.env.MESSAGING_SERVICE_URL || 'http://localhost:3006';
process.env.SOCIAL_GRAPH_API_URL = process.env.SOCIAL_GRAPH_API_URL || 'http://localhost:3010';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://karmyq_user:karmyq_password_dev@localhost:5432/karmyq_db';

// Increase timeout for all tests
jest.setTimeout(30000);

// Global test utilities
global.console = {
  ...console,
  // Uncomment to suppress console logs during tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  error: console.error, // Keep errors visible
};
