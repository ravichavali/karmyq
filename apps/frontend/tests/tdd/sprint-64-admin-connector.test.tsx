import { isBoostActive } from '@/utils/boost'

describe('isBoostActive', () => {
  it('returns true for an active boost', () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    expect(isBoostActive({ is_boosted: true, boosted_expires_at: future })).toBe(true)
  })

  it('returns false for an expired boost', () => {
    const past = new Date(Date.now() - 1000).toISOString()
    expect(isBoostActive({ is_boosted: true, boosted_expires_at: past })).toBe(false)
  })

  it('returns false when is_boosted is false', () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    expect(isBoostActive({ is_boosted: false, boosted_expires_at: future })).toBe(false)
  })

  it('returns false when boosted_expires_at is null', () => {
    expect(isBoostActive({ is_boosted: true, boosted_expires_at: null })).toBe(false)
  })
})
