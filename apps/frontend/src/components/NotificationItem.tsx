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
      case 'match_completed':
        return '✅'
      case 'karma_awarded':
        return '⭐'
      case 'karma_milestone':
        return '🎉'
      case 'new_request':
        return '🆘'
      case 'request_responded':
        return '💬'
      case 'message_received':
        return '💌'
      case 'community_invite':
        return '👥'
      case 'norm_proposed':
        return '📜'
      case 'feedback_received':
        return '📝'
      default:
        return '🔔'
    }
  }

  return (
    <div
      className={`notification-item ${!notification.read ? 'unread' : ''}`}
      onClick={handleClick}
    >
      <div className="notification-icon">{getIcon(notification.type)}</div>
      <div className="notification-content">
        <div className="notification-title">{notification.title}</div>
        <div className="notification-body">{notification.body}</div>
        <div className="notification-time">{formatTime(notification.created_at)}</div>
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
          border-bottom: 1px solid #eee;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .notification-item:hover {
          background-color: #f8f9fa;
        }

        .notification-item.unread {
          background-color: #f0f7ff;
        }

        .notification-item.unread:hover {
          background-color: #e6f2ff;
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
          color: #1a1a1a;
          margin-bottom: 4px;
        }

        .notification-body {
          font-size: 13px;
          color: #666;
          margin-bottom: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .notification-time {
          font-size: 12px;
          color: #999;
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
          color: #999;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }

        .mark-read-btn:hover {
          color: #0070f3;
        }

        .delete-btn {
          font-size: 20px;
          line-height: 1;
        }

        .delete-btn:hover {
          color: #ff4444;
        }
      `}</style>
    </div>
  )
}

export default NotificationItem
