/**
 * Sprint 118 / ADR-085 — new-bond emphasis: `formedRecently` links read as NEW, layered on top of
 * the existing decayTier opacity bands (which are pinned here exactly as they ship today, ADR-083:
 * no layout change). The existing inline ego legend gains a "New bond" entry.
 */
import { render, screen } from '@testing-library/react'
import EgoOrbitGraph from '../../src/components/graphs/EgoOrbitGraph'
import { buildEgoOrbitModel } from '../../src/components/graphs/egoOrbitModel'
import {
  FOCUSED_EDGE_WIDTH,
  NEW_BOND_COLOR,
  NEW_BOND_EDGE_WIDTH,
  PERSON_COLORS,
  PERSON_EDGE_WIDTH,
  edgeVisual,
} from '../../src/components/graphs/graphVisualEncoding'
import { normalizePersonGraph } from '../../src/components/graphs/normalizeGraphData'
import type { GraphData, TrustLink } from '../../src/components/graphs/types'

const ME = 'me'
const link = (overrides: Partial<TrustLink>): TrustLink => ({
  source: ME,
  target: 'peer',
  decayTier: 'warm',
  ...overrides,
})

describe('Sprint 118: edgeVisual layers "new" emphasis on the untouched decayTier bands', () => {
  it('REGRESSION: decayTier opacity bands are exactly as shipped (ADR-070/083)', () => {
    const expected: Array<[TrustLink['decayTier'], number]> = [
      ['strong', 0.62],
      ['warm', 0.4],
      ['fading', 0.23],
      ['nearly_forgotten', 0.11],
      ['swept', 0.05],
    ]
    for (const [tier, opacity] of expected) {
      expect(edgeVisual(link({ decayTier: tier }), ME).opacity).toBe(opacity)
      // the emphasis NEVER changes the opacity band
      expect(edgeVisual(link({ decayTier: tier, formedRecently: true }), ME).opacity).toBe(opacity)
    }
  })

  it('a formedRecently link gets the new-bond stroke + width; a non-new link keeps the caller stroke', () => {
    const fresh = edgeVisual(link({ formedRecently: true }), ME)
    expect(fresh.stroke).toBe(NEW_BOND_COLOR)
    expect(fresh.width).toBe(NEW_BOND_EDGE_WIDTH)

    const old = edgeVisual(link({ formedRecently: false }), ME)
    expect(old.stroke).toBe(PERSON_COLORS.callerEdge)
    expect(old.width).toBe(PERSON_EDGE_WIDTH)
  })

  it('new-bond emphasis also applies to non-caller edges', () => {
    const fresh = edgeVisual(link({ source: 'a', target: 'b', formedRecently: true }), ME)
    expect(fresh.stroke).toBe(NEW_BOND_COLOR)
    expect(fresh.width).toBe(NEW_BOND_EDGE_WIDTH)
  })

  it('a focused new bond keeps the new-bond color (state beats focus hue, per the shipped S115 contract) with the focused width', () => {
    const focused = edgeVisual(link({ source: 'a', target: 'b', formedRecently: true }), ME, 'a')
    expect(focused.stroke).toBe(NEW_BOND_COLOR)
    expect(focused.width).toBe(FOCUSED_EDGE_WIDTH)
  })

  it('REGRESSION: without the flag, caller amber still beats focused teal (S115 pin)', () => {
    const callerFocused = edgeVisual(link({}), ME, 'peer')
    expect(callerFocused.stroke).toBe(PERSON_COLORS.callerEdge)
    expect(callerFocused.width).toBe(FOCUSED_EDGE_WIDTH)
  })

  it('the label names the bond as new', () => {
    expect(edgeVisual(link({ decayTier: 'strong', formedRecently: true }), ME).label).toBe(
      'strong · new bond'
    )
    expect(edgeVisual(link({ decayTier: 'strong' }), ME).label).toBe('strong')
  })
})

describe('Sprint 118: normalizePersonGraph bridges formed_recently → formedRecently', () => {
  it('maps the outward snake_case boolean onto the canonical client link', () => {
    const graph = normalizePersonGraph({
      nodes: [{ user_id: ME, name: 'Me', is_current_user: true }],
      links: [
        { source: ME, target: 'b', relationship_state: 'warm', formed_recently: true },
        { source: ME, target: 'c', relationship_state: 'strong', formed_recently: false },
        { source: ME, target: 'd', relationship_state: 'strong' },
      ],
    })
    expect(graph.links.map(l => l.formedRecently)).toEqual([true, false, undefined])
    // decayTier bridge untouched
    expect(graph.links.map(l => l.decayTier)).toEqual(['warm', 'strong', 'strong'])
  })
})

describe('Sprint 118: ADR-083 layout regression — formedRecently never moves geometry', () => {
  const fixture = (formedRecently?: boolean): GraphData => ({
    nodes: [
      { id: ME, name: 'Me', isCurrentUser: true },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
      { id: 'd', name: 'D' },
    ],
    links: [
      { source: ME, target: 'b', decayTier: 'strong', ...(formedRecently != null ? { formedRecently } : {}) },
      { source: ME, target: 'c', decayTier: 'warm' },
      { source: 'c', target: 'd', decayTier: 'fading' },
    ],
  })

  it('orbit positions are identical with and without the flag', () => {
    const before = buildEgoOrbitModel(fixture(undefined), ME, 800, 560)
    const after = buildEgoOrbitModel(fixture(true), ME, 800, 560)
    expect(after.nodes.map(n => ({ id: n.id, x: n.x, y: n.y, angle: n.angle }))).toEqual(
      before.nodes.map(n => ({ id: n.id, x: n.x, y: n.y, angle: n.angle }))
    )
    expect(after.maxDistance).toBe(before.maxDistance)
  })
})

describe('Sprint 118: EgoOrbitGraph renders the emphasis and the extended legend', () => {
  const graphData: GraphData = {
    nodes: [
      { id: ME, name: 'Me', isCurrentUser: true },
      { id: 'b', name: 'Bea' },
      { id: 'c', name: 'Cal' },
    ],
    links: [
      { source: ME, target: 'b', decayTier: 'warm', formedRecently: true },
      { source: ME, target: 'c', decayTier: 'warm', formedRecently: false },
    ],
  }

  it('renders a formedRecently link with the new-bond stroke and a non-new link without it', () => {
    const { container } = render(<EgoOrbitGraph graphData={graphData} currentUserId={ME} />)
    const lines = [...container.querySelectorAll('line[data-link-key]')]
    expect(lines).toHaveLength(2)
    const strokes = lines.map(l => l.getAttribute('stroke'))
    expect(strokes).toContain(NEW_BOND_COLOR)
    expect(strokes).toContain(PERSON_COLORS.callerEdge)
  })

  it('the EXISTING inline legend gains a "New bond" entry alongside the four decay entries', () => {
    render(<EgoOrbitGraph graphData={graphData} currentUserId={ME} />)
    // exact-string matcher: the edge <title> ("warm · new bond") must not satisfy this
    expect(screen.getByText('New bond')).toBeInTheDocument()
    // the shipped entries stay exactly as they are
    expect(screen.getByText('Strong relationship')).toBeInTheDocument()
    expect(screen.getByText('Warm relationship')).toBeInTheDocument()
    expect(screen.getByText('Fading relationship')).toBeInTheDocument()
    expect(screen.getByText('Nearly forgotten relationship')).toBeInTheDocument()
  })
})
