/**
 * Tests for the founding-circle intake client (Sprint 96, ADR-076).
 * Pure TS — mocks global.fetch. Verifies base-URL selection, production fallback,
 * payload shape, and result mapping for 2xx / non-2xx / network-error.
 */

import { submitFoundingCircle } from '../src/lib/submitFoundingCircle';

const ORIGINAL_ENV = { ...process.env };

function mockFetch(impl: jest.Mock) {
  (global as any).fetch = impl;
}

const input = {
  email: 'you@example.com',
  lens: 'community organizer',
  contribution: 'host skill-shares',
  concern: 'trust at scale',
  website: '',
};

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.resetAllMocks();
});

describe('submitFoundingCircle', () => {
  it('POSTs to NEXT_PUBLIC_API_URL when set', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    mockFetch(fetchMock);

    const result = await submitFoundingCircle(input);

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example.test/founding-circle/submissions');
    expect(opts.method).toBe('POST');
    expect(opts.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(opts.body)).toEqual({
      email: 'you@example.com',
      lens: 'community organizer',
      contribution: 'host skill-shares',
      concern: 'trust at scale',
      website: '',
    });
  });

  it('strips a trailing slash from the configured base URL', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test/';
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    mockFetch(fetchMock);

    await submitFoundingCircle(input);

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.test/founding-circle/submissions');
  });

  it('ignores a relative NEXT_PUBLIC_API_URL and uses the production host (shared with frontend /api)', async () => {
    process.env.NEXT_PUBLIC_API_URL = '/api';
    process.env.NODE_ENV = 'production';
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    mockFetch(fetchMock);

    await submitFoundingCircle(input);

    expect(fetchMock.mock.calls[0][0]).toBe('https://karmyq.com/api/founding-circle/submissions');
  });

  it('falls back to the production API host when unset in production', async () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    process.env.NODE_ENV = 'production';
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    mockFetch(fetchMock);

    await submitFoundingCircle(input);

    expect(fetchMock.mock.calls[0][0]).toBe('https://karmyq.com/api/founding-circle/submissions');
  });

  it('returns ok:false with the server message on a non-2xx response', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, message: 'A valid email address is required' }),
    });
    mockFetch(fetchMock);

    const result = await submitFoundingCircle(input);

    expect(result.ok).toBe(false);
    expect(result.message).toBe('A valid email address is required');
  });

  it('returns ok:false with a generic message when a non-2xx body is not JSON', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => {
        throw new Error('not json');
      },
    });
    mockFetch(fetchMock);

    const result = await submitFoundingCircle(input);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/went wrong/i);
  });

  it('returns ok:false on a network error (fetch throws)', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
    const fetchMock = jest.fn().mockRejectedValue(new Error('network down'));
    mockFetch(fetchMock);

    const result = await submitFoundingCircle(input);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/reach the server/i);
  });
});
