import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import Layout from '@/components/Layout'
import ProviderCard from '@/components/providers/ProviderCard'
import CollectiveCard from '@/components/providers/CollectiveCard'
import { providerService, collectiveService } from '../../lib/api'
import { PROVIDER_SERVICE_TYPES } from '@karmyq/shared/schemas/providers'

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
  const [loading, setLoading] = useState(true)

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
  }, [currentUser, tab, serviceTypeFilter])

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

  return (
    <Layout>
      <Head><title>Service Providers — Karmyq</title></Head>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text">Neighborhood Service Providers</h1>
            <p className="text-sm text-text-muted mt-1">Paid neighborhood services alongside mutual aid — no karma, your own arrangement.</p>
          </div>
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
              {providers.map(p => <ProviderCard key={p.id} provider={p} />)}
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
    </Layout>
  )
}
