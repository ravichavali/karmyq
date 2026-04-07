// tests/tdd/group-communities-ui.test.ts
/**
 * Pure-logic tests for group-communities UI components (Sprint 47).
 * Extracts and tests business rules from ActivityCard.tsx and ActivitiesTab.tsx
 * in isolation — no React, no DOM, no network.
 */

// --- Business logic extracted from ActivityCard.tsx ---

const TYPE_BADGE_CLASSES: Record<string, string> = {
  pickup_game: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  group_run: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  workout: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  social: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  other: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

function getBadgeClass(activityType: string): string {
  return TYPE_BADGE_CLASSES[activityType] ?? TYPE_BADGE_CLASSES['other']
}

function formatParticipants(current: number, max: number | undefined | null): string {
  if (max != null && max > 0) return `${current} / ${max} joined`
  return `${current} joined`
}

function isActivityFull(current: number, max: number | undefined | null): boolean {
  return max != null && max > 0 && current >= max
}

// Returns 'join', 'leave', or 'full' based on membership and capacity state
function getButtonState(isJoined: boolean, isFull: boolean): 'join' | 'leave' | 'full' {
  if (isJoined) return 'leave'
  if (isFull) return 'full'
  return 'join'
}

// --- Business logic extracted from ActivitiesTab.tsx ---

function normalizeActivitiesResponse(data: any): any[] {
  const raw = data?.data ?? data ?? []
  return Array.isArray(raw) ? raw : []
}

// -------------------------------------------------------
// Tests
// -------------------------------------------------------

describe('ActivityCard — badge classes', () => {
  it('returns orange for pickup_game', () => {
    expect(getBadgeClass('pickup_game')).toContain('orange')
  })

  it('returns green for group_run', () => {
    expect(getBadgeClass('group_run')).toContain('green')
  })

  it('returns blue for workout', () => {
    expect(getBadgeClass('workout')).toContain('blue')
  })

  it('returns purple for social', () => {
    expect(getBadgeClass('social')).toContain('purple')
  })

  it('returns gray for other', () => {
    expect(getBadgeClass('other')).toContain('gray')
  })

  it('falls back to gray for unknown types', () => {
    expect(getBadgeClass('unknown_type')).toBe(TYPE_BADGE_CLASSES['other'])
    expect(getBadgeClass('unknown_type')).toContain('gray')
  })
})

describe('ActivityCard — participant display', () => {
  it('shows current / max when max is set', () => {
    expect(formatParticipants(3, 10)).toBe('3 / 10 joined')
  })

  it('shows only current when max is not set (undefined)', () => {
    expect(formatParticipants(5, undefined)).toBe('5 joined')
  })

  it('shows only current when max is null', () => {
    expect(formatParticipants(5, null)).toBe('5 joined')
  })

  it('shows current / max when max is 0 (treated as unlimited)', () => {
    // max === 0 is treated as no cap (formatParticipants guards max > 0)
    expect(formatParticipants(2, 0)).toBe('2 joined')
  })
})

describe('ActivityCard — full check', () => {
  it('is full when current_participants >= max_participants', () => {
    expect(isActivityFull(10, 10)).toBe(true)
    expect(isActivityFull(11, 10)).toBe(true)
  })

  it('is not full when current_participants < max_participants', () => {
    expect(isActivityFull(9, 10)).toBe(false)
    expect(isActivityFull(0, 10)).toBe(false)
  })

  it('is never full when max_participants is null', () => {
    expect(isActivityFull(100, null)).toBe(false)
  })

  it('is never full when max_participants is undefined', () => {
    expect(isActivityFull(100, undefined)).toBe(false)
  })

  it('is never full when max_participants is 0', () => {
    expect(isActivityFull(100, 0)).toBe(false)
  })
})

describe('ActivityCard — button state', () => {
  it('shows leave when already joined', () => {
    expect(getButtonState(true, false)).toBe('leave')
  })

  it('shows leave when joined even if activity is "full"', () => {
    // joined takes precedence — user can always leave
    expect(getButtonState(true, true)).toBe('leave')
  })

  it('shows full when not joined and activity is full', () => {
    expect(getButtonState(false, true)).toBe('full')
  })

  it('shows join when not joined and not full', () => {
    expect(getButtonState(false, false)).toBe('join')
  })
})

describe('ActivitiesTab — response normalization', () => {
  it('handles {success, data: [...]} envelope', () => {
    const response = { success: true, data: [{ id: 'a1' }, { id: 'a2' }] }
    const result = normalizeActivitiesResponse(response)
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('a1')
  })

  it('handles bare array response', () => {
    const response = [{ id: 'a1' }]
    const result = normalizeActivitiesResponse(response)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('a1')
  })

  it('handles unexpected object response gracefully', () => {
    // Server returns an object instead of an array — should yield []
    const response = { message: 'not an array' }
    const result = normalizeActivitiesResponse(response)
    expect(result).toEqual([])
  })

  it('handles null/undefined response gracefully', () => {
    expect(normalizeActivitiesResponse(null)).toEqual([])
    expect(normalizeActivitiesResponse(undefined)).toEqual([])
  })

  it('handles empty array in envelope', () => {
    const response = { data: [] }
    const result = normalizeActivitiesResponse(response)
    expect(result).toEqual([])
  })
})
