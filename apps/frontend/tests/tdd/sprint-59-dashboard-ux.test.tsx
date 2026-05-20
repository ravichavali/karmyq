import React from 'react'
import { render, screen, act } from '@testing-library/react'

jest.mock('@/contexts/ProviderContext', () => ({
  useProvider: () => ({ hasProviderProfile: false, isAvailable: false, setAvailability: jest.fn(), providerProfiles: [] }),
}))

jest.mock('@/hooks/useTrustPath', () => ({
  useTrustPath: () => ({ trustPath: null, loading: false }),
}))

jest.mock('@/lib/api', () => ({
  requestService: {
    getCuratedRequests: jest.fn().mockResolvedValue({ data: { requests: [] } }),
    createMatch: jest.fn(),
  },
}))

import TabBar from '@/components/TabBar'

describe('Sprint 59 — Dashboard UX', () => {
  describe('TabBar', () => {
    it('renders Browse, Helping, and Asks tabs', () => {
      render(<TabBar activeTab="browse" onChange={jest.fn()} />)
      expect(screen.getAllByText('Browse').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Helping').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Asks').length).toBeGreaterThan(0)
    })

    it('does not render Profile, Commitments, or My Requests tabs', () => {
      render(<TabBar activeTab="browse" onChange={jest.fn()} />)
      expect(screen.queryByText('Profile')).toBeNull()
      expect(screen.queryByText('Commitments')).toBeNull()
      expect(screen.queryByText('My Requests')).toBeNull()
      expect(screen.queryByText('Commits')).toBeNull()
    })

    it('has exactly 3 tabs', () => {
      render(<TabBar activeTab="browse" onChange={jest.fn()} />)
      const tabs = screen.getAllByRole('tab')
      expect(tabs).toHaveLength(3)
    })
  })

  describe('BrowseFeed — matched requests excluded', () => {
    it('filters out matched-status requests, showing only open ones', async () => {
      const { requestService } = require('@/lib/api')
      requestService.getCuratedRequests.mockResolvedValue({
        data: {
          requests: [
            { id: '1', title: 'Open request', status: 'open', urgency: 'medium', requester_id: 'other-user', created_at: new Date().toISOString() },
            { id: '2', title: 'Matched request', status: 'matched', urgency: 'medium', requester_id: 'other-user', created_at: new Date().toISOString() },
          ],
        },
      })

      const BrowseFeed = require('@/components/BrowseFeed').default

      await act(async () => {
        render(<BrowseFeed />)
      })

      expect(screen.getByText('Open request')).toBeInTheDocument()
      expect(screen.queryByText('Matched request')).toBeNull()
    })
  })
})
