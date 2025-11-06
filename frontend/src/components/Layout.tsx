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

              <div className="flex gap-4 items-center">
                <Link href="/dashboard" className="px-3 py-2 text-gray-700 hover:text-blue-600 transition-colors">
                  Dashboard
                </Link>
                <Link href="/communities" className="px-3 py-2 text-gray-700 hover:text-blue-600 transition-colors">
                  Communities
                </Link>
                <Link href="/requests" className="px-3 py-2 text-gray-700 hover:text-blue-600 transition-colors">
                  Requests
                </Link>
                <Link href="/offers" className="px-3 py-2 text-gray-700 hover:text-blue-600 transition-colors">
                  Offers
                </Link>
                <Link href="/messages" className="px-3 py-2 text-gray-700 hover:text-blue-600 transition-colors">
                  Messages
                </Link>

                {user && (
                  <>
                    <NotificationBell />
                    <div className="border-l border-gray-300 h-6 mx-2"></div>
                    <Link href="/profile" className="text-sm text-gray-600 hover:text-blue-600 transition-colors">
                      Hi, {user.name}
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                    >
                      Logout
                    </button>
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
