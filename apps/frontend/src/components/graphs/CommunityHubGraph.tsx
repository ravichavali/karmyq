import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { GraphData, TrustLink, TrustNode } from './types'
import { linkKey } from './normalizeGraphData'
import { hubBridgeVisual } from './graphVisualEncoding'
import GraphZoomControls from './GraphZoomControls'
import { clearGraphZoom, installGraphZoom, zoomBy, zoomReset } from './graphZoom'
import { useGraphContainerWidth } from '../../hooks/useGraphContainerWidth'

/**
 * Sprint 113 PR B / Task 9 — Scale 3 of the belonging fractal ("Across Communities"): communities-as-
 * nodes. Replaces the hierarchical-edge-bundling radial (pretty but busy) with an *egocentric hub*
 * (user decision 2026-06-25): your communities are anchored together in the centre; connected
 * communities radiate outward on a ring, ALWAYS labelled. Node size = membership; edge style =
 * organic trust vs fission lineage. Legibility over prettiness.
 *
 * Deterministic placement (no force tick loop) so it renders identically in jsdom and in the browser.
 * Zoom mirrors the single-owner pattern from TrustGraphHEB (BUG-027): one control cluster per surface,
 * gestures and buttons drive the same d3.zoom, the wheel is excluded so embedded graphs don't hijack
 * page scroll, and the initial transform is seeded on `__zoom` directly (jsdom can't do
 * zoom.transform's width.baseVal path).
 */

const MIN_NODE_R = 7
const MAX_NODE_R = 22
const TRANSITION_MS = 400

interface CommunityHubGraphProps {
  graphData: GraphData
  height?: number
  enableZoom?: boolean
  /** Pinned highlight (the explorer search focuses a community by id); also driven by hover/keyboard focus. */
  focusedNodeId?: string
  onNodeActivate?: (nodeId: string) => void
}

const FADE_OPACITY = 0.15

interface Placed {
  node: TrustNode
  x: number
  y: number
  r: number
}

export default function CommunityHubGraph({
  graphData,
  height = 560,
  enableZoom = false,
  focusedNodeId,
  onNodeActivate,
}: CommunityHubGraphProps) {
  const { containerRef, width } = useGraphContainerWidth()
  const svgRef = useRef<SVGSVGElement>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const initialTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity)

  // ── deterministic egocentric-hub placement (positions are around the origin; the root <g> is then
  //    translated to the centre, matching the zoom seed) ────────────────────────────────────────────
  const placed = useMemo<Map<string, Placed>>(() => {
    const nodes = graphData.nodes
    const maxMembers = Math.max(...nodes.map(n => n.member_count ?? 0), 1)
    const rOf = (n: TrustNode) => MIN_NODE_R + (MAX_NODE_R - MIN_NODE_R) * Math.sqrt((n.member_count ?? 0) / maxMembers)

    const outerR = Math.max(120, Math.min(width, height) / 2 - 80)
    const innerR = Math.min(64, outerR / 3)

    const mine = nodes.filter(n => n.is_member)
    const others = nodes.filter(n => !n.is_member)
    const map = new Map<string, Placed>()

    // Your communities anchor the centre: a single one sits dead-centre; several form a tight inner ring.
    if (mine.length === 1) {
      map.set(mine[0].id, { node: mine[0], x: 0, y: 0, r: rOf(mine[0]) })
    } else {
      mine.forEach((n, i) => {
        const a = (i / Math.max(mine.length, 1)) * 2 * Math.PI - Math.PI / 2
        map.set(n.id, { node: n, x: Math.cos(a) * innerR, y: Math.sin(a) * innerR, r: rOf(n) })
      })
    }

    // Connected communities radiate outward on a ring, evenly spread, each labelled. If there are no
    // member communities at all, everything sits on the ring (still an honest "how they connect" view).
    const ringNodes = mine.length === 0 ? nodes : others
    ringNodes.forEach((n, i) => {
      const a = (i / Math.max(ringNodes.length, 1)) * 2 * Math.PI - Math.PI / 2
      map.set(n.id, { node: n, x: Math.cos(a) * outerR, y: Math.sin(a) * outerR, r: rOf(n) })
    })

    return map
  }, [graphData.nodes, width, height])

  useEffect(() => {
    if (!svgRef.current || graphData.nodes.length === 0) return
    const svg = d3.select(svgRef.current)

    let root = svg.select<SVGGElement>('g.hub-root')
    if (root.empty()) {
      root = svg.append('g').attr('class', 'hub-root')
      root.append('g').attr('class', 'edges').attr('fill', 'none')
      root.append('g').attr('class', 'nodes')
    }
    const edgesG = root.select<SVGGElement>('g.edges')
    const nodesG = root.select<SVGGElement>('g.nodes')

    const cx = width / 2
    const cy = height / 2

    // ── edges: straight lines between community centres, organic vs fission lineage ─────────────────
    const edgeData = graphData.links
      .map(l => {
        const a = placed.get(l.source)
        const b = placed.get(l.target)
        return a && b ? { link: l, a, b } : null
      })
      .filter((x): x is { link: TrustLink; a: Placed; b: Placed } => x !== null)

    // Sprint 119 / ADR-086 — bridge encoding comes from the shared single source of truth:
    // member↔member organic bridges emphasized, alive ones in the S118 green family, periphery and
    // dormant quieted, fission lineage untouched.
    const isMember = (id: string) => placed.get(id)?.node.is_member === true
    const visuals = new Map(edgeData.map(({ link }) => [link, hubBridgeVisual(link, isMember)]))
    const visualOf = (link: TrustLink) => visuals.get(link)!

    const edgeSel = edgesG.selectAll<SVGLineElement, { link: TrustLink; a: Placed; b: Placed }>('line.hub-edge')
      // linkKey distinguishes parallel organic/fission edges between the same community pair.
      .data(edgeData, (d: any) => linkKey(d.link))
    edgeSel.exit().remove()
    const edgeMerge = edgeSel.enter()
      .append('line')
      .attr('class', 'hub-edge')
      .attr('role', 'img')
      .merge(edgeSel as any)
    edgeMerge
      .attr('stroke', d => visualOf(d.link).stroke)
      .attr('stroke-width', d => visualOf(d.link).width)
      .attr('stroke-opacity', d => visualOf(d.link).opacity)
      .attr('stroke-dasharray', d => visualOf(d.link).dasharray)
      .attr('aria-label', d => `${visualOf(d.link).label} between ${d.a.node.name} and ${d.b.node.name}`)
    edgeMerge.transition().duration(TRANSITION_MS)
      .attr('x1', d => d.a.x).attr('y1', d => d.a.y)
      .attr('x2', d => d.b.x).attr('y2', d => d.b.y)

    // ── nodes: a circle sized by membership + an always-on label ─────────────────────────────────────
    const activate = (id: string) => {
      if (onNodeActivate) onNodeActivate(id)
      else setSelectedNodeId(prev => (prev === id ? null : id))
    }

    const nodeData = graphData.nodes
      .map(n => placed.get(n.id))
      .filter((p): p is Placed => p !== undefined)

    const nodeSel = nodesG.selectAll<SVGGElement, Placed>('g.hub-node')
      .data(nodeData, (d: any) => d.node.id)
    nodeSel.exit().remove()
    const nodeEnter = nodeSel.enter()
      .append('g')
      .attr('class', 'hub-node')
      .attr('data-node-id', (d: any) => d.node.id)
      .attr('role', 'button')
      .attr('tabindex', '0')
      .style('cursor', 'pointer')
    nodeEnter.append('circle').attr('class', 'hub-dot')
    nodeEnter.append('title')
    nodeEnter.append('text')
      .attr('class', 'hub-label')
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('font-weight', 600)
      .style('pointer-events', 'none')

    const nodeMerge = nodeEnter.merge(nodeSel as any)
    nodeMerge.attr('aria-label', (d: any) => d.node.name)
    nodeMerge.select('title').text((d: any) => `${d.node.name} · ${d.node.member_count ?? 0} members`)
    nodeMerge.select('circle.hub-dot')
      .attr('r', (d: any) => d.r)
      // Your communities read emerald; connected communities indigo (matches the legend).
      .attr('fill', (d: any) => (d.node.is_member ? '#10b981' : '#818cf8'))
      .attr('stroke', (d: any) => (d.node.is_member ? '#fff' : 'none'))
      .attr('stroke-width', (d: any) => (d.node.is_member ? 2 : 0))
    nodeMerge.select('text.hub-label')
      .attr('y', (d: any) => d.r + 13)
      .attr('fill', '#cbd5e1')
      .text((d: any) => d.node.name)
    nodeMerge.transition().duration(TRANSITION_MS).attr('transform', (d: any) => `translate(${d.x},${d.y})`)

    // ── hover / focus highlight: dim communities not adjacent to the focused one (and the explorer's
    //    search focuses one by id via focusedNodeId) ───────────────────────────────────────────────────
    const adjacency = new Map<string, Set<string>>()
    graphData.nodes.forEach(n => adjacency.set(n.id, new Set([n.id])))
    graphData.links.forEach(l => {
      adjacency.get(l.source)?.add(l.target)
      adjacency.get(l.target)?.add(l.source)
    })
    const applyHighlight = (focusId: string | null) => {
      if (!focusId) {
        nodeMerge.attr('opacity', 1)
        edgeMerge.attr('stroke-opacity', d => visualOf(d.link).opacity)
        return
      }
      const related = adjacency.get(focusId) ?? new Set([focusId])
      nodeMerge.attr('opacity', (d: any) => (related.has(d.node.id) ? 1 : FADE_OPACITY))
      edgeMerge.attr('stroke-opacity', d =>
        d.link.source === focusId || d.link.target === focusId
          ? visualOf(d.link).opacity
          : FADE_OPACITY
      )
    }

    nodeMerge
      .on('click', (_e: any, d: any) => activate(d.node.id))
      .on('keydown', (e: any, d: any) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          activate(d.node.id)
        }
      })
      .on('mouseenter', (_e: any, d: any) => applyHighlight(d.node.id))
      .on('mouseleave', () => applyHighlight(focusedNodeId ?? null))
      .on('focus', (_e: any, d: any) => applyHighlight(d.node.id))
      .on('blur', () => applyHighlight(focusedNodeId ?? null))

    // Initial highlight: a pinned search focus, else fully visible.
    applyHighlight(focusedNodeId ?? null)

    // ── pan/zoom (single owner; shared contract with TrustGraphHEB) ──────────────────────────────────
    if (enableZoom) {
      const { behavior, initialTransform } = installGraphZoom(svgRef.current, root, { width, height, cx, cy })
      zoomBehaviorRef.current = behavior
      initialTransformRef.current = initialTransform
    } else {
      clearGraphZoom(svgRef.current, root, cx, cy)
      zoomBehaviorRef.current = null
    }
  }, [graphData, placed, width, height, enableZoom, focusedNodeId, onNodeActivate])

  useEffect(() => {
    const node = svgRef.current
    return () => {
      if (node) d3.select(node).on('.zoom', null)
    }
  }, [])

  const handleZoomBy = (factor: number) => {
    if (svgRef.current && zoomBehaviorRef.current) zoomBy(svgRef.current, zoomBehaviorRef.current, factor)
  }
  const handleZoomReset = () => {
    if (svgRef.current && zoomBehaviorRef.current) zoomReset(svgRef.current, zoomBehaviorRef.current, initialTransformRef.current)
  }

  const selectedNode = selectedNodeId ? graphData.nodes.find(n => n.id === selectedNodeId) : null

  if (graphData.nodes.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
        <p className="text-text-muted text-sm">Join more communities to see how they connect.</p>
        <p className="text-text-muted text-xs">Communities link through shared trust and fission lineage.</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      {enableZoom && graphData.nodes.length > 0 && (
        <GraphZoomControls
          onZoomIn={() => handleZoomBy(1.2)}
          onZoomOut={() => handleZoomBy(1 / 1.2)}
          onReset={handleZoomReset}
        />
      )}
      <svg ref={svgRef} width={width} height={height} style={{ maxWidth: '100%' }} />

      <div className="flex flex-wrap gap-4 text-xs text-text-muted mt-2 px-1">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" /> Your community
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-400" /> Connected community
        </span>
        <span className="flex items-center gap-1 text-violet-400">— fission lineage</span>
        <span className="flex items-center gap-1 text-green-400">Woven bridge — recent exchange</span>
        <span className="flex items-center gap-1 text-slate-500">Dormant bridge</span>
        <span className="text-text-muted">○ size = membership</span>
      </div>

      {selectedNode && (
        <div className="mt-3 p-4 bg-surface rounded-lg border border-border text-sm">
          <div className="font-semibold text-text mb-2">{selectedNode.name}</div>
          <div className="grid grid-cols-2 gap-2 text-text-muted">
            <span>Members</span>
            <span className="text-text">{selectedNode.member_count ?? 0}</span>
            <span>Status</span>
            <span className="text-text">{selectedNode.status ?? 'unknown'}</span>
            {selectedNode.is_member && (
              <span className="col-span-2 text-emerald-500">You&apos;re a member</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
