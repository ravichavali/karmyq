// Jest setup file
// Add any global test setup here

beforeAll(() => {
  // Setup before all tests
  console.log('Starting test suite...');
});

afterAll(() => {
  // Cleanup after all tests
  console.log('Test suite completed');
});

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
