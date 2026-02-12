import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { useNotifications } from '@/contexts/NotificationContext'
import NotificationItem from '@/components/NotificationItem'
import Layout from '@/components/Layout'

export default function NotificationsPage() {
  const router = useRouter()
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

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
    }
  }, [router])

  const filteredNotifications =
    filter === 'unread'
      ? notifications.filter((n) => !n.read)
      : notifications

  return (
    <>
      <Head>
        <title>Notifications - Karmyq</title>
      </Head>
      <Layout title="Notifications">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-surface-raised rounded-lg shadow-md">
            <div className="p-6 border-b border-border">
              <div className="flex justify-between items-center">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="px-4 py-2 text-sm bg-primary text-white rounded hover:bg-primary-dark"
                  >
                    Mark all as read
                  </button>
                )}
              </div>

              <div className="flex gap-4 mt-4">
                <button
                  className={`px-4 py-2 text-sm rounded ${
                    filter === 'all'
                      ? 'bg-primary text-white'
                      : 'bg-border-light text-text-muted hover:bg-gray-200'
                  }`}
                  onClick={() => setFilter('all')}
                >
                  All ({notifications.length})
                </button>
                <button
                  className={`px-4 py-2 text-sm rounded ${
                    filter === 'unread'
                      ? 'bg-primary text-white'
                      : 'bg-border-light text-text-muted hover:bg-gray-200'
                  }`}
                  onClick={() => setFilter('unread')}
                >
                  Unread ({unreadCount})
                </button>
              </div>
            </div>

            <div>
              {loading && notifications.length === 0 && (
                <div className="p-8 text-center text-text-subtle">Loading notifications...</div>
              )}

              {error && (
                <div className="p-8 text-center text-red-600">{error}</div>
              )}

              {!loading && !error && filteredNotifications.length === 0 && (
                <div className="p-12 text-center">
                  <div className="text-6xl mb-4">🔔</div>
                  <h3 className="text-xl font-semibold text-text-muted mb-2">
                    {filter === 'unread'
                      ? "You're all caught up!"
                      : 'No notifications yet'}
                  </h3>
                  <p className="text-text-subtle">
                    {filter === 'unread'
                      ? 'All your notifications have been read'
                      : "You'll see notifications here when there's activity"}
                  </p>
                </div>
              )}

              {filteredNotifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                  onDelete={deleteNotification}
                />
              ))}
            </div>
          </div>
        </div>
      </Layout>
    </>
  )
}
