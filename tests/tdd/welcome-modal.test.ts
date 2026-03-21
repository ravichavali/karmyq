// tests/tdd/welcome-modal.test.ts
/**
 * Pure-logic tests for WelcomeModal onboarding logic.
 * Tests localStorage-based onboarding state and modal step progression.
 */

function isOnboarded(storageValue: string | null): boolean {
  return storageValue !== null;
}

function shouldShowModal(isLoggedIn: boolean, onboarded: boolean): boolean {
  return isLoggedIn && !onboarded;
}

function stepNext(step: 1 | 2 | 3): 1 | 2 | 3 {
  if (step === 1) return 2;
  if (step === 2) return 3;
  return 3;
}

describe('isOnboarded', () => {
  it('returns false when storageValue is null (not yet onboarded)', () => {
    expect(isOnboarded(null)).toBe(false);
  });

  it('returns true when storageValue is non-null (any value)', () => {
    expect(isOnboarded('1')).toBe(true);
    expect(isOnboarded('true')).toBe(true);
    expect(isOnboarded('')).toBe(true);
  });
});

describe('shouldShowModal', () => {
  it('returns true only when logged in AND not yet onboarded', () => {
    expect(shouldShowModal(true, false)).toBe(true);
  });

  it('returns false when not logged in (no user session)', () => {
    expect(shouldShowModal(false, false)).toBe(false);
    expect(shouldShowModal(false, true)).toBe(false);
  });

  it('returns false when already onboarded', () => {
    expect(shouldShowModal(true, true)).toBe(false);
  });
});

describe('stepNext', () => {
  it('advances step 1 → 2', () => {
    expect(stepNext(1)).toBe(2);
  });

  it('advances step 2 → 3', () => {
    expect(stepNext(2)).toBe(3);
  });

  it('clamps step 3 → 3 (no step 4)', () => {
    expect(stepNext(3)).toBe(3);
  });
});
