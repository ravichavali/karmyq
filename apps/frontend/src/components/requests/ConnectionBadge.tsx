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
        return 'bg-success-light text-success border-success hover:bg-success-light'
      case 2:
        return 'bg-primary-light text-primary-dark border-primary-medium hover:bg-primary-light'
      case 3:
        return 'bg-surface text-text-muted border-border hover:bg-border-light'
      default:
        return 'bg-surface text-text-muted border-border'
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
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs font-medium ${getBadgeStyle()} ${
        onClick ? 'cursor-pointer' : 'cursor-default'
      }`}
      title="Click to see connection path"
    >
      <span aria-hidden="true">{getIcon()}</span>
      <span>{getBadgeText()}</span>
    </span>
  )
}
