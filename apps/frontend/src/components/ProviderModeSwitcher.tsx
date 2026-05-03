import React from 'react'
import Link from 'next/link'
import { useProvider } from '../contexts/ProviderContext'

const ProviderModeSwitcher: React.FC = () => {
  const { hasProviderProfile, providerMode, setProviderMode, isAvailable, setAvailability, loading } = useProvider()

  if (loading) return null

  if (!hasProviderProfile) {
    return (
      <Link
        href="/providers/new"
        className="become-provider-link"
        style={{ fontSize: '13px', color: 'rgb(var(--color-text-muted))', textDecoration: 'none' }}
      >
        Become a Provider →
      </Link>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div className="provider-mode-switcher">
        <button
          onClick={() => setProviderMode('member')}
          aria-pressed={providerMode === 'member'}
          aria-label="Switch to Member view"
          className={`mode-btn ${providerMode === 'member' ? 'active' : ''}`}
        >
          Member
        </button>
        <button
          onClick={() => setProviderMode('provider')}
          aria-pressed={providerMode === 'provider'}
          aria-label="Switch to Provider view"
          className={`mode-btn ${providerMode === 'provider' ? 'active' : ''}`}
        >
          Provider
        </button>
      </div>

      {providerMode === 'provider' && (
        <button
          onClick={() => setAvailability(!isAvailable)}
          className={`availability-btn ${isAvailable ? 'on' : 'off'}`}
          aria-label={isAvailable ? 'Go off duty' : 'Go on duty'}
          title={isAvailable ? 'Click to go off duty' : 'Click to go on duty'}
        >
          <span className="dot" />
          {isAvailable ? 'Available' : 'Off duty'}
        </button>
      )}

      <style jsx>{`
        .provider-mode-switcher {
          display: flex;
          align-items: center;
          background: rgb(var(--color-surface));
          border: 1px solid rgb(var(--color-border));
          border-radius: 9999px;
          padding: 2px;
          gap: 0;
        }

        .mode-btn {
          padding: 4px 12px;
          border-radius: 9999px;
          border: none;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.15s, color 0.15s;
          background: transparent;
          color: rgb(var(--color-text-muted));
        }

        .mode-btn:hover {
          color: rgb(var(--color-text));
        }

        .mode-btn.active {
          background: rgb(var(--color-primary));
          color: white;
        }

        .availability-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 9999px;
          border: 1px solid rgb(var(--color-border));
          background: rgb(var(--color-surface));
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.15s, border-color 0.15s, color 0.15s;
          color: rgb(var(--color-text-muted));
        }

        .availability-btn:hover {
          border-color: rgb(var(--color-text-muted));
          color: rgb(var(--color-text));
        }

        .availability-btn.on {
          border-color: rgb(34 197 94 / 0.4);
          color: rgb(22 163 74);
        }

        .availability-btn.on:hover {
          border-color: rgb(22 163 74 / 0.6);
          background: rgb(22 163 74 / 0.05);
        }

        .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
          background: rgb(var(--color-text-muted) / 0.4);
        }

        .availability-btn.on .dot {
          background: rgb(34 197 94);
        }
      `}</style>
    </div>
  )
}

export default ProviderModeSwitcher
