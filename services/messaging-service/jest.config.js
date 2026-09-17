// Jest configuration for Messaging Service (Sprint 131, BUG-034).
// Extends the root configuration, following services/notification-service/jest.config.js.

const rootConfig = require('../../jest.config');

module.exports = {
  ...rootConfig,
  rootDir: '.',
  displayName: 'messaging-service',

  testMatch: [
    '<rootDir>/tests/unit/**/*.test.ts',
    '<rootDir>/tests/regression/**/*.test.ts',
    '<rootDir>/tests/tdd/**/*.test.ts',
    '<rootDir>/tests/integration/**/*.test.ts',
  ],

  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/**/*.interface.ts',
    '!src/index.ts',
  ],

  // The root setup file resolves against the root rootDir; this service needs none.
  setupFilesAfterEnv: [],
};
