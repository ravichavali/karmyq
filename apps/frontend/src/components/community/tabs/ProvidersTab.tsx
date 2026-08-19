import { useCallback, useEffect, useState } from 'react'
import { providerService } from '@/lib/api'
import { PROVIDER_SERVICE_TYPE_LABELS } from '@karmyq/shared/schemas/providers'

interface CommunityProvider {
  id: string
  user_id: string
  service_type: string
  display_name: string
  bio: string | null
  pricing_notes: string | null
  location_notes: string | null
  user_name: string | null
  avg_stars: number | null
  total_reviews: number | null
  trust_score: number | null
}

/**
 * Label for a provider's service type, falling back to the raw value.
 *
 * `Object.hasOwn` rather than a bare lookup: `service_type` comes from the database, which stores
 * it as bare TEXT with no CHECK constraint, so a stored value of `constructor` or `toString` would
 * resolve up the prototype chain and return a function instead of falling through to the `??`.
 * React then renders a function as a child. Not exploitable, but it is a real crash-shaped bug for
 * a value this component does not control.
 */
function serviceTypeLabel(serviceType: string): string {
  return Object.hasOwn(PROVIDER_SERVICE_TYPE_LABELS, serviceType)
    ? PROVIDER_SERVICE_TYPE_LABELS[serviceType as keyof typeof PROVIDER_SERVICE_TYPE_LABELS]
    : serviceType
}

interface Props {
  communityId: string
}

/**
 * Sprint 125 / ADR-095 — the community provider layer.
 *
 * Shows the providers reachable through THIS community: members who registered a provider profile
 * and clear the community's three reach conditions (opt-in, personal standing floor, service-type
 * allowlist). The filtering is the server's job — this component never re-derives eligibility, so
 * it cannot disagree with the gate.
 *
 * ⚠️ Two states that look alike and must not be collapsed. The server returns `[]` BOTH when a
 * community never enabled provider services and when it enabled them but nobody clears the bar —
 * but those mean opposite things to a steward ("your switch is off" vs "your bar is too high"), so
 * an empty response must never be rendered as "not enabled".
 *
 * This component resolves that by never rendering the disabled case at all: the caller gates on
 * `config.provider_services_enabled` and renders nothing when it is off, so an empty list here
 * unambiguously means "enabled, nobody qualifies yet". An earlier draft ALSO took an `enabled`
 * prop and rendered a "not enabled" panel — dead code, since the only call site gated on the same
 * flag before rendering, and five tests asserted a screen no user could reach.
 */
export default function ProvidersTab({ communityId }: Props) {
  const [providers, setProviders] = useState<CommunityProvider[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!communityId) return
    setLoading(true)
    setError(null)
    try {
      // The api.ts interceptor already unwraps the ADR-074 envelope — `res.data`, never
      // `res.data.data`.
      const res = await providerService.getCommunityProviders(communityId)
      setProviders(Array.isArray(res.data) ? res.data : [])
    } catch (err: any) {
      setError(
        err?.response?.status === 403
          ? 'You need to be an active member of this community to see its providers.'
          : 'We could not load this community’s providers just now.'
      )
    } finally {
      setLoading(false)
    }
  }, [communityId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section className="kq-page-header">
      <p className="kq-eyebrow">Neighbours who offer services</p>
      <h3 className="kq-headline">Providers in this community</h3>
      <p className="kq-lede">
        Members here who offer a service and meet this community’s standing requirement.
      </p>

      {loading && <p className="kq-lede mt-3">Loading providers…</p>}

      {error && !loading && (
        <div className="kq-finite-state mt-3">
          <p className="kq-lede">{error}</p>
          <button type="button" className="btn-primary mt-3" onClick={() => void load()}>
            Try again
          </button>
        </div>
      )}

      {!loading && !error && providers.length === 0 && (
        <div className="kq-finite-state mt-3">
          <div className="text-3xl mb-2">🧰</div>
          <p className="kq-headline text-[22px]">No providers meet this community’s bar yet</p>
          <p className="kq-lede mt-1">
            Provider services are switched on here, but nobody clears the standing requirement so
            far. As neighbours build a track record they will appear here.
          </p>
        </div>
      )}

      {!loading && !error && providers.length > 0 && (
        <ul className="mt-3 space-y-2" data-testid="community-providers">
          {providers.map(provider => (
            <li key={provider.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="kq-headline text-[18px]">{provider.display_name}</p>
                  <p className="kq-lede">
                    {serviceTypeLabel(provider.service_type)}
                    {provider.user_name ? ` · ${provider.user_name}` : ''}
                  </p>
                  {provider.bio && <p className="kq-lede mt-1">{provider.bio}</p>}
                  {provider.location_notes && (
                    <p className="kq-lede mt-1">📍 {provider.location_notes}</p>
                  )}
                  {provider.pricing_notes && (
                    <p className="kq-lede mt-1">{provider.pricing_notes}</p>
                  )}
                </div>
                {provider.avg_stars != null && (
                  // `!= null` deliberately: a genuine 0-star average must render, and `||` would
                  // hide it.
                  <div className="text-right shrink-0">
                    <p className="kq-headline text-[18px]">★ {Number(provider.avg_stars).toFixed(1)}</p>
                    <p className="kq-lede">
                      {provider.total_reviews ?? 0} review{provider.total_reviews === 1 ? '' : 's'}
                    </p>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
