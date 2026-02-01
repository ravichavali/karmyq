import { useEffect, useState } from 'react'
import { feedApi } from '@/lib/api'

interface CommunityHealthData {
  communityId: string
  communityName: string
  networkStrength: number
  networkStrengthLabel: string
  totalMatches: number
  activeHelpers: number
  growthRate: number
  trendDirection: 'growing' | 'stable' | 'declining'
}

interface CommunityHealthHeroProps {
  communityId?: string
}

export default function CommunityHealthHero({ communityId }: CommunityHealthHeroProps) {
  const [healthData, setHealthData] = useState<CommunityHealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!communityId) {
      setLoading(false)
      return
    }

    const fetchHealthData = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await feedApi.get(`/feed/community-health?community_id=${communityId}`)
        setHealthData(response.data.data)
      } catch (err) {
        console.error('Failed to fetch community health:', err)
        const error = err as { response?: { data?: { message?: string } } }
        setError(error.response?.data?.message || 'Failed to load community health')
      } finally {
        setLoading(false)
      }
    }

    fetchHealthData()

    // Poll every 5 minutes for updates
    const interval = setInterval(fetchHealthData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [communityId])

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg p-6 mb-6 animate-pulse">
        <div className="h-24"></div>
      </div>
    )
  }

  if (error || !healthData) {
    return null // Silently hide if no data
  }

  // Determine color based on network strength
  const getStrengthColor = (strength: number) => {
    if (strength >= 80) return { bg: 'from-emerald-500 to-green-600', text: 'text-emerald-100', badge: 'bg-emerald-400' }
    if (strength >= 60) return { bg: 'from-green-500 to-teal-600', text: 'text-green-100', badge: 'bg-green-400' }
    if (strength >= 40) return { bg: 'from-amber-500 to-orange-600', text: 'text-amber-100', badge: 'bg-amber-400' }
    if (strength >= 20) return { bg: 'from-orange-400 to-red-500', text: 'text-orange-100', badge: 'bg-orange-400' }
    return { bg: 'from-slate-400 to-gray-500', text: 'text-slate-100', badge: 'bg-slate-400' }
  }

  const getTrendIcon = (direction: string) => {
    if (direction === 'growing') return '↗️'
    if (direction === 'declining') return '↘️'
    return '→'
  }

  const colors = getStrengthColor(healthData.networkStrength)

  return (
    <div className={`bg-gradient-to-br ${colors.bg} rounded-xl shadow-lg p-6 mb-6 text-white`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">{healthData.communityName}</h2>
          <p className={`text-sm ${colors.text} mt-1`}>Community Health</p>
        </div>
        <div className={`px-3 py-1 ${colors.badge} rounded-full text-sm font-semibold text-white`}>
          {healthData.networkStrengthLabel}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Network Strength */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
          <div className="text-sm opacity-90 mb-1">Network Strength</div>
          <div className="flex items-baseline gap-2">
            <div className="text-4xl font-bold">{healthData.networkStrength.toFixed(1)}</div>
            <div className="text-lg opacity-75">/100</div>
          </div>
          <div className="mt-2 bg-white/20 rounded-full h-2">
            <div
              className="bg-white rounded-full h-2 transition-all duration-500"
              style={{ width: `${healthData.networkStrength}%` }}
            ></div>
          </div>
        </div>

        {/* Activity This Week */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
          <div className="text-sm opacity-90 mb-1">Active This Week</div>
          <div className="text-2xl font-bold">{healthData.totalMatches} exchanges</div>
          <div className="text-sm opacity-90 mt-1">{healthData.activeHelpers} helpers</div>
        </div>

        {/* Growth Trend */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
          <div className="text-sm opacity-90 mb-1">Growth Trend</div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-bold">
              {getTrendIcon(healthData.trendDirection)} {healthData.growthRate > 0 ? '+' : ''}
              {healthData.growthRate.toFixed(1)}%
            </div>
          </div>
          <div className="text-sm opacity-90 mt-1">7-day change</div>
        </div>
      </div>

      {/* Motivational Message */}
      {healthData.networkStrength >= 70 && (
        <div className="mt-4 bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
          <p className="text-sm">
            🎉 Your community is thriving! Keep up the great work helping each other.
          </p>
        </div>
      )}
      {healthData.networkStrength >= 40 && healthData.networkStrength < 70 && (
        <div className="mt-4 bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
          <p className="text-sm">
            💪 Your community is building momentum. Every exchange makes it stronger!
          </p>
        </div>
      )}
      {healthData.networkStrength < 40 && (
        <div className="mt-4 bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
          <p className="text-sm">
            🌱 Your community is just getting started. Be one of the first to help!
          </p>
        </div>
      )}
    </div>
  )
}
