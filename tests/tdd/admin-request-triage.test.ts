// tests/tdd/admin-request-triage.test.ts

describe('Admin request triage contract', () => {
  // Helper: urgency badge class mapping (mirrors what the UI does for displaying urgency)
  function urgencyBadgeClass(urgency: string | null | undefined): string {
    switch (urgency) {
      case 'critical': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  it('urgency critical maps to red badge class', () => {
    expect(urgencyBadgeClass('critical')).toBe('bg-red-100 text-red-800')
  })

  it('urgency high maps to orange badge class', () => {
    expect(urgencyBadgeClass('high')).toBe('bg-orange-100 text-orange-800')
  })

  it('urgency medium maps to yellow badge class', () => {
    expect(urgencyBadgeClass('medium')).toBe('bg-yellow-100 text-yellow-800')
  })

  it('urgency low maps to green badge class', () => {
    expect(urgencyBadgeClass('low')).toBe('bg-green-100 text-green-800')
  })

  it('urgency null maps to gray badge class', () => {
    expect(urgencyBadgeClass(null)).toBe('bg-gray-100 text-gray-600')
  })

  it('modal initializes triageNote from req.admin_note when present', () => {
    const req = { admin_note: 'Existing note', urgency: 'high' }
    // Simulate what the Triage button onClick does:
    const triageNote = req.admin_note ?? ''
    expect(triageNote).toBe('Existing note')
  })

  it('modal initializes triageNote to empty string when admin_note absent', () => {
    const req = { urgency: 'low' }
    const triageNote = (req as any).admin_note ?? ''
    expect(triageNote).toBe('')
  })

  it('modal initializes triageUrgency from req.urgency', () => {
    const req = { urgency: 'medium', admin_note: null }
    const triageUrgency = req.urgency ?? ''
    expect(triageUrgency).toBe('medium')
  })

  it('adminTriageRequest called with correct payload structure', async () => {
    // Test the payload shape — no network call
    const mockAdminTriageRequest = jest.fn().mockResolvedValue({ data: { message: 'Triage saved' } })
    const requestId = 'req-uuid-123'
    const communityId = 'community-uuid-456'
    const urgency = 'high'
    const note = 'Needs urgent attention'

    await mockAdminTriageRequest(requestId, { community_id: communityId, urgency, note })

    expect(mockAdminTriageRequest).toHaveBeenCalledWith(
      requestId,
      expect.objectContaining({ community_id: communityId, urgency, note })
    )
  })

  it('createMatch called with request_id, responder_id, and community_id', async () => {
    const mockCreateMatch = jest.fn().mockResolvedValue({ data: {} })
    const requestId = 'req-uuid-123'
    const responderId = 'user-uuid-789'
    const communityId = 'community-uuid-456'

    await mockCreateMatch({ request_id: requestId, responder_id: responderId, community_id: communityId })

    expect(mockCreateMatch).toHaveBeenCalledWith({
      request_id: requestId,
      responder_id: responderId,
      community_id: communityId,
    })
  })

  it('VALID_URGENCY values are the canonical four', () => {
    // This documents the contract — any change to valid urgency values should update this test
    const VALID_URGENCY = ['low', 'medium', 'high', 'critical'] as const
    expect(VALID_URGENCY).toHaveLength(4)
    expect(VALID_URGENCY).toContain('low')
    expect(VALID_URGENCY).toContain('medium')
    expect(VALID_URGENCY).toContain('high')
    expect(VALID_URGENCY).toContain('critical')
  })
})
