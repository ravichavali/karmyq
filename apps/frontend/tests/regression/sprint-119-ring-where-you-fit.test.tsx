/**
 * Sprint 119 / ADR-086 — community ring answers "where do you fit?".
 *
 *  - The viewer anchors the ring: rotation ONLY (ADR-083 — membership, order, radius, chord
 *    geometry stay exactly as S115 shipped); the sorted order rotates so the caller sits at
 *    12 o'clock. Deterministic: same input → same picture.
 *  - Default state: viewer chords keep full presence; non-viewer chords are quieted by one
 *    shared factor layered ON TOP of the decayTier opacity bands (band ordering preserved).
 *    Focus/selection behavior is unchanged on top.
 *  - A place summary line answers the question in words ("bonded with N of M"), with an honest
 *    no-bonds state; the legend gains a "You" entry.
 *  - PINNED shipped contracts: decayTier band values and the new > caller > focused stroke
 *    precedence must not move (ADR-070/083/085).
 */
import { render, screen } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import CommunityRingGraph from '@/components/graphs/CommunityRingGraph'
import { buildCommunityRingModel } from '@/components/graphs/communityRingModel'
import {
  FOCUSED_EDGE_WIDTH,
  NEW_BOND_COLOR,
  NON_VIEWER_CHORD_QUIET_FACTOR,
  PERSON_COLORS,
  UNRELATED_OPACITY,
  edgeVisual,
  ringChordOpacity,
} from '@/components/graphs/graphVisualEncoding'
import type { GraphData, TrustLink } from '@/components/graphs/types'

const ME = 'me'

// Sorted order (name-normalized, then id) without the viewer anchor: Alice, Bob, Maya, Zoe.
const ringNodes = [
  { id: 'a', name: 'Alice' },
  { id: 'b', name: 'Bob' },
  { id: ME, name: 'Maya' },
  { id: 'z', name: 'Zoe' },
]

const chain: GraphData = {
  nodes: [
    { id: ME, name: 'Maya' },
    { id: 'peer', name: 'Peer' },
    { id: 'bridge', name: 'Bridge' },
    { id: 'outside', name: 'Outside' },
  ],
  links: [
    { source: ME, target: 'peer', decayTier: 'strong' },
    { source: 'peer', target: 'bridge', decayTier: 'warm' },
    { source: 'bridge', target: 'outside', decayTier: 'fading' },
  ],
}

const link = (overrides: Partial<TrustLink>): TrustLink => ({
  source: ME,
  target: 'peer',
  decayTier: 'warm',
  ...overrides,
})

describe('Sprint 119 PINNED: decayTier opacity bands are exactly as shipped (ADR-070/083)', () => {
  it('keeps every band value and never lets viewer emphasis change a band', () => {
    const expected: Array<[TrustLink['decayTier'], number]> = [
      ['strong', 0.62],
      ['warm', 0.4],
      ['fading', 0.23],
      ['nearly_forgotten', 0.11],
      ['swept', 0.05],
    ]
    for (const [tier, opacity] of expected) {
      expect(edgeVisual(link({ decayTier: tier }), ME).opacity).toBe(opacity)
    }
  })

  it('keeps the new > caller > focused stroke precedence (ADR-085 pin)', () => {
    // new beats caller
    expect(edgeVisual(link({ formedRecently: true }), ME).stroke).toBe(NEW_BOND_COLOR)
    // caller beats focused
    expect(edgeVisual(link({}), ME, 'peer').stroke).toBe(PERSON_COLORS.callerEdge)
    expect(edgeVisual(link({}), ME, 'peer').width).toBe(FOCUSED_EDGE_WIDTH)
    // focused beats ordinary
    expect(edgeVisual(link({ source: 'x', target: 'peer' }), ME, 'peer').stroke).toBe(
      PERSON_COLORS.focusedEdge
    )
  })
})

describe('Sprint 119: ring rotation anchors the viewer at 12 o\'clock (rotation only)', () => {
  const graph = (nodes: typeof ringNodes): GraphData => ({ nodes: [...nodes], links: [] })

  it('places the viewer at 12 o\'clock regardless of input node order', () => {
    const shuffled = [ringNodes[3], ringNodes[0], ringNodes[2], ringNodes[1]]
    for (const nodes of [ringNodes, shuffled]) {
      const model = buildCommunityRingModel(graph(nodes), 700, 560, ME)
      expect(model.nodes[0].id).toBe(ME)
      expect(model.nodes[0].angle).toBeCloseTo(-Math.PI / 2, 10)
      expect(model.nodes[0].x).toBeCloseTo(0, 6)
      expect(model.nodes[0].y).toBeCloseTo(-model.radius, 6)
    }
  })

  it('preserves the cyclic S115 order — rotation, not a re-sort', () => {
    const model = buildCommunityRingModel(graph(ringNodes), 700, 560, ME)
    // sorted order [Alice, Bob, Maya, Zoe] rotated to start at Maya
    expect(model.nodes.map(n => n.id)).toEqual([ME, 'z', 'a', 'b'])
  })

  it('is deterministic: same input twice gives the identical picture', () => {
    const first = buildCommunityRingModel(graph(ringNodes), 700, 560, ME)
    const second = buildCommunityRingModel(graph(ringNodes), 700, 560, ME)
    expect(second.nodes.map(n => ({ id: n.id, x: n.x, y: n.y, angle: n.angle }))).toEqual(
      first.nodes.map(n => ({ id: n.id, x: n.x, y: n.y, angle: n.angle }))
    )
  })

  it('keeps the plain S115 sorted order when no viewer is given or the viewer is absent', () => {
    const withoutViewer = buildCommunityRingModel(graph(ringNodes), 700, 560)
    expect(withoutViewer.nodes.map(n => n.id)).toEqual(['a', 'b', ME, 'z'])

    const viewerAbsent = buildCommunityRingModel(graph(ringNodes), 700, 560, 'ghost')
    expect(viewerAbsent.nodes.map(n => n.id)).toEqual(['a', 'b', ME, 'z'])
  })
})

describe('Sprint 119: ringChordOpacity layers viewer emphasis on the untouched bands', () => {
  it('quiets non-viewer chords by one shared factor and leaves viewer chords at the band', () => {
    expect(ringChordOpacity(0.62, true, true)).toBe(0.62)
    expect(ringChordOpacity(0.62, false, true)).toBeCloseTo(0.62 * NON_VIEWER_CHORD_QUIET_FACTOR, 10)
  })

  it('preserves relative band ordering within the quieted group', () => {
    const strong = ringChordOpacity(0.62, false, true)
    const warm = ringChordOpacity(0.4, false, true)
    const fading = ringChordOpacity(0.23, false, true)
    expect(strong).toBeGreaterThan(warm)
    expect(warm).toBeGreaterThan(fading)
  })

  it('applies no quieting when the viewer is not in the ring (steward/explorer views stay whole)', () => {
    expect(ringChordOpacity(0.4, false, false)).toBe(0.4)
  })

  it('never quiets a band down to the unrelated-focus opacity', () => {
    for (const band of [0.62, 0.4, 0.23, 0.11]) {
      expect(ringChordOpacity(band, false, true)).not.toBe(UNRELATED_OPACITY)
    }
  })
})

describe('Sprint 119: default ring state — your chords forward, others quiet', () => {
  it('renders viewer chords at the band and non-viewer chords quieted', () => {
    const { container } = render(<CommunityRingGraph graphData={chain} currentUserId={ME} />)
    const paths = [...container.querySelectorAll('path[data-link-key]')]
    // model.links follow graph.links order: me-peer, peer-bridge, bridge-outside
    expect(paths[0]).toHaveAttribute('stroke-opacity', '0.62')
    expect(paths[1]).toHaveAttribute(
      'stroke-opacity',
      String(0.4 * NON_VIEWER_CHORD_QUIET_FACTOR)
    )
    expect(paths[2]).toHaveAttribute(
      'stroke-opacity',
      String(0.23 * NON_VIEWER_CHORD_QUIET_FACTOR)
    )
  })

  it('keeps focus behavior unchanged on top: incident lifts to the band, unrelated drops to 0.05', () => {
    const { container } = render(<CommunityRingGraph graphData={chain} currentUserId={ME} />)
    fireEvent.focus(container.querySelector('[data-node-id="peer"]')!)
    const paths = [...container.querySelectorAll('path[data-link-key]')]
    expect(paths[0]).toHaveAttribute('stroke-opacity', '0.62') // incident viewer chord
    expect(paths[1]).toHaveAttribute('stroke-opacity', '0.4') // incident non-viewer chord lifts
    expect(paths[2]).toHaveAttribute('stroke-opacity', String(UNRELATED_OPACITY))
  })

  it('does not quiet anything when the viewer is not part of this community graph', () => {
    const { container } = render(<CommunityRingGraph graphData={chain} currentUserId="ghost" />)
    const paths = [...container.querySelectorAll('path[data-link-key]')]
    expect(paths[0]).toHaveAttribute('stroke-opacity', '0.62')
    expect(paths[1]).toHaveAttribute('stroke-opacity', '0.4')
    expect(paths[2]).toHaveAttribute('stroke-opacity', '0.23')
  })
})

describe('Sprint 119: the place summary answers "where do you fit?" in words', () => {
  it('summarizes a bonded viewer as "bonded with N of M"', () => {
    render(<CommunityRingGraph graphData={chain} currentUserId={ME} />)
    expect(screen.getByText(/bonded with 1 of 3/i)).toBeInTheDocument()
  })

  it('counts distinct bonded neighbours, not links', () => {
    const twoBonds: GraphData = {
      ...chain,
      links: [
        ...chain.links,
        { source: 'bridge', target: ME, decayTier: 'warm' },
      ],
    }
    render(<CommunityRingGraph graphData={twoBonds} currentUserId={ME} />)
    expect(screen.getByText(/bonded with 2 of 3/i)).toBeInTheDocument()
  })

  it('tells an unbonded viewer the honest no-bonds line, not a fake weave', () => {
    const unbonded: GraphData = {
      nodes: chain.nodes,
      links: [{ source: 'peer', target: 'bridge', decayTier: 'warm' }],
    }
    render(<CommunityRingGraph graphData={unbonded} currentUserId={ME} />)
    expect(
      screen.getByText(/no bonds here yet — help someone to start weaving in/i)
    ).toBeInTheDocument()
    expect(screen.queryByText(/bonded with/i)).not.toBeInTheDocument()
  })

  it('renders no place summary at all when the viewer is not in the graph', () => {
    render(<CommunityRingGraph graphData={chain} currentUserId="ghost" />)
    expect(screen.queryByText(/bonded with/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/no bonds here yet/i)).not.toBeInTheDocument()
  })

  it('adds a "You" legend entry and keeps the four shipped relationship entries', () => {
    render(<CommunityRingGraph graphData={chain} currentUserId={ME} />)
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText('Strong relationship')).toBeInTheDocument()
    expect(screen.getByText('Warm relationship')).toBeInTheDocument()
    expect(screen.getByText('Fading relationship')).toBeInTheDocument()
    expect(screen.getByText('Nearly forgotten relationship')).toBeInTheDocument()
  })

  it('names the viewer\'s place in the svg aria-label when the viewer is present', () => {
    const { container, rerender } = render(
      <CommunityRingGraph graphData={chain} currentUserId={ME} />
    )
    expect(container.querySelector('svg')).toHaveAttribute(
      'aria-label',
      'Community trust connections — where you fit'
    )
    rerender(<CommunityRingGraph graphData={chain} currentUserId="ghost" />)
    expect(container.querySelector('svg')).toHaveAttribute(
      'aria-label',
      'Community trust connections'
    )
  })
})
