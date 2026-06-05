/**
 * Sprint 88 — Community Home shell and altitude.
 */

import { render, screen } from '@testing-library/react'
import BrowseTab from '@/components/community/tabs/BrowseTab'

jest.mock('@/components/Feed/UnifiedFeed', () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="unified-feed">
      Unified feed {props.view} {props.communityId}
    </div>
  ),
}))

jest.mock('@/lib/api', () => ({
  requestService: {
    removeBoost: jest.fn(),
    boostRequest: jest.fn(),
    markUrgent: jest.fn(),
    proposeMatch: jest.fn(),
    adminTriageRequest: jest.fn(),
  },
}))

const community = {
  id: 'comm-1',
  name: 'Hawthorne Mutual Aid',
  community_type: 'mutual_aid',
  members: [],
} as any

const baseProps = {
  communityRequests: [],
  loadingRequests: false,
  loadingStats: false,
  stats: null,
  communityTrust: null,
  loadingTrust: false,
  networkMetrics: null,
  community,
  communityId: 'comm-1',
  isAdmin: false,
  isAdminOrMod: false,
  refetchCommunityRequests: jest.fn(),
}

describe('Community Home shell', () => {
  it('makes the member unified feed the primary Community Home surface', () => {
    render(<BrowseTab {...baseProps} />)

    expect(screen.getByRole('heading', { name: /Ways neighbours can help here/i })).toBeInTheDocument()
    expect(screen.getByTestId('unified-feed')).toHaveTextContent('Unified feed community comm-1')
  })

  it('keeps admin management separate from the member feed', () => {
    render(<BrowseTab {...baseProps} isAdmin isAdminOrMod />)

    expect(screen.getByRole('heading', { name: /Ways neighbours can help here/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Steward requests/i })).toBeInTheDocument()
  })

  it('does not render empty KPI tiles when admin stats are unavailable', () => {
    render(<BrowseTab {...baseProps} isAdmin isAdminOrMod stats={null} />)

    expect(screen.queryByText('Open Requests')).toBeNull()
    expect(screen.queryByText('Fulfilled Rate')).toBeNull()
    expect(screen.queryByText('Avg Response Time')).toBeNull()
  })
})
