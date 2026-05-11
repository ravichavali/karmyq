import { hashToken, generateRawToken } from '../../src/utils/refreshToken';

// Unit tests for refresh token utilities (no DB required)
describe('refreshToken utilities', () => {
  describe('generateRawToken', () => {
    it('returns a 64-character hex string', () => {
      const token = generateRawToken();
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('returns unique tokens on each call', () => {
      const a = generateRawToken();
      const b = generateRawToken();
      expect(a).not.toBe(b);
    });
  });

  describe('hashToken', () => {
    it('returns a 64-character hex SHA-256 hash', () => {
      const hash = hashToken('test-token');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is deterministic for the same input', () => {
      const hash1 = hashToken('same-input');
      const hash2 = hashToken('same-input');
      expect(hash1).toBe(hash2);
    });

    it('produces different hashes for different inputs', () => {
      const hash1 = hashToken('token-a');
      const hash2 = hashToken('token-b');
      expect(hash1).not.toBe(hash2);
    });

    it('never stores the raw token value in the hash', () => {
      const raw = 'my-secret-raw-token';
      const hash = hashToken(raw);
      expect(hash).not.toContain(raw);
    });
  });
});
