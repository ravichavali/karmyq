// Jest configuration for Cleanup Service
const rootConfig = require('../../jest.config');

module.exports = {
  ...rootConfig,
  rootDir: '.',
  displayName: 'cleanup-service',
  // Explicit tier discovery (Sprint 139, BUG-092). The package.json scripts select a tier with
  // --testPathPatterns: `test` = unit + regression (blocking), `test:tdd` = WIP (reports only).
  // The root config's patterns are deliberately NOT spread in: they include tests/integration/,
  // which a bare `jest` used to run as part of the blocking default.
  testMatch: [
    '**/tests/unit/**/*.test.ts',
    '**/tests/regression/**/*.test.ts',
    '**/tests/tdd/**/*.test.ts',
  ],

  // Remove setup files requirement
  setupFilesAfterEnv: [],
};
