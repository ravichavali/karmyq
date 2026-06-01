import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react'
import { notificationService } from '../lib/api'
import { PROVIDER_NOTIFICATION_TYPES } from '../lib/notificationCategories'

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  data: any
  read: boolean
  action_url: string | null
  created_at: string
  read_at: string | null
}

interface NotificationContextValue {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  error: string | null
  fetchNotifications: () => Promise<void>
  markAsRead: (notificationId: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (notificationId: string) => Promise<void>
  connectSSE: () => void
  disconnectSSE: () => void
  providerNotifications: Notification[]
  communityNotifications: Notification[]
  providerUnreadCount: number
  communityUnreadCount: number
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined)

interface NotificationProviderProps {
  children: ReactNode
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [eventSource, setEventSource] = useState<EventSource | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  // Get user from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user')
      if (userStr) {
        try {
          const user = JSON.parse(userStr)
          setUserId(user.id)
        } catch (e) {
          console.error('Failed to parse user', { error: e instanceof Error ? e.message : String(e) })
        }
      }
    }
  }, [])

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!userId) return

    setLoading(true)
    setError(null)

    try {
      const [notificationsRes, unreadCountRes] = await Promise.all([
        notificationService.getNotifications(userId, { limit: 50 }),
        notificationService.getUnreadCount(userId),
      ])

      setNotifications(notificationsRes.data?.notifications || [])
      setUnreadCount(unreadCountRes.data?.count || 0)
    } catch (err: any) {
      console.error('Failed to fetch notifications', { error: err instanceof Error ? err.message : String(err) })
      setError(err.message || 'Failed to fetch notifications')
      // Set empty state on error
      setNotifications([])
      setUnreadCount(0)
    } finally {
      setLoading(false)
    }
  }, [userId])

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!userId) return

    try {
      await notificationService.markAsRead(notificationId, userId)

      // Update local state
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read: true, read_at: new Date().toISOString() } : n
        )
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err: any) {
      console.error('Failed to mark notification as read', { error: err instanceof Error ? err.message : String(err) })
      setError(err.message || 'Failed to mark notification as read')
    }
  }, [userId])

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!userId) return

    try {
      await notificationService.markAllAsRead(userId)

      // Update local state
      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true, read_at: new Date().toISOString() }))
      )
      setUnreadCount(0)
    } catch (err: any) {
      console.error('Failed to mark all as read', { error: err instanceof Error ? err.message : String(err) })
      setError(err.message || 'Failed to mark all as read')
    }
  }, [userId])

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!userId) return

    try {
      await notificationService.deleteNotification(notificationId, userId)

      // Update local state
      const notification = notifications.find(n => n.id === notificationId)
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      if (notification && !notification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (err: any) {
      console.error('Failed to delete notification', { error: err instanceof Error ? err.message : String(err) })
      setError(err.message || 'Failed to delete notification')
    }
  }, [userId, notifications])

  // Connect to SSE
  const connectSSE = useCallback(() => {
    if (!userId || eventSource) return
    const token = localStorage.getItem('token')
    if (!token) return

    const url = notificationService.getStreamUrl(token)
    const es = new EventSource(url)

    es.onopen = () => {
      console.log('SSE connection established')
    }

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        // Handle connection message
        if (data.type === 'connected') {
          console.log('SSE connected')
          return
        }

        // Add new notification to the list
        const newNotification = data as Notification
        setNotifications(prev => [newNotification, ...prev])
        setUnreadCount(prev => prev + 1)

        console.log('New notification received:', newNotification)
      } catch (err) {
        console.error('Failed to parse SSE message', { error: err instanceof Error ? err.message : String(err) })
      }
    }

    es.onerror = (error) => {
      console.error('SSE error', { error: error instanceof Error ? error.message : String(error) })
      es.close()
      setEventSource(null)

      // Reconnect after 5 seconds
      setTimeout(() => {
        if (userId) {
          connectSSE()
        }
      }, 5000)
    }

    setEventSource(es)
  }, [userId, eventSource])

  // Disconnect from SSE
  const disconnectSSE = useCallback(() => {
    if (eventSource) {
      eventSource.close()
      setEventSource(null)
      console.log('SSE connection closed')
    }
  }, [eventSource])

  // Initial fetch and SSE connection
  useEffect(() => {
    if (userId) {
      fetchNotifications()
      connectSSE()
    }

    return () => {
      disconnectSSE()
    }
  }, [userId])

  const providerNotifications = useMemo(
    () => notifications.filter(n => PROVIDER_NOTIFICATION_TYPES.has(n.type)),
    [notifications]
  )
  const communityNotifications = useMemo(
    () => notifications.filter(n => !PROVIDER_NOTIFICATION_TYPES.has(n.type)),
    [notifications]
  )
  const providerUnreadCount = useMemo(
    () => providerNotifications.filter(n => !n.read).length,
    [providerNotifications]
  )
  const communityUnreadCount = useMemo(
    () => communityNotifications.filter(n => !n.read).length,
    [communityNotifications]
  )

  const value: NotificationContextValue = {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    connectSSE,
    disconnectSSE,
    providerNotifications,
    communityNotifications,
    providerUnreadCount,
    communityUnreadCount,
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export const useNotifications = () => {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}
