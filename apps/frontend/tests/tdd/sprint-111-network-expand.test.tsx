import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

/**
 * Sprint 111 — /network full-page explorer (ADR-081).
 *
 * Locks query→mode resolution, per-mode baseline fetches, loaded-node search/focus, and the
 * ego-only progressive expansion state machine (FIFO-three, collapse, failure recovery).
 */

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

jest.mock('@/components/Layout', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}))

// Stub BelongingGraph: render one button per node (clicking it activates the node) and expose mode,
// focus, and whether an expansion callback was wired.
jest.mock('@/components/BelongingGraph', () => ({
  __esModule: true,
  default: (props: any) => (
    <div
      data-testid="belonging-graph"
      data-mode={props.mode}
      data-focused={props.focusedNodeId ?? ''}
      data-has-activate={props.onNodeActivate ? 'yes' : 'no'}
    >
      {props.graphData?.nodes?.map((n: any) => (
        <button key={n.id} data-testid={`node-${n.id}`} onClick={() => props.onNodeActivate?.(n.id)}>
          {n.name}
        </button>
      ))}
    </div>
  ),
}))

jest.mock('@/lib/api', () => ({
  socialGraphService: {
    getNeighborhood: jest.fn(),
    getFullCommunityGraph: jest.fn(),
    getCommunityGraph: jest.fn(),
  },
  communityService: {
    getMyCommunities: jest.fn(),
  },
}))

import NetworkPage from '@/pages/network'
import { socialGraphService, communityService } from '@/lib/api'

const getNeighborhood = socialGraphService.getNeighborhood as jest.Mock
const getFullCommunityGraph = socialGraphService.getFullCommunityGraph as jest.Mock
const getCommunityGraph = socialGraphService.getCommunityGraph as jest.Mock
const getMyCommunities = communityService.getMyCommunities as jest.Mock

const EGO_BASELINE = {
  nodes: [
    { id: 'user-1', name: 'Me' },
    { id: 'a', name: 'Alice' },
    { id: 'b', name: 'Bob' },
    { id: 'c', name: 'Cara' },
    { id: 'd', name: 'Dan' },
  ],
  links: [],
}

const egoNeighborhood = (id: string, opts: any) => {
  if (id === 'user-1') return Promise.resolve({ data: EGO_BASELINE })
  return Promise.resolve({
    data: {
      nodes: [{ id, name: id }, { id: `${id}-exp`, name: `${id} plus` }],
      links: [{ source: id, target: `${id}-exp`, raw_weight: 1, effective_weight: 1 }],
    },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  routerQuery = {}
  localStorage.clear()
  localStorage.setItem('token', 't')
  localStorage.setItem('user', JSON.stringify({ id: 'user-1', name: 'Me', communities: [] }))
  getNeighborhood.mockImplementation(egoNeighborhood)
  getFullCommunityGraph.mockResolvedValue({ data: { nodes: [{ id: 'c1m', name: 'Member' }], links: [] } })
  getCommunityGraph.mockResolvedValue({
    data: {
      nodes: [
        { id: 'cc1', name: 'Garden', member_count: 3, status: 'active', is_member: true },
        { id: 'cc2', name: 'Tools', member_count: 9, status: 'active', is_member: false },
      ],
      links: [],
    },
  })
  getMyCommunities.mockResolvedValue({ data: [{ id: 'c1', name: 'Comm One' }] })
})

describe('/network mode resolution + baselines', () => {
  it('defaults an invalid mode to ego and normalizes the URL', async () => {
    routerQuery = { mode: 'bogus' }
    render(<NetworkPage />)
    await waitFor(() => expect(screen.getByTestId('belonging-graph')).toHaveAttribute('data-mode', 'ego'))
    expect(mockReplace).toHaveBeenCalled()
  })

  it('ego baseline fetches getNeighborhood(user.id, { depth }) and wires expansion', async () => {
    routerQuery = { mode: 'ego' }
    render(<NetworkPage />)
    await waitFor(() => expect(getNeighborhood).toHaveBeenCalledWith('user-1', { depth: 1 }))
    expect(screen.getByTestId('belonging-graph')).toHaveAttribute('data-has-activate', 'yes')
  })

  it('community mode fetches the full community, shows the picker, hides depth, no expansion', async () => {
    routerQuery = { mode: 'community', id: 'c1' }
    render(<NetworkPage />)
    await waitFor(() => expect(getFullCommunityGraph).toHaveBeenCalledWith('c1'))
    expect(screen.getByTestId('belonging-graph')).toHaveAttribute('data-mode', 'community')
    expect(screen.getByTestId('belonging-graph')).toHaveAttribute('data-has-activate', 'no')
    expect(screen.getByTestId('community-picker')).toBeInTheDocument()
    expect(screen.queryByTestId('depth-slider')).not.toBeInTheDocument()
  })

  it('communities mode fetches the depth graph, hides depth, no expansion', async () => {
    routerQuery = { mode: 'communities' }
    render(<NetworkPage />)
    await waitFor(() => expect(getCommunityGraph).toHaveBeenCalled())
    expect(screen.getByTestId('belonging-graph')).toHaveAttribute('data-has-activate', 'no')
    expect(screen.queryByTestId('depth-slider')).not.toBeInTheDocument()
  })
})

describe('/network search', () => {
  it('matches only loaded nodes and focuses the chosen one', async () => {
    routerQuery = { mode: 'ego' }
    render(<NetworkPage />)
    await screen.findByTestId('node-a')

    fireEvent.change(screen.getByTestId('node-search'), { target: { value: 'Ali' } })
    fireEvent.click(await screen.findByTestId('suggestion-a'))

    await waitFor(() =>
      expect(screen.getByTestId('belonging-graph')).toHaveAttribute('data-focused', 'a')
    )
  })
})

describe('/network ego expansion state machine', () => {
  it('keeps three expansions and evicts the oldest on the fourth', async () => {
    routerQuery = { mode: 'ego' }
    render(<NetworkPage />)
    await screen.findByTestId('node-a')

    fireEvent.click(screen.getByTestId('node-a'))
    await screen.findByTestId('node-a-exp')
    fireEvent.click(screen.getByTestId('node-b'))
    await screen.findByTestId('node-b-exp')
    fireEvent.click(screen.getByTestId('node-c'))
    await screen.findByTestId('node-c-exp')
    fireEvent.click(screen.getByTestId('node-d'))
    await screen.findByTestId('node-d-exp')

    // a was the oldest expansion → evicted; b/c/d remain.
    expect(screen.queryByTestId('node-a-exp')).not.toBeInTheDocument()
    expect(screen.getByTestId('node-d-exp')).toBeInTheDocument()
  })

  it('collapse recomputes from baseline plus the remaining expansions', async () => {
    routerQuery = { mode: 'ego' }
    render(<NetworkPage />)
    await screen.findByTestId('node-a')

    fireEvent.click(screen.getByTestId('node-a'))
    await screen.findByTestId('node-a-exp')
    fireEvent.click(screen.getByTestId('node-b'))
    await screen.findByTestId('node-b-exp')

    fireEvent.click(screen.getByRole('button', { name: /collapse alice/i }))

    expect(screen.queryByTestId('node-a-exp')).not.toBeInTheDocument()
    expect(screen.getByTestId('node-b-exp')).toBeInTheDocument()
  })

  it('leaves the graph intact and shows a recoverable message when an expansion fails', async () => {
    getNeighborhood.mockImplementation((id: string, opts: any) => {
      if (id === 'a') return Promise.reject(new Error('boom'))
      return egoNeighborhood(id, opts)
    })
    routerQuery = { mode: 'ego' }
    render(<NetworkPage />)
    await screen.findByTestId('node-a')

    fireEvent.click(screen.getByTestId('node-a'))

    expect(await screen.findByText(/couldn't expand/i)).toBeInTheDocument()
    expect(screen.queryByTestId('node-a-exp')).not.toBeInTheDocument()
    expect(screen.getByTestId('node-b')).toBeInTheDocument()
  })
})

describe('/network auth guard', () => {
  it('redirects to /login when the stored user is missing', async () => {
    localStorage.clear()
    routerQuery = { mode: 'ego' }
    render(<NetworkPage />)
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'))
  })
})
