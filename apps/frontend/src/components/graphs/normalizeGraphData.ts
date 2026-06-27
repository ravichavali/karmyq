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

// Sprint 112 (ADR-082) — the safe person-graph API shape. Nodes carry identity + structure only;
// links carry a qualitative relationship_state. No node trust_score/karma; no raw/effective weights.
interface SafePersonGraphNode {
  user_id?: string
  id?: string
  name: string
  is_current_user?: boolean
  isCurrentUser?: boolean
  degrees_of_separation?: 0 | 1 | 2 | 3
}
interface SafePersonGraphLink {
  source: string | { id?: string; user_id?: string }
  target: string | { id?: string; user_id?: string }
  relationship_state?: 'strong' | 'warm' | 'fading' | 'nearly_forgotten'
  decayTier?: 'strong' | 'warm' | 'fading' | 'nearly_forgotten' | 'swept'
  type?: 'organic' | 'fission'
}

function endpointId(value: SafePersonGraphLink['source']): string {
  if (value && typeof value === 'object') return (value.id ?? value.user_id) as string
  return value as string
}

/**
 * Bridge the privacy-safe person-graph payload (`/trust/graph*`, `/trust/neighborhood`) into the
 * canonical client model. Maps `user_id`→`id`, `is_current_user`→`isCurrentUser`, and
 * `relationship_state`→`decayTier` (the renderer styles edges by decayTier). Node reputation is
 * absent by design — surfaces render identity + relationship structure, never node metrics.
 */
export function normalizePersonGraph(graph: {
  nodes: SafePersonGraphNode[]
  links: SafePersonGraphLink[]
  meta?: GraphData['meta']
}): GraphData {
  return {
    nodes: (graph.nodes ?? []).map(n => ({
      id: (n.user_id ?? n.id) as string,
      name: n.name,
      isCurrentUser: n.is_current_user ?? n.isCurrentUser ?? false,
      ...(n.degrees_of_separation != null ? { degrees_of_separation: n.degrees_of_separation } : {}),
    })),
    links: (graph.links ?? []).map(l => ({
      source: endpointId(l.source),
      target: endpointId(l.target),
      decayTier: l.relationship_state ?? l.decayTier,
      ...(l.type ? { type: l.type } : {}),
    })),
    ...(graph.meta ? { meta: graph.meta } : {}),
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
