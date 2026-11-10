const rootConfig = require('../../jest.config.js');

module.exports = {
  ...rootConfig,
  // Explicit tier discovery (Sprint 139, BUG-092). The package.json scripts select a tier with
  // --testPathPatterns: `test` = unit + regression (blocking), `test:tdd` = WIP (reports only).
  testMatch: [
    '**/tests/unit/**/*.test.ts',
    '**/tests/regression/**/*.test.ts',
    '**/tests/tdd/**/*.test.ts',
  ],
  setupFilesAfterEnv: [],  // simulation service has no jest.setup.js
};
