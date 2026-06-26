import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import {
  buildAdjacency,
  describeNodeDetail,
  layoutForMode,
  toCanvasGraphData,
} from '@/components/graphs/graphCanvasModel'
import type { GraphData } from '@/components/graphs/types'
import {
  forceGraphMethods,
  lastForceGraphProps,
  resetForceGraphMock,
} from '../mocks/reactForceGraph2DMock'

const graph: GraphData = {
  nodes: [
    { id: 'me', name: 'Maria', isCurrentUser: true, degrees_of_separation: 0 },
    { id: 'p1', name: 'Aisha', degrees_of_separation: 1, trust_score: 99, karma: 88 },
    { id: 'p2', name: 'Lee', degrees_of_separation: 2 },
  ],
  links: [
    { source: 'me', target: 'p1', decayTier: 'strong' },
    { source: 'p1', target: 'p2', decayTier: 'fading' },
  ],
}

describe('graphCanvasModel', () => {
  it('maps belonging modes to Phase 1 layouts', () => {
    expect(layoutForMode('ego')).toBe('egocentric')
    expect(layoutForMode('community')).toBe('member-topology')
    expect(layoutForMode('fission')).toBe('member-topology')
    expect(layoutForMode('communities')).toBe('network-web')
  })

  it('clones graph data and pins the ego focus without mutating props', () => {
    const before = JSON.parse(JSON.stringify(graph))
    const canvas = toCanvasGraphData(graph, {
      mode: 'ego',
      currentUserId: 'me',
      layout: 'egocentric',
      width: 640,
      height: 480,
    })
    expect(canvas).not.toBe(graph)
    expect(canvas.nodes[0]).not.toBe(graph.nodes[0])
    expect(canvas.nodes.find(n => n.id === 'me')).toEqual(expect.objectContaining({ fx: 0, fy: 0 }))
    expect(graph).toEqual(before)
  })

  it('builds symmetric adjacency for hover/focus highlighting', () => {
    const adjacency = buildAdjacency(graph)
    expect([...adjacency.get('p1')!].sort()).toEqual(['me', 'p1', 'p2'])
  })

  it('describes node detail with structure only, never reputation numbers', () => {
    const rows = describeNodeDetail(graph.nodes[1], graph, 'me', 'ego')
    expect(rows).toEqual([
      { label: 'Degrees away', value: '1' },
      { label: 'Connections', value: '2' },
    ])
    expect(JSON.stringify(rows)).not.toMatch(/99|88|trust|karma/i)
  })
})

describe('GraphCanvas boundary', () => {
  beforeEach(() => {
    resetForceGraphMock()
  })

  it('passes cloned graph data and canvas callbacks to react-force-graph-2d', async () => {
    const { default: GraphCanvas } = await import('@/components/graphs/GraphCanvas')
    render(<GraphCanvas graphData={graph} mode="ego" currentUserId="me" width={640} height={480} />)
    expect(screen.getByTestId('force-graph')).toBeInTheDocument()
    expect(lastForceGraphProps.graphData.nodes.find((n: any) => n.id === 'me').fx).toBe(0)
    expect(typeof lastForceGraphProps.nodeCanvasObject).toBe('function')
    expect(typeof lastForceGraphProps.nodePointerAreaPaint).toBe('function')
    expect(typeof lastForceGraphProps.onNodeHover).toBe('function')
    expect(typeof lastForceGraphProps.onNodeClick).toBe('function')
  })

  it('translates force-graph hover/click callbacks to node ids', async () => {
    const { default: GraphCanvas } = await import('@/components/graphs/GraphCanvas')
    const onNodeHover = jest.fn()
    const onNodeClick = jest.fn()
    render(
      <GraphCanvas
        graphData={graph}
        mode="ego"
        currentUserId="me"
        width={640}
        height={480}
        onNodeHover={onNodeHover}
        onNodeClick={onNodeClick}
      />
    )
    lastForceGraphProps.onNodeHover({ id: 'p1' }, null)
    lastForceGraphProps.onNodeHover(null, { id: 'p1' })
    lastForceGraphProps.onNodeClick({ id: 'p2' })
    expect(onNodeHover).toHaveBeenNthCalledWith(1, 'p1')
    expect(onNodeHover).toHaveBeenNthCalledWith(2, null)
    expect(onNodeClick).toHaveBeenCalledWith('p2')
  })

  it('escapes HTML in the node label so a malicious display name cannot XSS the tooltip', async () => {
    const { default: GraphCanvas } = await import('@/components/graphs/GraphCanvas')
    const hostileGraph: GraphData = {
      nodes: [
        { id: 'me', name: 'Maria', isCurrentUser: true, degrees_of_separation: 0 },
        { id: 'x', name: '<img src=x onerror=alert(1)>', degrees_of_separation: 1 },
      ],
      links: [{ source: 'me', target: 'x', decayTier: 'strong' }],
    }

    render(<GraphCanvas graphData={hostileGraph} mode="ego" currentUserId="me" width={640} height={480} />)

    // react-force-graph renders a string nodeLabel into its tooltip via innerHTML, so the label
    // must be entity-escaped — no raw angle brackets reach the tooltip.
    const label = lastForceGraphProps.nodeLabel({ id: 'x', name: '<img src=x onerror=alert(1)>' })
    expect(label).not.toMatch(/<img/)
    expect(label).toContain('&lt;img')
  })

  it('keeps person node sizing uniform except the current-user anchor', async () => {
    const { default: GraphCanvas } = await import('@/components/graphs/GraphCanvas')
    render(<GraphCanvas graphData={graph} mode="ego" currentUserId="me" width={640} height={480} />)

    const me = lastForceGraphProps.graphData.nodes.find((node: any) => node.id === 'me')
    const peer = lastForceGraphProps.graphData.nodes.find((node: any) => node.id === 'p1')

    expect(lastForceGraphProps.nodeVal(peer)).toBe(5)
    expect(lastForceGraphProps.nodeVal(me)).toBe(8)
  })

  it('sizes community nodes by membership using the hub proportions', async () => {
    const { default: GraphCanvas } = await import('@/components/graphs/GraphCanvas')
    const communitiesGraph: GraphData = {
      nodes: [
        { id: 'c1', name: 'Garden Co-op', member_count: 12, is_member: true },
        { id: 'c2', name: 'Tool Library', member_count: 30 },
      ],
      links: [{ source: 'c1', target: 'c2', type: 'organic' }],
    }

    render(<GraphCanvas graphData={communitiesGraph} mode="communities" currentUserId="me" width={640} height={480} />)

    const memberCommunity = lastForceGraphProps.graphData.nodes.find((node: any) => node.id === 'c1')
    const largerCommunity = lastForceGraphProps.graphData.nodes.find((node: any) => node.id === 'c2')
    expect(lastForceGraphProps.nodeVal(largerCommunity)).toBe(22)
    expect(lastForceGraphProps.nodeVal(memberCommunity)).toBeCloseTo(16.49, 2)
  })

  it('ports mode-specific link colors, dashes, and decay opacity to force-graph props', async () => {
    const { default: GraphCanvas } = await import('@/components/graphs/GraphCanvas')
    const fissionGraph: GraphData = {
      nodes: [
        { id: 'me', name: 'Maria', isCurrentUser: true },
        { id: 'p1', name: 'Aisha' },
        { id: 'p2', name: 'Lee' },
      ],
      links: [
        { source: 'me', target: 'p1', decayTier: 'warm' },
        { source: 'p1', target: 'p2', decayTier: 'swept', type: 'fission' },
      ],
    }

    render(
      <GraphCanvas
        graphData={fissionGraph}
        mode="fission"
        currentUserId="me"
        width={640}
        height={480}
        groupMap={{ me: 'group_a', p1: 'group_a', p2: 'group_b' }}
      />
    )

    const myEdge = lastForceGraphProps.graphData.links[0]
    const crossGroupFission = lastForceGraphProps.graphData.links[1]
    expect(lastForceGraphProps.linkColor(myEdge)).toBe('#22c55e')
    expect(lastForceGraphProps.linkColor(crossGroupFission)).toBe('#ef4444')
    expect(lastForceGraphProps.linkLineDash(crossGroupFission)).toEqual([6, 4])
    expect(lastForceGraphProps.linkOpacity(myEdge)).toBeCloseTo(0.7544, 4)
    expect(lastForceGraphProps.linkOpacity(crossGroupFission)).toBeCloseTo(0.071, 3)
  })
})

describe('BelongingGraphRenderer chrome', () => {
  beforeEach(() => {
    resetForceGraphMock()
  })

  it('renders zoom controls that drive the force-graph ref', async () => {
    const { default: BelongingGraphRenderer } = await import('@/components/graphs/BelongingGraphRenderer')
    render(<BelongingGraphRenderer graphData={graph} mode="ego" currentUserId="me" height={480} enableZoom />)
    fireEvent.click(screen.getByLabelText(/zoom in/i))
    fireEvent.click(screen.getByLabelText(/zoom out/i))
    fireEvent.click(screen.getByLabelText(/reset zoom/i))
    expect(forceGraphMethods.zoom).toHaveBeenCalled()
    expect(forceGraphMethods.zoomToFit).toHaveBeenCalled()
  })

  it('opens privacy-safe node detail from canvas node clicks', async () => {
    const { default: BelongingGraphRenderer } = await import('@/components/graphs/BelongingGraphRenderer')
    render(<BelongingGraphRenderer graphData={graph} mode="ego" currentUserId="me" height={480} />)
    act(() => {
      lastForceGraphProps.onNodeClick({ id: 'p1' })
    })
    expect(screen.getByText('Connections')).toBeInTheDocument()
    expect(screen.queryByText(/trust score/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/karma/i)).not.toBeInTheDocument()
  })

  it('renders fission group labels and a move action when supplied', async () => {
    const { default: BelongingGraphRenderer } = await import('@/components/graphs/BelongingGraphRenderer')
    const onSwitchGroup = jest.fn().mockResolvedValue(undefined)
    render(
      <BelongingGraphRenderer
        graphData={graph}
        mode="fission"
        currentUserId="me"
        height={480}
        groupMap={{ me: 'group_a', p1: 'group_a', p2: 'group_b' }}
        groupALabel="North"
        groupBLabel="South"
        onSwitchGroup={onSwitchGroup}
      />
    )
    expect(screen.getByText('North')).toBeInTheDocument()
    expect(screen.getByText('South')).toBeInTheDocument()
    act(() => {
      lastForceGraphProps.onNodeClick({ id: 'p1' })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /move to south/i }))
    })
    expect(onSwitchGroup).toHaveBeenCalledWith('p1', 'group_a')
  })

  it('surfaces the fission isolated-member dashed-ring legend', async () => {
    const { default: BelongingGraphRenderer } = await import('@/components/graphs/BelongingGraphRenderer')
    render(<BelongingGraphRenderer graphData={graph} mode="fission" currentUserId="me" height={480} />)

    expect(screen.getByText(/dashed = no connections/i)).toBeInTheDocument()
  })
})
