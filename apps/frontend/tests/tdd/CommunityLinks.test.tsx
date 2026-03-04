/**
 * TDD tests for CommunityLinks component (Sprint 15)
 *
 * Covers:
 * - Renders correctly (loading → content → empty state)
 * - Admin gate: Propose Link + Remove shown only to admins
 * - Calls getLinks API on mount
 * - Calls proposeLink API on form submit with correct payload
 * - Calls approveLink when Approve button clicked
 */

import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import CommunityLinks from '../../src/components/community/CommunityLinks'

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../../src/lib/api', () => ({
  communityLinksService: {
    getLinks: jest.fn(),
    proposeLink: jest.fn(),
    approveLink: jest.fn(),
    removeLink: jest.fn(),
    updateLink: jest.fn(),
  },
}))

const { communityLinksService } = require('../../src/lib/api')

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ACTIVE_LINK = {
  id: 'link-1',
  community_a_id: 'comm-a',
  community_b_id: 'comm-b',
  link_type: 'sister',
  trust_carry_factor: 0.40,
  show_in_sister_feeds: false,
  status: 'active',
  partner_community_id: 'comm-b',
  partner_community_name: 'East Portland Mutual Aid',
  created_at: '2026-03-04T00:00:00Z',
}

const PENDING_LINK = {
  ...ACTIVE_LINK,
  id: 'link-2',
  status: 'pending',
  community_b_id: 'comm-a',  // we are party B, so we can approve
  partner_community_name: 'West Portland Mutual Aid',
}

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
})

describe('CommunityLinks: renders', () => {
  it('shows loading state initially', () => {
    communityLinksService.getLinks.mockReturnValue(new Promise(() => {}))
    render(<CommunityLinks communityId="comm-a" isAdmin={false} />)
    expect(screen.getByText(/loading community links/i)).toBeInTheDocument()
  })

  it('shows empty state when no links exist', async () => {
    communityLinksService.getLinks.mockResolvedValue({ data: { links: [], count: 0 } })
    render(<CommunityLinks communityId="comm-a" isAdmin={false} />)
    await waitFor(() => expect(screen.getByText(/no linked communities yet/i)).toBeInTheDocument())
  })

  it('shows active link partner name', async () => {
    communityLinksService.getLinks.mockResolvedValue({ data: { links: [ACTIVE_LINK], count: 1 } })
    render(<CommunityLinks communityId="comm-a" isAdmin={false} />)
    await waitFor(() => expect(screen.getByText('East Portland Mutual Aid')).toBeInTheDocument())
  })
})

describe('CommunityLinks: admin gate', () => {
  it('shows Propose Link button to admins', async () => {
    communityLinksService.getLinks.mockResolvedValue({ data: { links: [], count: 0 } })
    render(<CommunityLinks communityId="comm-a" isAdmin={true} />)
    await waitFor(() => expect(screen.getByText(/\+ propose link/i)).toBeInTheDocument())
  })

  it('hides Propose Link button from non-admins', async () => {
    communityLinksService.getLinks.mockResolvedValue({ data: { links: [], count: 0 } })
    render(<CommunityLinks communityId="comm-a" isAdmin={false} />)
    await waitFor(() => expect(screen.queryByText(/propose link/i)).not.toBeInTheDocument())
  })

  it('shows Remove button to admins on active links', async () => {
    communityLinksService.getLinks.mockResolvedValue({ data: { links: [ACTIVE_LINK], count: 1 } })
    render(<CommunityLinks communityId="comm-a" isAdmin={true} />)
    await waitFor(() => expect(screen.getByText('Remove')).toBeInTheDocument())
  })

  it('hides Remove button from non-admins', async () => {
    communityLinksService.getLinks.mockResolvedValue({ data: { links: [ACTIVE_LINK], count: 1 } })
    render(<CommunityLinks communityId="comm-a" isAdmin={false} />)
    await waitFor(() => expect(screen.queryByText('Remove')).not.toBeInTheDocument())
  })
})

describe('CommunityLinks: API call on mount', () => {
  it('calls getLinks with communityId on mount', async () => {
    communityLinksService.getLinks.mockResolvedValue({ data: { links: [], count: 0 } })
    render(<CommunityLinks communityId="comm-xyz" isAdmin={false} />)
    await waitFor(() => expect(communityLinksService.getLinks).toHaveBeenCalledWith('comm-xyz'))
  })
})

describe('CommunityLinks: propose link form', () => {
  it('calls proposeLink with correct payload on submit', async () => {
    communityLinksService.getLinks.mockResolvedValue({ data: { links: [], count: 0 } })
    communityLinksService.proposeLink.mockResolvedValue({ data: {} })

    render(<CommunityLinks communityId="comm-a" isAdmin={true} />)
    await waitFor(() => screen.getByText(/\+ propose link/i))

    fireEvent.click(screen.getByText(/\+ propose link/i))
    await waitFor(() => screen.getByPlaceholderText(/paste community uuid/i))

    fireEvent.change(screen.getByPlaceholderText(/paste community uuid/i), {
      target: { value: 'target-uuid-123' },
    })

    const form = screen.getByPlaceholderText(/paste community uuid/i).closest('form')!
    fireEvent.submit(form)

    await waitFor(() =>
      expect(communityLinksService.proposeLink).toHaveBeenCalledWith(
        'comm-a',
        expect.objectContaining({ target_community_id: 'target-uuid-123', link_type: 'sister' })
      )
    )
  })
})

describe('CommunityLinks: pending link approval', () => {
  it('shows Approve button when we are party B of a pending link', async () => {
    communityLinksService.getLinks.mockResolvedValue({ data: { links: [PENDING_LINK], count: 1 } })
    render(<CommunityLinks communityId="comm-a" isAdmin={true} />)
    await waitFor(() => expect(screen.getByText('Approve')).toBeInTheDocument())
  })

  it('calls approveLink when Approve button is clicked', async () => {
    communityLinksService.getLinks.mockResolvedValue({ data: { links: [PENDING_LINK], count: 1 } })
    communityLinksService.approveLink.mockResolvedValue({ data: {} })

    render(<CommunityLinks communityId="comm-a" isAdmin={true} />)
    await waitFor(() => screen.getByText('Approve'))
    fireEvent.click(screen.getByText('Approve'))

    await waitFor(() =>
      expect(communityLinksService.approveLink).toHaveBeenCalledWith('comm-a', 'link-2')
    )
  })
})
