// Mock pg Pool before any imports that use it
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    on: jest.fn(),
  })),
}));

import { ALLOWED_CLEANUP_TABLES, batchHardDelete } from '../../src/jobs/expirationJob';

describe('batchHardDelete whitelist (ADR-052, Sprint 54)', () => {
  describe('whitelist rejects disallowed tables', () => {
    it('throws for auth.users', async () => {
      await expect(batchHardDelete('auth.users')).rejects.toThrow(
        "batchHardDelete: table 'auth.users' is not in the allowed list"
      );
    });

    it('throws for SQL injection attempt', async () => {
      await expect(
        batchHardDelete("requests.help_requests; DROP TABLE auth.users--")
      ).rejects.toThrow('is not in the allowed list');
    });

    it('throws for empty string', async () => {
      await expect(batchHardDelete('')).rejects.toThrow('is not in the allowed list');
    });

    it('throws for communities.members', async () => {
      await expect(batchHardDelete('communities.members')).rejects.toThrow('is not in the allowed list');
    });
  });

  describe('whitelist contains exactly the expected tables', () => {
    it('allows requests.help_requests', () => {
      expect(ALLOWED_CLEANUP_TABLES.has('requests.help_requests')).toBe(true);
    });

    it('allows requests.help_offers', () => {
      expect(ALLOWED_CLEANUP_TABLES.has('requests.help_offers')).toBe(true);
    });

    it('allows messaging.messages', () => {
      expect(ALLOWED_CLEANUP_TABLES.has('messaging.messages')).toBe(true);
    });

    it('allows notifications.notifications', () => {
      expect(ALLOWED_CLEANUP_TABLES.has('notifications.notifications')).toBe(true);
    });

    it('contains exactly 4 tables (no accidental additions)', () => {
      expect(ALLOWED_CLEANUP_TABLES.size).toBe(4);
    });
  });
});
