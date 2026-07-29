import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Layout from '@/components/Layout'
import { reputationService } from '@/lib/api'

export default function KarmaPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [karmaData, setKarmaData] = useState<any>(null)
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [activeCommunity, setActiveCommunity] = useState<any>(null)
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
      const community = parsedUser.communities?.[0]
      setActiveCommunity(community)
      fetchKarmaData(parsedUser.id, community?.id)
    }
  }, [router])

  const fetchKarmaData = async (userId: string, communityId?: string) => {
    try {
      setLoading(true)
      const requests: Promise<any>[] = [
        reputationService.getKarma(userId, communityId),
        reputationService.getKarmaHistory(userId, { limit: 20 }, communityId),
      ]
      if (communityId) {
        requests.push(reputationService.getLeaderboard(communityId, { limit: 10 }))
      }

      const [karmaResult, historyResult, leaderboardResult] = await Promise.allSettled(requests)

      const karmaData = karmaResult.status === 'fulfilled' ? karmaResult.value.data : null
      const historyData = historyResult.status === 'fulfilled' ? historyResult.value.data : []
      const leaderboardData = leaderboardResult?.status === 'fulfilled' ? leaderboardResult.value.data : []

      setKarmaData({
        ...(karmaData || {}),
        history: Array.isArray(historyData) ? historyData : [],
      })
      setLeaderboard(Array.isArray(leaderboardData) ? leaderboardData : [])
    } catch (err) {
      console.error('Failed to fetch karma data', { error: err instanceof Error ? err.message : String(err) })
    } finally {
      setLoading(false)
    }
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
        <title>Karma Points - Karmyq</title>
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
              <h1 className="text-3xl font-bold text-text">Your Karma</h1>
              <p className="text-text-muted mt-2">
                Track your contribution to the community through karma points
              </p>
            </div>

            {/* Karma Summary */}
            <div className="bg-surface-raised rounded-xl shadow-xs border border-border p-8 mb-6">
              <div className="text-center">
                <div className="text-6xl font-bold text-primary mb-2">
                  {karmaData?.total_karma || 0}
                </div>
                <p className="text-text-muted text-lg">Total Karma Points</p>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-8 pt-8 border-t border-border">
                <div className="text-center">
                  <div className="text-2xl font-bold text-text">
                    {karmaData?.karma_from_giving || 0}
                  </div>
                  <p className="text-sm text-text-muted mt-1">From Helping</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-text">
                    {karmaData?.karma_from_receiving || 0}
                  </div>
                  <p className="text-sm text-text-muted mt-1">From Receiving</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-text">
                    {karmaData?.bonuses || 0}
                  </div>
                  <p className="text-sm text-text-muted mt-1">Bonuses</p>
                </div>
              </div>
            </div>

            {/* Karma History */}
            <div className="bg-surface-raised rounded-xl shadow-xs border border-border p-6 mb-6">
              <h2 className="text-xl font-bold text-text mb-4">Recent Activity</h2>

              {karmaData?.history?.length > 0 ? (
                <div className="space-y-3">
                  {karmaData.history.map((record: any, index: number) => (
                    <div key={index} className="flex items-center justify-between py-3 border-b border-border-light last:border-0">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-text">
                          {record.reason === 'help_given' ? 'Helped someone' :
                           record.reason === 'help_received' ? 'Received help' :
                           record.reason === 'bonus' ? 'Milestone bonus' :
                           record.reason || 'Karma earned'}
                        </p>
                        <p className="text-xs text-text-subtle mt-1">
                          {new Date(record.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <div className={`text-lg font-bold ${record.points > 0 ? 'text-success' : 'text-red-600'}`}>
                        {record.points > 0 ? '+' : ''}{record.points}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-text-subtle">No karma activity yet</p>
                  <p className="text-sm text-text-subtle mt-1">Start helping others to earn karma!</p>
                </div>
              )}
            </div>

            {/* Community Leaderboard */}
            {leaderboard.length > 0 && (
              <div className="bg-surface-raised rounded-xl shadow-xs border border-border p-6">
                <h2 className="text-xl font-bold text-text mb-1">Community Leaderboard</h2>
                {activeCommunity && (
                  <p className="text-sm text-text-muted mb-4">{activeCommunity.name}</p>
                )}
                <div className="space-y-3">
                  {leaderboard.map((entry: any, i: number) => {
                    const isCurrentUser = entry.user_id === user?.id
                    const medalColors = ['text-yellow-500', 'text-gray-400', 'text-amber-600']
                    const rankBg = i < 3 ? ['bg-yellow-50 border-yellow-200', 'bg-gray-50 border-gray-200', 'bg-amber-50 border-amber-200'][i] : 'bg-surface border-border-light'

                    return (
                      <div
                        key={entry.user_id}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${rankBg} ${isCurrentUser ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                      >
                        <div className={`w-8 text-center font-bold text-lg ${i < 3 ? medalColors[i] : 'text-text-muted'} flex-shrink-0`}>
                          {i < 3 ? ['1st', '2nd', '3rd'][i] : `${i + 1}`}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text truncate">
                            {entry.name}
                            {isCurrentUser && <span className="ml-2 text-xs text-primary font-normal">(you)</span>}
                          </p>
                          <p className="text-xs text-text-subtle">{entry.requests_completed || 0} helps completed</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-bold text-text">{entry.total_karma}</div>
                          <div className="text-xs text-text-subtle">karma</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </Layout>
    </>
  )
}
