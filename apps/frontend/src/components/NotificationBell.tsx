import React, { useState, useRef, useEffect } from 'react'
import { useNotifications } from '../contexts/NotificationContext'
import NotificationDropdown from './NotificationDropdown'

const NotificationBell: React.FC = () => {
  const { communityUnreadCount } = useNotifications()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const ariaLabel = communityUnreadCount > 0 ? 'Notifications, unread' : 'Notifications'

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      <button
        className="notification-bell-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={ariaLabel}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {communityUnreadCount > 0 && (
          <span className="notification-dot" aria-hidden="true" />
        )}
      </button>

      {isOpen && <NotificationDropdown onClose={() => setIsOpen(false)} />}

      <style jsx>{`
        .notification-bell-container {
          position: relative;
          display: inline-block;
        }

        .notification-bell-button {
          position: relative;
          background: none;
          border: none;
          cursor: pointer;
          padding: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgb(var(--color-text-muted));
          transition: color 0.2s;
        }

        .notification-bell-button:hover {
          color: rgb(var(--color-primary));
        }

        .notification-dot {
          position: absolute;
          top: 7px;
          right: 7px;
          width: 7px;
          height: 7px;
          background: rgb(var(--color-warn));
          border: 1.5px solid rgb(var(--color-surface-raised));
          border-radius: 9999px;
        }
      `}</style>
    </div>
  )
}

export default NotificationBell
