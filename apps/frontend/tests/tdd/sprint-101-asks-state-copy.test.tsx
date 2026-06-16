/**
 * Sprint 101 — Asks expansion copy must be lifecycle-aware.
 *
 * "No offers yet" is only true for an OPEN ask. A completed/matched/cancelled ask with no live offers
 * was previously also labelled "No offers yet", which reads as a lie about a finished ask. The empty
 * state now reflects the ask's actual lifecycle state.
 */

import { render, screen, fireEvent } from '@testing-library/react'

const getRequests = jest.fn()
const getMatches = jest.fn()
jest.mock('@/lib/api', () => ({
  requestService: {
    getRequests: (...args: unknown[]) => getRequests(...args),
    getMatches: (...args: unknown[]) => getMatches(...args),
    acceptMatch: jest.fn(),
    rejectMatch: jest.fn(),
  },
}))

import MyRequestsTab from '@/components/MyRequestsTab'

beforeEach(() => {
  getRequests.mockReset()
  getMatches.mockReset()
  localStorage.setItem('user', JSON.stringify({ id: 'me' }))
  getMatches.mockResolvedValue({ data: { matches: [] } })
  getRequests.mockResolvedValue({
    data: {
      requests: [
        { id: 'a1', title: 'Open ask', status: 'open', created_at: '2026-06-15T00:00:00Z' },
        { id: 'a2', title: 'Completed ask', status: 'completed', created_at: '2026-06-15T00:00:00Z' },
      ],
    },
  })
})

describe('Sprint 101: state-aware Asks expansion copy', () => {
  it('says no offers yet only for open asks with no offers', async () => {
    render(<MyRequestsTab onNewRequest={jest.fn()} />)
    fireEvent.click(await screen.findByText('Open ask'))
    expect(screen.getByText(/No offers yet/i)).toBeInTheDocument()
  })

  it('does not say no offers yet for completed asks', async () => {
    render(<MyRequestsTab onNewRequest={jest.fn()} />)
    fireEvent.click(await screen.findByText('Completed ask'))
    expect(screen.queryByText(/No offers yet/i)).not.toBeInTheDocument()
    expect(screen.getByText(/This ask is completed/i)).toBeInTheDocument()
  })
})
