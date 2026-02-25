import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { reputationService } from '@/lib/api'

interface Community {
  id: string
  name: string
  role?: string
}

interface User {
  id?: string
  name?: string
  [key: string]: unknown
}

interface LeftSidebarProps {
  user: User
  communities: Community[]
  activeCommunityId?: string
  karmaRefreshKey?: number
}

interface KarmaData {
  total_karma: number
  trust_score: number
  rank?: string
}

export default function LeftSidebar({ user, communities, activeCommunityId, karmaRefreshKey }: LeftSidebarProps) {
  const router = useRouter()
  const [karmaData, setKarmaData] = useState<KarmaData | null>(null)

  useEffect(() => {
    const fetchKarma = async () => {
      if (!user?.id) return

      try {
        const [karmaResult, trustResult] = await Promise.allSettled([
          reputationService.getKarma(user.id, activeCommunityId),
          reputationService.getTrustScore(user.id, activeCommunityId),
        ])
        const karma = karmaResult.status === 'fulfilled' ? karmaResult.value.data : null
        const trust = trustResult.status === 'fulfilled' ? trustResult.value.data : null
        setKarmaData({
          total_karma: karma?.total_karma || 0,
          trust_score: trust?.score ?? 0,
          rank: karma?.rank,
        })
      } catch (err) {
        console.error('Failed to fetch karma:', err)
      }
    }

    fetchKarma()
  }, [user?.id, activeCommunityId, karmaRefreshKey])

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

  return (
    <div className="space-y-4">
      {/* User Karma Card */}
      <div className="bg-surface-raised rounded-xl shadow-sm border border-border overflow-hidden">
        {/* User Header */}
        <div className={`bg-gradient-to-br ${getTrustColor(karmaData?.trust_score || 0)} p-4 text-white`}>
          <button
            onClick={() => router.push('/profile')}
            className="flex items-center gap-3 mb-3 w-full text-left hover:opacity-80 transition-opacity"
          >
            <div className="w-12 h-12 bg-surface-raised/20 backdrop-blur-sm rounded-full flex items-center justify-center text-lg font-bold">
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
            className="w-full bg-surface-raised/10 backdrop-blur-sm rounded-lg p-3 hover:bg-surface-raised/20 transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm opacity-90">Trust Score</span>
              <span className="text-lg font-bold">{karmaData?.trust_score || 0}</span>
            </div>
            <div className="bg-surface-raised/20 rounded-full h-2">
              <div
                className="bg-surface-raised rounded-full h-2 transition-all duration-500"
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
            className="flex items-center justify-between w-full hover:bg-surface rounded-lg p-2 -mx-2 transition-colors"
          >
            <span className="text-sm text-text-muted">Karma Points</span>
            <span className="text-xl font-bold text-text">{karmaData?.total_karma || 0}</span>
          </button>

          {karmaData?.rank && (
            <div className="flex items-center justify-between px-2">
              <span className="text-sm text-text-muted">Community Rank</span>
              <span className="text-sm font-semibold text-primary">{karmaData.rank}</span>
            </div>
          )}
        </div>
      </div>

      {/* Communities */}
      <div className="bg-surface-raised rounded-xl shadow-sm border border-border p-4">
        <button
          onClick={() => router.push('/communities')}
          className="w-full text-left font-semibold text-text mb-3 hover:text-primary transition-colors"
        >
          Your Communities
        </button>
        <div className="space-y-2">
          {communities.map((community) => {
            const isActive = community.id === activeCommunityId
            return (
              <button
                key={community.id}
                onClick={() => router.push(`/communities/${community.id}`)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-light border-2 border-primary'
                    : 'bg-surface border-2 border-transparent hover:bg-border-light'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{community.name}</p>
                    {community.role && (
                      <p className="text-xs text-text-subtle capitalize">{community.role}</p>
                    )}
                  </div>
                  {isActive && (
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        <button
          onClick={() => router.push('/communities')}
          className="w-full mt-3 pt-3 border-t border-border-light text-sm text-primary hover:text-primary-dark font-medium"
        >
          + Join Community
        </button>
      </div>

      {/* Quick Stats */}
      <div className="bg-surface-raised rounded-xl shadow-sm border border-border p-4">
        <h3 className="font-semibold text-text mb-3">Your Impact</h3>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-text-muted">Requests Made</span>
              <span className="text-sm font-semibold text-text">0</span>
            </div>
            <div className="bg-border-light rounded-full h-1.5">
              <div className="bg-primary rounded-full h-1.5" style={{ width: '0%' }}></div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-text-muted">Help Given</span>
              <span className="text-sm font-semibold text-text">0</span>
            </div>
            <div className="bg-border-light rounded-full h-1.5">
              <div className="bg-success-light0 rounded-full h-1.5" style={{ width: '0%' }}></div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-text-muted">Exchanges Completed</span>
              <span className="text-sm font-semibold text-text">0</span>
            </div>
            <div className="bg-border-light rounded-full h-1.5">
              <div className="bg-accent rounded-full h-1.5" style={{ width: '0%' }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
