// Sprint 111 / ADR-081 — the canonical client graph model. Every belonging-graph surface (dashboard,
// profile, community, fission, and the full-page /network explorer) renders these types through the
// single TrustGraphHEB engine via <BelongingGraph>. Before S111 four wrappers each declared their own
// near-identical TrustNode/TrustLink shapes; this file collapses them to one.

export type BelongingMode = 'ego' | 'community' | 'communities' | 'fission'

export interface TrustNode {
  id: string
  name: string
  // Sprint 112 (ADR-082): person graphs no longer disclose node-level reputation. These remain only
  // for the inter-community depth graph (which sets them to 0) and are optional/absent on person
  // graphs; surfaces show identity + relationship structure, never node reputation numbers.
  trust_score?: number
  karma?: number
  isCurrentUser?: boolean
  isIsolated?: boolean
  // S111 additions (optional; populated only where the backend supplies them).
  degrees_of_separation?: 0 | 1 | 2 | 3 // shortest BFS depth from the requested center (ego explorer)
  member_count?: number // communities mode (from DepthNode)
  is_member?: boolean // communities mode (from DepthNode)
  status?: string // community status in communities mode
}

export interface TrustLink {
  source: string
  target: string
  // Sprint 112 (ADR-082): person graph links carry only a qualitative relationship state (mapped to
  // decayTier below). Raw/effective edge weights stay internal; they remain here only for the
  // inter-community depth graph and are optional/absent on person graphs.
  raw_weight?: number
  effective_weight?: number
  decayTier?: 'strong' | 'warm' | 'fading' | 'nearly_forgotten' | 'swept' // Sprint 90 / ADR-070
  formedRecently?: boolean // Sprint 118 / ADR-085 — pair's first formation within the server's 30-day window
  type?: 'organic' | 'fission' // communities mode (from DepthLink)
}

export interface GraphData {
  nodes: TrustNode[]
  links: TrustLink[]
  meta?: {
    depth?: 1 | 2 | 3
    truncated?: boolean
    totalActiveMembers?: number
  }
}
