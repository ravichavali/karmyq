import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { requestService } from '../../lib/api'
import Layout from '@/components/Layout'
import EmptyState from '@/components/EmptyState'
import { getRequestStatusDisplay } from '@/lib/requestDisplay'

interface HelpOffer {
  id: string
  community_id: string
  community_name: string
  offerer_id: string
  helper_name: string
  title: string
  description: string
  category: string
  status: string
  created_at: string
  updated_at: string
  // Sprint 139 (BUG-097): an owner's expired offer stays in their list, so the card must say so.
  expires_at: string | null
  expired: boolean | null
}

/** Past its expiry: flagged by the hourly sweep, or its clock has run out before the sweep. */
function isOfferExpired(offer: Pick<HelpOffer, 'expired' | 'expires_at'>, now = Date.now()): boolean {
  if (offer.expired === true) return true
  return offer.expires_at != null && Date.parse(offer.expires_at) <= now
}

export default function OffersPage() {
  const [offers, setOffers] = useState<HelpOffer[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [filter, setFilter] = useState({
    status: 'active',
    category: '',
  })

  useEffect(() => {
    fetchOffers()
  }, [filter])

  const fetchOffers = async () => {
    try {
      setLoading(true)
      const params: any = { limit: 50 }

      if (filter.status) params.status = filter.status
      if (filter.category) params.type = filter.category

      // The API client's interceptor already unwrapped the envelope: response.data is
      // { offers, count, total }. Anything else is a failed load, not an empty list.
      const response = await requestService.getOffers(params)
      const list = response?.data?.offers
      if (!Array.isArray(list)) throw new Error('Unexpected offers response')
      setOffers(list)
      setLoadError(false)
    } catch (error) {
      console.error('Error fetching offers', { error: error instanceof Error ? error.message : String(error) })
      setOffers([])
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Help Offers - Karmyq</title>
      </Head>
      <Layout title="Help Offers">
        <div className="kq-page py-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <p className="text-text-muted mt-2">Browse available help offers from community members</p>
            </div>
            <Link href="/offers/new" className="btn-primary inline-flex">
              Create Offer
            </Link>
          </div>

        {/* Filters */}
        <div className="kq-card mb-6">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">
                Status
              </label>
              <select
                value={filter.status}
                onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                className="border border-border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="matched">Matched</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">
                Category
              </label>
              <select
                value={filter.category}
                onChange={(e) => setFilter({ ...filter, category: e.target.value })}
                className="border border-border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">All Categories</option>
                <option value="physical_help">Physical Help</option>
                <option value="skills">Skills & Expertise</option>
                <option value="resources">Resources</option>
                <option value="emotional_support">Emotional Support</option>
                <option value="transportation">Transportation</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </div>

        {/* Offers List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-text-muted mt-4">Loading offers...</p>
          </div>
        ) : loadError ? (
          <div role="alert" className="kq-card flex items-center justify-between gap-3 border-error bg-error-light text-error">
            <span>Unable to load offers</span>
            <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => fetchOffers()}>
              Retry
            </button>
          </div>
        ) : offers.length === 0 ? (
          <EmptyState
            icon="🙌"
            heading="No offers yet"
            body="Browse requests and offer to help someone today."
            ctaLabel="Go to Dashboard"
            ctaHref="/dashboard"
          />
        ) : (
          <div className="grid gap-6">
            {offers.map((offer) => (
              <OfferCard key={offer.id} offer={offer} />
            ))}
          </div>
        )}
        </div>
      </Layout>
    </>
  )
}

function OfferCard({ offer }: { offer: HelpOffer }) {
  const expired = isOfferExpired(offer)
  // An expired ACTIVE offer can no longer be taken up, so it reads "Expired". Any other status keeps
  // its own label (an ongoing match must never look cancelled or completed) plus an expiry note.
  const statusDisplay = getRequestStatusDisplay(expired && offer.status === 'active' ? 'expired' : offer.status)
  const expiryNote = expired && offer.status !== 'active'

  return (
    <div className="kq-card">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-text mb-2">{offer.title}</h3>
          <p className="text-text-muted line-clamp-2">{offer.description}</p>
        </div>
        <div className="flex flex-col items-end gap-1 ml-4">
          <span
            aria-label={`Status: ${statusDisplay.label}`}
            className={`kq-pill border ${statusDisplay.className}`}
          >
            {statusDisplay.label}
          </span>
          {expiryNote && (
            <span className={`kq-pill border ${getRequestStatusDisplay('expired').className}`}>Offer expired</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-6 text-sm text-text-subtle">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span>{offer.community_name}</span>
        </div>

        <div className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span>{offer.helper_name}</span>
        </div>

        <div className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <span className="capitalize">{offer.category.replace(/_/g, ' ')}</span>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{new Date(offer.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  )
}
