// Jest configuration for Mobile App
module.exports = {
  testEnvironment: "node",
  setupFilesAfterEnv: [],
  testMatch: [
    "**/__tests__/**/*.test.[jt]s?(x)",
    "**/?(*.)+(spec|test).[jt]s?(x)",
  ],
  // Pass when no tests are found (until we write mobile tests)
  passWithNoTests: true,
};
