import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import ActiveTab from '../../src/components/community/tabs/ActiveTab'
import BrowseFeed from '../../src/components/BrowseFeed'

jest.mock('../../src/lib/api', () => ({
  communityService: {
    updateMember: jest.fn().mockResolvedValue({}),
    removeMember: jest.fn().mockResolvedValue({}),
    createNorm: jest.fn().mockResolvedValue({}),
    approveNorm: jest.fn().mockResolvedValue({}),
  },
  requestService: {
    getCuratedRequests: jest.fn().mockResolvedValue({ data: { requests: [] } }),
    createMatch: jest.fn().mockResolvedValue({ data: { id: 'match-1' } }),
  },
}))

jest.mock('../../src/hooks/useTrustPath', () => ({
  useTrustPath: jest.fn().mockReturnValue({ trustPath: null, loading: false }),
}))

jest.mock('../../src/components/TrustPathBadge', () => ({
  __esModule: true,
  default: () => null,
  TrustPathBadgeSkeleton: () => null,
}))

jest.mock('../../src/components/FilterChipRow', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('../../src/components/EmptyState', () => ({
  __esModule: true,
  default: () => <div>No requests</div>,
}))

const makeMember = (id: string, status: 'active' | 'pending', name = `User ${id}`) => ({
  id: `member-${id}`,
  user_id: id,
  user_name: name,
  user_email: `${id}@example.com`,
  role: 'member' as const,
  status,
  joined_at: '2024-01-01T00:00:00Z',
  invited_by_name: null,
  join_request_message: null,
})

const baseCommunity: any = {
  id: 'comm-1',
  name: 'Test Community',
  creator_id: 'creator-1',
  members: [makeMember('user-1', 'active'), makeMember('user-2', 'active')],
}

const baseActiveTabProps = {
  community: baseCommunity,
  norms: [],
  memberTrustScores: {},
  currentUser: { id: 'admin-1' },
  isAdmin: true,
  isAdminOrMod: true,
  isMember: true,
  communityId: 'comm-1',
  refetchCommunity: jest.fn().mockResolvedValue(undefined),
  refetchNorms: jest.fn().mockResolvedValue(undefined),
}

// --- ActiveTab tests ---

describe('ActiveTab — unified layout', () => {
  it('shows pending section when isAdminOrMod and pending members exist', () => {
    const community = {
      ...baseCommunity,
      members: [
        makeMember('user-1', 'active'),
        makeMember('pending-1', 'pending', 'Pending User'),
      ],
    }
    render(<ActiveTab {...baseActiveTabProps} community={community} />)

    expect(screen.getByText('Pending Requests (1)')).toBeInTheDocument()
    expect(screen.getByText('Pending User')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument()
  })

  it('hides pending section when isAdminOrMod but no pending members', () => {
    render(<ActiveTab {...baseActiveTabProps} />)

    expect(screen.queryByText(/Pending Requests/)).not.toBeInTheDocument()
  })

  it('hides pending section from non-admins even when pending members exist', () => {
    const community = {
      ...baseCommunity,
      members: [makeMember('pending-1', 'pending', 'Pending User')],
    }
    render(
      <ActiveTab
        {...baseActiveTabProps}
        community={community}
        isAdminOrMod={false}
        isAdmin={false}
      />
    )

    expect(screen.queryByText(/Pending Requests/)).not.toBeInTheDocument()
  })

  it('norms accordion is closed by default', () => {
    const norms = [
      {
        id: 'norm-1',
        description: 'Be respectful',
        rationale: 'Because community matters',
        status: 'active',
        creator_name: 'Alice',
        approval_count: 3,
        created_at: '2024-01-01T00:00:00Z',
      },
    ]
    render(<ActiveTab {...baseActiveTabProps} norms={norms} />)

    // Toggle button is visible
    expect(screen.getByText('Community Norms (1)')).toBeInTheDocument()
    // Norm content not visible (accordion closed)
    expect(screen.queryByText('Be respectful')).not.toBeInTheDocument()
  })

  it('norms accordion opens on click', () => {
    const norms = [
      {
        id: 'norm-1',
        description: 'Be respectful',
        rationale: 'Because community matters',
        status: 'active',
        creator_name: 'Alice',
        approval_count: 3,
        created_at: '2024-01-01T00:00:00Z',
      },
    ]
    render(<ActiveTab {...baseActiveTabProps} norms={norms} />)

    fireEvent.click(screen.getByText('Community Norms (1)'))

    expect(screen.getByText('Be respectful')).toBeInTheDocument()
  })

  it('shows active members table for admins without needing sub-tab switch', () => {
    render(<ActiveTab {...baseActiveTabProps} />)

    // Active members table renders directly (no sub-tab click needed)
    expect(screen.getByText('User user-1')).toBeInTheDocument()
    expect(screen.getByText('User user-2')).toBeInTheDocument()
  })
})

// --- BrowseFeed tests ---

describe('BrowseFeed — post-offer confirmation', () => {
  const mockRequest = {
    id: 'req-1',
    title: 'Help moving furniture',
    description: 'Need a hand',
    status: 'open',
    urgency: 'medium',
    request_type: 'generic',
    requester_id: 'other-user',
    requester_name: 'Alice',
    created_at: '2024-01-01T00:00:00Z',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn((key: string) => {
          if (key === 'user') return JSON.stringify({ id: 'current-user' })
          if (key === 'karmyq_browse_mode') return 'provider'
          return null
        }),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    })
    const { requestService } = require('../../src/lib/api')
    requestService.getCuratedRequests.mockResolvedValue({
      data: { requests: [mockRequest] },
    })
    requestService.createMatch.mockResolvedValue({ data: { id: 'match-1' } })
  })

  it('shows offer confirmation with Active tab link after successful match creation', async () => {
    render(<BrowseFeed />)

    await waitFor(() => {
      expect(screen.getByText('Help moving furniture')).toBeInTheDocument()
    })

    const offerButton = screen.getByRole('button', { name: 'Offer to Help' })
    await act(async () => {
      fireEvent.click(offerButton)
    })

    await waitFor(() => {
      expect(screen.getByText('Offer sent!')).toBeInTheDocument()
    })

    const trackLink = screen.getByRole('link', { name: /Track in Active tab/i })
    expect(trackLink).toHaveAttribute('href', '/dashboard?tab=helping')
  })

  it('removes the offered request from feed after offer is sent', async () => {
    render(<BrowseFeed />)

    await waitFor(() => {
      expect(screen.getByText('Help moving furniture')).toBeInTheDocument()
    })

    const offerButton = screen.getByRole('button', { name: 'Offer to Help' })
    await act(async () => {
      fireEvent.click(offerButton)
    })

    await waitFor(() => {
      expect(screen.queryByText('Help moving furniture')).not.toBeInTheDocument()
    })
  })
})
