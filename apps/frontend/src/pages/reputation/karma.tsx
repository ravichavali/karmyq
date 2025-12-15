import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Layout from '@/components/Layout'
import { reputationService } from '@/lib/api'

export default function KarmaPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [karmaData, setKarmaData] = useState<any>(null)
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
      fetchKarmaData(parsedUser.id)
    }
  }, [router])

  const fetchKarmaData = async (userId: string) => {
    try {
      setLoading(true)
      const karmaRes = await reputationService.getKarma(userId)
      const historyRes = await reputationService.getKarmaHistory(userId, { limit: 20 })

      setKarmaData({
        ...karmaRes.data,
        history: historyRes.data?.karma_history || []
      })
    } catch (err) {
      console.error('Failed to fetch karma data:', err)
    } finally {
      setLoading(false)
    }
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

  return (
    <>
      <Head>
        <title>Karma Points - Karmyq</title>
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
              <h1 className="text-3xl font-bold text-gray-900">Your Karma</h1>
              <p className="text-gray-600 mt-2">
                Track your contribution to the community through karma points
              </p>
            </div>

            {/* Karma Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-6">
              <div className="text-center">
                <div className="text-6xl font-bold text-blue-600 mb-2">
                  {karmaData?.total_karma || 0}
                </div>
                <p className="text-gray-600 text-lg">Total Karma Points</p>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-8 pt-8 border-t border-gray-200">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {karmaData?.karma_from_giving || 0}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">From Helping</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {karmaData?.karma_from_receiving || 0}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">From Receiving</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {karmaData?.bonuses || 0}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">Bonuses</p>
                </div>
              </div>
            </div>

            {/* Karma History */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Activity</h2>

              {karmaData?.history?.length > 0 ? (
                <div className="space-y-3">
                  {karmaData.history.map((record: any, index: number) => (
                    <div key={index} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {record.event_type === 'help_given' ? '🤝 Helped someone' :
                           record.event_type === 'help_received' ? '💙 Received help' :
                           record.event_type === 'bonus' ? '🎉 Milestone bonus' :
                           record.event_type}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(record.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <div className={`text-lg font-bold ${record.points_awarded > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {record.points_awarded > 0 ? '+' : ''}{record.points_awarded}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">📊</div>
                  <p className="text-gray-500">No karma activity yet</p>
                  <p className="text-sm text-gray-400 mt-1">Start helping others to earn karma!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </Layout>
    </>
  )
}
