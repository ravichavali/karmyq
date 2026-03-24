import React from 'react'
import { useRouter } from 'next/router'
import { Notification } from '../contexts/NotificationContext'

interface NotificationItemProps {
  notification: Notification
  onMarkAsRead: (id: string) => void
  onDelete: (id: string) => void
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onMarkAsRead,
  onDelete,
}) => {
  const router = useRouter()

  const handleClick = () => {
    if (!notification.read) {
      onMarkAsRead(notification.id)
    }
    if (notification.action_url) {
      router.push(notification.action_url)
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'match_created':
        return '🤝'
      case 'match_accepted':
        return '✅'
      case 'match_completed':
        return '⭐'
      case 'match_cancelled':
        return '❌'
      case 'karma_awarded':
        return '🏅'
      case 'karma_milestone':
        return '🏆'
      case 'new_request':
        return '🆘'
      case 'request_responded':
        return '💬'
      case 'message_received':
        return '💌'
      case 'community_invite':
        return '👥'
      case 'join_request':
        return '🙋'
      case 'norm_proposed':
        return '📜'
      case 'feedback_received':
        return '📝'
      case 'preferred_provider_selected':
        return '🎯'
      case 'match_reminder':
        return '⏰'
      case 'provider_request_matched':
        return '🔧'
      case 'provider_review_received':
        return '📝'
      default:
        return '🔔'
    }
  }

  const getCtaLabel = (type: string): string | null => {
    switch (type) {
      case 'match_created':
        return 'View Offer'
      case 'match_accepted':
        return 'View Details'
      case 'match_completed':
        return 'Rate Helper'
      case 'match_cancelled':
        return 'View Request'
      case 'new_request':
        return 'Offer Help'
      case 'request_responded':
        return 'View Response'
      case 'message_received':
        return 'Reply'
      case 'community_invite':
        return 'View Invite'
      case 'join_request':
        return 'Review'
      case 'feedback_received':
        return 'View Feedback'
      case 'preferred_provider_selected':
        return 'View Request'
      case 'match_reminder':
        return 'View Commitment'
      case 'provider_request_matched':
        return 'View Request'
      case 'provider_review_received':
        return 'View Review'
      default:
        return null
    }
  }

  const ctaLabel = getCtaLabel(notification.type)

  return (
    <div
      className={`notification-item ${!notification.read ? 'unread' : ''}`}
      onClick={handleClick}
    >
      <div className="notification-icon">{getIcon(notification.type)}</div>
      <div className="notification-content">
        <div className="notification-title">{notification.title}</div>
        <div className="notification-body">{notification.body}</div>
        <div className="notification-meta">
          <span className="notification-time">{formatTime(notification.created_at)}</span>
          {ctaLabel && notification.action_url && (
            <button
              className="notification-cta"
              onClick={(e) => {
                e.stopPropagation()
                if (!notification.read) {
                  onMarkAsRead(notification.id)
                }
                router.push(notification.action_url!)
              }}
            >
              {ctaLabel}
            </button>
          )}
        </div>
      </div>
      <div className="notification-actions">
        {!notification.read && (
          <button
            className="mark-read-btn"
            onClick={(e) => {
              e.stopPropagation()
              onMarkAsRead(notification.id)
            }}
            aria-label="Mark as read"
            title="Mark as read"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="8" cy="8" r="4" />
            </svg>
          </button>
        )}
        <button
          className="delete-btn"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(notification.id)
          }}
          aria-label="Delete notification"
          title="Delete"
        >
          ×
        </button>
      </div>

      <style jsx>{`
        .notification-item {
          display: flex;
          gap: 12px;
          padding: 12px 16px;
          border-bottom: 1px solid rgb(var(--color-border-light));
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .notification-item:hover {
          background-color: rgb(var(--color-surface));
        }

        .notification-item.unread {
          background-color: rgb(var(--color-primary-light));
        }

        .notification-item.unread:hover {
          background-color: rgb(var(--color-primary-medium) / 0.3);
        }

        .notification-icon {
          font-size: 24px;
          flex-shrink: 0;
        }

        .notification-content {
          flex: 1;
          min-width: 0;
        }

        .notification-title {
          font-weight: 600;
          font-size: 14px;
          color: rgb(var(--color-text));
          margin-bottom: 4px;
        }

        .notification-body {
          font-size: 13px;
          color: rgb(var(--color-text-muted));
          margin-bottom: 6px;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .notification-meta {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .notification-time {
          font-size: 12px;
          color: rgb(var(--color-text-subtle));
        }

        .notification-cta {
          background: none;
          border: none;
          color: rgb(var(--color-primary));
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          padding: 2px 8px;
          border-radius: 4px;
          transition: background-color 0.2s;
        }

        .notification-cta:hover {
          background-color: rgb(var(--color-primary-light));
        }

        .notification-actions {
          display: flex;
          gap: 4px;
          align-items: flex-start;
          flex-shrink: 0;
        }

        .mark-read-btn,
        .delete-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          color: rgb(var(--color-text-subtle));
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }

        .mark-read-btn:hover {
          color: rgb(var(--color-primary));
        }

        .delete-btn {
          font-size: 20px;
          line-height: 1;
        }

        .delete-btn:hover {
          color: rgb(var(--color-error));
        }
      `}</style>
    </div>
  )
}

export default NotificationItem
