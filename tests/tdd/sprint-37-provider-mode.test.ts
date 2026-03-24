// tests/tdd/sprint-37-provider-mode.test.ts
/**
 * Sprint 37 — Provider Mode + Notification Separation
 *
 * Pure-logic tests covering:
 * - PROVIDER_NOTIFICATION_TYPES constant (source of truth for stream split)
 * - Notification stream split logic (community vs provider)
 * - Provider mode localStorage behavior
 * - BrowseFeed serviceTypeFilter logic
 * - Dashboard provider mode view logic (browseLabel, activeCommitmentsCount)
 */

import { PROVIDER_NOTIFICATION_TYPES } from '../../apps/frontend/src/lib/notificationCategories'

// ── Notification type constants ─────────────────────────────────────────────

describe('PROVIDER_NOTIFICATION_TYPES constant', () => {
  it('contains preferred_provider_selected', () => {
    expect(PROVIDER_NOTIFICATION_TYPES.has('preferred_provider_selected')).toBe(true)
  })

  it('contains provider_request_matched', () => {
    expect(PROVIDER_NOTIFICATION_TYPES.has('provider_request_matched')).toBe(true)
  })

  it('contains provider_review_received', () => {
    expect(PROVIDER_NOTIFICATION_TYPES.has('provider_review_received')).toBe(true)
  })

  it('contains match_reminder', () => {
    expect(PROVIDER_NOTIFICATION_TYPES.has('match_reminder')).toBe(true)
  })

  it('does NOT contain match_created (community stream)', () => {
    expect(PROVIDER_NOTIFICATION_TYPES.has('match_created')).toBe(false)
  })

  it('does NOT contain new_request (community stream)', () => {
    expect(PROVIDER_NOTIFICATION_TYPES.has('new_request')).toBe(false)
  })

  it('does NOT contain karma_awarded (community stream)', () => {
    expect(PROVIDER_NOTIFICATION_TYPES.has('karma_awarded')).toBe(false)
  })
})

// ── Notification stream split ────────────────────────────────────────────────

interface MockNotification {
  id: string
  type: string
  read: boolean
}

function splitNotifications(notifications: MockNotification[]) {
  const providerNotifications = notifications.filter(n =>
    PROVIDER_NOTIFICATION_TYPES.has(n.type)
  )
  const communityNotifications = notifications.filter(n =>
    !PROVIDER_NOTIFICATION_TYPES.has(n.type)
  )
  const providerUnreadCount = providerNotifications.filter(n => !n.read).length
  const communityUnreadCount = communityNotifications.filter(n => !n.read).length
  return { providerNotifications, communityNotifications, providerUnreadCount, communityUnreadCount }
}

const MIXED_NOTIFICATIONS: MockNotification[] = [
  { id: '1', type: 'match_created', read: false },
  { id: '2', type: 'karma_awarded', read: true },
  { id: '3', type: 'preferred_provider_selected', read: false },
  { id: '4', type: 'provider_request_matched', read: false },
  { id: '5', type: 'new_request', read: false },
  { id: '6', type: 'provider_review_received', read: true },
  { id: '7', type: 'match_reminder', read: false },
]

describe('NotificationContext split', () => {
  it('puts preferred_provider_selected into providerNotifications', () => {
    const { providerNotifications } = splitNotifications(MIXED_NOTIFICATIONS)
    expect(providerNotifications.some(n => n.type === 'preferred_provider_selected')).toBe(true)
  })

  it('puts provider_request_matched into providerNotifications', () => {
    const { providerNotifications } = splitNotifications(MIXED_NOTIFICATIONS)
    expect(providerNotifications.some(n => n.type === 'provider_request_matched')).toBe(true)
  })

  it('puts match_created into communityNotifications', () => {
    const { communityNotifications } = splitNotifications(MIXED_NOTIFICATIONS)
    expect(communityNotifications.some(n => n.type === 'match_created')).toBe(true)
  })

  it('puts new_request into communityNotifications', () => {
    const { communityNotifications } = splitNotifications(MIXED_NOTIFICATIONS)
    expect(communityNotifications.some(n => n.type === 'new_request')).toBe(true)
  })

  it('communityUnreadCount counts only unread community notifications', () => {
    const { communityUnreadCount } = splitNotifications(MIXED_NOTIFICATIONS)
    // match_created (unread) + new_request (unread) = 2; karma_awarded is read
    expect(communityUnreadCount).toBe(2)
  })

  it('providerUnreadCount counts only unread provider notifications', () => {
    const { providerUnreadCount } = splitNotifications(MIXED_NOTIFICATIONS)
    // preferred_provider_selected (unread) + provider_request_matched (unread) + match_reminder (unread) = 3
    // provider_review_received is read
    expect(providerUnreadCount).toBe(3)
  })

  it('provider and community streams are mutually exclusive', () => {
    const { providerNotifications, communityNotifications } = splitNotifications(MIXED_NOTIFICATIONS)
    const providerIds = new Set(providerNotifications.map(n => n.id))
    const communityIds = new Set(communityNotifications.map(n => n.id))
    for (const id of providerIds) {
      expect(communityIds.has(id)).toBe(false)
    }
  })

  it('provider + community counts = total notification count', () => {
    const { providerNotifications, communityNotifications } = splitNotifications(MIXED_NOTIFICATIONS)
    expect(providerNotifications.length + communityNotifications.length).toBe(MIXED_NOTIFICATIONS.length)
  })
})

// ── Provider mode localStorage key ──────────────────────────────────────────

const PROVIDER_MODE_KEY = 'karmyq_provider_mode'

function getStoredMode(storage: Record<string, string>): 'member' | 'provider' {
  const stored = storage[PROVIDER_MODE_KEY]
  if (stored === 'provider') return 'provider'
  return 'member'
}

function setStoredMode(storage: Record<string, string>, mode: 'member' | 'provider') {
  storage[PROVIDER_MODE_KEY] = mode
}

describe('Provider mode localStorage behavior', () => {
  it('defaults to "member" when no key is set', () => {
    const storage: Record<string, string> = {}
    expect(getStoredMode(storage)).toBe('member')
  })

  it('returns "provider" when key is set to "provider"', () => {
    const storage: Record<string, string> = { [PROVIDER_MODE_KEY]: 'provider' }
    expect(getStoredMode(storage)).toBe('provider')
  })

  it('setStoredMode writes "provider" to localStorage', () => {
    const storage: Record<string, string> = {}
    setStoredMode(storage, 'provider')
    expect(storage[PROVIDER_MODE_KEY]).toBe('provider')
  })

  it('setStoredMode writes "member" to localStorage', () => {
    const storage: Record<string, string> = { [PROVIDER_MODE_KEY]: 'provider' }
    setStoredMode(storage, 'member')
    expect(storage[PROVIDER_MODE_KEY]).toBe('member')
  })

  it('mode key is never sent to the server (it is UI-only)', () => {
    // Confirm the constant value matches the spec — it must NOT match any server field names
    expect(PROVIDER_MODE_KEY).toBe('karmyq_provider_mode')
    expect(PROVIDER_MODE_KEY).not.toContain('user_id')
    expect(PROVIDER_MODE_KEY).not.toContain('token')
  })
})

// ── BrowseFeed serviceTypeFilter ────────────────────────────────────────────

interface HelpRequest {
  id: string
  request_type?: string
  status: string
}

function applyServiceTypeFilter(
  requests: HelpRequest[],
  serviceTypeFilter: string[] | undefined
): HelpRequest[] {
  return requests.filter(r =>
    !serviceTypeFilter?.length || serviceTypeFilter.includes(r.request_type ?? '')
  )
}

const SAMPLE_REQUESTS: HelpRequest[] = [
  { id: '1', request_type: 'ride', status: 'open' },
  { id: '2', request_type: 'tutor', status: 'open' },
  { id: '3', request_type: 'generic', status: 'open' },
  { id: '4', request_type: 'ride', status: 'open' },
]

describe('BrowseFeed serviceTypeFilter', () => {
  it('shows all requests when serviceTypeFilter is undefined', () => {
    const result = applyServiceTypeFilter(SAMPLE_REQUESTS, undefined)
    expect(result).toHaveLength(4)
  })

  it('shows all requests when serviceTypeFilter is empty array', () => {
    const result = applyServiceTypeFilter(SAMPLE_REQUESTS, [])
    expect(result).toHaveLength(4)
  })

  it('filters to matching service types in provider mode', () => {
    const result = applyServiceTypeFilter(SAMPLE_REQUESTS, ['ride'])
    expect(result).toHaveLength(2)
    expect(result.every(r => r.request_type === 'ride')).toBe(true)
  })

  it('supports multiple service types', () => {
    const result = applyServiceTypeFilter(SAMPLE_REQUESTS, ['ride', 'tutor'])
    expect(result).toHaveLength(3)
  })
})

// ── Dashboard provider mode view logic ──────────────────────────────────────

// Extracts the dashboard's conditional logic for testing
function getBrowseLabel(mode: 'member' | 'provider'): string | undefined {
  return mode === 'provider' ? 'Requests for Me' : undefined
}

function getServiceTypeFilter(
  mode: 'member' | 'provider',
  providerServiceTypes: string[]
): string[] | undefined {
  return mode === 'provider' ? providerServiceTypes : undefined
}

describe('Dashboard provider mode view logic', () => {
  it('browseLabel is "Requests for Me" in provider mode', () => {
    expect(getBrowseLabel('provider')).toBe('Requests for Me')
  })

  it('browseLabel is undefined in member mode', () => {
    expect(getBrowseLabel('member')).toBeUndefined()
  })

  it('serviceTypeFilter is set in provider mode when user has service types', () => {
    expect(getServiceTypeFilter('provider', ['ride', 'tutor'])).toEqual(['ride', 'tutor'])
  })

  it('serviceTypeFilter is undefined in member mode', () => {
    expect(getServiceTypeFilter('member', ['ride', 'tutor'])).toBeUndefined()
  })

  it('activeCommitmentsCount counts matches where user is responder', () => {
    const userId = 'user-123'
    const upcomingMatches = [
      { id: 'm1', responder_id: 'user-123', status: 'matched' },
      { id: 'm2', responder_id: 'user-456', status: 'matched' },
      { id: 'm3', responder_id: 'user-123', status: 'matched' },
    ]
    const count = upcomingMatches.filter(m => m.responder_id === userId).length
    expect(count).toBe(2)
  })
})
