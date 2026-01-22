import { useState, useEffect } from 'react'
import { socialGraphClient, TrustPath } from '@/lib/socialGraphClient'

interface ConnectionBadgeProps {
  requesterId: string
  onClick?: () => void
}

/**
 * ConnectionBadge displays how the current user is connected to a requester
 * through the invitation graph (1°, 2°, or 3° connections)
 *
 * - 1°: "Direct connection" (green badge)
 * - 2°: "Connected through Name" (blue badge)
 * - 3°: "Connected through 2 people" (gray badge)
 * - null: No badge shown (4+ degrees or unconnected)
 */
export default function ConnectionBadge({ requesterId, onClick }: ConnectionBadgeProps) {
  const [path, setPath] = useState<TrustPath | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchPath() {
      setLoading(true)
      const pathData = await socialGraphClient.getPath(requesterId)
      setPath(pathData)
      setLoading(false)
    }

    fetchPath()
  }, [requesterId])

  // Don't show badge while loading
  if (loading) {
    return null
  }

  // Don't show badge if no connection or 4+ degrees
  if (!path || !path.degrees_of_separation || path.degrees_of_separation > 3) {
    return null
  }

  const degrees = path.degrees_of_separation

  // Get badge style based on connection degree
  const getBadgeStyle = () => {
    switch (degrees) {
      case 1:
        return 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
      case 2:
        return 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
      case 3:
        return 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  // Get badge text
  const getBadgeText = () => {
    switch (degrees) {
      case 1:
        return 'Direct connection'
      case 2:
        // Show name of intermediary
        if (path.path && path.path.length >= 2) {
          const intermediary = path.path[1]
          return `Connected through ${intermediary.name}`
        }
        return 'Connected through 1 person'
      case 3:
        return 'Connected through 2 people'
      default:
        return ''
    }
  }

  // Get icon
  const getIcon = () => {
    switch (degrees) {
      case 1:
        return '🔗'
      case 2:
        return '🤝'
      case 3:
        return '👥'
      default:
        return '🔗'
    }
  }

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${getBadgeStyle()} ${
        onClick ? 'cursor-pointer' : 'cursor-default'
      }`}
      title="Click to see connection path"
    >
      <span className="text-base" aria-hidden="true">
        {getIcon()}
      </span>
      <span>{getBadgeText()}</span>
    </button>
  )
}
