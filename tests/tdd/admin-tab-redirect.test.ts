// tests/tdd/admin-tab-redirect.test.ts
/**
 * Tests for the old-tab-name → new-tab-name redirect map.
 * This function is extracted from the component for testability.
 */

const OLD_TAB_MAP: Record<string, string> = {
  manage: 'members',
  pending: 'members',
  config: 'settings',
  stats: 'insights',
  export: 'insights',
  links: 'settings',
};

type ValidTab = 'overview' | 'members' | 'norms' | 'requests' | 'insights' | 'settings' | 'providers';

const VALID_TABS: ValidTab[] = ['overview', 'members', 'norms', 'requests', 'insights', 'settings', 'providers'];

function resolveTab(raw: string | undefined): ValidTab {
  if (!raw) return 'overview';
  if (VALID_TABS.includes(raw as ValidTab)) return raw as ValidTab;
  return (OLD_TAB_MAP[raw] as ValidTab) ?? 'overview';
}

describe('resolveTab', () => {
  it('returns overview for undefined', () => {
    expect(resolveTab(undefined)).toBe('overview');
  });

  it('passes through valid new tab names unchanged', () => {
    for (const tab of VALID_TABS) {
      expect(resolveTab(tab)).toBe(tab);
    }
  });

  it('maps manage → members', () => {
    expect(resolveTab('manage')).toBe('members');
  });

  it('maps pending → members', () => {
    expect(resolveTab('pending')).toBe('members');
  });

  it('maps config → settings', () => {
    expect(resolveTab('config')).toBe('settings');
  });

  it('maps stats → insights', () => {
    expect(resolveTab('stats')).toBe('insights');
  });

  it('maps export → insights', () => {
    expect(resolveTab('export')).toBe('insights');
  });

  it('maps links → settings', () => {
    expect(resolveTab('links')).toBe('settings');
  });

  it('falls back to overview for completely unknown tabs', () => {
    expect(resolveTab('gibberish')).toBe('overview');
  });
});
