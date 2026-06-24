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
  },

  // Remove setup files requirement
  setupFilesAfterEnv: [],
};
