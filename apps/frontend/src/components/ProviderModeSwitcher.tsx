import React, { useState } from 'react'
import Link from 'next/link'
import { useProvider } from '../contexts/ProviderContext'

const ProviderModeSwitcher: React.FC = () => {
  const { hasProviderProfile, providerMode, setProviderMode, loading } = useProvider()
  const [showConfirm, setShowConfirm] = useState(false)

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

  const handleMemberClick = () => {
    if (providerMode === 'provider') {
      setShowConfirm(true)
    } else {
      setProviderMode('member')
    }
  }

  const confirmOffDuty = () => {
    setShowConfirm(false)
    setProviderMode('member')
  }

  return (
    <div>
      <div className="provider-mode-switcher">
        <button
          onClick={handleMemberClick}
          aria-pressed={providerMode === 'member'}
          aria-label="Switch to Member mode"
          className={`mode-btn ${providerMode === 'member' ? 'active' : ''}`}
        >
          Member
        </button>
        <button
          onClick={() => setProviderMode('provider')}
          aria-pressed={providerMode === 'provider'}
          aria-label="Switch to Provider mode"
          className={`mode-btn ${providerMode === 'provider' ? 'active' : ''}`}
        >
          Provider
        </button>
      </div>

      {showConfirm && (
        <div className="off-duty-confirm" style={{ marginTop: 8, fontSize: 12, color: 'rgb(var(--color-text-muted))' }}>
          <p style={{ margin: '0 0 6px' }}>
            Active commitments won&apos;t be affected — you&apos;ll still fulfil them off-duty.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={confirmOffDuty} className="mode-btn" style={{ background: 'rgb(var(--color-primary))', color: 'white', padding: '3px 10px', fontSize: 12 }}>
              Go off-duty
            </button>
            <button onClick={() => setShowConfirm(false)} className="mode-btn" style={{ padding: '3px 10px', fontSize: 12 }}>
              Stay on
            </button>
          </div>
        </div>
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
      `}</style>
    </div>
  )
}

export default ProviderModeSwitcher

