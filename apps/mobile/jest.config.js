// Jest configuration for Mobile App
const { withWorkerCap } = require('../../scripts/jest-worker-cap');

module.exports = withWorkerCap({
  testEnvironment: "node",
  setupFilesAfterEnv: [],
  testMatch: [
    "**/__tests__/**/*.test.[jt]s?(x)",
    "**/?(*.)+(spec|test).[jt]s?(x)",
  ],
});
