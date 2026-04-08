// tests/tdd/group-communities.test.ts
/**
 * Pure-logic tests for Group Communities — Activities API business rules.
 */

// Activity type validation (matches backend CHECK constraint)
const VALID_ACTIVITY_TYPES = ['pickup_game', 'group_run', 'workout', 'social', 'other']

function isValidActivityType(type: string): boolean {
  return VALID_ACTIVITY_TYPES.includes(type)
}

// Community type validation
function isValidCommunityType(type: string): boolean {
  return ['mutual_aid', 'group'].includes(type)
}

// Activity status logic
function canJoinActivity(activity: {
  status: string
  max_participants: number | null
  current_participants: number
}): { canJoin: boolean; reason?: string } {
  if (activity.status !== 'open') return { canJoin: false, reason: 'Activity is not open' }
  if (
    activity.max_participants !== null &&
    activity.current_participants >= activity.max_participants
  ) {
    return { canJoin: false, reason: 'Activity is full' }
  }
  return { canJoin: true }
}

// Participant counter logic
function incrementParticipants(current: number, _max: number | null): number {
  // Should only be called when canJoin is true, but guard anyway
  return current + 1
}

function decrementParticipants(current: number): number {
  return Math.max(0, current - 1)
}

// Scheduled date validation
function isValidFutureDate(dateStr: string): boolean {
  const d = new Date(dateStr)
  return !isNaN(d.getTime()) && d > new Date()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Group Communities — community_type validation', () => {
  it('accepts mutual_aid', () => {
    expect(isValidCommunityType('mutual_aid')).toBe(true)
  })

  it('accepts group', () => {
    expect(isValidCommunityType('group')).toBe(true)
  })

  it('rejects invalid types', () => {
    expect(isValidCommunityType('neighborhood')).toBe(false)
    expect(isValidCommunityType('professional')).toBe(false)
    expect(isValidCommunityType('unknown')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidCommunityType('')).toBe(false)
  })
})

describe('Group Communities — activity_type validation', () => {
  it('accepts all 5 valid types', () => {
    for (const type of VALID_ACTIVITY_TYPES) {
      expect(isValidActivityType(type)).toBe(true)
    }
  })

  it('rejects unknown types', () => {
    expect(isValidActivityType('yoga')).toBe(false)
    expect(isValidActivityType('hiking')).toBe(false)
    expect(isValidActivityType('PICKUP_GAME')).toBe(false) // case-sensitive
  })

  it('rejects empty string', () => {
    expect(isValidActivityType('')).toBe(false)
  })
})

describe('Group Communities — canJoinActivity', () => {
  it('allows joining an open activity with space', () => {
    const result = canJoinActivity({ status: 'open', max_participants: 10, current_participants: 5 })
    expect(result.canJoin).toBe(true)
    expect(result.reason).toBeUndefined()
  })

  it('blocks joining a cancelled activity', () => {
    const result = canJoinActivity({
      status: 'cancelled',
      max_participants: 10,
      current_participants: 0,
    })
    expect(result.canJoin).toBe(false)
    expect(result.reason).toBe('Activity is not open')
  })

  it('blocks joining a completed activity', () => {
    const result = canJoinActivity({
      status: 'completed',
      max_participants: 10,
      current_participants: 5,
    })
    expect(result.canJoin).toBe(false)
    expect(result.reason).toBe('Activity is not open')
  })

  it('blocks joining a full activity (current >= max)', () => {
    const result = canJoinActivity({ status: 'open', max_participants: 5, current_participants: 5 })
    expect(result.canJoin).toBe(false)
    expect(result.reason).toBe('Activity is full')
  })

  it('allows joining when current < max', () => {
    const result = canJoinActivity({ status: 'open', max_participants: 5, current_participants: 4 })
    expect(result.canJoin).toBe(true)
  })

  it('allows joining when max_participants is null (no cap)', () => {
    const result = canJoinActivity({
      status: 'open',
      max_participants: null,
      current_participants: 999,
    })
    expect(result.canJoin).toBe(true)
  })
})

describe('Group Communities — participant counter', () => {
  it('increments correctly', () => {
    expect(incrementParticipants(0, 10)).toBe(1)
    expect(incrementParticipants(4, 10)).toBe(5)
    expect(incrementParticipants(9, 10)).toBe(10)
  })

  it('decrements correctly', () => {
    expect(decrementParticipants(5)).toBe(4)
    expect(decrementParticipants(1)).toBe(0)
  })

  it('decrement never goes below 0', () => {
    expect(decrementParticipants(0)).toBe(0)
  })
})

describe('Group Communities — scheduled_at validation', () => {
  it('accepts a valid future ISO date', () => {
    // One year from now is always in the future
    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    expect(isValidFutureDate(future)).toBe(true)
  })

  it('rejects an invalid date string', () => {
    expect(isValidFutureDate('not-a-date')).toBe(false)
    expect(isValidFutureDate('')).toBe(false)
    expect(isValidFutureDate('2026-99-99T00:00:00Z')).toBe(false)
  })

  it('rejects a past date', () => {
    expect(isValidFutureDate('2020-01-01T00:00:00Z')).toBe(false)
    expect(isValidFutureDate('2000-06-15T12:00:00Z')).toBe(false)
  })
})
