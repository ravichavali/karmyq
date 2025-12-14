interface MilestonePostProps {
  id: string
  milestoneType: string
  description: string
  achievedAt: string
  networkStrength: number
  strengthChange: number
  isPinned: boolean
  communityName: string
}

export default function MilestonePost({
  description,
  achievedAt,
  networkStrength,
  strengthChange,
  isPinned,
  communityName
}: MilestonePostProps) {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffHours < 1) return 'just now'
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg shadow-md overflow-hidden border-2 border-purple-200 hover:shadow-lg transition-shadow">
      {isPinned && (
        <div className="bg-purple-600 text-white text-xs font-semibold px-3 py-1 flex items-center gap-1">
          <span>📌</span>
          <span>Pinned Milestone</span>
        </div>
      )}

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-3xl">🎉</span>
              <h3 className="text-lg font-bold text-purple-900">MILESTONE ACHIEVED!</h3>
            </div>
            <p className="text-base text-gray-700">{communityName}</p>
          </div>
          <span className="text-sm text-gray-500">{formatTime(achievedAt)}</span>
        </div>

        {/* Milestone Description */}
        <div className="bg-white rounded-lg p-4 mb-4">
          <p className="text-xl font-semibold text-gray-900 text-center">{description}</p>
        </div>

        {/* Metrics */}
        <div className="bg-white/60 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600 mb-1">Network Strength</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-purple-700">{networkStrength.toFixed(1)}</span>
                <span className="text-sm text-gray-600">/100</span>
                {strengthChange !== 0 && (
                  <span className={`text-sm font-medium ${strengthChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {strengthChange > 0 ? '+' : ''}{strengthChange.toFixed(1)} this week
                  </span>
                )}
              </div>
            </div>
            <div className="text-4xl">
              {networkStrength >= 80 ? '🌟' : networkStrength >= 60 ? '⭐' : networkStrength >= 40 ? '💫' : '✨'}
            </div>
          </div>
        </div>

        {/* Motivational Message */}
        <div className="mt-4 text-center">
          <p className="text-sm italic text-purple-800">
            "Every exchange makes our community stronger. Thank you for being part of this journey!"
          </p>
        </div>
      </div>
    </div>
  )
}
