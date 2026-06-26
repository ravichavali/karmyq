import {
  buildAdjacency,
  describeNodeDetail,
  layoutForMode,
  toCanvasGraphData,
} from '@/components/graphs/graphCanvasModel'
import type { GraphData } from '@/components/graphs/types'

const graph: GraphData = {
  nodes: [
    { id: 'me', name: 'Maria', isCurrentUser: true, degrees_of_separation: 0 },
    { id: 'p1', name: 'Aisha', degrees_of_separation: 1, trust_score: 99, karma: 88 },
    { id: 'p2', name: 'Lee', degrees_of_separation: 2 },
  ],
  links: [
    { source: 'me', target: 'p1', decayTier: 'strong' },
    { source: 'p1', target: 'p2', decayTier: 'fading' },
  ],
}

describe('graphCanvasModel', () => {
  it('maps belonging modes to Phase 1 layouts', () => {
    expect(layoutForMode('ego')).toBe('egocentric')
    expect(layoutForMode('community')).toBe('member-topology')
    expect(layoutForMode('fission')).toBe('member-topology')
    expect(layoutForMode('communities')).toBe('network-web')
  })

  it('clones graph data and pins the ego focus without mutating props', () => {
    const before = JSON.parse(JSON.stringify(graph))
    const canvas = toCanvasGraphData(graph, {
      mode: 'ego',
      currentUserId: 'me',
      layout: 'egocentric',
      width: 640,
      height: 480,
    })
    expect(canvas).not.toBe(graph)
    expect(canvas.nodes[0]).not.toBe(graph.nodes[0])
    expect(canvas.nodes.find(n => n.id === 'me')).toEqual(expect.objectContaining({ fx: 0, fy: 0 }))
    expect(graph).toEqual(before)
  })

  it('builds symmetric adjacency for hover/focus highlighting', () => {
    const adjacency = buildAdjacency(graph)
    expect([...adjacency.get('p1')!].sort()).toEqual(['me', 'p1', 'p2'])
  })

  it('describes node detail with structure only, never reputation numbers', () => {
    const rows = describeNodeDetail(graph.nodes[1], graph, 'me', 'ego')
    expect(rows).toEqual([
      { label: 'Degrees away', value: '1' },
      { label: 'Connections', value: '2' },
    ])
    expect(JSON.stringify(rows)).not.toMatch(/99|88|trust|karma/i)
  })
})
