import React, { useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { socialGraphService } from '../lib/api'
import { useLazyGraphData } from '../hooks/useLazyGraphData'
import { normalizeCommunityDepthGraph, normalizePersonGraph, type DepthLink, type DepthNode } from './graphs/normalizeGraphData'
import type { BelongingMode, GraphData } from './graphs/types'

// TrustGraphHEB uses D3 and must be client-only. The wrapper is the ONLY place that knows how each
// mode fetches/normalizes; the renderer only ever receives canonical GraphData.
const TrustGraphHEB = dynamic(() => import('./graphs/TrustGraphHEB'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-slate-400 text-sm">Loading graph…</div>
  ),
})

const EMPTY_GRAPH: GraphData = { nodes: [], links: [] }

export interface BelongingGraphProps {
  mode: BelongingMode
  currentUserId: string
  communityId?: string
  /** Fission and the /network explorer supply already-loaded data; the wrapper then never fetches. */
  graphData?: GraphData
  load?: 'lazy' | 'immediate'
  onDataLoaded?: (data: GraphData) => void
  groupMap?: Record<string, 'group_a' | 'group_b'>
  groupALabel?: string
  groupBLabel?: string
  onSwitchGroup?: (nodeId: string, currentGroup: 'group_a' | 'group_b' | null) => Promise<void>
  height?: number
  focusedNodeId?: string
  onNodeActivate?: (nodeId: string) => void
  enableZoom?: boolean
}

/**
 * Sprint 111 / ADR-081 — the single belonging-graph wrapper. Dispatches per-mode fetching to
 * socialGraphService (NOT socialGraphClient, which is paths/invitations only), normalizes the
 * inter-community depth payload, and renders everything through one TrustGraphHEB. Replaces the
 * retired NetworkGraph / TrustGraph / CommunityDepthGraph wrappers.
 */
export default function BelongingGraph({
  mode,
  currentUserId,
  communityId,
  graphData,
  load = 'lazy',
  onDataLoaded,
  groupMap,
  groupALabel,
  groupBLabel,
  onSwitchGroup,
  height = 400,
  focusedNodeId,
  onNodeActivate,
  enableZoom,
}: BelongingGraphProps) {
  const hasSuppliedData = graphData !== undefined
  // community mode with no selected community is a finite, non-error state.
  const missingCommunity = mode === 'community' && !communityId

  const fetcher = useCallback(async (): Promise<GraphData> => {
    if (hasSuppliedData) return graphData as GraphData
    if (mode === 'ego') {
      // Community-scoped ego (the community page's "My Network" sub-tab passes communityId) vs the
      // cross-community aggregate (dashboard / profile, no communityId). Sprint 112 (ADR-082): the
      // safe person-graph shape is normalized to the canonical client model here.
      if (communityId) return normalizePersonGraph((await socialGraphService.getTrustGraph(communityId)).data)
      return normalizePersonGraph((await socialGraphService.getTrustGraphAggregate()).data)
    }
    if (mode === 'community') {
      if (!communityId) return EMPTY_GRAPH
      return normalizePersonGraph((await socialGraphService.getFullCommunityGraph(communityId)).data)
    }
    if (mode === 'communities') {
      const res = await socialGraphService.getCommunityGraph()
      return normalizeCommunityDepthGraph(res.data as { nodes: DepthNode[]; links: DepthLink[] })
    }
    // fission always supplies graphData; reach here only if a caller forgot to.
    return EMPTY_GRAPH
  }, [hasSuppliedData, graphData, mode, communityId])

  // Supplied data and immediate mode both skip lazy first-load (no IntersectionObserver).
  const { containerRef, observed, data, loading, error } = useLazyGraphData<GraphData>(fetcher, {
    immediate: load === 'immediate' || hasSuppliedData,
  })

  const effectiveData = hasSuppliedData ? (graphData as GraphData) : data

  useEffect(() => {
    if (effectiveData && onDataLoaded) onDataLoaded(effectiveData)
  }, [effectiveData, onDataLoaded])

  return (
    <div ref={containerRef} style={{ width: '100%', height }} className="relative">
      {missingCommunity ? (
        <div className="flex items-center justify-center h-full text-slate-400 text-sm text-center px-6">
          Choose a community to see its trust graph.
        </div>
      ) : !hasSuppliedData && (!observed || loading) ? (
        <div className="flex items-center justify-center h-full text-slate-400 text-sm">
          {observed ? 'Loading graph…' : 'Scroll to load graph…'}
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-full text-rose-400 text-sm">
          Couldn&apos;t load this graph.
        </div>
      ) : effectiveData ? (
        <TrustGraphHEB
          graphData={effectiveData}
          currentUserId={currentUserId}
          mode={mode}
          groupMap={groupMap}
          groupALabel={groupALabel}
          groupBLabel={groupBLabel}
          onSwitchGroup={onSwitchGroup}
          height={height}
          focusedNodeId={focusedNodeId}
          onNodeActivate={onNodeActivate}
          enableZoom={enableZoom}
        />
      ) : null}
    </div>
  )
}
