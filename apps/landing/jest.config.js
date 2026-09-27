const { withWorkerCap } = require('../../scripts/jest-worker-cap');

module.exports = withWorkerCap({
  testMatch: ['**/tests/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { module: 'commonjs', moduleResolution: 'node' } }],
  },
});
