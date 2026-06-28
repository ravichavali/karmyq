import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import CommunityRingGraph from '@/components/graphs/CommunityRingGraph'
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
