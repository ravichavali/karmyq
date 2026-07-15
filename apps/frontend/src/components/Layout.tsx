import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import NotificationBell from './NotificationBell'
import { useProvider } from '../contexts/ProviderContext'
import { clearAuthSession } from '../lib/session'

interface AppMenuProps {
  onLogout: () => void
}

function AppMenu({ onLogout }: AppMenuProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { hasProviderProfile, providerProfiles } = useProvider()
  const myProviderId = providerProfiles[0]?.id
  const close = () => setOpen(false)

  // Sprint 119 (header lever 2): this overflow is now the one home for Communities + the
  // provider links at every viewport (it was xl:hidden while kq-topnav duplicated them at xl);
  // My Network also keeps its topnav slot. SECTION items carry the active-route emphasis the
  // topnav links used to; action items (Manage my profile, Become a provider) don't claim one.
  const plainItemClass = 'block px-4 py-2 text-sm transition-colors hover:bg-surface text-text'
  const itemClass = (activePrefix: string) =>
    router.pathname.startsWith(activePrefix)
      ? 'block px-4 py-2 text-sm transition-colors hover:bg-surface font-semibold text-primary-dark'
      : plainItemClass

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="app-overflow-menu"
        className="p-2 rounded-lg text-text-muted hover:bg-surface transition-colors"
        aria-label={open ? 'Close menu' : 'Open menu'}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div
            id="app-overflow-menu"
            className="absolute right-0 mt-1 w-56 bg-surface-raised border border-border rounded-lg shadow-lg z-50 py-1"
          >
            <Link href="/network" className={itemClass('/network')} onClick={close}>
              My Network
            </Link>
            <Link href="/communities" className={itemClass('/communities')} onClick={close}>
              Communities
            </Link>
            {hasProviderProfile ? (
              <>
                <Link href="/providers" className={itemClass('/providers')} onClick={close}>
                  Service Providers
                </Link>
                {myProviderId && (
                  <Link href={`/providers/${myProviderId}`} className={plainItemClass} onClick={close}>
                    Manage my profile
                  </Link>
                )}
              </>
            ) : (
              <Link href="/providers/new" className={plainItemClass} onClick={close}>
                Become a provider
              </Link>
            )}
            <Link href="/profile" className={itemClass('/profile')} onClick={close}>
              Profile
            </Link>
            <button
              type="button"
              onClick={() => {
                close()
                onLogout()
              }}
              className="block w-full px-4 py-2 text-left text-sm text-text hover:bg-surface transition-colors"
            >
              Logout
            </button>
          </div>
        </>
      )}
    </div>
  )
}

interface LayoutProps {
  children: React.ReactNode
  title?: string
}

interface User {
  id: string
  name?: string
  [key: string]: unknown
}

const Layout: React.FC<LayoutProps> = ({ children, title }) => {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const { hasProviderProfile, isAvailable, setAvailability } = useProvider()

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      try {
        setUser(JSON.parse(userData))
      } catch {
        localStorage.removeItem('user')
      }
    }
  }, [])

  const handleLogout = () => {
    clearAuthSession()
    router.push('/')
  }

  const isAuthPage = router.pathname === '/login' || router.pathname === '/register' || router.pathname === '/'

  return (
    <div className="min-h-screen bg-surface">
      {!isAuthPage && (
        <nav className="kq-topbar">
          <div className="kq-chrome-page py-4">
            <div className="flex justify-between items-center">
              <Link href="/dashboard" className="kq-wordmark">
                <span className="kq-wordmark-seed" aria-hidden="true" />
                Karmyq
              </Link>

              {/* BUG-016: a calmer rhythm — the nav and the action cluster get their own breathing
                  room (gap grows with viewport) so the row never crowds at narrower desktop widths. */}
              <div className="flex items-center gap-3 md:gap-5">
                {/* Secondary nav — desktop only (xl:flex, BUG-016/017 chrome budget). The wordmark
                    links Home, so no redundant Home link. My Network keeps the one topnav slot
                    (Scale 1 of the belonging fractal — you + your first-degree); Sprint 119
                    (header lever 2) moved Communities + the provider links into the overflow
                    menu, their one home at every viewport. */}
                <div className="kq-topnav">
                  <Link
                    href="/network"
                    className={`kq-topnav-link ${router.pathname.startsWith('/network') ? 'active' : ''}`}
                  >
                    My Network
                  </Link>
                </div>

                {user && (
                  <>
                    <div className="hidden md:block border-l border-border h-8 mx-2"></div>
                    <NotificationBell />
                    {/* Single source of truth for availability — the clickable On duty/Off duty
                        toggle, shown on every viewport (replaces the redundant dashboard pill). */}
                    {hasProviderProfile && (
                      <button
                        onClick={() => setAvailability(!isAvailable)}
                        aria-pressed={isAvailable}
                        aria-label={isAvailable ? 'On duty' : 'Off duty'}
                        className={`flex items-center justify-center md:gap-1.5 px-2 md:px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                          isAvailable
                            ? 'bg-success-light border-success text-success hover:bg-success-light'
                            : 'bg-surface border-border text-text-muted hover:bg-surface-raised'
                        }`}
                        title={isAvailable ? 'Click to go off duty' : 'Click to go on duty'}
                      >
                        {/* Dot-only below md so the provider topbar fits on 320–375px phones;
                            the full label returns at md+. aria-label carries the state either way. */}
                        <span aria-hidden="true" className={`w-2 h-2 rounded-full flex-shrink-0 ${isAvailable ? 'bg-success' : 'bg-border'}`} />
                        <span className="hidden md:inline">{isAvailable ? 'On duty' : 'Off duty'}</span>
                      </button>
                    )}

                    {/* User Menu */}
                    <div className="flex items-center gap-3">
                      <Link
                        href="/profile"
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface"
                      >
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-semibold text-sm">
                          {user.name?.charAt(0).toUpperCase()}
                        </div>
                        {/* BUG-016: the name label defers to larger viewports so the busy provider
                            topbar (nav + bell + availability + avatar) doesn't crowd at md widths. */}
                        <span className="hidden lg:inline max-w-[14ch] truncate text-sm font-medium text-text">{user.name}</span>
                      </Link>
                      <button
                        onClick={handleLogout}
                        aria-label="Logout"
                        className="hidden xl:flex px-4 py-2 text-sm font-medium text-text-muted hover:text-error transition-colors"
                        title="Logout"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                      </button>
                    </div>
                    <AppMenu onLogout={handleLogout} />
                  </>
                )}
              </div>
            </div>
          </div>
        </nav>
      )}

      <main>
        {title && !isAuthPage && (
          <div className="bg-surface-raised border-b border-border">
            <div className="kq-page py-5">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.back()}
                  className="p-2 hover:bg-border-light rounded-full transition-colors"
                  aria-label="Go back"
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
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                </button>
                <h1 className="kq-headline-sm">{title}</h1>
              </div>
            </div>
          </div>
        )}
        {children}
      </main>
    </div>
  )
}

export default Layout
