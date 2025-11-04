/**
 * Test Utilities and Helpers
 */

export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  created_at: new Date(),
  ...overrides,
});

export const createMockRequest = (data: any) => ({
  body: data,
  headers: {},
  params: {},
  query: {},
});

export const createMockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

export const waitFor = (ms: number) => 
  new Promise(resolve => setTimeout(resolve, ms));
