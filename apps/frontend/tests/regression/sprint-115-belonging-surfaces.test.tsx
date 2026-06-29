import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

/**
 * Sprint 115 — contextual dispatch + surface integration (ADR-083).
 *
 * <BelongingGraph> stops routing every mode through one HEB renderer and dispatches each mode to a
 * purpose-built renderer (ego orbit / community ring / community hub / fission HEB). The profile owns a
 * single replaceable expansion, and /network threads stable baseline/expansion identity plus mode-aware
 * completeness copy. The leaf renderers are mocked so these tests assert dispatch + surface wiring, not
 * geometry (that lives in the model/renderer regression suites).
 */

// next/dynamic only wraps the fission HEB renderer now; stub it synchronously.
jest.mock('next/dynamic', () => () => {
  const Heb = (props: any) => <div data-testid="heb" data-mode={props.mode} />
  Heb.displayName = 'HebStub'
  return Heb
})

jest.mock('@/components/graphs/EgoOrbitGraph', () => ({
  __esModule: true,
  default: (props: any) => (
    <div
      data-testid="ego"
      data-baseline={(props.baselineNodeIds ?? []).join(',')}
      data-expansion={(props.expansionRootIds ?? []).join(',')}
    >
      {(props.graphData?.nodes ?? []).map((node: any) => (
        <button
          key={node.id}
          data-testid={`ego-node-${node.id}`}
          onClick={() => props.onNodeActivate?.(node.id)}
        >
          {node.name}
        </button>
      ))}
    </div>
  ),
}))

jest.mock('@/components/graphs/CommunityRingGraph', () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="community-ring" data-total={props.graphData?.meta?.totalActiveMembers ?? ''} />
  ),
}))

jest.mock('@/components/graphs/CommunityHubGraph', () => ({
  __esModule: true,
  default: () => <div data-testid="community-hub" />,
}))

jest.mock('@/components/Layout', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}))

const mockReplace = jest.fn()
let routerQuery: Record<string, string> = {}
jest.mock('next/router', () => ({
  useRouter: () => ({
    query: routerQuery,
    replace: mockReplace,
    push: jest.fn(),
    pathname: '/network',
    isReady: true,
    events: { on: jest.fn(), off: jest.fn(), emit: jest.fn() },
  }),
}))

jest.mock('@/lib/api', () => ({
  socialGraphService: {
    getTrustGraphAggregate: jest.fn(),
    getTrustGraph: jest.fn(),
    getFullCommunityGraph: jest.fn(),
    getCommunityGraph: jest.fn(),
    getNeighborhood: jest.fn(),
  },
  communityService: {
    getMyCommunities: jest.fn(),
  },
}))

import BelongingGraph from '@/components/BelongingGraph'
import BelongingSection from '@/components/BelongingSection'
import NetworkPage from '@/pages/network'
import { normalizePersonGraph } from '@/components/graphs/normalizeGraphData'
import { socialGraphService, communityService } from '@/lib/api'

const aggregate = socialGraphService.getTrustGraphAggregate as jest.Mock
const trustGraph = socialGraphService.getTrustGraph as jest.Mock
const fullCommunity = socialGraphService.getFullCommunityGraph as jest.Mock
const communityGraph = socialGraphService.getCommunityGraph as jest.Mock
const getNeighborhood = socialGraphService.getNeighborhood as jest.Mock
const getMyCommunities = communityService.getMyCommunities as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  routerQuery = {}
})

describe('BelongingGraph contextual dispatch', () => {
  const supplied = { nodes: [{ id: 'me', name: 'Maria' }], links: [] }

  it.each([
    ['ego', 'ego'],
    ['community', 'community-ring'],
    ['communities', 'community-hub'],
    ['fission', 'heb'],
  ] as const)('dispatches %s mode to the %s renderer without fetching', async (mode, testId) => {
    render(<BelongingGraph mode={mode} currentUserId="me" communityId="c1" graphData={supplied} />)

    expect(await screen.findByTestId(testId)).toBeInTheDocument()
    expect(aggregate).not.toHaveBeenCalled()
    expect(trustGraph).not.toHaveBeenCalled()
    expect(fullCommunity).not.toHaveBeenCalled()
    expect(communityGraph).not.toHaveBeenCalled()
  })

  it('passes stable baseline and expansion identity into the ego renderer', () => {
    render(
      <BelongingGraph
        mode="ego"
        currentUserId="me"
        graphData={supplied}
        baselineNodeIds={['me', 'maya']}
        expansionRootIds={['maya']}
      />
    )

    expect(screen.getByTestId('ego')).toHaveAttribute('data-baseline', 'me,maya')
    expect(screen.getByTestId('ego')).toHaveAttribute('data-expansion', 'maya')
  })

  it('surfaces community completeness metadata through the ring renderer', () => {
    render(
      <BelongingGraph
        mode="community"
        currentUserId="me"
        communityId="c1"
        graphData={{ ...supplied, meta: { truncated: true, totalActiveMembers: 151 } }}
      />
    )

    expect(screen.getByTestId('community-ring')).toHaveAttribute('data-total', '151')
  })

  it('preserves additive completeness metadata through normalizePersonGraph', () => {
    const normalized = normalizePersonGraph({
      nodes: [{ user_id: 'me', name: 'Maria', is_current_user: true }],
      links: [],
      meta: { truncated: true, totalActiveMembers: 151 },
    })

    expect(normalized.meta).toEqual({ truncated: true, totalActiveMembers: 151 })
  })
})

describe('profile BelongingSection one replaceable expansion', () => {
  beforeEach(() => {
    aggregate.mockResolvedValue({
      data: {
        nodes: [
          { user_id: 'me', name: 'Maria', is_current_user: true },
          { user_id: 'maya', name: 'Maya' },
          { user_id: 'john', name: 'John' },
        ],
        links: [],
      },
    })
    getMyCommunities.mockResolvedValue({ data: { communities: [{ id: 'c1', name: 'One' }] } })
    getNeighborhood.mockImplementation((id: string) =>
      Promise.resolve({
        data: {
          nodes: [
            { user_id: id, name: id },
            { user_id: `${id}-friend`, name: `${id} friend` },
          ],
          links: [{ source: id, target: `${id}-friend` }],
        },
      })
    )
  })

  it('expands one node, replaces that branch with another, then collapses on a repeat click', async () => {
    render(<BelongingSection userId="me" />)
    await screen.findByTestId('ego-node-maya')

    fireEvent.click(screen.getByTestId('ego-node-maya'))
    await screen.findByTestId('ego-node-maya-friend')
    expect(getNeighborhood).toHaveBeenCalledWith('maya', { depth: 1 })
    expect(screen.getByTestId('ego')).toHaveAttribute('data-expansion', 'maya')

    fireEvent.click(screen.getByTestId('ego-node-john'))
    await screen.findByTestId('ego-node-john-friend')
    expect(screen.queryByTestId('ego-node-maya-friend')).not.toBeInTheDocument()
    expect(screen.getByTestId('ego')).toHaveAttribute('data-expansion', 'john')

    fireEvent.click(screen.getByTestId('ego-node-john'))
    await waitFor(() =>
      expect(screen.queryByTestId('ego-node-john-friend')).not.toBeInTheDocument()
    )
    expect(screen.getByTestId('ego')).toHaveAttribute('data-expansion', '')
  })

  it('shows the last-clicked expansion even when an earlier request resolves later', async () => {
    const resolvers: Record<string, () => void> = {}
    getNeighborhood.mockImplementation(
      (id: string) =>
        new Promise(resolve => {
          resolvers[id] = () =>
            resolve({
              data: {
                nodes: [
                  { user_id: id, name: id },
                  { user_id: `${id}-friend`, name: `${id} friend` },
                ],
                links: [{ source: id, target: `${id}-friend` }],
              },
            })
        })
    )
    render(<BelongingSection userId="me" />)
    await screen.findByTestId('ego-node-maya')

    fireEvent.click(screen.getByTestId('ego-node-maya')) // request A (slow)
    fireEvent.click(screen.getByTestId('ego-node-john')) // request B — the user's real intent

    resolvers['john']() // B resolves first
    await screen.findByTestId('ego-node-john-friend')
    resolvers['maya']() // A resolves LATER — must be discarded as stale

    await waitFor(() =>
      expect(screen.queryByTestId('ego-node-maya-friend')).not.toBeInTheDocument()
    )
    expect(screen.getByTestId('ego-node-john-friend')).toBeInTheDocument()
    expect(screen.getByTestId('ego')).toHaveAttribute('data-expansion', 'john')
  })

  it('keeps the prior branch and offers retry/dismiss when an expansion fails', async () => {
    render(<BelongingSection userId="me" />)
    await screen.findByTestId('ego-node-maya')

    fireEvent.click(screen.getByTestId('ego-node-maya'))
    await screen.findByTestId('ego-node-maya-friend')

    getNeighborhood.mockRejectedValueOnce(new Error('boom'))
    fireEvent.click(screen.getByTestId('ego-node-john'))

    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument()
    // The old maya branch is retained — failure does not clear the visible graph.
    expect(screen.getByTestId('ego-node-maya-friend')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument()
    expect(screen.getByTestId('ego-node-maya-friend')).toBeInTheDocument()
  })
})

describe('/network stable identity and completeness copy', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('token', 't')
    localStorage.setItem('user', JSON.stringify({ id: 'user-1', name: 'Me', communities: [] }))
    getMyCommunities.mockResolvedValue({ data: { communities: [{ id: 'c1', name: 'One' }] } })
    getNeighborhood.mockImplementation((id: string) => {
      if (id === 'user-1') {
        return Promise.resolve({
          data: {
            nodes: [
              { user_id: 'user-1', name: 'Me', is_current_user: true },
              { user_id: 'a', name: 'Alice' },
              { user_id: 'b', name: 'Bob' },
              { user_id: 'c', name: 'Cara' },
            ],
            links: [],
          },
        })
      }
      return Promise.resolve({
        data: {
          nodes: [
            { user_id: id, name: id },
            { user_id: `${id}-exp`, name: `${id} plus` },
          ],
          links: [{ source: id, target: `${id}-exp` }],
        },
      })
    })
  })

  it('threads baseline ids and FIFO expansion roots into the ego wrapper', async () => {
    routerQuery = { mode: 'ego' }
    render(<NetworkPage />)
    await screen.findByTestId('ego-node-a')

    expect(screen.getByTestId('ego')).toHaveAttribute('data-baseline', 'user-1,a,b,c')

    fireEvent.click(screen.getByTestId('ego-node-a'))
    await screen.findByTestId('ego-node-a-exp')
    fireEvent.click(screen.getByTestId('ego-node-b'))
    await screen.findByTestId('ego-node-b-exp')
    fireEvent.click(screen.getByTestId('ego-node-c'))
    await screen.findByTestId('ego-node-c-exp')

    expect(screen.getByTestId('ego')).toHaveAttribute('data-expansion', 'a,b,c')
  })

  it('states exact incompleteness for a truncated community graph', async () => {
    fullCommunity.mockResolvedValue({
      data: {
        nodes: Array.from({ length: 150 }, (_, index) => ({
          user_id: `m-${index}`,
          name: `Member ${index}`,
          is_current_user: index === 0,
        })),
        links: [],
        meta: { truncated: true, totalActiveMembers: 151 },
      },
    })
    routerQuery = { mode: 'community', id: 'c1' }
    render(<NetworkPage />)

    expect(
      await screen.findByText('Showing 150 of 151 active members. This view is incomplete.')
    ).toBeInTheDocument()
  })
})
