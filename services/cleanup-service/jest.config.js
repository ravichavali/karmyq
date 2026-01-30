// Jest configuration for Cleanup Service
const rootConfig = require('../../jest.config');

module.exports = {
  ...rootConfig,
  rootDir: '.',
  displayName: 'cleanup-service',

  // Pass when no tests are found (until we write tests)
  passWithNoTests: true,

  // Remove setup files requirement
  setupFilesAfterEnv: [],
};
