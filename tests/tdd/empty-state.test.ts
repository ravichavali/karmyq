// tests/tdd/empty-state.test.ts
/**
 * Pure-logic tests for EmptyState visibility conditions.
 * shouldShowEmptyState determines when to render the EmptyState component.
 */

function shouldShowEmptyState(loading: boolean, count: number): boolean {
  return !loading && count === 0;
}

describe('shouldShowEmptyState', () => {
  it('returns false when loading is true (prevents flash during initial load)', () => {
    expect(shouldShowEmptyState(true, 0)).toBe(false);
  });

  it('returns false when loading and items exist', () => {
    expect(shouldShowEmptyState(true, 5)).toBe(false);
  });

  it('returns false when not loading but items exist', () => {
    expect(shouldShowEmptyState(false, 1)).toBe(false);
    expect(shouldShowEmptyState(false, 10)).toBe(false);
  });

  it('returns true only when not loading AND count is 0', () => {
    expect(shouldShowEmptyState(false, 0)).toBe(true);
  });
});
