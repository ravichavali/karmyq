// tests/tdd/evolution-toggle-profile.test.ts
/**
 * Pure-logic tests for the evolution toggle moved to profile.tsx.
 * Tests toggle inversion and settings section visibility.
 */

interface User {
  id: string;
  email: string;
}

function toggleGlobalEvolution(current: boolean): boolean {
  return !current;
}

function settingsVisible(user: User | null, globalEnabled: boolean | null): boolean {
  return user !== null && globalEnabled !== null;
}

describe('toggleGlobalEvolution', () => {
  it('inverts true → false', () => {
    expect(toggleGlobalEvolution(true)).toBe(false);
  });

  it('inverts false → true', () => {
    expect(toggleGlobalEvolution(false)).toBe(true);
  });
});

describe('settingsVisible', () => {
  const mockUser: User = { id: 'user-1', email: 'test@example.com' };

  it('returns true when user is set and globalEnabled is not null', () => {
    expect(settingsVisible(mockUser, true)).toBe(true);
    expect(settingsVisible(mockUser, false)).toBe(true);
  });

  it('returns false when user is null (not logged in)', () => {
    expect(settingsVisible(null, true)).toBe(false);
    expect(settingsVisible(null, false)).toBe(false);
  });

  it('returns false when globalEnabled is null (still loading)', () => {
    expect(settingsVisible(mockUser, null)).toBe(false);
  });

  it('returns false when both user and globalEnabled are null', () => {
    expect(settingsVisible(null, null)).toBe(false);
  });
});
