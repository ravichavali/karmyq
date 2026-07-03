import axios from 'axios';
import { ApiClient } from '../../src/api-client';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * Regression: login()/register() must set the auth header on the client, so subsequent
 * authenticated calls (createRequest, offerHelp, ...) are authorized. Missing this caused the live
 * reset's story creation to 401 after a successful login.
 */
describe('ApiClient auth token', () => {
  function fakeClient(token: string | null) {
    return {
      defaults: { headers: { common: {} as Record<string, string> } },
      post: jest.fn().mockResolvedValue({ data: { data: token ? { token, user: { id: 'u1' } } : { user: { id: 'u1' } } } }),
    };
  }

  it('sets the Authorization header after login', async () => {
    const client = fakeClient('tok-login');
    mockedAxios.create.mockReturnValue(client as never);
    const api = new ApiClient('http://localhost/api');
    await api.login('a@test.karmyq.com', 'password123');
    expect(client.defaults.headers.common['Authorization']).toBe('Bearer tok-login');
  });

  it('sets the Authorization header after register', async () => {
    const client = fakeClient('tok-register');
    mockedAxios.create.mockReturnValue(client as never);
    const api = new ApiClient('http://localhost/api');
    await api.register({ email: 'b@test.karmyq.com', name: 'B', password: 'password123' });
    expect(client.defaults.headers.common['Authorization']).toBe('Bearer tok-register');
  });

  it('does not set a header when no token is returned', async () => {
    const client = fakeClient(null);
    mockedAxios.create.mockReturnValue(client as never);
    const api = new ApiClient('http://localhost/api');
    await api.login('c@test.karmyq.com', 'password123');
    expect(client.defaults.headers.common['Authorization']).toBeUndefined();
  });
});
