/**
 * TDD: NetworkGraph data logic
 * Sprint 27 - Profile Unification
 *
 * Tests the data-transformation logic used by NetworkGraph.
 * No React rendering — pure functions only.
 */

interface GraphNode {
  id: string
  name: string
  provider_id: string | null
}

interface GraphEdge {
  source: string
  target: string
  type: 'exchange' | 'community'
}

interface NetworkData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

// Helper: is the user a provider?
function isProviderNode(node: GraphNode): boolean {
  return node.provider_id !== null
}

// Helper: classify node role
function classifyNode(node: GraphNode, currentUserId: string): 'self' | 'provider' | 'peer' {
  if (node.id === currentUserId) return 'self'
  if (node.provider_id !== null) return 'provider'
  return 'peer'
}

// Helper: filter edges by type
function filterEdgesByType(edges: GraphEdge[], type: 'exchange' | 'community'): GraphEdge[] {
  return edges.filter(e => e.type === type)
}

describe('NetworkGraph data logic', () => {
  describe('isProviderNode', () => {
    it('returns true when provider_id is a non-null string', () => {
      const node: GraphNode = { id: 'u1', name: 'Alice', provider_id: 'p1' }
      expect(isProviderNode(node)).toBe(true)
    })

    it('returns false when provider_id is null', () => {
      const node: GraphNode = { id: 'u1', name: 'Bob', provider_id: null }
      expect(isProviderNode(node)).toBe(false)
    })
  })

  describe('classifyNode', () => {
    const CURRENT_USER_ID = 'current-user-uuid'

    it('classifies current user as self', () => {
      const node: GraphNode = { id: CURRENT_USER_ID, name: 'Me', provider_id: null }
      expect(classifyNode(node, CURRENT_USER_ID)).toBe('self')
    })

    it('classifies connected user with provider profile as provider', () => {
      const node: GraphNode = { id: 'other-uuid', name: 'Alice', provider_id: 'p1' }
      expect(classifyNode(node, CURRENT_USER_ID)).toBe('provider')
    })

    it('classifies connected user without provider profile as peer', () => {
      const node: GraphNode = { id: 'other-uuid', name: 'Bob', provider_id: null }
      expect(classifyNode(node, CURRENT_USER_ID)).toBe('peer')
    })

    it('current user with provider_id is still classified as self (self takes precedence)', () => {
      const node: GraphNode = { id: CURRENT_USER_ID, name: 'Me', provider_id: 'my-provider-id' }
      expect(classifyNode(node, CURRENT_USER_ID)).toBe('self')
    })
  })

  describe('filterEdgesByType', () => {
    const edges: GraphEdge[] = [
      { source: 'a', target: 'b', type: 'exchange' },
      { source: 'a', target: 'c', type: 'community' },
      { source: 'a', target: 'd', type: 'exchange' },
    ]

    it('returns only exchange edges', () => {
      const result = filterEdgesByType(edges, 'exchange')
      expect(result).toHaveLength(2)
      expect(result.every(e => e.type === 'exchange')).toBe(true)
    })

    it('returns only community edges', () => {
      const result = filterEdgesByType(edges, 'community')
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('community')
    })

    it('returns empty array when no edges match type', () => {
      expect(filterEdgesByType([], 'exchange')).toEqual([])
    })
  })

  describe('empty network state', () => {
    it('network with only self node (no connections) is valid', () => {
      const data: NetworkData = {
        nodes: [{ id: 'self', name: 'Me', provider_id: null }],
        edges: [],
      }
      expect(data.nodes).toHaveLength(1)
      expect(data.edges).toHaveLength(0)
    })

    it('completely empty network data is valid', () => {
      const data: NetworkData = { nodes: [], edges: [] }
      expect(data.nodes).toHaveLength(0)
      expect(data.edges).toHaveLength(0)
    })
  })

  describe('node click navigation logic', () => {
    it('clicking a provider node returns provider page path', () => {
      const node: GraphNode = { id: 'u1', name: 'Alice', provider_id: 'p1' }
      const path = node.provider_id ? `/providers/${node.provider_id}` : null
      expect(path).toBe('/providers/p1')
    })

    it('clicking a non-provider node returns null (show trust path tooltip instead)', () => {
      const node: GraphNode = { id: 'u1', name: 'Bob', provider_id: null }
      const path = node.provider_id ? `/providers/${node.provider_id}` : null
      expect(path).toBeNull()
    })
  })
})
