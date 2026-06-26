import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import type { GraphData } from '@/components/graphs/types'

/**
 * Sprint 111 — surface migration + raised profile altitude (ADR-081).
 *
 * Community Trust Graph, fission, and profile all render through one <BelongingGraph>; the profile
 * gains a headline "belonging" section with an honest, exact connection/community pulse. Sprint 114
 * retires the dead dashboard widget and the duplicate community "My Network" sub-tab.
 */

// Configurable BelongingGraph stub: emits onDataLoaded (for the profile pulse) and exposes its props.
let stubEmit: GraphData | null = null
jest.mock('@/components/BelongingGraph', () => ({
  __esModule: true,
  default: (props: any) => {
    React.useEffect(() => {
      if (props.onDataLoaded && stubEmit) props.onDataLoaded(stubEmit)
    }, [props.onDataLoaded])
    return (
      <div
        data-testid="belonging-graph"
        data-mode={props.mode}
        data-communityid={props.communityId ?? ''}
        data-height={String(props.height ?? '')}
      />
    )
  },
}))

jest.mock('@/lib/api', () => {
  const ok = (data: any) => jest.fn().mockResolvedValue({ data })
  return {
    socialGraphService: {
      getTrustGraphAggregate: ok({ nodes: [], links: [] }),
      getFullCommunityGraph: ok({ nodes: [], links: [] }),
      getCommunityGraph: ok({ nodes: [], links: [] }),
      getTrustGraph: ok({ nodes: [{ id: 'u1', name: 'Me', trust_score: 0, karma: 0 }], links: [] }),
      getNeighborhood: ok({ nodes: [], links: [] }),
      getFadingRelationships: ok([]),
      getRelationshipMemory: ok({ activeCount: 0, fading: [], nearlyForgotten: [] }),
    },
    communityService: {
      getMyCommunities: jest.fn(),
      getSplitProposal: ok({}),
      updateSplitAssignments: jest.fn().mockResolvedValue({ data: {} }),
    },
  }
})

import TrustGraphTab from '@/components/community/tabs/TrustGraphTab'
import FissionTab from '@/components/community/tabs/FissionTab'
import BelongingSection from '@/components/BelongingSection'
import BelongingPulse from '@/components/BelongingPulse'
import { communityService } from '@/lib/api'

const getMyCommunities = communityService.getMyCommunities as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  stubEmit = null
  getMyCommunities.mockResolvedValue({ data: [{ id: 'c1', name: 'One' }] })
})

describe('community TrustGraphTab', () => {
  it('renders community mode with the communityId and links up to the explorer', async () => {
    render(<TrustGraphTab communityId="c1" currentUserId="u1" />)
    const graph = await screen.findByTestId('belonging-graph')
    expect(graph).toHaveAttribute('data-mode', 'community')
    expect(graph).toHaveAttribute('data-communityid', 'c1')

    expect(screen.queryByRole('button', { name: /my network/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /how communities connect/i })).toHaveAttribute(
      'href',
      '/network?mode=communities'
    )
  })
})

describe('community FissionTab', () => {
  it('renders the fission graph through BelongingGraph in the discussion phase', async () => {
    ;(communityService.getSplitProposal as jest.Mock).mockResolvedValue({
      data: {
        proposal: {
          id: 'p1',
          status: 'discussion',
          group_a_name: 'Left',
          group_b_name: 'Right',
          rationale: '',
          voting_ends_at: null,
          quorum_pct: 50,
          approval_pct: 50,
        },
        assignments: [
          { user_id: 'u1', user_name: 'Me', assigned_to: 'group_a', cluster_suggestion: null, admin_overridden: false },
        ],
        my_vote: null,
        vote_tally: {
          total_members: 1,
          voted_count: 0,
          quorum_pct: 50,
          approval_pct: 50,
          weighted_yes: 0,
          weighted_total: 0,
          approval_ratio: 0,
          quorum_ratio: 0,
        },
      },
    })

    const community: any = {
      id: 'cf',
      active_split_proposal: { id: 'p1', status: 'discussion', group_a_name: 'Left', group_b_name: 'Right' },
    }
    render(<FissionTab community={community} currentUserId="u1" isAdmin={false} onRefresh={jest.fn()} />)

    const graph = await screen.findByTestId('belonging-graph')
    expect(graph).toHaveAttribute('data-mode', 'fission')
  })
})

describe('BelongingPulse copy', () => {
  it('uses exact singular forms', () => {
    render(<BelongingPulse peopleCount={1} communityCount={1} />)
    expect(screen.getByText('You\'re connected to 1 person across 1 community.')).toBeInTheDocument()
  })

  it('uses exact plural forms', () => {
    render(<BelongingPulse peopleCount={3} communityCount={2} />)
    expect(screen.getByText('You\'re connected to 3 people across 2 communities.')).toBeInTheDocument()
  })

  it('omits the community clause when count is unknown', () => {
    render(<BelongingPulse peopleCount={4} />)
    expect(screen.getByText('You\'re connected to 4 people.')).toBeInTheDocument()
  })
})

describe('profile BelongingSection', () => {
  it('headlines belonging, sizes the graph at 480, excludes self from the pulse, and links to the explorer', async () => {
    stubEmit = {
      nodes: [
        { id: 'u1', name: 'Me', trust_score: 0, karma: 0 },
        { id: 'a', name: 'A', trust_score: 0, karma: 0 },
        { id: 'b', name: 'B', trust_score: 0, karma: 0 },
      ],
      links: [],
    }
    render(<BelongingSection userId="u1" />)

    expect(screen.getByText(/woven into Karmyq/i)).toBeInTheDocument()
    const graph = await screen.findByTestId('belonging-graph')
    expect(graph).toHaveAttribute('data-mode', 'ego')
    expect(graph).toHaveAttribute('data-height', '480')

    // 3 nodes minus the current user = 2 people; one community from getMyCommunities.
    await waitFor(() =>
      expect(screen.getByText('You\'re connected to 2 people across 1 community.')).toBeInTheDocument()
    )
    expect(screen.getByRole('link', { name: /explore your full network/i })).toHaveAttribute(
      'href',
      '/network?mode=ego'
    )
  })

  it('falls back to graph-only copy when the membership read fails', async () => {
    getMyCommunities.mockRejectedValue(new Error('nope'))
    stubEmit = {
      nodes: [
        { id: 'u1', name: 'Me', trust_score: 0, karma: 0 },
        { id: 'a', name: 'A', trust_score: 0, karma: 0 },
      ],
      links: [],
    }
    render(<BelongingSection userId="u1" />)

    await waitFor(() =>
      expect(screen.getByText('You\'re connected to 1 person.')).toBeInTheDocument()
    )
  })
})
