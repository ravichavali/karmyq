/**
 * Sprint 88 — Community Home shell and altitude.
 * Updated by Sprint 89 / ADR-068: BrowseTab was split. It is now the member-only Home feed; the
 * admin steward-request manager moved to StewardRequestsAdmin (rendered under Stewardship). These
 * tests follow the surfaces to their new homes.
 */

import { render, screen } from '@testing-library/react'
import BrowseTab from '@/components/community/tabs/BrowseTab'
import StewardRequestsAdmin from '@/components/community/StewardRequestsAdmin'

jest.mock('@/components/Feed/UnifiedFeed', () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="unified-feed">
      Unified feed {props.view} {props.communityId} {props.suppressActivity ? 'suppressed' : ''}
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

const adminProps = {
  communityRequests: [],
  loadingRequests: false,
  loadingStats: false,
  stats: null,
  communityTrust: null,
  loadingTrust: false,
  networkMetrics: null,
  community,
  communityId: 'comm-1',
  isAdmin: true,
  isAdminOrMod: true,
  refetchCommunityRequests: jest.fn(),
}

describe('Community Home shell', () => {
  it('BrowseTab is the member feed and suppresses the in-feed activity card on Home', () => {
    render(<BrowseTab community={community} communityId="comm-1" />)

    expect(screen.getByRole('heading', { name: /Ways neighbours can help here/i })).toBeInTheDocument()
    expect(screen.getByTestId('unified-feed')).toHaveTextContent('Unified feed community comm-1 suppressed')
    // The admin steward manager is NOT in the member feed anymore.
    expect(screen.queryByRole('heading', { name: /Steward requests/i })).toBeNull()
  })

  it('StewardRequestsAdmin renders the steward-request manager for admins', () => {
    render(<StewardRequestsAdmin {...adminProps} />)

    expect(screen.getByRole('heading', { name: /Steward requests/i })).toBeInTheDocument()
  })

  it('StewardRequestsAdmin renders nothing for non-admins', () => {
    const { container } = render(<StewardRequestsAdmin {...adminProps} isAdmin={false} isAdminOrMod={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('does not render empty KPI tiles when admin stats are unavailable', () => {
    render(<StewardRequestsAdmin {...adminProps} stats={null} />)

    expect(screen.queryByText('Open Requests')).toBeNull()
    expect(screen.queryByText('Fulfilled Rate')).toBeNull()
    expect(screen.queryByText('Avg Response Time')).toBeNull()
  })
})
