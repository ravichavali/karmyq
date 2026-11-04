// Jest configuration for Mobile App
const { withWorkerCap } = require("../../scripts/jest-worker-cap");
const { compilerOptions } = require("./tsconfig.json");

// Sprint 136: the aliases used to come from babel-plugin-module-resolver. Metro reads tsconfig `paths` itself
// (longest prefix first); jest does not, so it maps the same `paths` here, in the same order. One source of truth:
// `@/shared/*` reaches packages/shared under tsc, Metro and jest alike.
const moduleNameMapper = Object.fromEntries(
  Object.entries(compilerOptions.paths)
    .sort(([a], [b]) => b.length - a.length)
    .map(([alias, [target]]) => [
      `^${alias.replace("*", "(.*)")}$`,
      `<rootDir>/${target.replace("*", "$1")}`,
    ]),
);

module.exports = withWorkerCap({
  testEnvironment: "node",
  setupFilesAfterEnv: [],
  moduleNameMapper,
  testMatch: [
    "**/__tests__/**/*.test.[jt]s?(x)",
    "**/?(*.)+(spec|test).[jt]s?(x)",
  ],
});
