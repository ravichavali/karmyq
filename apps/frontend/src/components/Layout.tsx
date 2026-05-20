import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Image from 'next/image'
import NotificationBell from './NotificationBell'
import { useProvider } from '../contexts/ProviderContext'

function HamburgerMenu() {
  const [open, setOpen] = useState(false)
  const { hasProviderProfile, isAvailable, setAvailability } = useProvider()
  return (
    <div className="relative md:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg text-text-muted hover:bg-surface transition-colors"
        aria-label="Open menu"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-48 bg-surface-raised border border-border rounded-xl shadow-lg z-50 py-1">
            <Link href="/communities" className="block px-4 py-2 text-sm text-text hover:bg-surface transition-colors" onClick={() => setOpen(false)}>
              Communities
            </Link>
            {hasProviderProfile ? (
              <Link href="/providers" className="block px-4 py-2 text-sm text-text hover:bg-surface transition-colors" onClick={() => setOpen(false)}>
                Service Providers
              </Link>
            ) : (
              <Link href="/providers/new" className="block px-4 py-2 text-sm text-text hover:bg-surface transition-colors" onClick={() => setOpen(false)}>
                Become a provider
              </Link>
            )}
            <Link href="/profile" className="block px-4 py-2 text-sm text-text hover:bg-surface transition-colors" onClick={() => setOpen(false)}>
              Profile
            </Link>
            {hasProviderProfile && (
              <div className="px-4 py-2 border-t border-border">
                <button
                  onClick={() => { setAvailability(!isAvailable); setOpen(false) }}
                  className="flex items-center gap-2 text-sm w-full"
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: isAvailable ? 'rgb(34 197 94)' : 'rgb(var(--color-text-muted) / 0.4)' }}
                  />
                  <span style={{ color: isAvailable ? 'rgb(22 163 74)' : 'rgb(var(--color-text-muted))' }}>
                    {isAvailable ? 'Available' : 'Off duty'}
                  </span>
                </button>
              </div>
            )}
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
      setUser(JSON.parse(userData))
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    router.push('/')
  }

  const isAuthPage = router.pathname === '/login' || router.pathname === '/register' || router.pathname === '/'

  return (
    <div className="min-h-screen bg-surface">
      {!isAuthPage && (
        <nav className="bg-surface-raised shadow sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <Image src="/brand/karmyq-mark-1level.svg" width={28} height={28} alt="" />
                <span className="text-2xl font-bold font-serif text-primary">Karmyq</span>
              </Link>

              <div className="flex gap-4 items-center">
                {/* Secondary nav — desktop only */}
                <div className="hidden md:flex gap-2 items-center">
                  <Link
                    href="/communities"
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                      router.pathname.startsWith('/communities')
                        ? 'bg-primary-light text-primary'
                        : 'text-text-muted hover:bg-surface'
                    }`}
                  >
                    Communities
                  </Link>
                  {hasProviderProfile ? (
                    <Link
                      href="/providers"
                      className={`px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                        router.pathname.startsWith('/providers')
                          ? 'bg-primary-light text-primary'
                          : 'text-text-muted hover:bg-surface'
                      }`}
                    >
                      Providers
                    </Link>
                  ) : (
                    <Link
                      href="/providers/new"
                      className="px-3 py-2 text-sm font-medium rounded-lg transition-all text-text-muted hover:bg-surface"
                    >
                      Become a provider
                    </Link>
                  )}
                </div>

                {user && (
                  <>
                    <div className="border-l border-border h-8 mx-2"></div>
                    <NotificationBell />
                    {hasProviderProfile && (
                      <button
                        onClick={() => setAvailability(!isAvailable)}
                        className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                          isAvailable
                            ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                            : 'bg-surface border-border text-text-muted hover:bg-surface-raised'
                        }`}
                        title={isAvailable ? 'Click to go off duty' : 'Click to go on duty'}
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isAvailable ? 'bg-green-500' : 'bg-gray-300'}`} />
                        {isAvailable ? 'Available' : 'Off duty'}
                      </button>
                    )}

                    {/* User Menu */}
                    <div className="flex items-center gap-3">
                      <Link
                        href="/profile"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface transition-colors"
                      >
                        <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-white font-semibold text-sm">
                          {user.name?.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-text">{user.name}</span>
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="hidden md:flex px-4 py-2 text-sm font-medium text-text-muted hover:text-error transition-colors"
                        title="Logout"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                      </button>
                    </div>
                    <HamburgerMenu />
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
            <div className="container mx-auto px-4 py-6">
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
                <h1 className="text-3xl font-bold text-text">{title}</h1>
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
