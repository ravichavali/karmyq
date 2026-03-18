import { useState, useEffect } from 'react'
import Link from 'next/link'
import { requestApi } from '@/lib/api'

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

interface ProviderProfile {
  id: string
  service_type: string
  display_name: string
  bio?: string
  is_available?: boolean
}

interface Collective {
  id: string
  name: string
  member_count?: number
}

interface ProviderProfileTabProps {
  providers: ProviderProfile[]
  collectives: Collective[]
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  ride: 'Rides',
  tradesperson: 'Home Repair',
  tutor: 'Tutoring',
  other: 'Other',
}

function formatRateCard(card: RateCard): string {
  if (card.pricing_model === 'standard' && card.rate_amount) {
    const unit = card.rate_unit?.replace('per_', '') ?? ''
    return `$${parseFloat(card.rate_amount).toFixed(0)} / ${unit}`
  }
  if (card.pricing_model === 'free') return 'Free'
  return 'Negotiable'
}

const RATE_UNIT_OPTIONS = [
  { value: 'per_hour', label: 'Per hour' },
  { value: 'per_session', label: 'Per session' },
  { value: 'per_trip', label: 'Per trip' },
  { value: 'flat_rate', label: 'Flat rate' },
]

const SERVICE_TYPE_OPTIONS = [
  { value: '', label: '— none —' },
  { value: 'ride', label: 'Ride' },
  { value: 'tradesperson', label: 'Tradesperson' },
  { value: 'tutor', label: 'Tutor' },
  { value: 'other', label: 'Other' },
]

export default function ProviderProfileTab({ providers, collectives }: ProviderProfileTabProps) {
  const [rateCards, setRateCards] = useState<Record<string, RateCard[]>>({})
  const [showRateCardModal, setShowRateCardModal] = useState<string | null>(null)
  const [editingCard, setEditingCard] = useState<RateCard | null>(null)

  // Modal form state
  const [modalLabel, setModalLabel] = useState('')
  const [modalPricingModel, setModalPricingModel] = useState<'standard' | 'free' | 'negotiable'>('standard')
  const [modalRateAmount, setModalRateAmount] = useState('')
  const [modalRateUnit, setModalRateUnit] = useState('per_hour')
  const [modalServiceType, setModalServiceType] = useState('')
  const [modalNotes, setModalNotes] = useState('')
  const [modalSaving, setModalSaving] = useState(false)

  const hasContent = providers.length > 0 || collectives.length > 0

  useEffect(() => {
    if (providers.length > 0) {
      fetchRateCardsForAll(providers)
    }
  }, [providers])

  async function fetchRateCardsForAll(providerList: ProviderProfile[]) {
    const results = await Promise.allSettled(
      providerList.map(async (p) => {
        const resp = await requestApi.get(`/providers/${p.id}/rate-cards`, {
          params: { include_inactive: true },
        })
        return { id: p.id, cards: (resp.data.data ?? resp.data) as RateCard[] }
      })
    )
    const map: Record<string, RateCard[]> = {}
    for (const r of results) {
      if (r.status === 'fulfilled') {
        map[r.value.id] = r.value.cards
      }
    }
    setRateCards(map)
  }

  async function fetchRateCards(providerId: string) {
    try {
      const resp = await requestApi.get(`/providers/${providerId}/rate-cards`, {
        params: { include_inactive: true },
      })
      const cards = (resp.data.data ?? resp.data) as RateCard[]
      setRateCards((prev) => ({ ...prev, [providerId]: cards }))
    } catch (err) {
      console.error('Failed to fetch rate cards', err)
    }
  }

  function openAddModal(providerId: string) {
    setEditingCard(null)
    setModalLabel('')
    setModalPricingModel('standard')
    setModalRateAmount('')
    setModalRateUnit('per_hour')
    setModalServiceType('')
    setModalNotes('')
    setShowRateCardModal(providerId)
  }

  function openEditModal(providerId: string, card: RateCard) {
    setEditingCard(card)
    setModalLabel(card.label)
    setModalPricingModel(card.pricing_model)
    setModalRateAmount(card.rate_amount ?? '')
    setModalRateUnit(card.rate_unit ?? 'per_hour')
    setModalServiceType(card.service_type ?? '')
    setModalNotes(card.notes ?? '')
    setShowRateCardModal(providerId)
  }

  async function handleModalSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!showRateCardModal || !modalLabel.trim()) return

    setModalSaving(true)
    try {
      const body = {
        label: modalLabel.trim(),
        pricing_model: modalPricingModel,
        rate_amount: modalPricingModel === 'standard' ? modalRateAmount || null : null,
        rate_unit: modalPricingModel === 'standard' ? modalRateUnit : null,
        service_type: modalServiceType || null,
        notes: modalNotes.trim() || null,
      }

      if (editingCard) {
        await requestApi.put(`/providers/${showRateCardModal}/rate-cards/${editingCard.id}`, body)
      } else {
        await requestApi.post(`/providers/${showRateCardModal}/rate-cards`, body)
      }

      await fetchRateCards(showRateCardModal)
      setShowRateCardModal(null)
    } catch (err) {
      console.error('Failed to save rate card', err)
      alert('Failed to save rate card')
    } finally {
      setModalSaving(false)
    }
  }

  async function handleDeactivateCard(providerId: string, cardId: string) {
    if (!confirm('Remove this rate card?')) return
    try {
      await requestApi.delete(`/providers/${providerId}/rate-cards/${cardId}`)
      await fetchRateCards(providerId)
    } catch (err) {
      console.error('Failed to remove rate card', err)
      alert('Failed to remove rate card')
    }
  }

  if (!hasContent) {
    return (
      <div className="text-center py-12 text-text-muted text-sm">
        No provider profiles or collectives yet.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Service Profiles */}
      {providers.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-text mb-3">Your Service Profiles</h2>
          <div className="space-y-3">
            {providers.map((provider) => (
              <div
                key={provider.id}
                className="bg-surface-raised rounded-xl border border-border p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-text">{provider.display_name}</span>
                      <span className="text-xs bg-primary-light text-primary rounded-full px-2 py-0.5">
                        {SERVICE_TYPE_LABELS[provider.service_type] ?? provider.service_type}
                      </span>
                      {provider.is_available && (
                        <span className="flex items-center gap-1 text-xs text-karmyq-green-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-karmyq-green-500 inline-block" />
                          Available
                        </span>
                      )}
                    </div>
                    {provider.bio && (
                      <p className="text-xs text-text-muted line-clamp-2">{provider.bio}</p>
                    )}
                  </div>
                  <Link
                    href={`/providers/${provider.id}`}
                    className="text-xs text-primary hover:underline shrink-0"
                  >
                    View →
                  </Link>
                </div>

                {/* Rate Cards section */}
                <div className="mt-4 border-t pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-700">Rate Cards</h4>
                    <button
                      onClick={() => openAddModal(provider.id)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      + Add rate card
                    </button>
                  </div>
                  {(rateCards[provider.id] ?? []).length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No rate cards yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {(rateCards[provider.id] ?? []).map((card) => (
                        <li key={card.id} className={`text-sm flex justify-between items-start ${!card.is_active ? 'opacity-40' : ''}`}>
                          <div>
                            <span className="font-medium">{card.label}</span>
                            <span className="text-gray-500 ml-2">{formatRateCard(card)}</span>
                            {card.notes && <p className="text-xs text-gray-400">{card.notes}</p>}
                            {!card.is_active && <span className="text-xs text-gray-400 ml-1">(inactive)</span>}
                          </div>
                          <div className="flex gap-2 ml-2 shrink-0">
                            <button onClick={() => openEditModal(provider.id, card)} className="text-xs text-blue-500">Edit</button>
                            <button onClick={() => handleDeactivateCard(provider.id, card.id)} className="text-xs text-red-400">Remove</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Collectives */}
      {collectives.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-text mb-3">Your Collectives</h2>
          <div className="space-y-3">
            {collectives.map((collective) => (
              <div
                key={collective.id}
                className="bg-surface-raised rounded-xl border border-border p-4 flex items-center justify-between gap-4"
              >
                <div>
                  <span className="text-sm font-medium text-text">{collective.name}</span>
                  {collective.member_count != null && (
                    <span className="ml-2 text-xs text-text-muted">{collective.member_count} member{collective.member_count !== 1 ? 's' : ''}</span>
                  )}
                </div>
                <Link
                  href={`/providers/collectives/${collective.id}`}
                  className="text-xs text-primary hover:underline shrink-0"
                >
                  View →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Rate Card Modal */}
      {showRateCardModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-800">{editingCard ? 'Edit Rate Card' : 'Add Rate Card'}</h3>
              <button onClick={() => setShowRateCardModal(null)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>

            <form onSubmit={handleModalSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Label <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={modalLabel}
                  onChange={(e) => setModalLabel(e.target.value)}
                  required
                  placeholder="e.g. Standard hourly rate"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pricing model</label>
                <div className="flex gap-3">
                  {(['standard', 'free', 'negotiable'] as const).map((model) => (
                    <label key={model} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="pricing_model"
                        value={model}
                        checked={modalPricingModel === model}
                        onChange={() => setModalPricingModel(model)}
                      />
                      {model.charAt(0).toUpperCase() + model.slice(1)}
                    </label>
                  ))}
                </div>
              </div>

              {modalPricingModel === 'standard' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rate amount ($)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={modalRateAmount}
                      onChange={(e) => setModalRateAmount(e.target.value)}
                      placeholder="e.g. 50"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rate unit</label>
                    <select
                      value={modalRateUnit}
                      onChange={(e) => setModalRateUnit(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {RATE_UNIT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service type (optional)</label>
                <select
                  value={modalServiceType}
                  onChange={(e) => setModalServiceType(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {SERVICE_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  rows={2}
                  placeholder="Any additional details..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowRateCardModal(null)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSaving || !modalLabel.trim()}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {modalSaving ? 'Saving...' : editingCard ? 'Save changes' : 'Add rate card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
