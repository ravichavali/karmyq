// Jest configuration for Mobile App
const { withWorkerCap } = require('../../scripts/jest-worker-cap');

module.exports = withWorkerCap({
  testEnvironment: "node",
  setupFilesAfterEnv: [],
  // Sprint 136: the alias used to come from babel-plugin-module-resolver. Metro reads tsconfig `paths` itself; jest
  // does not, so it maps `@/` here (tsconfig.json `@/*` → `./*`).
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
  testMatch: [
    "**/__tests__/**/*.test.[jt]s?(x)",
    "**/?(*.)+(spec|test).[jt]s?(x)",
  ],
});
