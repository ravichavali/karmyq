// Sprint 50: Provider Mode + Dibs for All Request Types
// Uses real DB — requires running postgres

describe('Sprint 50 — Provider Mode + Dibs', () => {
  describe('Provider availability sync', () => {
    it.todo('setProviderMode → calls PATCH /providers/:id/availability with is_available=true when switching to provider')
    it.todo('setProviderMode → calls PATCH /providers/:id/availability with is_available=false when switching to member')
  })

  describe('Dibs — all request types', () => {
    it.todo('GET /requests/:id/dibs-candidate returns a candidate for a non-scheduled request')
    it.todo('POST /requests/:id/dibs succeeds for a non-scheduled (ASAP) request')
    it.todo('POST /requests/:id/dibs sets expires_at to ~24h from now for non-scheduled requests')
    it.todo('POST /requests/:id/dibs sets expires_at to 20% of lead time for scheduled requests')
  })

  describe('Mutual aid candidates', () => {
    it.todo('GET /requests/:id/dibs-candidate?type=generic returns a non-provider with prior match history')
    it.todo('GET /requests/:id/dibs-candidate?type=service returns only provider-profile users')
    it.todo('returns null when requester has no prior interactions')
  })

  describe('Off-duty commitment persistence', () => {
    it.todo('toggling provider mode to member does not change status of existing pending dibs')
    it.todo('toggling provider mode to member does not cancel matched requests')
  })
})
