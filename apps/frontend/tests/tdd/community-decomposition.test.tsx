/**
 * Sprint 57: Community page decomposition smoke tests
 * Verifies that the extracted components render without errors
 * and receive their required props correctly.
 */

import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
  MockLink.displayName = 'MockLink'
  return MockLink
})

jest.mock('@/lib/api', () => ({
  communityService: {
    updateConfig: jest.fn(),
    updateSettings: jest.fn(),
    createNorm: jest.fn(),
    approveNorm: jest.fn(),
    updateMember: jest.fn(),
    removeMember: jest.fn(),
    exportCommunityData: jest.fn(),
    exportMembers: jest.fn(),
    exportActivity: jest.fn(),
    getProviderConfig: jest.fn().mockResolvedValue({ data: {} }),
    updateProviderConfig: jest.fn(),
  },
  reputationService: {
    getCommunityTrust: jest.fn(),
    getNetworkMetrics: jest.fn(),
    getCommunityEvolutionStatus: jest.fn().mockResolvedValue({ data: {} }),
    getCommunityEvolutionSummary: jest.fn().mockResolvedValue({ data: {} }),
    updateCommunityEvolution: jest.fn(),
    getTrustScore: jest.fn(),
    boostRequest: jest.fn(),
    triageRequest: jest.fn(),
    proposeMatch: jest.fn(),
  },
  requestService: { getRequests: jest.fn() },
  collectiveService: { listCollectivesByCommunity: jest.fn() },
}))

jest.mock('@/components/providers/CollectiveDiscoveryPanel', () => {
  const Mock = () => <div data-testid="collective-discovery-panel" />
  Mock.displayName = 'CollectiveDiscoveryPanel'
  return Mock
})

jest.mock('@/components/providers/CollectiveCardRich', () => {
  const Mock = () => <div data-testid="collective-card-rich" />
  Mock.displayName = 'CollectiveCardRich'
  return Mock
})

jest.mock('@/components/CommunityConfigEditor', () => {
  const Mock = () => <div data-testid="community-config-editor" />
  Mock.displayName = 'CommunityConfigEditor'
  return { __esModule: true, default: Mock }
})

jest.mock('@/components/CommunityTrustQuestionnaire', () => {
  const Mock = () => <div data-testid="community-trust-questionnaire" />
  Mock.displayName = 'CommunityTrustQuestionnaire'
  return { __esModule: true, default: Mock }
})

jest.mock('@/components/TrustModelDiff', () => {
  const Mock = () => <div data-testid="trust-model-diff" />
  Mock.displayName = 'TrustModelDiff'
  return { __esModule: true, default: Mock }
})

jest.mock('@/components/community/CommunityLinks', () => {
  const Mock = () => <div data-testid="community-links" />
  Mock.displayName = 'CommunityLinks'
  return { __esModule: true, default: Mock }
})

const mockCommunity = {
  id: 'comm-1',
  name: 'Test Community',
  description: 'A test community',
  current_members: 5,
  max_members: 50,
  access_type: 'public' as const,
  creator_id: 'user-1',
  creator_name: 'Alice',
  status: 'active',
  members: [
    { id: 'm1', user_id: 'user-1', user_name: 'Alice', user_email: 'alice@example.com', role: 'admin', status: 'active', joined_at: '2024-01-01' },
    { id: 'm2', user_id: 'user-2', user_name: 'Bob', user_email: 'bob@example.com', role: 'member', status: 'active', joined_at: '2024-01-02' },
  ],
  community_type: 'mutual_aid',
}

// Sprint 89 / ADR-068: CommunityHeader was retired in favour of the warm CommunityHero, which
// embeds the same join-CTA logic. These assertions follow that behaviour onto the hero.
describe('CommunityHero', () => {
  let CommunityHero: React.ComponentType<any>

  beforeAll(async () => {
    CommunityHero = (await import('@/components/community/CommunityHero')).default
  })

  it('renders community name and mission', () => {
    render(
      <CommunityHero
        community={mockCommunity}
        isMember={false}
        isPending={false}
        isAdmin={false}
        joiningCommunity={false}
        onJoin={jest.fn()}
      />
    )
    expect(screen.getByText('Test Community')).toBeInTheDocument()
    expect(screen.getByText(/A test community/)).toBeInTheDocument()
  })

  it('shows join button for non-members', () => {
    render(
      <CommunityHero
        community={mockCommunity}
        isMember={false}
        isPending={false}
        isAdmin={false}
        joiningCommunity={false}
        onJoin={jest.fn()}
      />
    )
    expect(screen.getByText('Join Community')).toBeInTheDocument()
  })

  it('shows pending badge when join request is pending', () => {
    render(
      <CommunityHero
        community={mockCommunity}
        isMember={false}
        isPending={true}
        isAdmin={false}
        joiningCommunity={false}
        onJoin={jest.fn()}
      />
    )
    expect(screen.getByText(/Join Request Pending/)).toBeInTheDocument()
  })

  it('hides join button for active members', () => {
    render(
      <CommunityHero
        community={mockCommunity}
        isMember={true}
        isPending={false}
        isAdmin={false}
        joiningCommunity={false}
        onJoin={jest.fn()}
      />
    )
    expect(screen.queryByText('Join Community')).not.toBeInTheDocument()
  })

  it('shows Schema Manager link for admins', () => {
    render(
      <CommunityHero
        community={mockCommunity}
        isMember={true}
        isPending={false}
        isAdmin={true}
        joiningCommunity={false}
        onJoin={jest.fn()}
      />
    )
    expect(screen.getByText(/Schema Manager/)).toBeInTheDocument()
  })

  it('shows "Community Full" when at capacity', () => {
    const fullCommunity = { ...mockCommunity, current_members: 50, max_members: 50 }
    render(
      <CommunityHero
        community={fullCommunity}
        isMember={false}
        isPending={false}
        isAdmin={false}
        joiningCommunity={false}
        onJoin={jest.fn()}
      />
    )
    expect(screen.getByText('Community Full')).toBeInTheDocument()
  })

  it('shows "Request to Join" for private communities', () => {
    const privateCommunity = { ...mockCommunity, access_type: 'private' as const }
    render(
      <CommunityHero
        community={privateCommunity}
        isMember={false}
        isPending={false}
        isAdmin={false}
        joiningCommunity={false}
        onJoin={jest.fn()}
      />
    )
    expect(screen.getByText('Request to Join')).toBeInTheDocument()
  })

  it('shows the warm capline with neighbours count and room remaining', () => {
    render(
      <CommunityHero
        community={mockCommunity}
        isMember={false}
        isPending={false}
        isAdmin={false}
        joiningCommunity={false}
        onJoin={jest.fn()}
      />
    )
    expect(screen.getByText(/room for/)).toBeInTheDocument()
    expect(screen.getByText(/45/)).toBeInTheDocument() // 50 cap − 5 members
  })
})

describe('ProfileTab overview section', () => {
  let ProfileTab: React.ComponentType<any>

  beforeAll(async () => {
    ProfileTab = (await import('@/components/community/tabs/ProfileTab')).default
  })

  const baseProps = {
    section: 'overview' as const,
    community: mockCommunity,
    config: null,
    settings: null,
    stats: null,
    communityCollectives: [],
    currentUser: { id: 'user-1' },
    isAdmin: false,
    communityId: 'comm-1',
    refetchCommunityCollectives: jest.fn(),
  }

  it('renders overview heading', () => {
    render(<ProfileTab {...baseProps} />)
    expect(screen.getByText('About this Community')).toBeInTheDocument()
  })

  it('shows description in overview', () => {
    render(<ProfileTab {...baseProps} />)
    expect(screen.getByText('A test community')).toBeInTheDocument()
  })

  it('renders providers section without crashing', () => {
    render(<ProfileTab {...baseProps} section="providers" />)
    // Should render without throwing
    expect(document.body).toBeTruthy()
  })

  it('renders settings section without crashing', () => {
    render(<ProfileTab {...baseProps} section="settings" />)
    expect(document.body).toBeTruthy()
  })
})
