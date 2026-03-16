import Link from 'next/link'

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

export default function ProviderProfileTab({ providers, collectives }: ProviderProfileTabProps) {
  const hasContent = providers.length > 0 || collectives.length > 0

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
                className="bg-surface-raised rounded-xl border border-border p-4 flex items-start justify-between gap-4"
              >
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
    </div>
  )
}
