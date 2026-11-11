// tests/regression/sprint-36-commitment-depth.test.ts (promoted from tests/tdd/ in Sprint 140)

import { sortByActionPriority } from '../../apps/frontend/src/utils/commitmentSort'
import { normalizeTags } from '../../services/community-service/src/utils/tags'
import { isBoostActive } from '../../services/request-service/src/utils/boost'

// Sprint 43 (c15962cd) changed the sorter's contract from `updated_at` DESC to `created_at` ASC within a status
// tier ("CommitmentsTab sort direction fixed"); Sprint 140 caught these fixtures up. The generic item type is
// preserved, so callers keep their own fields (here `id`).
describe('sortByActionPriority', () => {
  it('sorts proposed before matched before completed', () => {
    const matches = [
      { id: '3', status: 'completed', created_at: '2026-01-01' },
      { id: '1', status: 'proposed', created_at: '2026-01-03' },
      { id: '2', status: 'matched', created_at: '2026-01-02' },
    ]
    const sorted = sortByActionPriority(matches)
    expect(sorted.map(m => m.id)).toEqual(['1', '2', '3'])
  })

  it('within same status tier, sorts by created_at ASC (oldest first)', () => {
    const matches = [
      { id: 'B', status: 'matched', created_at: '2026-01-03' },
      { id: 'A', status: 'matched', created_at: '2026-01-01' },
      { id: 'C', status: 'matched', created_at: '2026-01-02' },
    ]
    const sorted = sortByActionPriority(matches)
    expect(sorted.map(m => m.id)).toEqual(['A', 'C', 'B'])
    expect(matches.map(m => m.id)).toEqual(['B', 'A', 'C']) // input is not mutated
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
