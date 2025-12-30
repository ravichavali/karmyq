import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { reputationService } from '@/lib/api'

interface Community {
  id: string
  name: string
  role?: string
}

interface LeftSidebarProps {
  user: any
  communities: Community[]
  activeCommunityId?: string
  onCommunityChange?: (communityId: string) => void
}

interface KarmaData {
  total_karma: number
  trust_score: number
  rank?: string
}

export default function LeftSidebar({ user, communities, activeCommunityId, onCommunityChange }: LeftSidebarProps) {
  const router = useRouter()
  const [karmaData, setKarmaData] = useState<KarmaData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchKarma = async () => {
      if (!user?.id) return

      try {
        setLoading(true)
        // TODO: Re-enable when reputation service auth is fixed (See ROADMAP.md Backlog #24)
        // const karmaRes = await reputationService.getKarma(user.id, activeCommunityId)
        // const trustRes = await reputationService.getTrustScore(user.id, activeCommunityId)

        setKarmaData({
          total_karma: 0, // karmaRes.data?.total_karma || 0,
          trust_score: 0, // trustRes.data?.trust_score || 0,
          rank: undefined // karmaRes.data?.rank
        })
      } catch (err) {
        console.error('Failed to fetch karma:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchKarma()
  }, [user?.id, activeCommunityId])

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

  return (
    <div className="space-y-4">
      {/* User Karma Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* User Header */}
        <div className={`bg-gradient-to-br ${getTrustColor(karmaData?.trust_score || 0)} p-4 text-white`}>
          <button
            onClick={() => router.push('/profile')}
            className="flex items-center gap-3 mb-3 w-full text-left hover:opacity-80 transition-opacity"
          >
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-lg font-bold">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{user?.name}</h3>
              <p className="text-sm opacity-90">{getTrustLabel(karmaData?.trust_score || 0)}</p>
            </div>
          </button>

          {/* Trust Score - Clickable */}
          <button
            onClick={() => router.push('/reputation/trust')}
            className="w-full bg-white/10 backdrop-blur-sm rounded-lg p-3 hover:bg-white/20 transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm opacity-90">Trust Score</span>
              <span className="text-lg font-bold">{karmaData?.trust_score || 0}</span>
            </div>
            <div className="bg-white/20 rounded-full h-2">
              <div
                className="bg-white rounded-full h-2 transition-all duration-500"
                style={{ width: `${karmaData?.trust_score || 0}%` }}
              ></div>
            </div>
          </button>
        </div>

        {/* Karma Stats */}
        <div className="p-4 space-y-3">
          {/* Karma Points - Clickable */}
          <button
            onClick={() => router.push('/reputation/karma')}
            className="flex items-center justify-between w-full hover:bg-gray-50 rounded-lg p-2 -mx-2 transition-colors"
          >
            <span className="text-sm text-gray-600">Karma Points</span>
            <span className="text-xl font-bold text-gray-900">{karmaData?.total_karma || 0}</span>
          </button>

          {karmaData?.rank && (
            <div className="flex items-center justify-between px-2">
              <span className="text-sm text-gray-600">Community Rank</span>
              <span className="text-sm font-semibold text-blue-600">{karmaData.rank}</span>
            </div>
          )}
        </div>
      </div>

      {/* Communities */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <button
          onClick={() => router.push('/communities')}
          className="w-full text-left font-semibold text-gray-900 mb-3 hover:text-blue-600 transition-colors"
        >
          Your Communities
        </button>
        <div className="space-y-2">
          {communities.map((community) => {
            const isActive = community.id === activeCommunityId
            return (
              <button
                key={community.id}
                onClick={() => onCommunityChange?.(community.id)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 border-2 border-blue-500'
                    : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{community.name}</p>
                    {community.role && (
                      <p className="text-xs text-gray-500 capitalize">{community.role}</p>
                    )}
                  </div>
                  {isActive && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        <button
          onClick={() => router.push('/communities')}
          className="w-full mt-3 pt-3 border-t border-gray-100 text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          + Join Community
        </button>
      </div>

      {/* Quick Stats */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Your Impact</h3>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600">Requests Made</span>
              <span className="text-sm font-semibold text-gray-900">0</span>
            </div>
            <div className="bg-gray-100 rounded-full h-1.5">
              <div className="bg-blue-500 rounded-full h-1.5" style={{ width: '0%' }}></div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600">Help Given</span>
              <span className="text-sm font-semibold text-gray-900">0</span>
            </div>
            <div className="bg-gray-100 rounded-full h-1.5">
              <div className="bg-green-500 rounded-full h-1.5" style={{ width: '0%' }}></div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600">Exchanges Completed</span>
              <span className="text-sm font-semibold text-gray-900">0</span>
            </div>
            <div className="bg-gray-100 rounded-full h-1.5">
              <div className="bg-purple-500 rounded-full h-1.5" style={{ width: '0%' }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
