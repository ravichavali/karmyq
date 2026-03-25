import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Layout from '@/components/Layout'
import { providerService } from '@/lib/api'

const SERVICE_TYPE_LABELS: Record<string, string> = {
  ride: 'Rides',
  skill: 'Skills',
  errand: 'Errands',
  care: 'Care',
  other: 'Other',
}

const SERVICE_TYPE_COLORS: Record<string, string> = {
  ride: 'bg-blue-100 text-blue-700',
  skill: 'bg-purple-100 text-purple-700',
  errand: 'bg-orange-100 text-orange-700',
  care: 'bg-pink-100 text-pink-700',
  other: 'bg-gray-100 text-gray-600',
}

const getTrustColor = (score: number) => {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-teal-600'
  if (score >= 40) return 'text-orange-500'
  return 'text-gray-400'
}

const getTrustLabel = (score: number) => {
  if (score >= 75) return 'Highly Trusted'
  if (score >= 50) return 'Trusted'
  if (score >= 20) return 'Active'
  return 'New'
}

const RANK_STYLES = [
  'bg-yellow-50 border-yellow-200',
  'bg-gray-50 border-gray-200',
  'bg-amber-50 border-amber-200',
]
const RANK_TEXT = ['text-yellow-500', 'text-gray-400', 'text-amber-600']
const RANK_LABELS = ['1st', '2nd', '3rd']

const SERVICE_TYPES = ['ride', 'skill', 'errand', 'care', 'other']

export default function ProvidersPage() {
  const router = useRouter()
  const [providers, setProviders] = useState<any[]>([])
  const [filter, setFilter] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }
    fetchProviders()
  }, [router])

  const fetchProviders = async (serviceType?: string) => {
    try {
      setLoading(true)
      const res = await providerService.listProviders({
        limit: 20,
        ...(serviceType ? { service_type: serviceType } : {}),
      })
      const data = res.data?.data ?? res.data ?? []
      setProviders(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch providers:', err)
      setProviders([])
    } finally {
      setLoading(false)
    }
  }

  const handleFilter = (type: string | null) => {
    setFilter(type)
    fetchProviders(type ?? undefined)
  }

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    )
  }

  return (
    <>
      <Head>
        <title>Top Providers - Karmyq</title>
      </Head>
      <Layout>
        <div className="min-h-screen bg-surface py-8">
          <div className="container mx-auto px-4 max-w-4xl">
            {/* Header */}
            <div className="mb-6">
              <button
                onClick={() => router.back()}
                className="text-primary hover:text-primary-dark mb-4 flex items-center gap-2"
              >
                ← Back
              </button>
              <h1 className="text-3xl font-bold text-text">Top Providers</h1>
              <p className="text-text-muted mt-2">
                Community members offering services, ranked by trust score
              </p>
            </div>

            {/* Service type filter chips */}
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                onClick={() => handleFilter(null)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filter === null
                    ? 'bg-primary text-white'
                    : 'bg-surface-raised border border-border text-text-muted hover:border-primary'
                }`}
              >
                All
              </button>
              {SERVICE_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => handleFilter(type)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    filter === type
                      ? 'bg-primary text-white'
                      : 'bg-surface-raised border border-border text-text-muted hover:border-primary'
                  }`}
                >
                  {SERVICE_TYPE_LABELS[type]}
                </button>
              ))}
            </div>

            {/* Provider list */}
            {providers.length === 0 ? (
              <div className="bg-surface-raised rounded-xl shadow-sm border border-border p-12 text-center">
                <p className="text-text-subtle text-lg">No providers yet</p>
                <p className="text-sm text-text-subtle mt-2">
                  Be the first to register as a provider
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {providers.map((provider: any, i: number) => {
                  const trustScore = Math.round(provider.trust_score ?? 0)
                  const avgStars = provider.avg_stars ? Number(provider.avg_stars).toFixed(1) : null
                  const completionRate = provider.completion_rate
                    ? Math.round(provider.completion_rate)
                    : null

                  return (
                    <div
                      key={provider.id}
                      className={`flex items-start gap-4 p-4 rounded-xl border shadow-sm ${
                        i < 3 ? RANK_STYLES[i] : 'bg-surface-raised border-border'
                      }`}
                    >
                      {/* Rank */}
                      <div
                        className={`w-10 text-center font-bold text-lg flex-shrink-0 mt-0.5 ${
                          i < 3 ? RANK_TEXT[i] : 'text-text-muted'
                        }`}
                      >
                        {i < 3 ? RANK_LABELS[i] : `${i + 1}`}
                      </div>

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-text">{provider.display_name}</p>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              SERVICE_TYPE_COLORS[provider.service_type] ?? 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {SERVICE_TYPE_LABELS[provider.service_type] ?? provider.service_type}
                          </span>
                        </div>
                        {provider.user_name && (
                          <p className="text-xs text-text-muted mt-0.5">{provider.user_name}</p>
                        )}
                        {provider.bio && (
                          <p className="text-sm text-text-subtle mt-1.5 line-clamp-2">{provider.bio}</p>
                        )}
                        {/* Stats row */}
                        <div className="flex items-center gap-4 mt-2">
                          {avgStars && (
                            <span className="text-xs text-text-muted">
                              ⭐ {avgStars}
                              {provider.total_reviews > 0 && (
                                <span className="ml-0.5">({provider.total_reviews})</span>
                              )}
                            </span>
                          )}
                          {completionRate !== null && (
                            <span className="text-xs text-text-muted">
                              {completionRate}% completion
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Trust score */}
                      <div className="text-right flex-shrink-0">
                        <div className={`text-xl font-bold ${getTrustColor(trustScore)}`}>
                          {trustScore}
                        </div>
                        <div className="text-xs text-text-subtle">{getTrustLabel(trustScore)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </Layout>
    </>
  )
}
