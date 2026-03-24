import React from 'react'
import Link from 'next/link'
import { useProvider } from '../contexts/ProviderContext'

const ProviderModeSwitcher: React.FC = () => {
  const { hasProviderProfile, providerMode, setProviderMode, loading } = useProvider()

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
    <div className="provider-mode-switcher">
      <button
        onClick={() => setProviderMode('member')}
        className={`mode-btn ${providerMode === 'member' ? 'active' : ''}`}
      >
        Member
      </button>
      <button
        onClick={() => setProviderMode('provider')}
        className={`mode-btn ${providerMode === 'provider' ? 'active' : ''}`}
      >
        Provider
      </button>

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
      `}</style>
    </div>
  )
}

export default ProviderModeSwitcher
