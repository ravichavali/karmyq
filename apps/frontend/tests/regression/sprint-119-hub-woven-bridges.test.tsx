/**
 * Sprint 119 / ADR-086 — across-communities hub answers "which of your communities are woven
 * together?".
 *
 *  - A member↔member organic bridge (both endpoints `is_member`) is the answer to the question,
 *    so it renders emphasized; periphery bridges (either endpoint not yours) and dormant bridges
 *    are quieted.
 *  - Aliveness is server-derived and qualitative (ADR-082): `active_recently` → the S118
 *    new-bond green family. Dormant member↔member bridges do NOT get the aliveness hue.
 *  - The flag must survive the live normalization hop: `BelongingGraph` (mode `communities`) →
 *    `normalizeCommunityDepthGraph` → `DepthLink.active_recently` → `TrustLink.activeRecently`.
 *    The renderer assertions here feed a RAW depth-graph payload through that hop — hand-built
 *    TrustLink fixtures alone could go green while live data shows nothing.
 *  - Fission lineage rendering is untouched.
 */
import { render, screen } from '@testing-library/react'
import CommunityHubGraph from '@/components/graphs/CommunityHubGraph'
import {
  FISSION_VIOLET,
  NEW_BOND_COLOR,
  ORGANIC_SLATE,
  PERIPHERY_BRIDGE_OPACITY,
  PERIPHERY_BRIDGE_WIDTH,
  WOVEN_ALIVE_OPACITY,
  WOVEN_BRIDGE_WIDTH,
  WOVEN_DORMANT_OPACITY,
  hubBridgeVisual,
} from '@/components/graphs/graphVisualEncoding'
import { normalizeCommunityDepthGraph } from '@/components/graphs/normalizeGraphData'
import type { TrustLink } from '@/components/graphs/types'

// RAW /trust/communities payload shape — exactly what the server returns after Task 2.
const rawDepthGraph = {
  nodes: [
    { id: 'home', name: 'Home Co-op', member_count: 12, status: 'active', is_member: true },
    { id: 'harbor', name: 'Harbor Aid', member_count: 30, status: 'active', is_member: true },
    { id: 'hollow', name: 'Hollow Exchange', member_count: 9, status: 'active', is_member: true },
    { id: 'far', name: 'Far Network', member_count: 20, status: 'active', is_member: false },
  ],
  links: [
    // woven + alive: both endpoints mine, recent exchange
    { source: 'home', target: 'harbor', weight: 4, type: 'organic' as const, active_recently: true },
    // woven but dormant: both endpoints mine, no recent exchange
    { source: 'home', target: 'hollow', weight: 2, type: 'organic' as const, active_recently: false },
    // periphery: one endpoint not mine
    { source: 'harbor', target: 'far', weight: 1, type: 'organic' as const, active_recently: true },
    // fission lineage: untouched
    { source: 'home', target: 'far', weight: 1, type: 'fission' as const },
  ],
}

const isMember = (id: string) => ['home', 'harbor', 'hollow'].includes(id)

const organicLink = (overrides: Partial<TrustLink>): TrustLink => ({
  source: 'home',
  target: 'harbor',
  type: 'organic',
  ...overrides,
})

describe('Sprint 119: normalizeCommunityDepthGraph threads active_recently → activeRecently', () => {
  it('maps the outward snake_case boolean onto the canonical client link', () => {
    const graph = normalizeCommunityDepthGraph(rawDepthGraph)
    expect(graph.links.map(l => l.activeRecently)).toEqual([true, false, true, undefined])
  })

  it('keeps the shipped mapping intact: weight → raw/effective, type preserved', () => {
    const graph = normalizeCommunityDepthGraph(rawDepthGraph)
    expect(graph.links[0]).toEqual(
      expect.objectContaining({
        source: 'home',
        target: 'harbor',
        raw_weight: 4,
        effective_weight: 4,
        type: 'organic',
      })
    )
    expect(graph.links[3].type).toBe('fission')
  })
})

describe('Sprint 119: hubBridgeVisual — one encoding source of truth for hub edges', () => {
  it('emphasizes a woven, alive bridge with the S118 green family', () => {
    const visual = hubBridgeVisual(organicLink({ activeRecently: true }), isMember)
    expect(visual.stroke).toBe(NEW_BOND_COLOR)
    expect(visual.width).toBe(WOVEN_BRIDGE_WIDTH)
    expect(visual.opacity).toBe(WOVEN_ALIVE_OPACITY)
    expect(visual.label).toBe('Woven bridge — recent exchange')
  })

  it('keeps a dormant woven bridge emphasized in width but quiet, with NO aliveness hue', () => {
    const visual = hubBridgeVisual(organicLink({ activeRecently: false }), isMember)
    expect(visual.stroke).toBe(ORGANIC_SLATE)
    expect(visual.width).toBe(WOVEN_BRIDGE_WIDTH)
    expect(visual.opacity).toBe(WOVEN_DORMANT_OPACITY)
    expect(visual.label).toBe('Dormant bridge')
  })

  it('fails closed: a woven bridge with no aliveness flag renders dormant, never alive', () => {
    const visual = hubBridgeVisual(organicLink({}), isMember)
    expect(visual.stroke).toBe(ORGANIC_SLATE)
    expect(visual.label).toBe('Dormant bridge')
  })

  it('quiets a periphery bridge even when it is active (the question is about YOUR communities)', () => {
    const visual = hubBridgeVisual(
      organicLink({ source: 'harbor', target: 'far', activeRecently: true }),
      isMember
    )
    expect(visual.stroke).toBe(ORGANIC_SLATE)
    expect(visual.width).toBe(PERIPHERY_BRIDGE_WIDTH)
    expect(visual.opacity).toBe(PERIPHERY_BRIDGE_OPACITY)
  })

  it('REGRESSION: fission lineage keeps its exact shipped styling', () => {
    const visual = hubBridgeVisual(
      { source: 'home', target: 'far', type: 'fission' },
      isMember
    )
    expect(visual.stroke).toBe(FISSION_VIOLET)
    expect(visual.width).toBe(2)
    expect(visual.opacity).toBe(0.9)
    expect(visual.dasharray).toBe('6,4')
  })
})

describe('Sprint 119: the hub renders woven vs dormant vs periphery from a RAW server payload', () => {
  const renderHub = () =>
    render(<CommunityHubGraph graphData={normalizeCommunityDepthGraph(rawDepthGraph)} />)

  const edgeByLabel = (container: HTMLElement, prefix: string) =>
    [...container.querySelectorAll('line.hub-edge')].find(l =>
      (l.getAttribute('aria-label') ?? '').startsWith(prefix)
    )

  it('gives the alive woven bridge the aliveness treatment', () => {
    const { container } = renderHub()
    const alive = edgeByLabel(container, 'Woven bridge — recent exchange')
    expect(alive).toBeDefined()
    expect(alive!.getAttribute('stroke')).toBe(NEW_BOND_COLOR)
    expect(alive!.getAttribute('stroke-width')).toBe(String(WOVEN_BRIDGE_WIDTH))
    expect(alive!.getAttribute('stroke-opacity')).toBe(String(WOVEN_ALIVE_OPACITY))
  })

  it('renders the dormant woven bridge without the aliveness hue and quieted', () => {
    const { container } = renderHub()
    const dormant = edgeByLabel(container, 'Dormant bridge')
    expect(dormant).toBeDefined()
    expect(dormant!.getAttribute('stroke')).toBe(ORGANIC_SLATE)
    expect(dormant!.getAttribute('stroke-opacity')).toBe(String(WOVEN_DORMANT_OPACITY))
  })

  it('quiets the periphery bridge below every woven bridge', () => {
    const { container } = renderHub()
    const lines = [...container.querySelectorAll('line.hub-edge')]
    const periphery = lines.find(
      l => l.getAttribute('stroke-opacity') === String(PERIPHERY_BRIDGE_OPACITY)
    )
    expect(periphery).toBeDefined()
    expect(periphery!.getAttribute('stroke')).toBe(ORGANIC_SLATE)
    expect(periphery!.getAttribute('stroke-width')).toBe(String(PERIPHERY_BRIDGE_WIDTH))
    expect(PERIPHERY_BRIDGE_OPACITY).toBeLessThan(WOVEN_DORMANT_OPACITY)
    expect(WOVEN_DORMANT_OPACITY).toBeLessThan(WOVEN_ALIVE_OPACITY)
  })

  it('REGRESSION: the fission lineage edge still renders violet and dashed', () => {
    const { container } = renderHub()
    const dashed = [...container.querySelectorAll('line.hub-edge')].filter(l =>
      l.getAttribute('stroke-dasharray')
    )
    expect(dashed).toHaveLength(1)
    expect(dashed[0].getAttribute('stroke')).toBe(FISSION_VIOLET)
    expect(dashed[0].getAttribute('stroke-opacity')).toBe('0.9')
  })

  it('keeps the focus dim behavior working on top of the new encoding', () => {
    const { container } = render(
      <CommunityHubGraph
        graphData={normalizeCommunityDepthGraph(rawDepthGraph)}
        focusedNodeId="home"
      />
    )
    // incident to home: keeps its own encoded opacity; non-incident: fades.
    const alive = edgeByLabel(container, 'Woven bridge — recent exchange')
    expect(alive!.getAttribute('stroke-opacity')).toBe(String(WOVEN_ALIVE_OPACITY))
    const periphery = [...container.querySelectorAll('line.hub-edge')].find(
      l => l.getAttribute('stroke') === ORGANIC_SLATE && !(l.getAttribute('aria-label') ?? '').startsWith('Dormant')
    )
    expect(periphery!.getAttribute('stroke-opacity')).toBe('0.15')
  })

  it('adds the two legend entries and keeps the shipped ones', () => {
    renderHub()
    expect(screen.getByText('Woven bridge — recent exchange')).toBeInTheDocument()
    expect(screen.getByText('Dormant bridge')).toBeInTheDocument()
    expect(screen.getByText('Your community')).toBeInTheDocument()
    expect(screen.getByText('Connected community')).toBeInTheDocument()
    expect(screen.getByText(/fission lineage/i)).toBeInTheDocument()
  })

  it('names woven vs dormant in the bridge aria-labels with both community names', () => {
    const { container } = renderHub()
    const alive = edgeByLabel(container, 'Woven bridge — recent exchange')
    expect(alive!.getAttribute('aria-label')).toContain('Home Co-op')
    expect(alive!.getAttribute('aria-label')).toContain('Harbor Aid')
    const dormant = edgeByLabel(container, 'Dormant bridge')
    expect(dormant!.getAttribute('aria-label')).toContain('Hollow Exchange')
  })
})
