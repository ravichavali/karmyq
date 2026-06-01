import React from 'react'
import { render, act } from '@testing-library/react'
import { NotificationProvider } from '@/contexts/NotificationContext'

const mockGetNotifications = jest.fn().mockResolvedValue({ data: { notifications: [] } })
const mockGetUnreadCount = jest.fn().mockResolvedValue({ data: { count: 0 } })
const mockGetStreamUrl = jest.fn((token: string) => `http://localhost:3005/notifications/stream?access_token=${token}`)

jest.mock('@/lib/api', () => ({
  notificationService: {
    getNotifications: (...args: unknown[]) => mockGetNotifications(...args),
    getUnreadCount: (...args: unknown[]) => mockGetUnreadCount(...args),
    getStreamUrl: (...args: unknown[]) => mockGetStreamUrl(...args),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    deleteNotification: jest.fn(),
  },
}))

const MockEventSource = jest.fn().mockImplementation(() => ({
  onopen: null,
  onmessage: null,
  onerror: null,
  close: jest.fn(),
}))

describe('Sprint 81 — Notification SSE wiring', () => {
  beforeEach(() => {
    localStorage.clear()
    mockGetNotifications.mockClear()
    mockGetUnreadCount.mockClear()
    mockGetStreamUrl.mockClear()
    MockEventSource.mockClear()
    ;(global as any).EventSource = MockEventSource
  })

  async function mountProvider() {
    await act(async () => {
      render(
        <NotificationProvider>
          <div>child</div>
        </NotificationProvider>
      )
    })
  }

  it('uses token-based stream URL and opens EventSource when token exists', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 'user-1' }))
    localStorage.setItem('token', 'jwt-token-1')

    await mountProvider()

    expect(mockGetNotifications).toHaveBeenCalledWith('user-1', { limit: 50 })
    expect(mockGetUnreadCount).toHaveBeenCalledWith('user-1')
    expect(mockGetStreamUrl).toHaveBeenCalledWith('jwt-token-1')
    expect(MockEventSource).toHaveBeenCalledWith(expect.stringContaining('access_token=jwt-token-1'))
  })

  it('does not open EventSource when user exists but token is missing', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 'user-1' }))

    await mountProvider()

    expect(mockGetNotifications).toHaveBeenCalledWith('user-1', { limit: 50 })
    expect(mockGetUnreadCount).toHaveBeenCalledWith('user-1')
    expect(mockGetStreamUrl).not.toHaveBeenCalled()
    expect(MockEventSource).not.toHaveBeenCalled()
  })
})

