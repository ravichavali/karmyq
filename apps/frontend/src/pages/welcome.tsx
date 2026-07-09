import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { communityService, socialGraphService } from '@/lib/api'
import ArrivalGraph from '@/components/graphs/ArrivalGraph'
import { normalizePersonGraph } from '@/components/graphs/normalizeGraphData'
import type { GraphData } from '@/components/graphs/types'

interface ArrivalContext {
  path: 'invite' | 'open'
  /** The account this arrival belongs to — a stale context from another login on the same tab
   *  must never be replayed (sessionStorage survives logout). */
  userId?: string
  inviterId?: string
  inviterName?: string
  communityId: string
  communityName?: string
}

const ARRIVAL_KEY = 'karmyq_arrival'

function readStoredUser(): { id: string; name?: string } | null {
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null')
    return user?.id ? user : null
  } catch {
    return null
  }
}

function readArrivalContext(expectedUserId: string): ArrivalContext | null {
  try {
    const stored = JSON.parse(sessionStorage.getItem(ARRIVAL_KEY) || 'null')
    if (!stored?.communityId) return null
    // A context stamped for a different account (or an unstamped legacy one) is stale — drop it.
    if (stored.userId !== expectedUserId) {
      sessionStorage.removeItem(ARRIVAL_KEY)
      return null
    }
    return stored
  } catch {
    return null
  }
}

/**
 * Sprint 118 (ADR-085) — the arrival moment. Shown once per account after the first community
 * join (both funnel paths converge here). Renders the member's ACTUAL nascent belonging graph —
 * you on the ring of the community you just entered, plus (invite path) the invitation bond to
 * your inviter, which is provenance that becomes trust through helping, never a trust edge.
 * Completion and skip both write the user-scoped onboarded key and land the same guided place.
 */
export default function WelcomePage() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string; name?: string } | null>(null)
  const [arrival, setArrival] = useState<ArrivalContext | null>(null)
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function resolveArrival() {
      const storedUser = readStoredUser()
      if (!storedUser || !localStorage.getItem('token')) {
        router.replace('/dashboard')
        return
      }

      let context = readArrivalContext(storedUser.id)
      if (!context) {
        // Deep link — an already-onboarded member has nothing to arrive at.
        if (
          localStorage.getItem(`karmyq_onboarded:${storedUser.id}`) ||
          localStorage.getItem('karmyq_onboarded')
        ) {
          router.replace('/dashboard')
          return
        }
        // Fall back to the first joined community. getMyCommunities returns
        // {communities, count, total} — extract defensively (S113 crash pattern).
        try {
          const res = await communityService.getMyCommunities(storedUser.id)
          const data = res?.data
          const list = data?.communities ?? data?.data ?? (Array.isArray(data) ? data : [])
          const first = list?.[0]
          if (!first?.id) {
            router.replace('/dashboard')
            return
          }
          context = { path: 'open', communityId: first.id, communityName: first.name }
        } catch {
          router.replace('/dashboard')
          return
        }
      }
      if (cancelled) return

      setUser(storedUser)
      setArrival(context)

      // The graph is the moment — but its fetch failing must never strand the member: fall back
      // to the smallest true picture (you, plus your inviter on the invite path).
      try {
        const res = await socialGraphService.getFullCommunityGraph(context.communityId)
        if (!cancelled) setGraphData(normalizePersonGraph(res.data ?? { nodes: [], links: [] }))
      } catch {
        if (!cancelled) {
          setGraphData({
            nodes: [{ id: storedUser.id, name: storedUser.name ?? 'You', isCurrentUser: true }],
            links: [],
          })
        }
      }
      if (!cancelled) setReady(true)
    }

    resolveArrival()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const finish = () => {
    if (user) localStorage.setItem(`karmyq_onboarded:${user.id}`, '1')
    sessionStorage.removeItem(ARRIVAL_KEY)
    router.push(`/communities/${arrival?.communityId ?? ''}`)
  }

  if (!ready || !arrival || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-light to-surface-raised flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    )
  }

  const isInvite = arrival.path === 'invite' && !!arrival.inviterName
  const communityName = arrival.communityName ?? 'your community'

  return (
    <>
      <Head>
        <title>Welcome - Karmyq</title>
      </Head>
      <div className="min-h-screen bg-gradient-to-b from-primary-light to-surface-raised px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-bold font-serif text-text mb-3">
            {isInvite ? (
              <>
                <span className="text-primary">{arrival.inviterName}</span> brought you into{' '}
                <span className="text-accent">{communityName}</span>
              </>
            ) : (
              <>
                Welcome to <span className="text-accent">{communityName}</span>
              </>
            )}
          </h1>
          <p className="text-text-muted mb-8">
            This is your place in the community — your web starts here and grows with every
            exchange.
          </p>

          <div className="bg-surface-raised/60 rounded-2xl border border-border p-4 mb-6">
            <ArrivalGraph
              graphData={graphData ?? { nodes: [], links: [] }}
              currentUserId={user.id}
              inviter={
                isInvite
                  ? { id: arrival.inviterId, name: arrival.inviterName as string }
                  : undefined
              }
            />
          </div>

          {isInvite && (
            <p className="text-sm text-text-muted mb-8">
              The dashed line is your invitation bond with {arrival.inviterName}. It becomes trust
              when you help each other — every exchange makes it real.
            </p>
          )}
          {!isInvite && (
            <p className="text-sm text-text-muted mb-8">
              These are your new neighbours. Bonds form through the help you give and receive.
            </p>
          )}

          <div className="flex flex-col items-center gap-3">
            <button onClick={finish} className="btn-primary px-8 py-3 text-base">
              See the open asks in {communityName}
            </button>
            <button onClick={finish} className="btn-ghost text-sm text-text-muted">
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
