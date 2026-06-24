import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

import BelongingGraph from '@/components/BelongingGraph'
import {
  normalizeCommunityDepthGraph,
  mergeGraphData,
} from '@/components/graphs/normalizeGraphData'
import { socialGraphService } from '@/lib/api'
import type { GraphData } from '@/components/graphs/types'

/**
 * Sprint 111 — Belonging Graph foundation (ADR-081)
 *
 * Locks the canonical client model: pure DepthNode/DepthLink normalization, a deterministic graph
 * merge for explorer expansions, and the single <BelongingGraph> wrapper's per-mode fetch dispatch.
 */

jest.mock('@/lib/api', () => ({
  socialGraphService: {
    getTrustGraphAggregate: jest.fn(),
    getTrustGraph: jest.fn(),
    getFullCommunityGraph: jest.fn(),
    getCommunityGraph: jest.fn(),
  },
}))

// Replace next/dynamic with a synchronous stub of the HEB renderer so we can assert the data/props
// the wrapper hands it without exercising D3 or async dynamic loading.
jest.mock('next/dynamic', () => () => {
  const Stub = (props: any) => (
    <div
      data-testid="heb"
      data-mode={props.mode}
      data-nodecount={props.graphData?.nodes?.length ?? 0}
    />
  )
  Stub.displayName = 'TrustGraphHEBStub'
  return Stub
})

const aggregate = socialGraphService.getTrustGraphAggregate as jest.Mock
const trustGraph = socialGraphService.getTrustGraph as jest.Mock
const fullCommunity = socialGraphService.getFullCommunityGraph as jest.Mock
const communityGraph = socialGraphService.getCommunityGraph as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

describe('normalizeCommunityDepthGraph', () => {
  it('maps DepthNode/DepthLink to canonical TrustNode/TrustLink', () => {
    expect(
      normalizeCommunityDepthGraph({
        nodes: [{ id: 'c1', name: 'One', member_count: 12, status: 'active', is_member: true }],
        links: [{ source: 'c1', target: 'c2', weight: 3, type: 'organic' }],
      })
    ).toEqual({
      nodes: [
        expect.objectContaining({
          id: 'c1',
          name: 'One',
          trust_score: 0,
          karma: 0,
          member_count: 12,
          status: 'active',
          is_member: true,
        }),
      ],
      links: [
        { source: 'c1', target: 'c2', raw_weight: 3, effective_weight: 3, type: 'organic' },
      ],
    })
  })
})

describe('mergeGraphData', () => {
  it('dedups nodes by id (min depth), dedups links by endpoint+type, and does not mutate inputs', () => {
    const base: GraphData = {
      nodes: [
        { id: 'a', name: 'A', trust_score: 0, karma: 0, degrees_of_separation: 0 },
        { id: 'b', name: 'B', trust_score: 0, karma: 0, degrees_of_separation: 2 },
      ],
      links: [{ source: 'a', target: 'b', raw_weight: 1, effective_weight: 1 }],
    }
    const expansion: GraphData = {
      nodes: [
        { id: 'b', name: 'B', trust_score: 0, karma: 0, degrees_of_separation: 1 },
        { id: 'c', name: 'C', trust_score: 0, karma: 0, degrees_of_separation: 1 },
      ],
      links: [
        // Same a<->b edge in reverse order: must collapse to one link.
        { source: 'b', target: 'a', raw_weight: 1, effective_weight: 1 },
        { source: 'b', target: 'c', raw_weight: 1, effective_weight: 1 },
      ],
    }
    const baseSnapshot = JSON.parse(JSON.stringify(base))

    const merged = mergeGraphData(base, expansion)

    expect(merged.nodes).toHaveLength(3)
    expect(merged.nodes.find(n => n.id === 'b')!.degrees_of_separation).toBe(1)
    expect(merged.links).toHaveLength(2)
    // Inputs are untouched.
    expect(base).toEqual(baseSnapshot)
  })
})

describe('<BelongingGraph> per-mode fetch dispatch', () => {
  it('ego mode without communityId fetches the cross-community aggregate', async () => {
    aggregate.mockResolvedValue({ data: { nodes: [{ id: 'u1' }], links: [] } })
    render(<BelongingGraph mode="ego" currentUserId="u1" load="immediate" />)
    await waitFor(() => expect(aggregate).toHaveBeenCalledTimes(1))
    expect(trustGraph).not.toHaveBeenCalled()
    expect(fullCommunity).not.toHaveBeenCalled()
  })

  it('ego mode WITH communityId fetches the community-scoped ego graph', async () => {
    trustGraph.mockResolvedValue({ data: { nodes: [{ id: 'u1' }], links: [] } })
    render(<BelongingGraph mode="ego" communityId="c1" currentUserId="u1" load="immediate" />)
    await waitFor(() => expect(trustGraph).toHaveBeenCalledWith('c1'))
    expect(aggregate).not.toHaveBeenCalled()
  })

  it('community mode fetches getFullCommunityGraph(communityId)', async () => {
    fullCommunity.mockResolvedValue({ data: { nodes: [], links: [] } })
    render(<BelongingGraph mode="community" communityId="c1" currentUserId="u1" load="immediate" />)
    await waitFor(() => expect(fullCommunity).toHaveBeenCalledWith('c1'))
  })

  it('communities mode fetches getCommunityGraph then normalizes the payload', async () => {
    communityGraph.mockResolvedValue({
      data: {
        nodes: [{ id: 'c1', name: 'One', member_count: 5, status: 'active', is_member: true }],
        links: [],
      },
    })
    const onDataLoaded = jest.fn()
    render(
      <BelongingGraph mode="communities" currentUserId="u1" load="immediate" onDataLoaded={onDataLoaded} />
    )
    await waitFor(() => expect(onDataLoaded).toHaveBeenCalled())
    expect(onDataLoaded.mock.calls[0][0].nodes[0]).toEqual(
      expect.objectContaining({ id: 'c1', trust_score: 0, member_count: 5 })
    )
  })

  it('renders supplied graphData (fission) without fetching', async () => {
    render(
      <BelongingGraph
        mode="fission"
        currentUserId="u1"
        graphData={{ nodes: [{ id: 'a', name: 'A', trust_score: 0, karma: 0 }], links: [] }}
      />
    )
    await screen.findByTestId('heb')
    expect(aggregate).not.toHaveBeenCalled()
    expect(fullCommunity).not.toHaveBeenCalled()
    expect(communityGraph).not.toHaveBeenCalled()
  })

  it('load="immediate" fetches without waiting for an IntersectionObserver', async () => {
    // IntersectionObserver is intentionally undefined in jsdom; immediate mode must still load.
    expect((globalThis as any).IntersectionObserver).toBeUndefined()
    aggregate.mockResolvedValue({ data: { nodes: [], links: [] } })
    render(<BelongingGraph mode="ego" currentUserId="u1" load="immediate" />)
    await waitFor(() => expect(aggregate).toHaveBeenCalled())
  })

  it('calls onDataLoaded once with the canonical payload', async () => {
    aggregate.mockResolvedValue({
      data: { nodes: [{ id: 'u1', name: 'Me', trust_score: 0, karma: 0 }], links: [] },
    })
    const onDataLoaded = jest.fn()
    render(<BelongingGraph mode="ego" currentUserId="u1" load="immediate" onDataLoaded={onDataLoaded} />)
    await waitFor(() => expect(onDataLoaded).toHaveBeenCalledTimes(1))
    expect(onDataLoaded.mock.calls[0][0]).toEqual({
      nodes: [{ id: 'u1', name: 'Me', trust_score: 0, karma: 0 }],
      links: [],
    })
  })
})
