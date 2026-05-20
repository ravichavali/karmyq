// apps/frontend/tests/tdd/sprint-61-on-duty-browse.test.tsx

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import BrowseFeed from '@/components/BrowseFeed'
import { requestService } from '@/lib/api'

// Mock the API and hooks
jest.mock('@/lib/api', () => ({
  requestService: {
    getCuratedRequests: jest.fn(),
    createMatch: jest.fn(),
  },
}))
jest.mock('@/hooks/useTrustPath', () => ({
  useTrustPath: () => ({ trustPath: null, loading: false }),
}))

const MOCK_REQUESTS = [
  {
    id: 'r1', title: 'Need a ride', description: 'Downtown', status: 'open',
    urgency: 'medium', request_type: 'ride', requester_id: 'user-2',
    requester_name: 'Alice', created_at: new Date().toISOString(),
  },
  {
    id: 'r2', title: 'Fix my sink', description: 'Kitchen', status: 'open',
    urgency: 'low', request_type: 'service', requester_id: 'user-3',
    requester_name: 'Bob', created_at: new Date().toISOString(),
  },
  {
    id: 'r3', title: 'Borrow a drill', description: 'Weekend project', status: 'open',
    urgency: 'low', request_type: 'borrow', requester_id: 'user-4',
    requester_name: 'Carol', created_at: new Date().toISOString(),
  },
]

beforeEach(() => {
  ;(requestService.getCuratedRequests as jest.Mock).mockResolvedValue({
    data: { requests: MOCK_REQUESTS },
  })
  localStorage.clear()
  // Mock current user so all requests pass the requester_id filter
  localStorage.setItem('user', JSON.stringify({ id: 'user-1' }))
})

describe('BrowseFeed — off-duty (no segmented control)', () => {
  it('does not show segmented control when isOnDuty is false', async () => {
    render(<BrowseFeed isOnDuty={false} providerServiceTypes={['ride']} />)
    await waitFor(() => expect(screen.queryByRole('button', { name: /community/i })).toBeNull())
    expect(screen.queryByRole('button', { name: /provider/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /both/i })).toBeNull()
  })

  it('shows all requests when off-duty', async () => {
    render(<BrowseFeed isOnDuty={false} providerServiceTypes={['ride']} />)
    await waitFor(() => expect(screen.getByText('Need a ride')).toBeInTheDocument())
    expect(screen.getByText('Fix my sink')).toBeInTheDocument()
    expect(screen.getByText('Borrow a drill')).toBeInTheDocument()
  })
})

describe('BrowseFeed — on-duty segmented control', () => {
  it('shows Community / Provider / Both chips when isOnDuty is true', async () => {
    render(<BrowseFeed isOnDuty providerServiceTypes={['ride']} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /community/i })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /provider/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /both/i })).toBeInTheDocument()
  })

  it('defaults to Provider mode on first on-duty visit', async () => {
    render(<BrowseFeed isOnDuty providerServiceTypes={['ride']} />)
    await waitFor(() => screen.getByRole('button', { name: /provider/i }))
    // Provider mode: only ride requests shown
    expect(screen.getByText('Need a ride')).toBeInTheDocument()
    expect(screen.queryByText('Fix my sink')).toBeNull()
    expect(screen.queryByText('Borrow a drill')).toBeNull()
  })

  it('Community mode shows all requests without service type filter', async () => {
    render(<BrowseFeed isOnDuty providerServiceTypes={['ride']} />)
    await waitFor(() => screen.getByRole('button', { name: /community/i }))
    fireEvent.click(screen.getByRole('button', { name: /community/i }))
    await waitFor(() => expect(screen.getByText('Fix my sink')).toBeInTheDocument())
    expect(screen.getByText('Need a ride')).toBeInTheDocument()
    expect(screen.getByText('Borrow a drill')).toBeInTheDocument()
  })

  it('Both mode shows all requests', async () => {
    render(<BrowseFeed isOnDuty providerServiceTypes={['ride']} />)
    await waitFor(() => screen.getByRole('button', { name: /both/i }))
    fireEvent.click(screen.getByRole('button', { name: /both/i }))
    await waitFor(() => expect(screen.getByText('Fix my sink')).toBeInTheDocument())
    expect(screen.getByText('Need a ride')).toBeInTheDocument()
    expect(screen.getByText('Borrow a drill')).toBeInTheDocument()
  })
})

describe('BrowseFeed — localStorage persistence', () => {
  it('persists browseMode to localStorage on chip click', async () => {
    render(<BrowseFeed isOnDuty providerServiceTypes={['ride']} />)
    await waitFor(() => screen.getByRole('button', { name: /community/i }))
    fireEvent.click(screen.getByRole('button', { name: /community/i }))
    expect(localStorage.getItem('karmyq_browse_mode')).toBe('community')
  })

  it('restores browseMode from localStorage on mount', async () => {
    localStorage.setItem('karmyq_browse_mode', 'both')
    render(<BrowseFeed isOnDuty providerServiceTypes={['ride']} />)
    await waitFor(() => expect(screen.getByText('Fix my sink')).toBeInTheDocument())
    // Both mode — all requests visible
    expect(screen.getByText('Need a ride')).toBeInTheDocument()
    expect(screen.getByText('Borrow a drill')).toBeInTheDocument()
  })
})

describe('BrowseFeed — card accents', () => {
  it('does not show "Provider match" badge in Community mode', async () => {
    render(<BrowseFeed isOnDuty providerServiceTypes={['ride']} />)
    await waitFor(() => screen.getByRole('button', { name: /community/i }))
    fireEvent.click(screen.getByRole('button', { name: /community/i }))
    await waitFor(() => screen.getByText('Need a ride'))
    expect(screen.queryByText(/provider match/i)).toBeNull()
  })

  it('shows "Provider match" badge on matching cards in Both mode', async () => {
    render(<BrowseFeed isOnDuty providerServiceTypes={['ride']} />)
    await waitFor(() => screen.getByRole('button', { name: /both/i }))
    fireEvent.click(screen.getByRole('button', { name: /both/i }))
    await waitFor(() => screen.getByText('Need a ride'))
    expect(screen.getByText(/provider match/i)).toBeInTheDocument()
  })
})
