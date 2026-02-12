import React, { useState } from 'react'
import Link from 'next/link'
import { useNotifications } from '../contexts/NotificationContext'
import NotificationItem from './NotificationItem'

interface NotificationDropdownProps {
  onClose: () => void
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ onClose }) => {
  const {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications()

  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const filteredNotifications =
    filter === 'unread'
      ? notifications.filter((n) => !n.read)
      : notifications

  const handleMarkAllAsRead = async () => {
    await markAllAsRead()
  }

  return (
    <div className="notification-dropdown">
      <div className="notification-header">
        <h3>Notifications</h3>
        {unreadCount > 0 && (
          <button className="mark-all-read-btn" onClick={handleMarkAllAsRead}>
            Mark all as read
          </button>
        )}
      </div>

      <div className="notification-filters">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({notifications.length})
        </button>
        <button
          className={`filter-btn ${filter === 'unread' ? 'active' : ''}`}
          onClick={() => setFilter('unread')}
        >
          Unread ({unreadCount})
        </button>
      </div>

      <div className="notification-list">
        {loading && notifications.length === 0 && (
          <div className="notification-empty">Loading...</div>
        )}

        {error && (
          <div className="notification-error">{error}</div>
        )}

        {!loading && !error && filteredNotifications.length === 0 && (
          <div className="notification-empty">
            {filter === 'unread'
              ? "You're all caught up!"
              : 'No notifications yet'}
          </div>
        )}

        {filteredNotifications.map((notification) => (
          <div key={notification.id} onClick={onClose}>
            <NotificationItem
              notification={notification}
              onMarkAsRead={markAsRead}
              onDelete={deleteNotification}
            />
          </div>
        ))}
      </div>

      <div className="notification-footer">
        <Link href="/notifications" className="view-all-link">
          View all notifications
        </Link>
      </div>

      <style jsx>{`
        .notification-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 400px;
          max-width: 90vw;
          background: white;
          border: 1px solid rgb(var(--color-border));
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          overflow: hidden;
        }

        .notification-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid rgb(var(--color-border-light));
        }

        .notification-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: rgb(var(--color-text));
        }

        .mark-all-read-btn {
          background: none;
          border: none;
          color: rgb(var(--color-primary));
          font-size: 13px;
          cursor: pointer;
          padding: 4px 8px;
          transition: opacity 0.2s;
        }

        .mark-all-read-btn:hover {
          opacity: 0.8;
        }

        .notification-filters {
          display: flex;
          gap: 8px;
          padding: 12px 16px;
          border-bottom: 1px solid rgb(var(--color-border-light));
        }

        .filter-btn {
          background: none;
          border: none;
          padding: 6px 12px;
          font-size: 13px;
          cursor: pointer;
          border-radius: 16px;
          transition: background-color 0.2s;
          color: rgb(var(--color-text-muted));
        }

        .filter-btn:hover {
          background-color: rgb(var(--color-border-light));
        }

        .filter-btn.active {
          background-color: rgb(var(--color-primary));
          color: white;
        }

        .notification-list {
          max-height: 400px;
          overflow-y: auto;
        }

        .notification-empty {
          padding: 40px 20px;
          text-align: center;
          color: rgb(var(--color-text-subtle));
          font-size: 14px;
        }

        .notification-error {
          padding: 20px;
          text-align: center;
          color: rgb(var(--color-error));
          font-size: 13px;
        }

        .notification-footer {
          padding: 12px 16px;
          border-top: 1px solid rgb(var(--color-border-light));
          text-align: center;
        }

        .view-all-link {
          color: rgb(var(--color-primary));
          text-decoration: none;
          font-size: 13px;
          font-weight: 500;
        }

        .view-all-link:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  )
}

export default NotificationDropdown
