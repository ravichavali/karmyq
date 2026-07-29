import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Layout from '@/components/Layout'
import { reputationService } from '@/lib/api'


export default function TrustScorePage() {
  const router = useRouter()
  const [overallData, setOverallData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')

    if (!token) {
      router.push('/login')
      return
    }

    if (userData) {
      const parsedUser = JSON.parse(userData)
      fetchTrustData(parsedUser.id)
    }
  }, [router])

  const fetchTrustData = async (userId: string) => {
    try {
      setLoading(true)
      const trustRes = await reputationService.getOverallTrustScore(userId)
      setOverallData(trustRes.data)
    } catch (err) {
      console.error('Failed to fetch trust data', { error: err instanceof Error ? err.message : String(err) })
    } finally {
      setLoading(false)
    }
  }

  const getTrustColor = (score: number) => {
    if (score >= 80) return 'from-karmyq-green-500 to-karmyq-green-700'
    if (score >= 60) return 'from-karmyq-green-400 to-karmyq-teal-500'
    if (score >= 40) return 'from-karmyq-orange-500 to-karmyq-orange-700'
    return 'from-karmyq-brown-400 to-karmyq-brown-600'
  }

  const getTrustLabel = (score: number) => {
    if (score >= 75) return 'Highly Trusted'
    if (score >= 50) return 'Trusted'
    if (score >= 20) return 'Active'
    return 'New'
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

  const score = overallData?.overall_score || 0
  const communityBreakdown: Array<{ community_id: string; community_name: string; score: number; recent_interactions: number }> = overallData?.community_breakdown || []

  return (
    <>
      <Head>
        <title>Trust Score - Karmyq</title>
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
              <h1 className="text-3xl font-bold text-text">Your Trust Score</h1>
              <p className="text-text-muted mt-2">
                Your trust score reflects your reliability and engagement in the community
              </p>
            </div>

            {/* Trust Score Display */}
            <div className={`bg-gradient-to-br ${getTrustColor(score)} rounded-xl shadow-lg p-8 mb-6 text-white`}>
              <div className="text-center">
                <div className="text-8xl font-bold mb-4">{score}</div>
                <p className="text-2xl font-semibold opacity-90">{getTrustLabel(score)}</p>
                <div className="bg-surface-raised/20 rounded-full h-3 mt-6 max-w-md mx-auto">
                  <div
                    className="bg-surface-raised rounded-full h-3 transition-all duration-500"
                    style={{ width: `${score}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Trust Score Breakdown */}
            <div className="bg-surface-raised rounded-xl shadow-xs border border-border p-6 mb-6">
              <h2 className="text-xl font-bold text-text mb-1">How It's Calculated</h2>
              <p className="text-sm text-text-muted mb-4">Your trust score reflects recent activity — it decays when you're inactive and grows as you engage.</p>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-text">Volume</span>
                    <span className="text-xs text-text-muted">up to 30 pts</span>
                  </div>
                  <p className="text-xs text-text-muted mb-2">Interactions completed in the last 12 months (log-scaled — early exchanges count most)</p>
                  <div className="bg-border-light rounded-full h-2">
                    <div className="bg-primary rounded-full h-2" style={{ width: '30%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-text">Quality</span>
                    <span className="text-xs text-text-muted">up to 25 pts</span>
                  </div>
                  <p className="text-xs text-text-muted mb-2">Recency-weighted feedback ratings — recent feedback counts more than old feedback (6-month half-life)</p>
                  <div className="bg-border-light rounded-full h-2">
                    <div className="bg-success rounded-full h-2" style={{ width: '25%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-text">Depth</span>
                    <span className="text-xs text-text-muted">up to 15 pts</span>
                  </div>
                  <p className="text-xs text-text-muted mb-2">Repeat exchanges with the same people — trust built through ongoing relationships</p>
                  <div className="bg-border-light rounded-full h-2">
                    <div className="bg-accent rounded-full h-2" style={{ width: '15%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-text">Breadth</span>
                    <span className="text-xs text-text-muted">up to 20 pts</span>
                  </div>
                  <p className="text-xs text-text-muted mb-2">Diversity of people and communities you've helped — trust that travels across the network</p>
                  <div className="bg-border-light rounded-full h-2">
                    <div className="bg-karmyq-teal-500 rounded-full h-2" style={{ width: '20%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-text">Engagement Bonus</span>
                    <span className="text-xs text-text-muted">up to 5 pts</span>
                  </div>
                  <p className="text-xs text-text-muted mb-2">Awarded for active participation — showing up consistently matters</p>
                  <div className="bg-border-light rounded-full h-2">
                    <div className="bg-karmyq-orange-500 rounded-full h-2" style={{ width: '5%' }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Per-community breakdown */}
            {communityBreakdown.length > 0 && (
              <div className="bg-surface-raised rounded-xl shadow-xs border border-border p-6 mb-6">
                <h2 className="text-xl font-bold text-text mb-1">Your Communities</h2>
                <p className="text-sm text-text-muted mb-4">Overall score is weighted by recent activity in each community.</p>
                <div className="space-y-3">
                  {communityBreakdown
                    .slice()
                    .sort((a, b) => b.score - a.score)
                    .map((c) => (
                      <div key={c.community_id} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium text-text truncate">{c.community_name}</span>
                            <span className="text-sm font-semibold text-text ml-2 shrink-0">{c.score}/100</span>
                          </div>
                          <div className="bg-border-light rounded-full h-1.5">
                            <div
                              className={`rounded-full h-1.5 ${c.score >= 75 ? 'bg-karmyq-green-500' : c.score >= 50 ? 'bg-karmyq-teal-500' : c.score >= 20 ? 'bg-karmyq-orange-500' : 'bg-karmyq-brown-400'}`}
                              style={{ width: `${c.score}%` }}
                            />
                          </div>
                        </div>
                        {c.recent_interactions > 0 && (
                          <span className="text-xs text-text-muted shrink-0">{c.recent_interactions} recent</span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Tips to Improve */}
            <div className="bg-primary-light rounded-xl border border-primary-medium p-6">
              <h2 className="text-lg font-bold text-primary-dark mb-3">Tips to Improve Your Trust Score</h2>
              <ul className="space-y-2 text-sm text-primary-dark">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">✓</span>
                  <span>Stay active — scores decay when you're not engaging; recent interactions count most</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">✓</span>
                  <span>Build recurring relationships — repeat exchanges with the same people boost your depth score</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">✓</span>
                  <span>Help across communities — interacting with people outside your primary community increases breadth</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">✓</span>
                  <span>Earn consistent feedback — a few high-quality recent ratings outweigh many old ones</span>
                </li>
              </ul>
            </div>

            <p className="text-sm text-text-muted mt-6">
              Manage trust evolution settings on your{' '}
              <a href="/profile" className="text-primary underline">Profile page</a>.
            </p>
          </div>
        </div>
      </Layout>
    </>
  )
}
