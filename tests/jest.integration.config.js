/**
 * Jest configuration for integration tests
 *
 * Integration tests verify service-to-service communication and run in
 * Docker Compose environment with real PostgreSQL and Redis.
 *
 * Prerequisites:
 * - Start test environment: npm run test:integration:setup
 * - Run tests: npm run test:integration
 * - Stop test environment: npm run test:integration:teardown
 */

module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/integration'],
  // Sprint 126: resolve @karmyq/shared to SOURCE, exactly as jest.config.js does. Integration tests
  // now import reputation-service modules that pull in the shared package; without this the suite
  // dies with "Cannot find module '@karmyq/shared'" in CI, where the workspace symlink and built
  // dist/ are not laid out the way they are on a dev machine.
  moduleNameMapper: {
    '^@karmyq/shared/projections/completed-exchange$': '<rootDir>/../packages/shared/src/projections/completedExchange.ts',
    '^@karmyq/shared$': '<rootDir>/../packages/shared/index.ts',
  },
  testMatch: ['**/*.integration.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      }
    }]
  },
  setupFilesAfterEnv: ['<rootDir>/integration/setup.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  verbose: true,
  testTimeout: 30000, // 30 seconds for service-to-service calls
  maxWorkers: 1,      // Run tests serially to avoid database conflicts

  // Coverage configuration (optional for integration tests)
  collectCoverage: false, // Set to true if you want coverage for integration tests
  coverageDirectory: 'coverage/integration',
  coverageReporters: ['text', 'html'],

  // Only collect coverage from actual test files, not setup
  collectCoverageFrom: [
    'integration/**/*.test.ts',
    '!integration/setup.ts',
  ],

  // Display settings
  displayName: {
    name: 'Integration Tests',
    color: 'blue',
  },

  // Fail fast on first error (helpful for debugging)
  bail: false,

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
