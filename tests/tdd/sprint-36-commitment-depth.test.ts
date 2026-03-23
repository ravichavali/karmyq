// tests/tdd/sprint-36-commitment-depth.test.ts

import { sortByActionPriority } from '../../apps/frontend/src/utils/commitmentSort'
import { normalizeTags } from '../../services/community-service/src/utils/tags'
import { isBoostActive } from '../../services/request-service/src/utils/boost'

describe('sortByActionPriority', () => {
  it('sorts proposed before matched before completed', () => {
    const matches = [
      { id: '3', status: 'completed', updated_at: '2026-01-03' },
      { id: '1', status: 'proposed', updated_at: '2026-01-01' },
      { id: '2', status: 'matched', updated_at: '2026-01-02' },
    ]
    const sorted = sortByActionPriority(matches)
    expect(sorted.map(m => m.id)).toEqual(['1', '2', '3'])
  })

  it('within same status tier, sorts by updated_at DESC', () => {
    const matches = [
      { id: 'A', status: 'matched', updated_at: '2026-01-01' },
      { id: 'B', status: 'matched', updated_at: '2026-01-03' },
    ]
    const sorted = sortByActionPriority(matches)
    expect(sorted[0].id).toBe('B')
  })
})

describe('normalizeTags', () => {
  it('lowercases and trims tags', () => {
    expect(normalizeTags(['  Gardening ', 'TECH'])).toEqual(['gardening', 'tech'])
  })
  it('filters empty strings', () => {
    expect(normalizeTags(['', 'food', '  '])).toEqual(['food'])
  })
})

describe('isBoostActive', () => {
  it('returns false when is_boosted is false', () => {
    expect(isBoostActive({ is_boosted: false, boosted_expires_at: null })).toBe(false)
  })
  it('returns false when boost has expired', () => {
    expect(isBoostActive({ is_boosted: true, boosted_expires_at: '2020-01-01' })).toBe(false)
  })
  it('returns true when boost is active and not expired', () => {
    const future = new Date(Date.now() + 3600000).toISOString()
    expect(isBoostActive({ is_boosted: true, boosted_expires_at: future })).toBe(true)
  })
})
