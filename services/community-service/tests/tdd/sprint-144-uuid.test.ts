/**
 * Sprint 144 (BUG-104): request-supplied UUIDs are canonicalized once at parse.
 *
 * PostgreSQL renders uuid values lowercase, so a JS comparison between a DB id and a raw path id
 * fails for an uppercase spelling of the same UUID. The members PUT's last-admin guard compared
 * exactly that way and was skipped (fail-open). canonicalUuid returns the lowercase form or null;
 * it never trims, so a padded id is malformed rather than silently accepted.
 */
import { UUID_RE, canonicalUuid } from '../../src/utils/uuid';

const LOWER = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

describe('Sprint 144 canonicalUuid', () => {
  it('returns a lowercase UUID unchanged', () => {
    expect(canonicalUuid(LOWER)).toBe(LOWER);
  });

  it.each([
    ['uppercase', LOWER.toUpperCase()],
    ['mixed case', '0A1b2C3d-4E5f-4A6b-8C7d-9E0f1A2b3C4d'],
  ])('lowercases a %s UUID', (_label, value) => {
    expect(canonicalUuid(value)).toBe(LOWER);
  });

  it.each([
    ['leading whitespace', ` ${LOWER}`],
    ['trailing whitespace', `${LOWER} `],
    ['trailing newline', `${LOWER}\n`],
    ['empty string', ''],
    ['35 characters', LOWER.slice(0, 35)],
    ['37 characters', `${LOWER}0`],
    ['non-hex digit', LOWER.replace('a', 'g')],
    ['missing hyphens', LOWER.replace(/-/g, '')],
    ['hyphen moved', '0a1b2c3d4-e5f-4a6b-8c7d-9e0f1a2b3c4d'],
  ])('returns null for %s', (_label, value) => {
    expect(canonicalUuid(value)).toBeNull();
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a number', 42],
    ['an object', { id: LOWER }],
    ['an array', [LOWER]],
  ])('returns null for %s', (_label, value) => {
    expect(canonicalUuid(value)).toBeNull();
  });

  it('exports the one case-insensitive UUID regex', () => {
    expect(UUID_RE).toBeInstanceOf(RegExp);
    expect(UUID_RE.flags).toBe('i');
    expect(UUID_RE.source).toBe('^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
    expect(UUID_RE.test(LOWER.toUpperCase())).toBe(true);
  });
});
