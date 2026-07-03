module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      }
    }]
  },
  collectCoverageFrom: [
    '../services/**/*.ts',
    '!../services/**/*.d.ts',
    '!../services/**/node_modules/**',
    '!../services/**/dist/**',
    '!../services/**/shared/**', // Shared utilities tested separately
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  // Resolve workspace packages to their TypeScript source so cross-workspace imports (e.g.
  // simulation-service's baselineWriter importing @karmyq/shared) work under ts-jest without a
  // prior build step. Fixes the Sprint 117 integration test failing to resolve @karmyq/shared.
  moduleNameMapper: {
    '^@karmyq/shared/projections/completed-exchange$': '<rootDir>/../packages/shared/src/projections/completedExchange.ts',
    '^@karmyq/shared$': '<rootDir>/../packages/shared/index.ts',
  },
  verbose: true,
  testTimeout: 30000, // 30 seconds for integration tests
  setupFilesAfterEnv: ['<rootDir>/setup.ts'],
};
