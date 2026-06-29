import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import BelongingGraph from './BelongingGraph'
import BelongingPulse from './BelongingPulse'
import { communityService, socialGraphService } from '../lib/api'
import { mergeGraphData, normalizePersonGraph } from './graphs/normalizeGraphData'
import type { GraphData } from './graphs/types'

interface BelongingSectionProps {
  userId: string
}

interface ProfileExpansion {
  nodeId: string
  data: GraphData
}

/**
 * Sprint 111 / ADR-081 — the profile's headline belonging section ("How you're woven into Karmyq").
 * Raised altitude over the old reused dashboard widget: a larger ego graph (480 vs 360), an honest
 * connection/community pulse, and a link into the full explorer. The pulse reuses the SAME ego graph
 * response via onDataLoaded (no duplicate graph fetch) plus the existing membership read.
 *
 * Sprint 115 / ADR-083 — the profile owns ONE replaceable click-to-expand: clicking a person fetches
 * their depth-1 neighborhood and replaces any open branch. The baseline (the seed ego graph) is set
 * once from the wrapper's first load, so an expansion only ever adds non-baseline nodes near their
 * root and never shifts the stable orbit layout.
 */
export default function BelongingSection({ userId }: BelongingSectionProps) {
  const [baseline, setBaseline] = useState<GraphData | null>(null)
  const [expansion, setExpansion] = useState<ProfileExpansion | null>(null)
  const [expandingNodeId, setExpandingNodeId] = useState<string | null>(null)
  const [expandError, setExpandError] = useState<{ nodeId: string; message: string } | null>(null)
  const [communityCount, setCommunityCount] = useState<number | null>(null)
  const [membershipFailed, setMembershipFailed] = useState(false)
  // The node whose expansion the user most recently asked for. Used to discard out-of-order responses
  // so the single replaceable expansion always reflects the LAST click, not whichever fetch resolves
  // last (mirrors the modeRef stale-response guard in the /network explorer).
  const pendingExpandRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    communityService
      .getMyCommunities(userId)
      .then((res: any) => {
        // getMyCommunities returns `{ communities: [...], count, total }` (an object), not a bare
        // array — `(res.data ?? []).length` read `.length` off the object (undefined). Extract the
        // array the same way the /network explorer does. (Same shape bug as the /network crash.)
        if (cancelled) return
        const list = res.data?.communities ?? res.data?.data ?? res.data
        setCommunityCount(Array.isArray(list) ? list.length : 0)
      })
      .catch(() => {
        if (!cancelled) setMembershipFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  // First load only: the seed ego graph becomes the authoritative baseline. Later merged graphs flow
  // back through onDataLoaded but must not overwrite the seed.
  const onDataLoaded = useCallback((data: GraphData) => setBaseline(current => current ?? data), [])

  const mergedGraph = useMemo(
    () => (baseline && expansion ? mergeGraphData(baseline, expansion.data) : baseline),
    [baseline, expansion]
  )
  const baselineNodeIds = useMemo(() => baseline?.nodes.map(node => node.id), [baseline])
  const expansionRootIds = useMemo(() => (expansion ? [expansion.nodeId] : []), [expansion])

  const expandNode = useCallback(
    (nodeId: string) => {
      if (nodeId === userId) return
      // Clicking the currently open root collapses it.
      if (expansion?.nodeId === nodeId) {
        pendingExpandRef.current = null
        setExpansion(null)
        setExpandError(null)
        return
      }
      pendingExpandRef.current = nodeId
      setExpandingNodeId(nodeId)
      setExpandError(null)
      // Do not clear the current expansion before the request — a failure must leave it visible. Drop a
      // response whose node is no longer the pending one (a newer click superseded it).
      socialGraphService
        .getNeighborhood(nodeId, { depth: 1 })
        .then((res: any) => {
          if (pendingExpandRef.current !== nodeId) return
          setExpansion({ nodeId, data: normalizePersonGraph(res.data) })
        })
        .catch(() => {
          if (pendingExpandRef.current !== nodeId) return
          setExpandError({ nodeId, message: 'Couldn’t expand that connection.' })
        })
        .finally(() => {
          if (pendingExpandRef.current === nodeId) setExpandingNodeId(null)
        })
    },
    [userId, expansion]
  )

  const peopleCount = baseline ? baseline.nodes.filter(n => n.id !== userId).length : 0

  return (
    <section className="kq-card space-y-4">
      <div>
        <h2 className="section-heading mb-1">How you&apos;re woven into Karmyq</h2>
        <BelongingPulse
          peopleCount={peopleCount}
          communityCount={membershipFailed ? undefined : communityCount ?? undefined}
        />
      </div>

      <BelongingGraph
        mode="ego"
        currentUserId={userId}
        height={480}
        load="immediate"
        graphData={mergedGraph ?? undefined}
        onDataLoaded={onDataLoaded}
        baselineNodeIds={baselineNodeIds}
        expansionRootIds={expansionRootIds}
        onNodeActivate={expandNode}
      />

      {expandingNodeId && !expandError && (
        <p className="text-sm text-text-muted">Expanding…</p>
      )}

      {expandError && (
        <div className="flex items-center gap-3 text-sm text-rose-400">
          <span>{expandError.message}</span>
          <button onClick={() => expandNode(expandError.nodeId)} className="underline">
            Retry
          </button>
          <button onClick={() => setExpandError(null)} className="underline">
            Dismiss
          </button>
        </div>
      )}

      <Link href="/network?mode=ego" className="inline-block text-sm text-primary hover:underline">
        Explore your full network →
      </Link>
    </section>
  )
}
