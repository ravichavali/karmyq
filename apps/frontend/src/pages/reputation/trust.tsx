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
      fetchTrustData(parsedUser.id)
    }
  }, [router])

  const fetchTrustData = async (userId: string) => {
    try {
      setLoading(true)
      const trustRes = await reputationService.getTrustScore(userId)
      setTrustData(trustRes.data)
    } catch (err) {
      console.error('Failed to fetch trust data:', err)
    } finally {
      setLoading(false)
    }
  }

  const getTrustColor = (score: number) => {
    if (score >= 80) return 'from-emerald-500 to-green-600'
    if (score >= 60) return 'from-blue-500 to-cyan-600'
    if (score >= 40) return 'from-amber-500 to-orange-600'
    return 'from-slate-400 to-gray-500'
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    )
  }

  const score = trustData?.trust_score || 0

  return (
    <>
      <Head>
        <title>Trust Score - Karmyq</title>
      </Head>
      <Layout>
        <div className="min-h-screen bg-gray-50 py-8">
          <div className="container mx-auto px-4 max-w-4xl">
            {/* Header */}
            <div className="mb-6">
              <button
                onClick={() => router.back()}
                className="text-blue-600 hover:text-blue-700 mb-4 flex items-center gap-2"
              >
                ← Back
              </button>
              <h1 className="text-3xl font-bold text-gray-900">Your Trust Score</h1>
              <p className="text-gray-600 mt-2">
                Your trust score reflects your reliability and engagement in the community
              </p>
            </div>

            {/* Trust Score Display */}
            <div className={`bg-gradient-to-br ${getTrustColor(score)} rounded-xl shadow-lg p-8 mb-6 text-white`}>
              <div className="text-center">
                <div className="text-8xl font-bold mb-4">{score}</div>
                <p className="text-2xl font-semibold opacity-90">{getTrustLabel(score)}</p>
                <div className="bg-white/20 rounded-full h-3 mt-6 max-w-md mx-auto">
                  <div
                    className="bg-white rounded-full h-3 transition-all duration-500"
                    style={{ width: `${score}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Trust Score Breakdown */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">How It's Calculated</h2>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Karma Points</span>
                    <span className="text-sm text-gray-600">40%</span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-2">
                    <div className="bg-blue-500 rounded-full h-2" style={{ width: '40%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Exchanges Completed</span>
                    <span className="text-sm text-gray-600">30%</span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-2">
                    <div className="bg-green-500 rounded-full h-2" style={{ width: '30%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Positive Feedback</span>
                    <span className="text-sm text-gray-600">20%</span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-2">
                    <div className="bg-purple-500 rounded-full h-2" style={{ width: '20%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Account Age</span>
                    <span className="text-sm text-gray-600">10%</span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-2">
                    <div className="bg-amber-500 rounded-full h-2" style={{ width: '10%' }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tips to Improve */}
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
              <h2 className="text-lg font-bold text-blue-900 mb-3">💡 Tips to Improve Your Trust Score</h2>
              <ul className="space-y-2 text-sm text-blue-800">
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
