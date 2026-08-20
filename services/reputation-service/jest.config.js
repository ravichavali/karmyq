// Jest configuration for Reputation Service
// Extends root configuration

const rootConfig = require('../../jest.config');

module.exports = {
  ...rootConfig,
  rootDir: '.',
  displayName: 'reputation-service',

  // Override test match for this service. Sprint 112 (ADR-082): regression/ was missing here, so the
  // reputation regression tier silently never ran (`npm run test:regression` → "No tests found").
  // It is now included so the blocking tier actually executes — matching every other service.
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.ts',
    '<rootDir>/tests/regression/**/*.test.ts',
    '<rootDir>/tests/tdd/**/*.test.ts',
    '<rootDir>/tests/integration/**/*.test.ts'
  ],

  // Coverage specific to this service
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/**/*.interface.ts',
    '!src/index.ts',
  ],

  // Module path mapping
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Sprint 126: resolve @karmyq/shared to SOURCE, matching the root tests config. Since the
    // karma allocation policy moved into the shared package, running this tier directly (as the
    // sprint plan's own commands do) would otherwise test a stale packages/shared/dist and go
    // green against code that no longer exists. Turbo rebuilds shared first; a bare jest run does not.
    '^@karmyq/shared$': '<rootDir>/../../packages/shared/index.ts',
  },

  // Remove setup files requirement
  setupFilesAfterEnv: [],
};
