import {
  FOCUSED_EDGE_WIDTH,
  PERSON_COLORS,
  PERSON_EDGE_WIDTH,
  UNRELATED_OPACITY,
  buildAdjacency,
  edgeVisual,
  personNodeAriaLabel,
  relationshipLabel,
} from '@/components/graphs/graphVisualEncoding'
import {
  buildCommunityRingModel,
  compareGraphNodes,
} from '@/components/graphs/communityRingModel'
import type { GraphData, TrustLink, TrustNode } from '@/components/graphs/types'

const link = (decayTier?: TrustLink['decayTier']): TrustLink => ({
  source: 'a',
  target: 'b',
  decayTier,
})

describe('Sprint 115 shared person-graph visual encoding', () => {
  it('locks the shared person-graph palette and unrelated opacity', () => {
    expect(PERSON_COLORS).toEqual({
      callerNode: '#10b981',
      ordinaryNode: '#94a3b8',
      callerEdge: '#f59e0b',
      ordinaryEdge: '#64748b',
      focusedEdge: '#14b8a6',
      focusRing: '#f8fafc',
    })
    expect(UNRELATED_OPACITY).toBe(0.05)
  })

  it.each([
    ['strong', 0.62],
    ['warm', 0.4],
    ['fading', 0.23],
    ['nearly_forgotten', 0.11],
    ['swept', 0.05],
    [undefined, 0.16],
  ] as const)('maps the %s relationship state to opacity %s', (decayTier, opacity) => {
    expect(edgeVisual(link(decayTier), 'me')).toMatchObject({
      opacity,
      width: PERSON_EDGE_WIDTH,
    })
  })

  it('falls back to neutral opacity for an unknown runtime relationship state', () => {
    const unknown = { ...link(), decayTier: 'unexpected' as TrustLink['decayTier'] }

    expect(edgeVisual(unknown, 'me').opacity).toBe(0.16)
  })

  it('keeps at-rest width constant and widens only incident focused edges', () => {
    expect(edgeVisual(link('strong'), 'me').width).toBe(PERSON_EDGE_WIDTH)
    expect(edgeVisual(link('swept'), 'me').width).toBe(PERSON_EDGE_WIDTH)
    expect(edgeVisual({ source: 'me', target: 'a', decayTier: 'strong' }, 'me').width).toBe(
      PERSON_EDGE_WIDTH
    )
    expect(edgeVisual(link('warm'), 'me', 'a').width).toBe(FOCUSED_EDGE_WIDTH)
    expect(edgeVisual(link('warm'), 'me', 'elsewhere').width).toBe(PERSON_EDGE_WIDTH)
  })

  it('gives caller amber precedence over focused teal, then uses the ordinary hue', () => {
    expect(edgeVisual({ source: 'me', target: 'a', decayTier: 'warm' }, 'me', 'a')).toMatchObject({
      stroke: PERSON_COLORS.callerEdge,
      width: 2.5,
    })
    expect(edgeVisual({ source: 'a', target: 'b', decayTier: 'warm' }, 'me', 'a').stroke).toBe(
      PERSON_COLORS.focusedEdge
    )
    expect(edgeVisual(link('warm'), 'me').stroke).toBe(PERSON_COLORS.ordinaryEdge)
  })

  it('uses qualitative relationship and structural identity in labels', () => {
    expect(relationshipLabel('nearly_forgotten')).toBe('nearly forgotten')
    expect(relationshipLabel(undefined)).toBe('relationship state unavailable')
    expect(personNodeAriaLabel({ id: 'me', name: 'Maria' }, 'me', 0, 1)).toBe(
      'Maria, you, 1 connection'
    )
    expect(personNodeAriaLabel({ id: 'a', name: 'Aisha' }, 'me', 1, 2)).toBe(
      'Aisha, 1 degree away, 2 connections'
    )
    expect(personNodeAriaLabel({ id: 'b', name: 'Ben' }, 'me', 2, 0)).toBe(
      'Ben, 2 degrees away, 0 connections'
    )
  })

  it('builds undirected adjacency only for links whose endpoints exist', () => {
    const graph: GraphData = {
      nodes: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
        { id: 'c', name: 'C' },
      ],
      links: [
        { source: 'a', target: 'b' },
        { source: 'a', target: 'missing' },
      ],
    }

    expect([...buildAdjacency(graph).entries()].map(([id, neighbors]) => [id, [...neighbors]])).toEqual([
      ['a', ['a', 'b']],
      ['b', ['b', 'a']],
      ['c', ['c']],
    ])
  })
})

describe('Sprint 115 deterministic community ring model', () => {
  const graph: GraphData = {
    nodes: [
      { id: 'z-id', name: 'Zed' },
      { id: 'b-id', name: 'alice' },
      { id: 'a-id', name: 'Alice' },
    ],
    links: [
      { source: 'a-id', target: 'b-id', decayTier: 'strong' },
      { source: 'z-id', target: 'a-id', decayTier: 'warm' },
      { source: 'missing', target: 'a-id', decayTier: 'fading' },
    ],
    meta: { totalActiveMembers: 7, truncated: true },
  }

  it('orders by normalized name then ID and places every node on one finite circle', () => {
    const model = buildCommunityRingModel(graph, 700, 560)

    expect(model.nodes.map(node => node.id)).toEqual(['a-id', 'b-id', 'z-id'])
    expect(new Set(model.nodes.map(node => Math.hypot(node.x, node.y).toFixed(4))).size).toBe(1)
    expect(model.radius).toBe(208)
    expect(
      model.nodes.every(node =>
        [node.x, node.y, node.angle].every(value => Number.isFinite(value))
      )
    ).toBe(true)
    expect(compareGraphNodes({ id: 'a-id', name: 'Alice' }, { id: 'b-id', name: 'alice' })).toBeLessThan(0)
  })

  it('emits one direct quadratic path per valid link and filters dangling links', () => {
    const model = buildCommunityRingModel(graph, 700, 560)

    expect(model.links).toHaveLength(graph.links.length - 1)
    expect(model.links.every(item => /^M[-\d.]+ [-\d.]+ Q[-\d.]+ [-\d.]+ [-\d.]+ [-\d.]+$/.test(item.path))).toBe(
      true
    )
    expect(model.links.every(item => !item.path.includes('NaN') && !item.path.includes('Infinity'))).toBe(
      true
    )
  })

  it('keeps a reversed undirected link on the same stable curve', () => {
    const nodes: TrustNode[] = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ]
    const forward = buildCommunityRingModel(
      { nodes, links: [{ source: 'a', target: 'b', decayTier: 'strong' }] },
      600,
      500
    ).links[0]
    const reversed = buildCommunityRingModel(
      { nodes, links: [{ source: 'b', target: 'a', decayTier: 'strong' }] },
      600,
      500
    ).links[0]
    const parse = (path: string) => {
      const values = path.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
      return { start: values.slice(0, 2), control: values.slice(2, 4), end: values.slice(4, 6) }
    }
    const forwardPath = parse(forward.path)
    const reversedPath = parse(reversed.path)

    expect(reversed.key).toBe(forward.key)
    expect(reversedPath.control).toEqual(forwardPath.control)
    expect(reversedPath.start).toEqual(forwardPath.end)
    expect(reversedPath.end).toEqual(forwardPath.start)
  })

  it('ignores person reputation and edge weights in geometry, paths, tokens, and labels', () => {
    const graphWithNumbers = Object.freeze({
      nodes: Object.freeze([
        Object.freeze({ id: 'me', name: 'Maria', trust_score: 91, karma: 37 }),
        Object.freeze({ id: 'a', name: 'Aisha', trust_score: 12, karma: 8 }),
      ]),
      links: Object.freeze([
        Object.freeze({
          source: 'me',
          target: 'a',
          decayTier: 'warm' as const,
          raw_weight: 0.88,
          effective_weight: 0.55,
        }),
      ]),
    })
    const graphWithChangedNumbers = Object.freeze({
      nodes: Object.freeze([
        Object.freeze({ id: 'me', name: 'Maria', trust_score: -999, karma: 50000 }),
        Object.freeze({ id: 'a', name: 'Aisha', trust_score: 0.001, karma: -4 }),
      ]),
      links: Object.freeze([
        Object.freeze({
          source: 'me',
          target: 'a',
          decayTier: 'warm' as const,
          raw_weight: 1000,
          effective_weight: -1000,
        }),
      ]),
    })

    const first = buildCommunityRingModel(graphWithNumbers as GraphData, 640, 480)
    const changed = buildCommunityRingModel(graphWithChangedNumbers as GraphData, 640, 480)
    const projectGeometry = (model: ReturnType<typeof buildCommunityRingModel>) => ({
      nodes: model.nodes.map(({ id, x, y, angle }) => ({ id, x, y, angle })),
      links: model.links.map(({ key, path }) => ({ key, path })),
      radius: model.radius,
    })
    const firstLink = graphWithNumbers.links[0]
    const changedLink = graphWithChangedNumbers.links[0]

    expect(projectGeometry(changed)).toEqual(projectGeometry(first))
    expect(edgeVisual(changedLink, 'me', 'a')).toEqual(edgeVisual(firstLink, 'me', 'a'))
    expect(personNodeAriaLabel(graphWithChangedNumbers.nodes[1], 'me', 1, 1)).toBe(
      personNodeAriaLabel(graphWithNumbers.nodes[1], 'me', 1, 1)
    )
    expect(graphWithNumbers.nodes[0]).toEqual(
      expect.objectContaining({ trust_score: 91, karma: 37 })
    )
    expect(graphWithNumbers.links[0]).toEqual(
      expect.objectContaining({ raw_weight: 0.88, effective_weight: 0.55 })
    )
  })

  it('uses a finite minimum radius for degenerate dimensions and an empty graph', () => {
    const model = buildCommunityRingModel({ nodes: [], links: [] }, Number.NaN, Number.POSITIVE_INFINITY)

    expect(model).toEqual({ nodes: [], links: [], radius: 60 })
  })
})
