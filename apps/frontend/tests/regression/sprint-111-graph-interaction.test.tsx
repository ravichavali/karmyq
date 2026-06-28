import React from 'react'
import { render, fireEvent, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import EgoOrbitGraph from '@/components/graphs/EgoOrbitGraph'
import CommunityRingGraph from '@/components/graphs/CommunityRingGraph'
import CommunityHubGraph from '@/components/graphs/CommunityHubGraph'
import TrustGraphHEB from '@/components/graphs/TrustGraphHEB'
import type { GraphData } from '@/components/graphs/types'

/**
 * Sprint 111 interaction & accessibility contract, re-homed in Sprint 115 (ADR-083).
 *
 * Person modes no longer route through the HEB radial: the shared keyboard / accessibility / hover /
 * keyed-update / privacy contracts now live against the renderer that OWNS each mode — EgoOrbitGraph
 * (ego), CommunityRingGraph (this community), CommunityHubGraph (across communities). TrustGraphHEB is
 * retained only for fission (group split) interactions. ResizeObserver is stubbed in jest.setup; width
 * falls back to the renderer default.
 */

const nodeById = (container: HTMLElement, id: string) =>
  container.querySelector<SVGGElement>(`[data-node-id="${id}"]`)

// me ── peer-1 ── peer-2  (me is NOT adjacent to peer-2). Privacy-safe shape: relationship state only.
const peopleGraph: GraphData = {
  nodes: [
    { id: 'me', name: 'Me Myself', isCurrentUser: true },
    { id: 'peer-1', name: 'Peer One' },
    { id: 'peer-2', name: 'Peer Two' },
  ],
  links: [
    { source: 'me', target: 'peer-1', decayTier: 'strong' },
    { source: 'peer-1', target: 'peer-2', decayTier: 'warm' },
  ],
}

describe('EgoOrbitGraph accessibility + keyboard', () => {
  it('exposes node groups as labelled buttons with a full-name <title>', () => {
    const { container } = render(<EgoOrbitGraph graphData={peopleGraph} currentUserId="me" />)
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
      <EgoOrbitGraph graphData={peopleGraph} currentUserId="me" onNodeActivate={onNodeActivate} />
    )
    const peer = nodeById(container, 'peer-1')!
    fireEvent.keyDown(peer, { key: 'Enter' })
    fireEvent.keyDown(peer, { key: ' ' })
    expect(onNodeActivate).toHaveBeenCalledWith('peer-1')
    expect(onNodeActivate).toHaveBeenCalledTimes(2)
  })
})

describe('EgoOrbitGraph hover/focus highlight', () => {
  it('fades topology unrelated to the hovered node and restores on leave', () => {
    const { container } = render(<EgoOrbitGraph graphData={peopleGraph} currentUserId="me" />)
    const me = nodeById(container, 'me')!
    const peer1 = nodeById(container, 'peer-1')!
    const peer2 = nodeById(container, 'peer-2')!

    fireEvent.mouseEnter(peer2)
    // peer-2 is adjacent only to peer-1; "me" is unrelated and recedes to the unrelated opacity.
    expect(me.getAttribute('opacity')).toBe('0.05')
    expect(peer1.getAttribute('opacity')).toBe('1')

    fireEvent.mouseLeave(peer2)
    expect(me.getAttribute('opacity')).toBe('1')
  })
})

describe('EgoOrbitGraph keyed updates', () => {
  it('updates without tearing down the root group (declarative re-render keeps it)', () => {
    const { container, rerender } = render(<EgoOrbitGraph graphData={peopleGraph} currentUserId="me" />)
    const rootGroupBefore = container.querySelector('svg > g')
    expect(rootGroupBefore).toBeInTheDocument()

    const grown: GraphData = {
      nodes: [...peopleGraph.nodes, { id: 'peer-3', name: 'Peer Three' }],
      links: [...peopleGraph.links, { source: 'peer-2', target: 'peer-3', decayTier: 'fading' }],
    }
    rerender(<EgoOrbitGraph graphData={grown} currentUserId="me" />)

    expect(container.querySelector('svg > g')).toBe(rootGroupBefore)
    expect(nodeById(container, 'peer-3')).toBeInTheDocument()
  })
})

describe('EgoOrbitGraph privacy (ADR-082)', () => {
  it('shows relationship structure only — never trust score or karma, not even for your own node', () => {
    // The explicit forbidden-field non-read: nodes carry reputation, the renderer must never surface it.
    const withMetrics: GraphData = {
      nodes: [
        { id: 'me', name: 'Me Myself', isCurrentUser: true, trust_score: 1, karma: 0 },
        { id: 'peer-1', name: 'Peer One', trust_score: 2, karma: 3 },
        { id: 'peer-2', name: 'Peer Two', trust_score: 1, karma: 1 },
      ],
      links: peopleGraph.links,
    }
    const { container, getByText, queryByText } = render(
      <EgoOrbitGraph graphData={withMetrics} currentUserId="me" />
    )

    fireEvent.click(nodeById(container, 'peer-1')!)
    expect(getByText('2 connections')).toBeInTheDocument() // detail panel open, structural only
    expect(queryByText(/trust score/i)).not.toBeInTheDocument()
    expect(queryByText(/karma/i)).not.toBeInTheDocument()

    fireEvent.click(nodeById(container, 'me')!)
    expect(getByText(/this is you/i)).toBeInTheDocument()
    expect(queryByText(/trust score/i)).not.toBeInTheDocument()
    expect(queryByText(/karma/i)).not.toBeInTheDocument()
  })
})

describe('CommunityRingGraph focus + detail', () => {
  const ring: GraphData = {
    nodes: [
      { id: 'me', name: 'Maria' },
      { id: 'peer', name: 'Peer' },
      { id: 'bridge', name: 'Bridge' },
    ],
    links: [
      { source: 'me', target: 'peer', decayTier: 'strong' },
      { source: 'peer', target: 'bridge', decayTier: 'warm' },
    ],
  }

  it('opens a structural detail panel and recolors focus without trust numbers', () => {
    const { container } = render(<CommunityRingGraph graphData={ring} currentUserId="me" />)

    fireEvent.click(nodeById(container, 'peer')!)
    expect(screen.getByText('2 connections')).toBeInTheDocument()
    expect(screen.getByText('1 strong, 1 warm')).toBeInTheDocument()
    expect(screen.queryByText(/trust score/i)).not.toBeInTheDocument()

    fireEvent.focus(nodeById(container, 'peer')!)
    const paths = [...container.querySelectorAll('path[data-link-key]')]
    expect(paths[0]).toHaveAttribute('stroke', '#f59e0b') // caller amber
    expect(paths[1]).toHaveAttribute('stroke', '#14b8a6') // focused teal
  })
})

describe('CommunityHubGraph membership sizing (Scale 3)', () => {
  const communitiesGraph: GraphData = {
    nodes: [
      { id: 'c1', name: 'Garden Co-op', trust_score: 0, karma: 0, member_count: 12, status: 'active', is_member: true },
      { id: 'c2', name: 'Tool Library', trust_score: 0, karma: 0, member_count: 30, status: 'active', is_member: false },
    ],
    links: [{ source: 'c1', target: 'c2', raw_weight: 3, effective_weight: 3, type: 'organic' }],
  }

  it('sizes community nodes by membership and surfaces member count/status in the detail panel', () => {
    const { container, getByText } = render(<CommunityHubGraph graphData={communitiesGraph} />)
    const c1Dot = nodeById(container, 'c1')!.querySelector('circle')!
    const c2Dot = nodeById(container, 'c2')!.querySelector('circle')!
    expect(parseFloat(c2Dot.getAttribute('r')!)).toBeGreaterThan(parseFloat(c1Dot.getAttribute('r')!))

    fireEvent.click(nodeById(container, 'c1')!)
    expect(getByText('12')).toBeInTheDocument()
    expect(getByText(/active/i)).toBeInTheDocument()
  })
})

describe('TrustGraphHEB fission', () => {
  const fissionGraph: GraphData = {
    nodes: [
      { id: 'me', name: 'Me', isCurrentUser: true },
      { id: 'x', name: 'Loner', isIsolated: true },
      { id: 'y', name: 'Connected' },
    ],
    links: [{ source: 'me', target: 'y', raw_weight: 1, effective_weight: 1 }],
  }
  const groupMap = { me: 'group_a' as const, x: 'group_b' as const, y: 'group_a' as const }

  it('draws a dashed ring for isolated members (legend: "dashed = no connections")', () => {
    const { container } = render(
      <TrustGraphHEB graphData={fissionGraph} currentUserId="me" mode="fission" groupMap={groupMap} />
    )
    const ring = nodeById(container, 'x')!.querySelector('circle.iso-ring')
    expect(ring).toBeInTheDocument()
    expect(ring?.getAttribute('stroke-dasharray')).toBe('2,2')
    expect(nodeById(container, 'y')!.querySelector('circle.iso-ring')).toBeNull()
  })

  it('offers a group switch from the detail panel and invokes onSwitchGroup with the current group', async () => {
    const onSwitchGroup = jest.fn().mockResolvedValue(undefined)
    const { container } = render(
      <TrustGraphHEB
        graphData={fissionGraph}
        currentUserId="me"
        mode="fission"
        groupMap={groupMap}
        groupALabel="Left"
        groupBLabel="Right"
        onSwitchGroup={onSwitchGroup}
      />
    )

    fireEvent.click(nodeById(container, 'y')!)
    fireEvent.click(screen.getByRole('button', { name: /move to right/i }))

    expect(onSwitchGroup).toHaveBeenCalledWith('y', 'group_a')
  })
})
