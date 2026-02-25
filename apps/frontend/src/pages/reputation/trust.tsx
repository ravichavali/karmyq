import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Layout from '@/components/Layout'
import { reputationService } from '@/lib/api'

export default function TrustScorePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [trustData, setTrustData] = useState<any>(null)
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
      setUser(parsedUser)
      const communityId = parsedUser.communities?.[0]?.id
      fetchTrustData(parsedUser.id, communityId)
    }
  }, [router])

  const fetchTrustData = async (userId: string, communityId?: string) => {
    try {
      setLoading(true)
      const trustRes = await reputationService.getTrustScore(userId, communityId)
      setTrustData(trustRes.data)
    } catch (err) {
      console.error('Failed to fetch trust data:', err)
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
    if (score >= 80) return 'Trusted'
    if (score >= 60) return 'Reliable'
    if (score >= 40) return 'Building'
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

  const score = trustData?.score || 0

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
            <div className="bg-surface-raised rounded-xl shadow-sm border border-border p-6 mb-6">
              <h2 className="text-xl font-bold text-text mb-4">How It's Calculated</h2>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-text-muted">Karma Points</span>
                    <span className="text-sm text-text-muted">40%</span>
                  </div>
                  <div className="bg-border-light rounded-full h-2">
                    <div className="bg-primary rounded-full h-2" style={{ width: '40%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-text-muted">Exchanges Completed</span>
                    <span className="text-sm text-text-muted">30%</span>
                  </div>
                  <div className="bg-border-light rounded-full h-2">
                    <div className="bg-success-light0 rounded-full h-2" style={{ width: '30%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-text-muted">Positive Feedback</span>
                    <span className="text-sm text-text-muted">20%</span>
                  </div>
                  <div className="bg-border-light rounded-full h-2">
                    <div className="bg-accent rounded-full h-2" style={{ width: '20%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-text-muted">Account Age</span>
                    <span className="text-sm text-text-muted">10%</span>
                  </div>
                  <div className="bg-border-light rounded-full h-2">
                    <div className="bg-karmyq-orange-500 rounded-full h-2" style={{ width: '10%' }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tips to Improve */}
            <div className="bg-primary-light rounded-xl border border-primary-medium p-6">
              <h2 className="text-lg font-bold text-primary-dark mb-3">💡 Tips to Improve Your Trust Score</h2>
              <ul className="space-y-2 text-sm text-primary-dark">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">✓</span>
                  <span>Complete exchanges and mark them as done</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">✓</span>
                  <span>Respond quickly to offers and requests</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">✓</span>
                  <span>Provide clear communication throughout exchanges</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">✓</span>
                  <span>Leave feedback for others after exchanges</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </Layout>
    </>
  )
}
