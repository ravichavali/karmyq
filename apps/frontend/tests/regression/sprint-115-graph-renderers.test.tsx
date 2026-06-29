import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import CommunityRingGraph from '@/components/graphs/CommunityRingGraph'
import EgoOrbitGraph from '@/components/graphs/EgoOrbitGraph'
import type { GraphData } from '@/components/graphs/types'

const chain: GraphData = {
  nodes: [
    { id: 'me', name: 'Maria' },
    { id: 'peer', name: 'Peer' },
    { id: 'bridge', name: 'Bridge' },
    { id: 'outside', name: 'Outside' },
  ],
  links: [
    { source: 'me', target: 'peer', decayTier: 'strong' },
    { source: 'peer', target: 'bridge', decayTier: 'warm' },
    { source: 'bridge', target: 'outside', decayTier: 'fading' },
  ],
}

describe('Sprint 115 community ring renderer', () => {
  it('renders one accessible person button per node and activates it from the keyboard', () => {
    const onNodeActivate = jest.fn()
    const { container } = render(
      <CommunityRingGraph
        graphData={chain}
        currentUserId="me"
        onNodeActivate={onNodeActivate}
      />
    )

    expect(container.querySelectorAll('g[data-node-id]')).toHaveLength(4)
    expect(container.querySelectorAll('path[data-link-key]')).toHaveLength(3)
    expect(container.querySelector('[data-node-id="peer"]')).toHaveAttribute('role', 'button')
    expect(container.querySelector('[data-node-id="peer"]')).toHaveAttribute('tabindex', '0')
    expect(container.querySelector('[data-node-id="peer"] title')).toHaveTextContent('Peer')

    fireEvent.keyDown(container.querySelector('[data-node-id="peer"]')!, { key: 'Enter' })

    expect(onNodeActivate).toHaveBeenCalledWith('peer')
    expect(screen.getByText('2 connections')).toBeInTheDocument()
    expect(screen.getByText('1 strong, 1 warm')).toBeInTheDocument()

    fireEvent.keyDown(container.querySelector('[data-node-id="bridge"]')!, { key: ' ' })
    expect(onNodeActivate).toHaveBeenLastCalledWith('bridge')
    expect(onNodeActivate).toHaveBeenCalledTimes(2)
  })

  it('changes focus styling without changing any direct path geometry', () => {
    const { container } = render(
      <CommunityRingGraph graphData={chain} currentUserId="me" />
    )
    const before = [...container.querySelectorAll('path[data-link-key]')].map(path => path.getAttribute('d'))

    fireEvent.focus(container.querySelector('[data-node-id="peer"]')!)

    const paths = [...container.querySelectorAll('path[data-link-key]')]
    expect(paths[0]).toHaveAttribute('stroke', '#f59e0b')
    expect(paths[0]).toHaveAttribute('stroke-width', '2.5')
    expect(paths[1]).toHaveAttribute('stroke', '#14b8a6')
    expect(paths[1]).toHaveAttribute('stroke-width', '2.5')
    expect(paths[2]).toHaveAttribute('stroke-opacity', '0.05')
    expect(container.querySelector('[data-node-id="outside"]')).toHaveAttribute('opacity', '0.05')
    expect(paths.map(path => path.getAttribute('d'))).toEqual(before)
  })

  it('ignores an external focus ID that is not present in the graph', () => {
    const { container } = render(
      <CommunityRingGraph graphData={chain} currentUserId="me" focusedNodeId="missing" />
    )

    expect(
      [...container.querySelectorAll('g[data-node-id]')].every(
        node => node.getAttribute('opacity') === '1'
      )
    ).toBe(true)
    expect(container.querySelectorAll('path[stroke-opacity="0.05"]')).toHaveLength(0)
  })

  it('drops an internal selection focus when graph replacement removes that member', () => {
    const replacement: GraphData = {
      nodes: [
        { id: 'me', name: 'Maria' },
        { id: 'new-peer', name: 'New Peer' },
      ],
      links: [{ source: 'me', target: 'new-peer', decayTier: 'strong' }],
    }
    const { container, rerender } = render(
      <CommunityRingGraph graphData={chain} currentUserId="me" />
    )
    fireEvent.click(container.querySelector('[data-node-id="peer"]')!)

    rerender(<CommunityRingGraph graphData={replacement} currentUserId="me" />)

    expect(
      [...container.querySelectorAll('g[data-node-id]')].every(
        node => node.getAttribute('opacity') === '1'
      )
    ).toBe(true)
    expect(container.querySelector('path[data-link-key]')).toHaveAttribute('stroke-opacity', '0.62')
  })

  it('counts relationship states only from links with two rendered endpoints', () => {
    const graphData: GraphData = {
      ...chain,
      links: [
        ...chain.links,
        { source: 'peer', target: 'missing', decayTier: 'nearly_forgotten' },
      ],
    }
    const { container } = render(
      <CommunityRingGraph graphData={graphData} currentUserId="me" />
    )

    fireEvent.click(container.querySelector('[data-node-id="peer"]')!)

    expect(container.querySelectorAll('path[data-link-key]')).toHaveLength(3)
    expect(screen.getByText('1 strong, 1 warm')).toBeInTheDocument()
  })

  it('has one zoom owner and its controls drive the svg zoom transform', () => {
    const { container } = render(
      <CommunityRingGraph graphData={chain} currentUserId="me" enableZoom />
    )
    const svg = container.querySelector('svg') as SVGSVGElement & { __zoom: { k: number } }
    const before = svg.__zoom.k

    expect(screen.getAllByLabelText(/zoom in/i)).toHaveLength(1)
    expect(screen.getAllByLabelText(/zoom out/i)).toHaveLength(1)
    expect(screen.getAllByLabelText(/reset zoom/i)).toHaveLength(1)
    fireEvent.click(screen.getByLabelText(/zoom in/i))

    expect(svg.__zoom.k).toBeGreaterThan(before)
  })

  it('measures and installs centered zoom when a sparse graph becomes populated', () => {
    const width = jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640)
    try {
      const sparse: GraphData = { nodes: [{ id: 'me', name: 'Maria' }], links: [] }
      const { container, rerender } = render(
        <CommunityRingGraph graphData={sparse} currentUserId="me" enableZoom />
      )

      rerender(<CommunityRingGraph graphData={chain} currentUserId="me" enableZoom />)

      const svg = container.querySelector('svg') as SVGSVGElement & { __zoom: { k: number } }
      expect(svg).toHaveAttribute('width', '640')
      expect(container.querySelector('svg > g')?.getAttribute('transform')).toMatch(
        /^translate\(320,280\)/
      )
      const before = svg.__zoom?.k
      fireEvent.click(screen.getByLabelText(/zoom in/i))
      expect(svg.__zoom.k).toBeGreaterThan(before)
    } finally {
      width.mockRestore()
    }
  })

  it('keeps every person accessible while limiting persistent labels above 40 nodes', () => {
    const graphData: GraphData = {
      nodes: Array.from({ length: 41 }, (_, index) => ({
        id: index === 0 ? 'me' : `person-${index}`,
        name: index === 0 ? 'Maria' : `Person ${index}`,
      })),
      links: [],
    }
    const { container } = render(
      <CommunityRingGraph
        graphData={graphData}
        currentUserId="me"
        focusedNodeId="person-40"
      />
    )

    expect(container.querySelectorAll('g[data-node-id][role="button"][tabindex="0"]')).toHaveLength(41)
    expect(container.querySelectorAll('g[data-node-id] > title')).toHaveLength(41)
    expect(container.querySelectorAll('text.node-label')).toHaveLength(2)
    expect([...container.querySelectorAll('text.node-label')].map(label => label.textContent)).toEqual(
      expect.arrayContaining(['Maria', 'Person 40'])
    )
  })

  it('renders a community-specific sparse state for a lone member', () => {
    render(
      <CommunityRingGraph
        graphData={{ nodes: [{ id: 'me', name: 'Maria' }], links: [] }}
        currentUserId="me"
      />
    )

    expect(screen.getByText(/This community doesn.t have any trust connections yet/i)).toBeInTheDocument()
    expect(screen.getByText(/Connections appear after completed help/i)).toBeInTheDocument()
  })

  it('states when a member graph is truncated and does not overclaim structural guidance', () => {
    render(
      <CommunityRingGraph
        graphData={{
          ...chain,
          nodes: Array.from({ length: 41 }, (_, index) => ({ id: `p-${index}`, name: `Person ${index}` })),
          links: [{ source: 'p-0', target: 'p-1', decayTier: 'strong' }],
          meta: { truncated: true, totalActiveMembers: 151 },
        }}
        currentUserId="p-0"
      />
    )

    expect(screen.getByText(/Showing 41 of 151 active members/i)).toBeInTheDocument()
    expect(screen.getByText(/incomplete view/i)).toBeInTheDocument()
    expect(screen.queryByText(/Look for multiple routes/i)).not.toBeInTheDocument()
  })

  it('offers redundant-belonging guidance only for a complete community view', () => {
    render(<CommunityRingGraph graphData={chain} currentUserId="me" />)

    expect(
      screen.getByText(
        /Look for multiple routes, several bridges, few isolates, and whether one person has become indispensable/i
      )
    ).toBeInTheDocument()
    expect(screen.getByText('Strong relationship')).toBeInTheDocument()
    expect(screen.getByText('Nearly forgotten relationship')).toBeInTheDocument()
  })
})

const egoChain: GraphData = {
  nodes: [
    { id: 'me', name: 'Maria' },
    { id: 'maya', name: 'Maya' },
    { id: 'john', name: 'John' },
  ],
  links: [
    { source: 'me', target: 'maya', decayTier: 'strong' },
    { source: 'maya', target: 'john', decayTier: 'warm' },
  ],
}

const radiusOf = (container: HTMLElement, id: string) => {
  const transform = container.querySelector(`[data-node-id="${id}"]`)!.getAttribute('transform')!
  const [x, y] = transform.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
  return Math.hypot(x, y)
}

describe('Sprint 115 ego orbit renderer', () => {
  it('anchors the caller at the origin and grows orbit radius with BFS distance', () => {
    const { container } = render(<EgoOrbitGraph graphData={egoChain} currentUserId="me" />)

    expect(container.querySelector('[data-node-id="me"]')).toHaveAttribute('transform', 'translate(0,0)')
    expect(container.querySelectorAll('g[data-node-id]')).toHaveLength(3)
    expect(container.querySelectorAll('line[data-link-key]')).toHaveLength(2)
    expect(radiusOf(container, 'maya')).toBeGreaterThan(0)
    expect(radiusOf(container, 'john')).toBeGreaterThan(radiusOf(container, 'maya'))
  })

  it('derives geometry from BFS, never from response-supplied depth', () => {
    const honest = render(<EgoOrbitGraph graphData={egoChain} currentUserId="me" />)
    const honestMaya = honest.container.querySelector('[data-node-id="maya"]')!.getAttribute('transform')

    const scrambled: GraphData = {
      ...egoChain,
      nodes: egoChain.nodes.map(node => ({ ...node, degrees_of_separation: 3 as const })),
    }
    const { container } = render(<EgoOrbitGraph graphData={scrambled} currentUserId="me" />)

    expect(container.querySelector('[data-node-id="maya"]')!.getAttribute('transform')).toBe(honestMaya)
  })

  it('activates a node from Enter and Space and reports the distance in its label', () => {
    const onNodeActivate = jest.fn()
    const { container } = render(
      <EgoOrbitGraph graphData={egoChain} currentUserId="me" onNodeActivate={onNodeActivate} />
    )

    expect(container.querySelector('[data-node-id="maya"]')).toHaveAttribute(
      'aria-label',
      'Maya, 1 degree away, 2 connections'
    )
    fireEvent.keyDown(container.querySelector('[data-node-id="maya"]')!, { key: 'Enter' })
    expect(onNodeActivate).toHaveBeenCalledWith('maya')
    fireEvent.keyDown(container.querySelector('[data-node-id="john"]')!, { key: ' ' })
    expect(onNodeActivate).toHaveBeenLastCalledWith('john')
    expect(onNodeActivate).toHaveBeenCalledTimes(2)
  })

  it('recolors focus without moving any node or edge endpoint', () => {
    const { container } = render(<EgoOrbitGraph graphData={egoChain} currentUserId="me" />)
    const endpoints = () =>
      [...container.querySelectorAll('line[data-link-key]')].map(line =>
        ['x1', 'y1', 'x2', 'y2'].map(attr => line.getAttribute(attr)).join(',')
      )
    const transforms = () =>
      [...container.querySelectorAll('g[data-node-id]')].map(node => node.getAttribute('transform'))
    const beforeEndpoints = endpoints()
    const beforeTransforms = transforms()

    fireEvent.focus(container.querySelector('[data-node-id="maya"]')!)

    const lines = [...container.querySelectorAll('line[data-link-key]')]
    expect(lines[0]).toHaveAttribute('stroke', '#f59e0b') // caller amber overrides teal
    expect(lines[0]).toHaveAttribute('stroke-width', '2.5')
    expect(lines[1]).toHaveAttribute('stroke', '#14b8a6') // focused teal
    expect(lines[1]).toHaveAttribute('stroke-width', '2.5')
    expect(endpoints()).toEqual(beforeEndpoints)
    expect(transforms()).toEqual(beforeTransforms)
  })

  it('has one zoom owner and its controls drive the svg zoom transform', () => {
    const { container } = render(<EgoOrbitGraph graphData={egoChain} currentUserId="me" enableZoom />)
    const svg = container.querySelector('svg') as SVGSVGElement & { __zoom: { k: number } }
    const before = svg.__zoom.k

    expect(screen.getAllByLabelText(/zoom in/i)).toHaveLength(1)
    expect(screen.getAllByLabelText(/zoom out/i)).toHaveLength(1)
    expect(screen.getAllByLabelText(/reset zoom/i)).toHaveLength(1)
    fireEvent.click(screen.getByLabelText(/zoom in/i))

    expect(svg.__zoom.k).toBeGreaterThan(before)
  })

  it('keeps every person accessible while limiting persistent labels above 40 nodes', () => {
    const graphData: GraphData = {
      nodes: Array.from({ length: 41 }, (_, index) => ({
        id: index === 0 ? 'me' : `person-${index}`,
        name: index === 0 ? 'Maria' : `Person ${index}`,
      })),
      links: [],
    }
    const { container } = render(
      <EgoOrbitGraph graphData={graphData} currentUserId="me" focusedNodeId="person-40" />
    )

    expect(container.querySelectorAll('g[data-node-id][role="button"][tabindex="0"]')).toHaveLength(41)
    expect(container.querySelectorAll('g[data-node-id] > title')).toHaveLength(41)
    expect(container.querySelectorAll('text.node-label')).toHaveLength(2)
    expect([...container.querySelectorAll('text.node-label')].map(label => label.textContent)).toEqual(
      expect.arrayContaining(['Maria', 'Person 40'])
    )
  })

  it('renders an ego-specific sparse state for a lone caller', () => {
    render(<EgoOrbitGraph graphData={{ nodes: [{ id: 'me', name: 'Maria' }], links: [] }} currentUserId="me" />)

    expect(screen.getByText(/You don.t have any trust connections yet/i)).toBeInTheDocument()
    expect(screen.getByText(/Connections grow through the help you give and receive/i)).toBeInTheDocument()
  })
})
