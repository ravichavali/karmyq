import { useEffect, useRef, useState, useCallback } from 'react'
import { socialGraphService } from '@/lib/api'

interface TrustNode {
  id: string
  name: string
  trust_score: number
  karma: number
  isCurrentUser: boolean
}

interface TrustLink {
  source: string
  target: string
  effective_weight: number
}

interface NetworkGraphProps {
  currentUserId: string
}

export default function NetworkGraph({ currentUserId }: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [nodes, setNodes] = useState<TrustNode[]>([])
  const [links, setLinks] = useState<TrustLink[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [ForceGraph, setForceGraph] = useState<any>(null)

  const fetchNetwork = useCallback(async () => {
    if (loaded) return
    setLoading(true)
    try {
      const resp = await socialGraphService.getTrustGraphAggregate()
      setNodes(resp.data?.nodes ?? [])
      setLinks(resp.data?.links ?? [])
      const { default: FG } = await import('react-force-graph-2d')
      setForceGraph(() => FG)
    } catch {
      setNodes([])
      setLinks([])
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }, [loaded])

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

  const graphData = {
    nodes: nodes.map(n => ({ ...n, label: n.name })),
    links: links.map(l => ({ ...l })),
  }

  return (
    <div ref={containerRef} className="bg-surface-raised rounded-xl border border-border p-4 mb-6">
      <h2 className="text-base font-semibold text-text mb-3">Your Network</h2>

      {loading && (
        <div className="flex items-center justify-center py-12 text-text-muted text-sm">
          Loading network…
        </div>
      )}

      {!loading && loaded && links.length === 0 && (
        <div className="text-center py-8 text-text-muted text-sm">
          No trust connections yet — complete a help exchange to build your network.
        </div>
      )}

      {!loading && loaded && ForceGraph && links.length > 0 && (
        <ForceGraph
          graphData={graphData}
          width={600}
          height={400}
          nodeLabel="name"
          nodeVal={(node: any) => Math.max(4, node.trust_score / 10)}
          nodeColor={(node: any) => {
            if (node.isCurrentUser || node.id === currentUserId) return '#10b981'
            return '#6366f1'
          }}
          linkWidth={(link: any) => Math.max(1, link.effective_weight / 5)}
          linkColor={() => 'rgba(99,102,241,0.4)'}
          backgroundColor="transparent"
        />
      )}
    </div>
  )
}
