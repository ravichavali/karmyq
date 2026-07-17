import { render, screen } from '@testing-library/react'
import CommunityHubGraph from '@/components/graphs/CommunityHubGraph'
import CommunityRingGraph from '@/components/graphs/CommunityRingGraph'
import * as visualEncoding from '@/components/graphs/graphVisualEncoding'
import type { GraphData, TrustLink } from '@/components/graphs/types'

jest.mock('@/components/graphs/graphVisualEncoding', () => {
  const actual = jest.requireActual('@/components/graphs/graphVisualEncoding')
  return { ...actual, hubBridgeVisual: jest.fn(actual.hubBridgeVisual) }
})

const ME = 'me'

const ringGraph: GraphData = {
  nodes: [
    { id: ME, name: 'Me' },
    { id: 'bonded', name: 'Bonded' },
    { id: 'shown', name: 'Shown' },
  ],
  links: [{ source: ME, target: 'bonded', decayTier: 'strong' }],
  meta: { truncated: true, totalActiveMembers: 12 },
}

const hubGraph: GraphData = {
  nodes: [
    { id: 'home', name: 'Home', is_member: true, member_count: 12 },
    { id: 'harbor', name: 'Harbor', is_member: true, member_count: 8 },
    { id: 'far', name: 'Far', is_member: false, member_count: 5 },
  ],
  links: [
    { source: 'home', target: 'harbor', type: 'organic', activeRecently: true },
    { source: 'harbor', target: 'far', type: 'organic', activeRecently: false },
  ],
}

const link = (overrides: Partial<TrustLink> = {}): TrustLink => ({
  source: ME,
  target: 'peer',
  decayTier: 'warm',
  ...overrides,
})

describe('Sprint 120 graph polish: unchanged visual contracts', () => {
  it('pins decay bands and the new > caller > focused stroke precedence', () => {
    const expected: Array<[TrustLink['decayTier'], number]> = [
      ['strong', 0.62],
      ['warm', 0.4],
      ['fading', 0.23],
      ['nearly_forgotten', 0.11],
      ['swept', 0.05],
    ]
    expected.forEach(([tier, opacity]) => {
      expect(visualEncoding.edgeVisual(link({ decayTier: tier }), ME).opacity).toBe(opacity)
    })
    expect(
      visualEncoding.edgeVisual(link({ formedRecently: true }), ME, 'peer').stroke,
    ).toBe(visualEncoding.NEW_BOND_COLOR)
    expect(visualEncoding.edgeVisual(link(), ME, 'peer').stroke).toBe(
      visualEncoding.PERSON_COLORS.callerEdge,
    )
    expect(
      visualEncoding.edgeVisual(link({ source: 'a', target: 'peer' }), ME, 'peer').stroke,
    ).toBe(visualEncoding.PERSON_COLORS.focusedEdge)
  })

  it('pins truthful woven, dormant, and fission legend colors', () => {
    const mine = (id: string) => id !== 'far'
    expect(
      visualEncoding.hubBridgeVisual(
        { source: 'home', target: 'harbor', type: 'organic', activeRecently: true },
        mine,
      ).stroke,
    ).toBe(visualEncoding.NEW_BOND_COLOR)
    expect(
      visualEncoding.hubBridgeVisual(
        { source: 'home', target: 'harbor', type: 'organic', activeRecently: false },
        mine,
      ).stroke,
    ).toBe(visualEncoding.ORGANIC_SLATE)
    expect(
      visualEncoding.hubBridgeVisual({ source: 'home', target: 'far', type: 'fission' }, mine)
        .stroke,
    ).toBe(visualEncoding.FISSION_VIOLET)
  })
})

describe('Sprint 120 graph polish: clearer and accessible rendering', () => {
  it('scopes a truncated ring bond summary to the members shown', () => {
    render(<CommunityRingGraph graphData={ringGraph} currentUserId={ME} />)

    expect(screen.getByText("You're bonded with 1 of the 2 members shown.")).toBeInTheDocument()
  })

  it('keeps the quieted weakest related chord visibly above unrelated content', () => {
    const quietedRelatedOpacity = visualEncoding.ringChordOpacity(0.11, false, true)

    expect(quietedRelatedOpacity).toBeGreaterThan(visualEncoding.UNRELATED_OPACITY)
    expect(quietedRelatedOpacity).toBeGreaterThanOrEqual(0.12)
  })

  it('renders Woven and Dormant legend entries without a redundant organic-trust entry', () => {
    render(<CommunityHubGraph graphData={hubGraph} />)

    expect(screen.getByText('Woven bridge — recent exchange')).toBeInTheDocument()
    expect(screen.getByText('Dormant bridge')).toBeInTheDocument()
    expect(screen.queryByText(/organic trust/i)).not.toBeInTheDocument()
  })

  it('exposes every labelled hub edge as an image to assistive technology', () => {
    const { container } = render(<CommunityHubGraph graphData={hubGraph} />)

    const labelledEdges = [...container.querySelectorAll('line.hub-edge[aria-label]')]
    expect(labelledEdges).toHaveLength(hubGraph.links.length)
    labelledEdges.forEach(edge => expect(edge).toHaveAttribute('role', 'img'))
  })

  it('computes each hub bridge visual once per render', () => {
    const visualSpy = visualEncoding.hubBridgeVisual as jest.MockedFunction<
      typeof visualEncoding.hubBridgeVisual
    >
    visualSpy.mockClear()

    render(<CommunityHubGraph graphData={hubGraph} />)

    expect(visualSpy).toHaveBeenCalledTimes(hubGraph.links.length)
  })
})
