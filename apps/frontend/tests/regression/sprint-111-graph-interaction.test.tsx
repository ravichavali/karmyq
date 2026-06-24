import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import TrustGraphHEB from '@/components/graphs/TrustGraphHEB'
import type { GraphData } from '@/components/graphs/types'

/**
 * Sprint 111 — TrustGraphHEB interaction & accessibility contract (ADR-081).
 *
 * The single renderer must be keyboard-operable, accessibly labelled, hover/focus-highlighting,
 * optionally zoomable (explorer-only), and must update via keyed joins rather than tearing the SVG
 * down. ResizeObserver is stubbed in jest.setup; width falls back to the renderer default.
 */

const nodeById = (container: HTMLElement, id: string) =>
  container.querySelector<SVGGElement>(`[data-node-id="${id}"]`)

// me ── peer-1 ── peer-2  (me is NOT adjacent to peer-2)
const peopleGraph: GraphData = {
  nodes: [
    { id: 'me', name: 'Me Myself', trust_score: 1, karma: 0, isCurrentUser: true },
    { id: 'peer-1', name: 'Peer One', trust_score: 2, karma: 3 },
    { id: 'peer-2', name: 'Peer Two', trust_score: 1, karma: 1 },
  ],
  links: [
    { source: 'me', target: 'peer-1', raw_weight: 2, effective_weight: 2 },
    { source: 'peer-1', target: 'peer-2', raw_weight: 1, effective_weight: 1 },
  ],
}

describe('TrustGraphHEB accessibility + keyboard', () => {
  it('exposes node groups as labelled buttons with a full-name <title>', () => {
    const { container } = render(<TrustGraphHEB graphData={peopleGraph} currentUserId="me" mode="ego" />)
    const peer = nodeById(container, 'peer-1')!
    expect(peer).toBeInTheDocument()
    expect(peer.getAttribute('role')).toBe('button')
    expect(peer.getAttribute('tabindex')).toBe('0')
    expect(peer.getAttribute('aria-label')).toContain('Peer One')
    expect(peer.querySelector('title')?.textContent).toContain('Peer One')
  })

  it('activates a node on Enter and Space', () => {
    const onNodeActivate = jest.fn()
    const { container } = render(
      <TrustGraphHEB graphData={peopleGraph} currentUserId="me" mode="ego" onNodeActivate={onNodeActivate} />
    )
    const peer = nodeById(container, 'peer-1')!
    fireEvent.keyDown(peer, { key: 'Enter' })
    fireEvent.keyDown(peer, { key: ' ' })
    expect(onNodeActivate).toHaveBeenCalledWith('peer-1')
    expect(onNodeActivate).toHaveBeenCalledTimes(2)
  })
})

describe('TrustGraphHEB hover/focus highlight', () => {
  it('fades topology unrelated to the hovered node and restores on leave', () => {
    const { container } = render(<TrustGraphHEB graphData={peopleGraph} currentUserId="me" mode="ego" />)
    const me = nodeById(container, 'me')!
    const peer1 = nodeById(container, 'peer-1')!
    const peer2 = nodeById(container, 'peer-2')!

    fireEvent.mouseEnter(peer2)
    // peer-2 is adjacent only to peer-1; "me" is unrelated and fades.
    expect(me.getAttribute('opacity')).toBe('0.15')
    expect(peer1.getAttribute('opacity')).toBe('1')

    fireEvent.mouseLeave(peer2)
    expect(me.getAttribute('opacity')).toBe('1')
  })
})

describe('TrustGraphHEB zoom (explorer-only)', () => {
  it('attaches a zoom behavior only when enableZoom is set', () => {
    const { container: withZoom } = render(
      <TrustGraphHEB graphData={peopleGraph} currentUserId="me" mode="ego" enableZoom />
    )
    expect((withZoom.querySelector('svg') as any).__zoom).toBeDefined()

    const { container: noZoom } = render(
      <TrustGraphHEB graphData={peopleGraph} currentUserId="me" mode="ego" />
    )
    expect((noZoom.querySelector('svg') as any).__zoom).toBeUndefined()
  })
})

describe('TrustGraphHEB communities mode', () => {
  const communitiesGraph: GraphData = {
    nodes: [
      { id: 'c1', name: 'Garden Co-op', trust_score: 0, karma: 0, member_count: 12, status: 'active', is_member: true },
      { id: 'c2', name: 'Tool Library', trust_score: 0, karma: 0, member_count: 30, status: 'active', is_member: false },
    ],
    links: [{ source: 'c1', target: 'c2', raw_weight: 3, effective_weight: 3, type: 'organic' }],
  }

  it('keeps uniform node radius and surfaces member count/status in the detail panel', () => {
    const { container, getByText } = render(
      <TrustGraphHEB graphData={communitiesGraph} currentUserId="" mode="communities" />
    )
    const radii = Array.from(container.querySelectorAll('circle')).map(c => c.getAttribute('r'))
    expect(new Set(radii).size).toBe(1) // uniform sizing (ADR-063)

    fireEvent.click(nodeById(container, 'c1')!)
    expect(getByText(/12/)).toBeInTheDocument()
    expect(getByText(/active/i)).toBeInTheDocument()
  })
})

describe('TrustGraphHEB privacy', () => {
  it('hides another member\'s trust score and karma, but shows your own', () => {
    const { container, getByText, queryByText } = render(
      <TrustGraphHEB graphData={peopleGraph} currentUserId="me" mode="ego" />
    )

    // Clicking another member shows only structural info (connections), never their reputation numbers.
    fireEvent.click(nodeById(container, 'peer-1')!)
    expect(getByText('Connections')).toBeInTheDocument() // detail panel is open
    expect(queryByText(/trust score/i)).not.toBeInTheDocument()
    expect(queryByText(/karma/i)).not.toBeInTheDocument()

    // Your own node shows your full numbers.
    fireEvent.click(nodeById(container, 'me')!)
    expect(getByText(/trust score/i)).toBeInTheDocument()
    expect(getByText(/karma/i)).toBeInTheDocument()
  })
})

describe('TrustGraphHEB fission isolated ring', () => {
  it('draws a dashed ring for isolated members (legend: "dashed = no connections")', () => {
    const fissionGraph: GraphData = {
      nodes: [
        { id: 'me', name: 'Me', trust_score: 0, karma: 0, isCurrentUser: true },
        { id: 'x', name: 'Loner', trust_score: 0, karma: 0, isIsolated: true },
        { id: 'y', name: 'Connected', trust_score: 0, karma: 0 },
      ],
      links: [{ source: 'me', target: 'y', raw_weight: 1, effective_weight: 1 }],
    }
    const { container } = render(
      <TrustGraphHEB
        graphData={fissionGraph}
        currentUserId="me"
        mode="fission"
        groupMap={{ me: 'group_a', x: 'group_b', y: 'group_a' }}
      />
    )
    const ring = nodeById(container, 'x')!.querySelector('circle.iso-ring')
    expect(ring).toBeInTheDocument()
    expect(ring?.getAttribute('stroke-dasharray')).toBe('2,2')
    // A connected member gets no ring.
    expect(nodeById(container, 'y')!.querySelector('circle.iso-ring')).toBeNull()
  })
})

describe('TrustGraphHEB keyed updates', () => {
  it('updates without a blanket SVG teardown (keyed joins keep the root group)', () => {
    const { container, rerender } = render(
      <TrustGraphHEB graphData={peopleGraph} currentUserId="me" mode="ego" />
    )
    const rootGroupBefore = container.querySelector('svg > g')
    expect(rootGroupBefore).toBeInTheDocument()

    const grown: GraphData = {
      nodes: [...peopleGraph.nodes, { id: 'peer-3', name: 'Peer Three', trust_score: 1, karma: 0 }],
      links: [...peopleGraph.links, { source: 'peer-2', target: 'peer-3', raw_weight: 1, effective_weight: 1 }],
    }
    rerender(<TrustGraphHEB graphData={grown} currentUserId="me" mode="ego" />)

    // The persistent root group survives the update (no svg.selectAll('*').remove()).
    expect(container.querySelector('svg > g')).toBe(rootGroupBefore)
    expect(nodeById(container, 'peer-3')).toBeInTheDocument()
  })
})
