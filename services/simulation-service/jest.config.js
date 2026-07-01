const rootConfig = require('../../jest.config.js');

module.exports = {
  ...rootConfig,
  testMatch: [
    '**/tests/unit/**/*.test.ts',
    '**/tests/regression/**/*.test.ts',
    '**/tests/tdd/**/*.test.ts',
  ],
  setupFilesAfterEnv: [],  // simulation service has no jest.setup.js
};
