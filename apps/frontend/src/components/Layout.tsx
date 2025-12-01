import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import NotificationBell from './NotificationBell'

interface LayoutProps {
  children: React.ReactNode
  title?: string
}

const Layout: React.FC<LayoutProps> = ({ children, title }) => {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      setUser(JSON.parse(userData))
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/')
  }

  const isAuthPage = router.pathname === '/login' || router.pathname === '/register' || router.pathname === '/'

  return (
    <div className="min-h-screen bg-gray-50">
      {!isAuthPage && (
        <nav className="bg-white shadow sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <Link href="/dashboard" className="text-2xl font-bold text-blue-600 hover:text-blue-700">
                Karmyq
              </Link>

              <div className="flex gap-6 items-center">
                {/* Main Navigation - Simplified */}
                <Link
                  href="/dashboard"
                  className={`px-4 py-2 font-medium rounded-lg transition-all ${
                    router.pathname === '/dashboard'
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  href="/communities"
                  className={`px-4 py-2 font-medium rounded-lg transition-all ${
                    router.pathname.startsWith('/communities')
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Communities
                </Link>

                {user && (
                  <>
                    <div className="border-l border-gray-200 h-8 mx-2"></div>
                    <NotificationBell />

                    {/* User Menu */}
                    <div className="flex items-center gap-3">
                      <Link
                        href="/profile"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                          {user.name?.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-gray-700">{user.name}</span>
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-red-600 transition-colors"
                        title="Logout"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </nav>
      )}

      <main>
        {title && !isAuthPage && (
          <div className="bg-white border-b border-gray-200">
            <div className="container mx-auto px-4 py-6">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.back()}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
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
                <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
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
