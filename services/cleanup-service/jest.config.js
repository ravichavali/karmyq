// Jest configuration for Cleanup Service
const rootConfig = require('../../jest.config');

module.exports = {
  ...rootConfig,
  rootDir: '.',
  displayName: 'cleanup-service',
  testMatch: [
    ...(rootConfig.testMatch || []),
    '**/tests/tdd/**/*.test.ts',
    '**/tests/regression/**/*.test.ts',
  ],

  // Remove setup files requirement
  setupFilesAfterEnv: [],
};
