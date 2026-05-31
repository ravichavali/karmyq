import { identityKey, pickCanonical } from '../../src/utils/identity';

describe('Sprint 77 — community identity helpers', () => {
  describe('identityKey', () => {
    it('lowercases and trims name and location', () => {
      expect(identityKey('  PDX Service Providers Network  ', '  Portland, OR  '))
        .toBe('pdx service providers network portland, or');
    });

    it('treats differently-cased name+location as the same identity', () => {
      expect(identityKey('Hello World', 'Austin'))
        .toBe(identityKey('HELLO WORLD', 'austin'));
    });

    it('coalesces null/undefined location to empty string', () => {
      expect(identityKey('Solo Community', null)).toBe('solo community ');
      expect(identityKey('Solo Community', undefined)).toBe('solo community ');
      expect(identityKey('Solo Community')).toBe('solo community ');
    });

    it('distinguishes the same name in different locations', () => {
      expect(identityKey('Helpers', 'Austin'))
        .not.toBe(identityKey('Helpers', 'Portland'));
    });

    it('handles null/undefined name defensively', () => {
      expect(identityKey(undefined as any, 'x')).toBe(' x');
    });
  });

  describe('pickCanonical', () => {
    it('returns null for an empty list', () => {
      expect(pickCanonical([])).toBeNull();
    });

    it('picks the oldest by created_at', () => {
      const rows = [
        { id: 'c', created_at: '2024-03-01T00:00:00Z' },
        { id: 'a', created_at: '2024-01-01T00:00:00Z' },
        { id: 'b', created_at: '2024-02-01T00:00:00Z' },
      ];
      expect(pickCanonical(rows)!.id).toBe('a');
    });

    it('tie-breaks equal created_at by lowest id', () => {
      const rows = [
        { id: 'ffff', created_at: '2024-01-01T00:00:00Z' },
        { id: 'aaaa', created_at: '2024-01-01T00:00:00Z' },
        { id: 'cccc', created_at: '2024-01-01T00:00:00Z' },
      ];
      expect(pickCanonical(rows)!.id).toBe('aaaa');
    });

    it('accepts Date objects for created_at', () => {
      const rows = [
        { id: 'new', created_at: new Date('2025-06-01T00:00:00Z') },
        { id: 'old', created_at: new Date('2025-01-01T00:00:00Z') },
      ];
      expect(pickCanonical(rows)!.id).toBe('old');
    });
  });
});
