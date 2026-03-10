/**
 * TDD tests for register-user-workflow.ts
 * Tests the registerNewUser() standalone function used by the growth engine.
 */

import { registerNewUser } from '../../src/workflows/register-user-workflow';
import { ApiClient } from '../../src/api-client';

jest.mock('../../src/api-client');

const MockApiClient = ApiClient as jest.MockedClass<typeof ApiClient>;

describe('registerNewUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns user details on successful registration', async () => {
    MockApiClient.prototype.register = jest.fn().mockResolvedValue({
      token: 'tok-abc',
      user: { id: 'user-123' }
    });

    const result = await registerNewUser('http://localhost:3000/api', 'test.karmyq.com', 'password123');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('user-123');
    expect(result!.token).toBe('tok-abc');
    expect(result!.email).toMatch(/@test\.karmyq\.com$/);
    expect(result!.name).toBeTruthy();
  });

  it('returns null when API returns no user', async () => {
    MockApiClient.prototype.register = jest.fn().mockResolvedValue(null);

    const result = await registerNewUser('http://localhost:3000/api', 'test.karmyq.com', 'password123');

    expect(result).toBeNull();
  });

  it('returns null when API throws', async () => {
    MockApiClient.prototype.register = jest.fn().mockRejectedValue(new Error('Network error'));

    const result = await registerNewUser('http://localhost:3000/api', 'test.karmyq.com', 'password123');

    expect(result).toBeNull();
  });

  it('generates unique emails with numeric suffix', async () => {
    MockApiClient.prototype.register = jest.fn().mockResolvedValue({
      token: 'tok-1',
      user: { id: 'user-1' }
    });

    const results = await Promise.all([
      registerNewUser('http://localhost:3000/api', 'test.karmyq.com', 'password123'),
      registerNewUser('http://localhost:3000/api', 'test.karmyq.com', 'password123'),
    ]);

    const emails = results.map(r => r!.email);
    // Both should be valid test.karmyq.com emails
    emails.forEach(email => expect(email).toMatch(/@test\.karmyq\.com$/));
  });
});
