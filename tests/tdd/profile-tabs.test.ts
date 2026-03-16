/**
 * TDD: Profile page tab bar visibility logic
 * Sprint 27 - Profile Unification
 */

// Simulate the tab visibility logic extracted from profile.tsx
type ActiveTab = 'community' | 'provider';

function resolveActiveTab(
  queryTab: string | undefined,
  hasProviders: boolean
): ActiveTab {
  if (queryTab === 'provider' && hasProviders) return 'provider';
  return 'community';
}

function shouldShowProviderTab(myProviders: any[]): boolean {
  return myProviders.length > 0;
}

describe('Profile tab visibility', () => {
  describe('shouldShowProviderTab', () => {
    it('shows provider tab when user has at least one provider profile', () => {
      const providers = [{ id: 'p1', service_type: 'ride', display_name: 'Alice' }];
      expect(shouldShowProviderTab(providers)).toBe(true);
    });

    it('hides provider tab when user has no provider profiles', () => {
      expect(shouldShowProviderTab([])).toBe(false);
    });

    it('shows provider tab when user has multiple provider profiles', () => {
      const providers = [
        { id: 'p1', service_type: 'ride', display_name: 'Alice' },
        { id: 'p2', service_type: 'tutor', display_name: 'Alice Tutoring' },
      ];
      expect(shouldShowProviderTab(providers)).toBe(true);
    });
  });

  describe('resolveActiveTab', () => {
    it('defaults to community tab when no query param', () => {
      expect(resolveActiveTab(undefined, true)).toBe('community');
    });

    it('defaults to community tab when query param is invalid', () => {
      expect(resolveActiveTab('unknown', true)).toBe('community');
    });

    it('activates provider tab when query param is "provider" and user has providers', () => {
      expect(resolveActiveTab('provider', true)).toBe('provider');
    });

    it('falls back to community tab when query param is "provider" but user has no providers', () => {
      expect(resolveActiveTab('provider', false)).toBe('community');
    });

    it('activates community tab when query param is "community"', () => {
      // 'community' is not 'provider', so returns 'community'
      expect(resolveActiveTab('community', true)).toBe('community');
    });
  });
});
