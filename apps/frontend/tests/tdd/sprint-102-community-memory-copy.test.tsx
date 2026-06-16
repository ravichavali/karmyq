import { render, screen } from '@testing-library/react'
import CommunityPulse from '@/components/community/CommunityPulse'
import TrustGraphTab from '@/components/community/tabs/TrustGraphTab'

jest.mock('@/lib/api', () => ({
  socialGraphService: {
    getFullCommunityGraph: jest.fn(() => Promise.resolve({ data: { nodes: [], links: [] } })),
    getTrustGraph: jest.fn(() => Promise.resolve({ data: { nodes: [], links: [] } })),
    getFadingRelationships: jest.fn(() => Promise.resolve({ data: [] })),
  },
}))

jest.mock('@/components/TrustGraph', () => ({
  __esModule: true,
  default: () => <div data-testid="trust-graph" />,
}))

jest.mock('@/components/relationships/ReWarmingNudge', () => ({
  __esModule: true,
  default: () => null,
}))

describe('Sprint 102 - community memory copy', () => {
  it('explains fading relationships in the connected tab', async () => {
    render(<TrustGraphTab communityId="community-1" currentUserId="user-1" />)

    expect(screen.getByText(/How memory fades/i)).toBeInTheDocument()
    expect(screen.getByText(/Strong and warm bonds/i)).toBeInTheDocument()
    expect(screen.getByText(/Nearly forgotten bonds/i)).toBeInTheDocument()
  })

  it('reframes helped count as care, not accounting', () => {
    render(
      <CommunityPulse
        pulse={{
          helpedThisWeek: 3,
          openAsks: 0,
          timeSensitive: 0,
          recentJoins: 0,
          recentHelpers: [{ name: 'Maria Reyes', count: 1 }, { name: 'David Park', count: 1 }],
          windowDays: 7,
        }}
        loading={false}
      />,
    )

    expect(screen.getByText(/3 neighbours showed up for one another/i)).toBeInTheDocument()
    expect(screen.getByText(/with care from Maria Reyes, David Park/i)).toBeInTheDocument()
    expect(screen.queryByText(/helped each other/i)).not.toBeInTheDocument()
  })

  it('still suppresses zero helped rows and links open asks', () => {
    render(
      <CommunityPulse
        communityId="community-1"
        pulse={{ helpedThisWeek: 0, openAsks: 4, timeSensitive: 1, recentJoins: 0, recentHelpers: [], windowDays: 7 }}
        loading={false}
      />,
    )

    expect(screen.queryByText(/0 neighbours/i)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /4 open asks across the community/i })).toHaveAttribute(
      'href',
      '/communities/community-1/open-asks',
    )
  })
})
