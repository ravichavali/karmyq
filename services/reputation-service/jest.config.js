// Jest configuration for Reputation Service
// Extends root configuration

const rootConfig = require('../../jest.config');

module.exports = {
  ...rootConfig,
  rootDir: '.',
  displayName: 'reputation-service',

  // Override test match for this service.
  // NOTE (Sprint 112): tests/regression/ is intentionally NOT matched here — enabling it surfaced a
  // pre-existing dormant, bit-rotted karmaService.test.ts (auto-mocked db, 11 failures) that is out
  // of this sprint's scope. The disclosure boundary contract test therefore lives in tests/unit/
  // (fully mocked, no DB) so it RUNS and BLOCKS in CI without dragging in that unrelated rot. The
  // dormant regression tier is recorded as a follow-up in the handoff.
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.ts',
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
