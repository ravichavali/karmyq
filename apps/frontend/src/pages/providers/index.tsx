import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import Layout from '@/components/Layout'
import ProviderCard from '@/components/providers/ProviderCard'
import type { ProviderCardData } from '@/components/providers/ProviderCard'
import CollectiveCard from '@/components/providers/CollectiveCard'
import { providerService, collectiveService } from '../../lib/api'
import { PROVIDER_SERVICE_TYPES } from '@karmyq/shared/schemas/providers'
import RequestWizard from '@/components/RequestWizard'

const SERVICE_TYPE_LABELS: Record<string, string> = {
  ride: 'Rides',
  tradesperson: 'Home Repair',
  tutor: 'Tutoring',
  other: 'Other',
}

export default function ProvidersPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [tab, setTab] = useState<'individuals' | 'collectives'>('individuals')
  const [serviceTypeFilter, setServiceTypeFilter] = useState('')
  const [providers, setProviders] = useState<any[]>([])
  const [collectives, setCollectives] = useState<any[]>([])
  const [myProviders, setMyProviders] = useState<any[]>([])
  const [myCollectives, setMyCollectives] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [wizardProvider, setWizardProvider] = useState<ProviderCardData | null>(null)

  useEffect(() => {
    const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null
    if (!userStr) {
      router.push('/login')
      return
    }
    setCurrentUser(JSON.parse(userStr))
  }, [])

  useEffect(() => {
    if (!currentUser) return
    fetchData()
    fetchMyData()
  }, [currentUser, tab, serviceTypeFilter])

  async function fetchMyData() {
    try {
      const [provRes, collRes] = await Promise.all([
        providerService.getMyProviders(),
        collectiveService.getMyCollectives(),
      ])
      setMyProviders(provRes.data ?? [])
      setMyCollectives(collRes.data ?? [])
    } catch {}
  }

  async function fetchData() {
    setLoading(true)
    try {
      if (tab === 'individuals') {
        const response = await providerService.listProviders({ service_type: serviceTypeFilter || undefined })
        setProviders(response.data ?? [])
      } else {
        const response = await collectiveService.listCollectives({ service_type: serviceTypeFilter || undefined })
        setCollectives(response.data ?? [])
      }
    } catch (err) {
      console.error('Failed to fetch', err)
    } finally {
      setLoading(false)
    }
  }

  const isProvider = myProviders.length > 0
  const isInCollective = myCollectives.length > 0

  return (
    <Layout>
      <Head><title>Service Providers — Karmyq</title></Head>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">

        {/* Provider dashboard — only shown when user is a provider */}
        {(isProvider || isInCollective) && (
          <div className="bg-surface-raised rounded-xl border border-border p-6">
            <h2 className="text-base font-semibold text-text mb-4">My Provider Presence</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* My profiles */}
              {isProvider && (
                <div>
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">My Profiles</p>
                  <div className="space-y-2">
                    {myProviders.map((p: any) => (
                      <Link key={p.id} href={`/providers/${p.id}`}>
                        <div className="flex items-center justify-between bg-surface rounded-lg border border-border px-3 py-2 hover:border-primary transition cursor-pointer">
                          <div>
                            <p className="text-sm font-medium text-text">{p.display_name}</p>
                            <p className="text-xs text-text-muted">{SERVICE_TYPE_LABELS[p.service_type] ?? p.service_type}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {p.is_available && (
                              <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" title="Available" />
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded-full ${p.is_active ? 'bg-primary-light text-primary' : 'bg-surface-raised text-text-muted'}`}>
                              {p.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <Link href="/providers/new">
                    <button className="mt-2 text-xs text-primary hover:underline">+ Add another profile</button>
                  </Link>
                </div>
              )}

              {/* My collectives */}
              {isInCollective && (
                <div>
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">My Collectives</p>
                  <div className="space-y-2">
                    {myCollectives.map((c: any) => (
                      <Link key={c.id} href={`/providers/collectives/${c.id}`}>
                        <div className="flex items-center justify-between bg-surface rounded-lg border border-border px-3 py-2 hover:border-primary transition cursor-pointer">
                          <div>
                            <p className="text-sm font-medium text-text">{c.name}</p>
                            <p className="text-xs text-text-muted">{c.service_types?.map((t: string) => SERVICE_TYPE_LABELS[t] ?? t).join(', ')}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <Link href="/providers/collectives/new">
                    <button className="mt-2 text-xs text-primary hover:underline">+ Create collective</button>
                  </Link>
                </div>
              )}

              {/* CTA when provider but not in any collective */}
              {isProvider && !isInCollective && (
                <div className="flex flex-col justify-center">
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Collectives</p>
                  <p className="text-sm text-text-muted">You're not part of any collective yet.</p>
                  <Link href="/providers/collectives/new">
                    <button className="mt-2 text-xs text-primary hover:underline">+ Create one</button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Public directory */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-text">Neighborhood Service Providers</h1>
              <p className="text-sm text-text-muted mt-1">Paid neighborhood services alongside mutual aid — no karma, your own arrangement.</p>
            </div>
            {!isProvider && (
              <div className="flex gap-2">
                <Link href="/providers/collectives/new">
                  <button className="text-sm border border-border rounded-lg px-3 py-2 text-text-muted hover:bg-surface-raised transition">
                    + New Collective
                  </button>
                </Link>
                <Link href="/providers/new">
                  <button className="text-sm bg-primary text-white rounded-lg px-3 py-2 hover:bg-primary-dark transition">
                    + Become a Provider
                  </button>
                </Link>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 border-b border-border">
            {(['individuals', 'collectives'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setServiceTypeFilter('') }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px ${
                  tab === t ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text'
                }`}
              >
                {t === 'individuals' ? 'Individual Providers' : 'Collectives'}
              </button>
            ))}
          </div>

          {/* Service type filter */}
          <div className="flex gap-2 flex-wrap mb-5">
            <button
              onClick={() => setServiceTypeFilter('')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                serviceTypeFilter === '' ? 'bg-primary text-white border-primary' : 'bg-surface text-text-muted border-border hover:border-primary'
              }`}
            >
              All
            </button>
            {PROVIDER_SERVICE_TYPES.map(type => (
              <button
                key={type}
                onClick={() => setServiceTypeFilter(type)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                  serviceTypeFilter === type ? 'bg-primary text-white border-primary' : 'bg-surface text-text-muted border-border hover:border-primary'
                }`}
              >
                {SERVICE_TYPE_LABELS[type]}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-text-muted text-sm">Loading...</div>
          ) : tab === 'individuals' ? (
            providers.length === 0 ? (
              <div className="text-center py-16 text-text-muted text-sm">No providers found. Be the first!</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {providers.map(p => (
                  <ProviderCard
                    key={p.id}
                    provider={p}
                    onGetService={(provider) => setWizardProvider(provider)}
                  />
                ))}
              </div>
            )
          ) : (
            collectives.length === 0 ? (
              <div className="text-center py-16 text-text-muted text-sm">No collectives yet. Create the first one!</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {collectives.map(c => <CollectiveCard key={c.id} collective={c} />)}
              </div>
            )
          )}
        </div>
      </div>

      {/* Get Service FAB */}
      <button
        className="fab"
        onClick={() => setWizardProvider({ id: '', display_name: '', service_type: 'other' })}
        aria-label="Get Service"
      >
        +
      </button>

      {wizardProvider && (
        <RequestWizard
          onClose={() => setWizardProvider(null)}
          preferredProviderId={wizardProvider.id || undefined}
          preferredProviderName={wizardProvider.display_name || undefined}
          preferredProviderServiceType={wizardProvider.service_type || undefined}
        />
      )}
    </Layout>
  )
}
