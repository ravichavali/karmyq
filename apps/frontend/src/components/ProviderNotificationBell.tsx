import React, { useState, useRef, useEffect } from 'react'
import { useNotifications } from '../contexts/NotificationContext'
import { useProvider } from '../contexts/ProviderContext'
import NotificationDropdown from './NotificationDropdown'

const ProviderNotificationBell: React.FC = () => {
  const { providerNotifications, providerUnreadCount } = useNotifications()
  const { hasProviderProfile, providerMode } = useProvider()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  if (!hasProviderProfile || providerMode !== 'provider') return null

  return (
    <div className="provider-bell-container" ref={dropdownRef}>
      <button
        className="provider-bell-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Provider notifications"
      >
        {/* Briefcase SVG */}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
        {providerUnreadCount > 0 && (
          <span className="provider-badge">{providerUnreadCount > 99 ? '99+' : providerUnreadCount}</span>
        )}
      </button>

      {isOpen && (
        <NotificationDropdown
          onClose={() => setIsOpen(false)}
          notifications={providerNotifications}
        />
      )}

      <style jsx>{`
        .provider-bell-container {
          position: relative;
          display: inline-block;
        }
        .provider-bell-button {
          position: relative;
          background: none;
          border: none;
          cursor: pointer;
          padding: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgb(var(--color-text));
          transition: color 0.2s;
        }
        .provider-bell-button:hover {
          color: rgb(var(--color-primary));
        }
        .provider-badge {
          position: absolute;
          top: 4px;
          right: 4px;
          background: #f59e0b;
          color: white;
          border-radius: 10px;
          padding: 2px 6px;
          font-size: 11px;
          font-weight: bold;
          min-width: 18px;
          text-align: center;
        }
      `}</style>
    </div>
  )
}

export default ProviderNotificationBell
