import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import Layout from '@/components/Layout'
import TrustScoreBadge from '@/components/providers/TrustScoreBadge'
import TrustPathBadge from '@/components/TrustPathBadge'
import ProviderForm from '@/components/providers/ProviderForm'
import ProviderReviews from '@/components/providers/ProviderReviews'
import { providerService } from '../../lib/api'
import { useTrustPath } from '@/hooks/useTrustPath'
import RequestWizard from '@/components/RequestWizard'

const SERVICE_TYPE_LABELS: Record<string, string> = {
  ride: 'Rides',
  tradesperson: 'Home Repair',
  tutor: 'Tutoring',
  other: 'Other',
}

interface RateCard {
  id: string
  provider_id: string
  label: string
  service_type: string | null
  pricing_model: 'standard' | 'free' | 'negotiable'
  rate_amount: string | null
  rate_unit: string | null
  currency: string
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

function formatRateCard(card: RateCard): string {
  if (card.pricing_model === 'standard' && card.rate_amount) {
    const unit = card.rate_unit?.replace('per_', '') ?? ''
    return `$${parseFloat(card.rate_amount).toFixed(0)} / ${unit}`
  }
  if (card.pricing_model === 'free') return 'Free'
  return 'Negotiable'
}

function renderStars(avg: number | string | undefined) {
  const n = Number(avg)
  if (!avg || !n) return null
  const full = Math.round(n)
  return (
    <span className="text-yellow-500">
      {'★'.repeat(full)}{'☆'.repeat(5 - full)}
      <span className="text-text-muted ml-1 font-normal text-sm">{n.toFixed(1)}</span>
    </span>
  )
}

export default function ProviderDetailPage() {
  const router = useRouter()
  const { id } = router.query
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [provider, setProvider] = useState<any>(null)
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [showWizard, setShowWizard] = useState(false)
  const isOwner = currentUser ? currentUser.id === provider?.user_id : false
  const { trustPath } = useTrustPath(provider?.user_id ?? null, { enabled: !!currentUser && !isOwner })

  useEffect(() => {
    const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null
    if (!userStr) { router.push('/login'); return }
    setCurrentUser(JSON.parse(userStr))
  }, [])

  useEffect(() => {
    if (currentUser && id) fetchProvider()
  }, [currentUser, id])

  async function fetchProvider() {
    setLoading(true)
    try {
      const [providerResp, reviewResp] = await Promise.all([
        providerService.getProvider(id as string),
        providerService.getProviderReviews(id as string),
      ])
      setProvider(providerResp.data)
      setReviews(reviewResp.data ?? [])
    } catch (err) {
      console.error('Failed to fetch provider', { error: err instanceof Error ? err.message : String(err) })
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdate(data: any) {
    await providerService.updateProvider(id as string, data)
    setEditing(false)
    fetchProvider()
  }

  if (!currentUser || loading) {
    return <Layout><div className="flex items-center justify-center py-24 text-text-muted text-sm">Loading...</div></Layout>
  }

  if (!provider) {
    return <Layout><div className="flex items-center justify-center py-24 text-text-muted text-sm">Provider not found.</div></Layout>
  }

  return (
    <Layout>
      <Head><title>{provider.display_name} — Karmyq Providers</title></Head>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {isOwner && (
          <div className="mb-4">
            <Link href="/profile?tab=provider" className="text-sm text-primary hover:underline">
              ← Your Profile
            </Link>
          </div>
        )}

        {/* Header */}
        <div className="bg-surface-raised rounded-xl border border-border p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-karmyq-green-500 to-karmyq-teal-600 rounded-full flex items-center justify-center text-white text-lg font-bold">
                {provider.display_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-xl font-bold text-text">{provider.display_name}</h1>
                <span className="text-sm bg-primary-light text-primary rounded-full px-2 py-0.5 mt-0.5 inline-block">
                  {SERVICE_TYPE_LABELS[provider.service_type] ?? provider.service_type}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <TrustScoreBadge score={provider.trust_score} />
              {renderStars(provider.avg_stars)}
              {provider.total_reviews > 0 && (
                <span className="text-xs text-text-subtle">{provider.total_reviews} review{provider.total_reviews !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>

          {!isOwner && (
            <button
              className="btn-primary mt-4 px-6 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              onClick={() => setShowWizard(true)}
            >
              Get Service
            </button>
          )}

          {provider.bio && <p className="mt-4 text-sm text-text-muted">{provider.bio}</p>}

          {!isOwner && trustPath && (
            <div className="mt-3">
              <TrustPathBadge trustPath={trustPath} compact />
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-4 text-sm text-text-muted">
            {provider.pricing_notes && (
              <span><span className="font-medium text-text">Pricing:</span> {provider.pricing_notes}</span>
            )}
            {provider.location_notes && (
              <span><span className="font-medium text-text">Area:</span> {provider.location_notes}</span>
            )}
          </div>

          {isOwner && (
            <button
              onClick={() => setEditing(e => !e)}
              className="mt-4 text-sm text-primary hover:underline"
            >
              {editing ? 'Cancel edit' : 'Edit profile'}
            </button>
          )}
        </div>

        {/* Rate Cards */}
        {provider.rate_cards && provider.rate_cards.length > 0 && (
          <section className="bg-surface-raised rounded-xl border border-border p-5">
            <h3 className="text-base font-semibold text-gray-800 mb-3">Rate Cards</h3>
            <ul className="space-y-2">
              {provider.rate_cards.map((card: RateCard) => (
                <li key={card.id} className="text-sm border border-gray-200 rounded-lg p-3">
                  <div className="flex justify-between">
                    <span className="font-medium">{card.label}</span>
                    <span className="text-gray-500">{formatRateCard(card)}</span>
                  </div>
                  {card.notes && <p className="text-xs text-gray-400 mt-1">{card.notes}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Edit form */}
        {editing && (
          <div className="bg-surface-raised rounded-xl border border-border p-6">
            <ProviderForm initial={provider} onSubmit={handleUpdate} submitLabel="Save changes" />
          </div>
        )}

        {/* Ride details */}
        {provider.service_type === 'ride' && provider.vehicle_type && (
          <div className="bg-surface-raised rounded-xl border border-border p-5">
            <h2 className="text-base font-semibold text-text mb-3">Ride details</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {provider.vehicle_type && (
                <>
                  <dt className="text-text-muted">Vehicle</dt>
                  <dd className="text-text">{provider.vehicle_type}</dd>
                </>
              )}
              {provider.max_passengers && (
                <>
                  <dt className="text-text-muted">Capacity</dt>
                  <dd className="text-text">{provider.max_passengers} passenger{provider.max_passengers !== 1 ? 's' : ''}</dd>
                </>
              )}
              {provider.typical_routes && (
                <>
                  <dt className="text-text-muted">Typical routes</dt>
                  <dd className="text-text">{provider.typical_routes}</dd>
                </>
              )}
              <dt className="text-text-muted">Advance booking</dt>
              <dd className="text-text">{provider.advance_booking_required ? 'Required' : 'Not required'}</dd>
            </dl>
          </div>
        )}

        {/* Reviews */}
        <div className="bg-surface-raised rounded-xl border border-border p-5">
          <ProviderReviews
            providerId={id as string}
            reviews={reviews}
            currentUserId={currentUser?.id}
            onReviewSubmitted={fetchProvider}
          />
        </div>
      </div>

      {showWizard && (
        <RequestWizard
          onClose={() => setShowWizard(false)}
          preferredProviderId={provider?.id}
          preferredProviderName={provider?.display_name}
          preferredProviderServiceType={provider?.service_type}
        />
      )}
    </Layout>
  )
}
