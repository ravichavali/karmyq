import type { GraphData, TrustLink, TrustNode } from './types'

// Sprint 111 / ADR-081 — pure helpers that bridge the inter-community "depth graph" backend shape
// into the canonical client model, and deterministically merge explorer expansions. Kept free of
// React/D3 so they are trivially testable and so TrustGraphHEB only ever sees canonical types.

export interface DepthNode {
  id: string
  name: string
  member_count: number
  status: string
  is_member: boolean
}

export interface DepthLink {
  source: string
  target: string
  weight: number
  type: 'organic' | 'fission'
}

/**
 * Convert the `getCommunityGraph()` (inter-community depth) payload to canonical GraphData.
 * Communities-as-nodes carry no person trust/karma, so those read 0; member_count/status/is_member
 * survive for the detail panel and emerald member ring. `weight` becomes both raw and effective
 * (the depth graph is not decay-adjusted), and the organic/fission `type` is preserved.
 */
export function normalizeCommunityDepthGraph(graph: {
  nodes: DepthNode[]
  links: DepthLink[]
}): GraphData {
  return {
    nodes: graph.nodes.map(n => ({
      id: n.id,
      name: n.name,
      trust_score: 0,
      karma: 0,
      member_count: n.member_count,
      status: n.status,
      is_member: n.is_member,
    })),
    links: graph.links.map(l => ({
      source: l.source,
      target: l.target,
      raw_weight: l.weight,
      effective_weight: l.weight,
      type: l.type,
    })),
  }
}

/** Stable de-dup key: undirected endpoint pair + semantic link type (parallel organic/fission kept). */
export function linkKey(link: TrustLink): string {
  return `${[link.source, link.target].sort().join('::')}::${link.type ?? 'trust'}`
}

/**
 * Merge a baseline graph with ordered ego-expansion graphs. Nodes de-dup by id keeping the SHORTEST
 * `degrees_of_separation` (so an expansion can pull a node closer but never push it farther); links
 * de-dup by {@link linkKey}. Inputs are never mutated — the explorer recomputes the merged graph from
 * baseline + remaining expansions whenever an expansion is collapsed.
 */
export function mergeGraphData(...graphs: GraphData[]): GraphData {
  const nodeMap = new Map<string, TrustNode>()
  for (const graph of graphs) {
    for (const node of graph.nodes) {
      const existing = nodeMap.get(node.id)
      if (!existing) {
        nodeMap.set(node.id, { ...node })
        continue
      }
      const a = existing.degrees_of_separation
      const b = node.degrees_of_separation
      const degrees = a == null ? b : b == null ? a : (Math.min(a, b) as 0 | 1 | 2 | 3)
      // First-seen wins on identity: the baseline is passed first and is authoritative, so an
      // expansion only ADDS new neighbors and pulls shared nodes closer (min depth) — it never
      // relabels a node already present in the baseline.
      nodeMap.set(node.id, { ...node, ...existing, degrees_of_separation: degrees })
    }
  }

  const linkMap = new Map<string, TrustLink>()
  for (const graph of graphs) {
    for (const link of graph.links) {
      const key = linkKey(link)
      if (!linkMap.has(key)) linkMap.set(key, { ...link })
    }
  }

  return { nodes: [...nodeMap.values()], links: [...linkMap.values()] }
}
