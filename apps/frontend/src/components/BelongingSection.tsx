import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import BelongingGraph from './BelongingGraph'
import BelongingPulse from './BelongingPulse'
import { communityService } from '../lib/api'
import type { GraphData } from './graphs/types'

interface BelongingSectionProps {
  userId: string
}

/**
 * Sprint 111 / ADR-081 — the profile's headline belonging section ("How you're woven into Karmyq").
 * Raised altitude over the old reused dashboard widget: a larger ego graph (480 vs 360), an honest
 * connection/community pulse, and a link into the full explorer. The pulse reuses the SAME ego graph
 * response via onDataLoaded (no duplicate graph fetch) plus the existing membership read.
 */
export default function BelongingSection({ userId }: BelongingSectionProps) {
  const [graph, setGraph] = useState<GraphData | null>(null)
  const [communityCount, setCommunityCount] = useState<number | null>(null)
  const [membershipFailed, setMembershipFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    communityService
      .getMyCommunities(userId)
      .then((res: any) => {
        if (!cancelled) setCommunityCount((res.data ?? []).length)
      })
      .catch(() => {
        if (!cancelled) setMembershipFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const onDataLoaded = useCallback((data: GraphData) => setGraph(data), [])

  const peopleCount = graph ? graph.nodes.filter(n => n.id !== userId).length : 0

  return (
    <section className="kq-card space-y-4">
      <div>
        <h2 className="section-heading mb-1">How you&apos;re woven into Karmyq</h2>
        <BelongingPulse
          peopleCount={peopleCount}
          communityCount={membershipFailed ? undefined : communityCount ?? undefined}
        />
      </div>

      <BelongingGraph mode="ego" currentUserId={userId} height={480} onDataLoaded={onDataLoaded} />

      <Link href="/network?mode=ego" className="inline-block text-sm text-primary hover:underline">
        Explore your full network →
      </Link>
    </section>
  )
}
