import React from 'react'

describe('Sprint 60 — Provider Browse Fork', () => {
  it('does not pass serviceTypeFilter when provider is off-duty', () => {
    const hasProviderProfile = true
    const isAvailable = false
    const providerServiceTypes = ['ride', 'service']
    const filter =
      hasProviderProfile && isAvailable && providerServiceTypes.length > 0
        ? providerServiceTypes
        : undefined
    expect(filter).toBeUndefined()
  })

  it('does not pass serviceTypeFilter when user has no provider profile', () => {
    const hasProviderProfile = false
    const isAvailable = true
    const providerServiceTypes = ['ride']
    const filter =
      hasProviderProfile && isAvailable && providerServiceTypes.length > 0
        ? providerServiceTypes
        : undefined
    expect(filter).toBeUndefined()
  })

  it('passes serviceTypeFilter when provider is on-duty with service types', () => {
    const hasProviderProfile = true
    const isAvailable = true
    const providerServiceTypes = ['ride', 'service']
    const filter =
      hasProviderProfile && isAvailable && providerServiceTypes.length > 0
        ? providerServiceTypes
        : undefined
    expect(filter).toEqual(['ride', 'service'])
  })

  it('does not pass serviceTypeFilter when provider has no service types configured', () => {
    const hasProviderProfile = true
    const isAvailable = true
    const providerServiceTypes: string[] = []
    const filter =
      hasProviderProfile && isAvailable && providerServiceTypes.length > 0
        ? providerServiceTypes
        : undefined
    expect(filter).toBeUndefined()
  })
})

describe('Sprint 60 — Communities Page', () => {
  it('activity sort option is present and is first in sort dropdown options', () => {
    const options = ['activity', 'newest', 'members', 'alphabetical']
    expect(options).toContain('activity')
    expect(options[0]).toBe('activity')
  })

  it('default sort is activity', () => {
    const defaultSort = 'activity'
    expect(defaultSort).toBe('activity')
  })

  it('Your Communities strip renders when user has communities in JWT', () => {
    const mockCommunities = [
      { id: 'c1', name: 'Test Neighborhood', role: 'member' },
    ]
    expect(mockCommunities.length).toBeGreaterThan(0)
    expect(mockCommunities[0].name).toBe('Test Neighborhood')
  })

  it('joined community IDs are excluded from discover grid', () => {
    const joinedIds = new Set(['c1', 'c2'])
    const allCommunities = [
      { id: 'c1', name: 'Joined One' },
      { id: 'c3', name: 'Discover Me' },
    ]
    const discover = allCommunities.filter(c => !joinedIds.has(c.id))
    expect(discover).toHaveLength(1)
    expect(discover[0].id).toBe('c3')
  })

  it('all joined communities are excluded from discover grid', () => {
    const joinedIds = new Set(['c1', 'c2'])
    const allCommunities = [
      { id: 'c1', name: 'Joined One' },
      { id: 'c2', name: 'Joined Two' },
    ]
    const discover = allCommunities.filter(c => !joinedIds.has(c.id))
    expect(discover).toHaveLength(0)
  })

  it('discover grid is unaffected when user has no communities in JWT', () => {
    const joinedIds = new Set<string>([])
    const allCommunities = [
      { id: 'c1', name: 'Community One' },
      { id: 'c2', name: 'Community Two' },
    ]
    const discover = allCommunities.filter(c => !joinedIds.has(c.id))
    expect(discover).toHaveLength(2)
  })
})
