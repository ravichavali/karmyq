import { useEffect, useState } from 'react'

interface RightSidebarProps {
  communityId?: string
}

interface CommunityHealth {
  networkStrength: number
  networkStrengthLabel: string
  totalMatches: number
  activeHelpers: number
  growthRate: number
  trendDirection: 'growing' | 'stable' | 'declining'
}

interface Milestone {
  id: string
  description: string
  achievedAt: string
  isPinned: boolean
}

export default function RightSidebar({ communityId }: RightSidebarProps) {
  const [healthData, setHealthData] = useState<CommunityHealth | null>(null)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      if (!communityId) return

      try {
        setLoading(true)
        // TODO: Re-enable when milestone_events and community_health_metrics tables are created (See ROADMAP.md Backlog #24)
        // const [healthRes, milestonesRes] = await Promise.all([
        //   feedApi.get(`/feed/community-health?community_id=${communityId}`),
        //   feedApi.get(`/feed/milestones?community_id=${communityId}&limit=3`)
        // ])
        //
        // setHealthData(healthRes.data || null)
        // setMilestones(milestonesRes.data || [])
        setHealthData(null) // Temporarily disabled
        setMilestones([]) // Temporarily disabled
      } catch (err) {
        console.error('Failed to fetch sidebar data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [communityId])

  const getStrengthColor = (strength: number) => {
    if (strength >= 80) return 'text-emerald-600 bg-emerald-50 border-emerald-200'
    if (strength >= 60) return 'text-green-600 bg-green-50 border-green-200'
    if (strength >= 40) return 'text-amber-600 bg-amber-50 border-amber-200'
    if (strength >= 20) return 'text-orange-600 bg-orange-50 border-orange-200'
    return 'text-gray-600 bg-gray-50 border-gray-200'
  }

  const getTrendIcon = (direction: string) => {
    if (direction === 'growing') return '↗️'
    if (direction === 'declining') return '↘️'
    return '→'
  }

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffDays === 0) return 'today'
    if (diffDays === 1) return 'yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
    return `${Math.floor(diffDays / 30)}mo ago`
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 animate-pulse">
          <div className="h-24 bg-gray-100 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Community Health Compact */}
      {healthData && (
        <div className={`rounded-xl shadow-sm border-2 p-4 ${getStrengthColor(healthData.networkStrength)}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Community Health</h3>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-white/50">
              {healthData.networkStrengthLabel}
            </span>
          </div>

          {/* Network Strength */}
          <div className="mb-3">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-bold">{healthData.networkStrength.toFixed(0)}</span>
              <span className="text-sm opacity-75">/100</span>
            </div>
            <div className="bg-white/30 rounded-full h-2">
              <div
                className="bg-current rounded-full h-2 transition-all duration-500"
                style={{ width: `${healthData.networkStrength}%` }}
              ></div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <div className="opacity-75 text-xs">Exchanges</div>
              <div className="font-semibold">{healthData.totalMatches}</div>
            </div>
            <div>
              <div className="opacity-75 text-xs">Active Helpers</div>
              <div className="font-semibold">{healthData.activeHelpers}</div>
            </div>
            <div className="col-span-2">
              <div className="opacity-75 text-xs">Growth</div>
              <div className="font-semibold">
                {getTrendIcon(healthData.trendDirection)} {healthData.growthRate > 0 ? '+' : ''}
                {healthData.growthRate.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Milestones */}
      {milestones.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h3 className="font-semibold text-sm text-gray-900 mb-3">Recent Milestones</h3>
          <div className="space-y-2">
            {milestones.map((milestone) => (
              <div key={milestone.id} className="text-sm">
                <div className="flex items-start gap-2">
                  {milestone.isPinned && <span className="text-xs">📌</span>}
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 leading-snug">{milestone.description}</p>
                    <p className="text-xs text-gray-500 mt-1">{formatTimeAgo(milestone.achievedAt)}</p>
                  </div>
                </div>
                {milestone !== milestones[milestones.length - 1] && (
                  <div className="border-b border-gray-100 mt-2"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trending Helpers */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h3 className="font-semibold text-sm text-gray-900 mb-3">Top Helpers This Week</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                {i}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-400 truncate">Coming soon...</p>
                <p className="text-xs text-gray-400">0 helps</p>
              </div>
              <div className="text-xs font-semibold text-gray-400">0</div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Now */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h3 className="font-semibold text-sm text-gray-900 mb-3">Active Now</h3>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="flex -space-x-2">
            <div className="w-6 h-6 bg-gradient-to-br from-blue-400 to-purple-600 rounded-full border-2 border-white"></div>
            <div className="w-6 h-6 bg-gradient-to-br from-green-400 to-teal-600 rounded-full border-2 border-white"></div>
            <div className="w-6 h-6 bg-gradient-to-br from-amber-400 to-orange-600 rounded-full border-2 border-white"></div>
          </div>
          <span className="text-gray-500">and more...</span>
        </div>
      </div>

      {/* Footer Links */}
      <div className="px-4 py-3 text-xs text-gray-500 space-y-1">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <a href="#" className="hover:underline">About</a>
          <a href="#" className="hover:underline">Help</a>
          <a href="#" className="hover:underline">Terms</a>
          <a href="#" className="hover:underline">Privacy</a>
        </div>
        <p className="text-gray-400">© 2025 Karmyq</p>
      </div>
    </div>
  )
}
