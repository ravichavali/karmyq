import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import { socialGraphService } from '@/lib/api'

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

interface NetworkGraphProps {
  currentUserId: string
}

export default function NetworkGraph({ currentUserId }: NetworkGraphProps) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const [networkData, setNetworkData] = useState<NetworkData | null>(null)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [ForceGraph, setForceGraph] = useState<any>(null)

  const fetchNetwork = useCallback(async () => {
    if (loaded) return
    setLoading(true)
    try {
      const resp = await socialGraphService.getNetwork()
      setNetworkData(resp.data)
      // Dynamically import to avoid SSR issues
      const { default: FG } = await import('react-force-graph-2d')
      setForceGraph(() => FG)
    } catch {
      setNetworkData({ nodes: [], edges: [] })
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }, [loaded])

  // Lazy-load: only fetch when scrolled into view
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNetwork()
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [fetchNetwork])

  const graphData = networkData
    ? {
        nodes: networkData.nodes.map(n => ({ ...n, label: n.name })),
        links: networkData.edges.map(e => ({ ...e })),
      }
    : { nodes: [], links: [] }

  return (
    <div ref={containerRef} className="bg-surface-raised rounded-xl border border-border p-4 mb-6">
      <h2 className="text-base font-semibold text-text mb-3">Your Network</h2>

      {loading && (
        <div className="flex items-center justify-center py-12 text-text-muted text-sm">
          Loading network…
        </div>
      )}

      {!loading && loaded && networkData && networkData.edges.length === 0 && (
        <div className="text-center py-8 text-text-muted text-sm">
          No connections yet — complete a help exchange to build your network.
        </div>
      )}

      {!loading && loaded && ForceGraph && networkData && networkData.edges.length > 0 && (
        <ForceGraph
          graphData={graphData}
          width={600}
          height={400}
          nodeLabel="name"
          nodeColor={(node: any) => {
            if (node.id === currentUserId) return '#10b981'   // center: green
            if (node.provider_id) return '#6366f1'            // provider: indigo
            return '#94a3b8'                                   // peer: slate
          }}
          linkColor={(link: any) =>
            link.type === 'exchange' ? '#10b981' : '#6366f1'
          }
          onNodeClick={(node: any) => {
            if (node.provider_id) {
              router.push(`/providers/${node.provider_id}`)
            }
          }}
        />
      )}
    </div>
  )
}
