import { buildCommunityRingModel } from '@/components/graphs/communityRingModel'
import type { GraphData } from '@/components/graphs/types'

/**
 * Sprint 115 (ADR-083) — structural truth without a score.
 *
 * The community ring must let the eye read redundant belonging (many routes), hub dependence (one
 * indispensable person), and fragmentation (isolated groups) from the TOPOLOGY ALONE. These fixtures
 * prove the renderer-fed model preserves exactly the disclosed edges for each shape and that the three
 * shapes are genuinely distinct — without computing or displaying any "community health" metric.
 */

const node = (id: string): { id: string; name: string } => ({ id, name: id.toUpperCase() })

// Redundant: a 5-cycle plus three chords — multiple routes between people, no single indispensable node.
const redundantGraph: GraphData = {
  nodes: ['a', 'b', 'c', 'd', 'e'].map(node),
  links: [
    { source: 'a', target: 'b', decayTier: 'strong' },
    { source: 'b', target: 'c', decayTier: 'strong' },
    { source: 'c', target: 'd', decayTier: 'strong' },
    { source: 'd', target: 'e', decayTier: 'strong' },
    { source: 'e', target: 'a', decayTier: 'strong' },
    { source: 'a', target: 'c', decayTier: 'warm' },
    { source: 'b', target: 'd', decayTier: 'warm' },
    { source: 'c', target: 'e', decayTier: 'warm' },
  ],
}

// Hub-dependent: a pure star — every tie runs through `hub`, the indispensable person.
const hubGraph: GraphData = {
  nodes: ['hub', 's1', 's2', 's3', 's4'].map(node),
  links: [
    { source: 'hub', target: 's1', decayTier: 'strong' },
    { source: 'hub', target: 's2', decayTier: 'strong' },
    { source: 'hub', target: 's3', decayTier: 'warm' },
    { source: 'hub', target: 's4', decayTier: 'fading' },
  ],
}

// Fragmented: three disjoint pairs — three separate components, no bridges between them.
const fragmentedGraph: GraphData = {
  nodes: ['a', 'b', 'c', 'd', 'e', 'f'].map(node),
  links: [
    { source: 'a', target: 'b', decayTier: 'strong' },
    { source: 'c', target: 'd', decayTier: 'warm' },
    { source: 'e', target: 'f', decayTier: 'fading' },
  ],
}

// Count connected components from endpoint adjacency (test-local; never a production health metric).
function componentCount(graph: GraphData): number {
  const adjacency = new Map<string, Set<string>>(graph.nodes.map(n => [n.id, new Set<string>()]))
  for (const link of graph.links) {
    if (!adjacency.has(link.source) || !adjacency.has(link.target)) continue
    adjacency.get(link.source)!.add(link.target)
    adjacency.get(link.target)!.add(link.source)
  }
  const seen = new Set<string>()
  let components = 0
  for (const start of adjacency.keys()) {
    if (seen.has(start)) continue
    components++
    const stack = [start]
    while (stack.length) {
      const id = stack.pop()!
      if (seen.has(id)) continue
      seen.add(id)
      for (const neighbor of adjacency.get(id) ?? []) stack.push(neighbor)
    }
  }
  return components
}

describe('Sprint 115 structural truth fixtures', () => {
  const redundant = buildCommunityRingModel(redundantGraph, 700, 560)
  const hubDependent = buildCommunityRingModel(hubGraph, 700, 560)
  const fragmented = buildCommunityRingModel(fragmentedGraph, 700, 560)

  it('preserves every disclosed edge of the redundant shape (multiple routes)', () => {
    expect(redundant.links).toHaveLength(8)
  })

  it('routes every tie of the hub shape through the indispensable person', () => {
    expect(
      hubDependent.links.every(edge => [edge.link.source, edge.link.target].includes('hub'))
    ).toBe(true)
  })

  it('reads three separate components from the fragmented shape', () => {
    expect(componentCount(fragmentedGraph)).toBe(3)
  })

  it('keeps the three structural shapes genuinely distinct', () => {
    const signature = (links: { key: string }[]) => links.map(l => l.key).sort().join('|')
    expect(
      new Set([signature(redundant.links), signature(hubDependent.links), signature(fragmented.links)]).size
    ).toBe(3)
  })
})
