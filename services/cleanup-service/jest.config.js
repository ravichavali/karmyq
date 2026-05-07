// Jest configuration for Cleanup Service
const rootConfig = require('../../jest.config');

module.exports = {
  ...rootConfig,
  rootDir: '.',
  displayName: 'cleanup-service',

  // Remove setup files requirement
  setupFilesAfterEnv: [],
};
