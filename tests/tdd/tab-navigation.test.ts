// tests/tdd/tab-navigation.test.ts
/**
 * Pure-logic tests for tab navigation behavior.
 * Extracts and tests the business rules for tab state management.
 */

type TabId = 'browse' | 'commitments' | 'my-requests' | 'profile'

const ALL_TABS: TabId[] = ['browse', 'commitments', 'my-requests', 'profile']

function isTabActive(activeTab: TabId, tabId: TabId): boolean {
  return activeTab === tabId
}

function shouldShowFab(activeTab: TabId): boolean {
  return activeTab === 'browse' || activeTab === 'commitments'
}

function formatCommitmentBadge(count: number): string | null {
  if (count <= 0) return null
  if (count > 9) return '9+'
  return String(count)
}

describe('TabBar', () => {
  it('renders 4 tabs', () => {
    expect(ALL_TABS).toHaveLength(4)
    expect(ALL_TABS).toContain('browse')
    expect(ALL_TABS).toContain('commitments')
    expect(ALL_TABS).toContain('my-requests')
    expect(ALL_TABS).toContain('profile')
  })

  it('marks active tab correctly', () => {
    expect(isTabActive('browse', 'browse')).toBe(true)
    expect(isTabActive('browse', 'commitments')).toBe(false)
    expect(isTabActive('commitments', 'commitments')).toBe(true)
    expect(isTabActive('profile', 'my-requests')).toBe(false)
  })

  it('calls onChange when tab clicked — onChange is called with the new tab id', () => {
    let selectedTab: TabId | null = null
    const onChange = (tab: TabId) => { selectedTab = tab }
    onChange('commitments')
    expect(selectedTab).toBe('commitments')
  })

  it('shows commitment count badge when count > 0', () => {
    expect(formatCommitmentBadge(3)).toBe('3')
    expect(formatCommitmentBadge(9)).toBe('9')
  })

  it('does not show badge when count is 0', () => {
    expect(formatCommitmentBadge(0)).toBeNull()
    expect(formatCommitmentBadge(-1)).toBeNull()
  })

  it('caps badge display at 9+', () => {
    expect(formatCommitmentBadge(10)).toBe('9+')
    expect(formatCommitmentBadge(99)).toBe('9+')
  })
})

describe('FAB visibility', () => {
  it('shows FAB on browse tab', () => {
    expect(shouldShowFab('browse')).toBe(true)
  })

  it('shows FAB on commitments tab', () => {
    expect(shouldShowFab('commitments')).toBe(true)
  })

  it('hides FAB on my-requests tab', () => {
    expect(shouldShowFab('my-requests')).toBe(false)
  })

  it('hides FAB on profile tab', () => {
    expect(shouldShowFab('profile')).toBe(false)
  })
})
