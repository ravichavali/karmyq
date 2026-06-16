import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Head from 'next/head'
import Layout from '@/components/Layout'
import RequestCard from '@/components/Feed/RequestCard'
import { requestService } from '@/lib/api'
import type { RequestCardData } from '@/types/unified-feed'

/**
 * Sprint 100 / F2 + Sprint 101 — the reachable open-asks view.
 *
 * The community pulse says "N open asks across the community". This page is exactly those N: every
 * open + unexpired ask attached to the community, INCLUDING the viewer's own asks and asks they have
 * already offered on (the server uses the same predicate as the pulse count, so the number is always
 * reachable). Cards here carry no inline Offer action — opening a card is the action path: the
 * /requests/[id] detail page shows the ask and the action available to the viewer (offer, awaiting
 * response, your own ask, or a finite state). The count stays honest without implying every ask is
 * fillable by the viewer.
 */
export default function CommunityOpenAsksPage() {
  const router = useRouter()
  const { id } = router.query
  const communityId = id as string | undefined

  const [items, setItems] = useState<RequestCardData[]>([])
  const [communityName, setCommunityName] = useState<string>('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      router.push('/login')
      return
    }
    try {
      const stored = localStorage.getItem('user')
      if (stored) setCurrentUserId(JSON.parse(stored).id ?? null)
    } catch {
      // Non-fatal: own-ask detection just falls back to showing every card the same way.
    }
  }, [router])

  useEffect(() => {
    if (!communityId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await requestService.getCommunityOpenAsks(communityId!)
        if (cancelled) return
        const fetched = (res.data?.items ?? []) as RequestCardData[]
        setItems(fetched)
        setCommunityName(fetched[0]?.community_name ?? '')
      } catch (err: any) {
        if (!cancelled) setError(err.response?.data?.message || 'Failed to load open asks')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [communityId])

  return (
    <>
      <Head>
        <title>Open asks - Karmyq</title>
      </Head>
      <Layout title="Open asks">
        <div className="kq-page py-8">
          <Link href={`/communities/${communityId ?? ''}`} className="text-sm text-text-subtle hover:text-text">
            ← Back to community
          </Link>

          <h1 className="kq-headline text-[26px] mt-3 mb-1">Open asks across the community</h1>
          <p className="kq-lede mb-6">
            {communityName ? `Everything ${communityName} has open right now` : 'Everything open right now'} — including
            your own asks and ones you’ve already offered on. Open an ask to see details and the action available to you.
          </p>

          {loading && <div className="text-text-subtle">Loading open asks…</div>}
          {error && <div className="text-red-500">{error}</div>}

          {!loading && !error && items.length === 0 && (
            <div className="kq-finite-state">
              <div className="text-3xl mb-2">🌿</div>
              <p className="kq-headline text-[20px]">No open asks right now</p>
              <p className="kq-lede mt-1">When a neighbour needs a hand, it’ll show up here.</p>
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <div className="space-y-3">
              {items.map((item) => (
                <RequestCard key={item.request_id} data={item} currentUserId={currentUserId} readOnly />
              ))}
            </div>
          )}
        </div>
      </Layout>
    </>
  )
}
