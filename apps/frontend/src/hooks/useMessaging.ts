import { useState, useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

const MESSAGING_SERVICE_URL = process.env.NEXT_PUBLIC_MESSAGING_SERVICE_URL || 'http://localhost:3006'

interface Message {
  id: string
  sender_id: string
  content: string
  created_at: string
}

interface UseMessagingOptions {
  matchId: string
  conversationId: string | null
  enabled: boolean // Only connect when chat is expanded
}

interface UseMessagingReturn {
  messages: Message[]
  loading: boolean
  connected: boolean
  sendMessage: (content: string) => Promise<void>
  refreshMessages: () => Promise<void>
  startTyping: () => void
  stopTyping: () => void
  isTyping: boolean
  typingUser: string | null
}

export function useMessaging({
  matchId,
  conversationId,
  enabled,
}: UseMessagingOptions): UseMessagingReturn {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false) // Start as false, will be set to true when fetching
  const [connected, setConnected] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [typingUser, setTypingUser] = useState<string | null>(null)

  const socketRef = useRef<Socket | null>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Get token from localStorage
  const getToken = useCallback(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token')
    }
    return null
  }, [])

  // Initialize Socket.IO connection
  useEffect(() => {
    if (!enabled || !conversationId) {
      return
    }

    const token = getToken()
    if (!token) {
      console.error('No authentication token found')
      return
    }

    // Create socket connection with JWT authentication
    const socket = io(MESSAGING_SERVICE_URL, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
    })

    socketRef.current = socket

    // Connection events
    socket.on('connect', () => {
      console.log('WebSocket connected:', socket.id)
      setConnected(true)

      // Join the conversation room
      socket.emit('join_conversation', conversationId)
    })

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected')
      setConnected(false)
    })

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error.message)
      setConnected(false)
    })

    // Message events
    socket.on('new_message', (message: Message) => {
      console.log('New message received:', message)
      setMessages((prev) => {
        // Avoid duplicates
        if (prev.some((m) => m.id === message.id)) {
          return prev
        }
        return [...prev, message]
      })
    })

    // Typing events
    socket.on('user_typing', (data: { userId: string; userName: string }) => {
      console.log('User typing:', data.userName)
      setIsTyping(true)
      setTypingUser(data.userName)

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      // Auto-clear typing indicator after 3 seconds
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false)
        setTypingUser(null)
      }, 3000)
    })

    socket.on('user_stop_typing', () => {
      setIsTyping(false)
      setTypingUser(null)

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    })

    // Error events
    socket.on('message_error', (data: { error: string }) => {
      console.error('Message error:', data.error)
    })

    socket.on('error', (data: { error: string }) => {
      console.error('Socket error:', data.error)
    })

    // Cleanup
    return () => {
      if (conversationId) {
        socket.emit('leave_conversation', conversationId)
      }
      socket.disconnect()
      socketRef.current = null

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [enabled, conversationId, getToken])

  // Fetch initial messages (REST fallback)
  const refreshMessages = useCallback(async () => {
    if (!matchId) return

    try {
      setLoading(true)
      const token = getToken()
      const response = await fetch(
        `${MESSAGING_SERVICE_URL}/match/${matchId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error('Failed to fetch messages')
      }

      const data = await response.json()
      setMessages(data.data.messages || [])
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setLoading(false)
    }
  }, [matchId, getToken])

  // Send message via WebSocket (with REST fallback)
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return

      const socket = socketRef.current

      if (socket && socket.connected && conversationId) {
        // Send via WebSocket
        socket.emit('send_message', {
          conversationId,
          content: content.trim(),
        })
      } else {
        // Fallback to REST API
        try {
          const token = getToken()
          const response = await fetch(
            `${MESSAGING_SERVICE_URL}/match/${matchId}/messages`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ content: content.trim() }),
            }
          )

          if (!response.ok) {
            throw new Error('Failed to send message')
          }

          // Refresh messages to show the sent message
          await refreshMessages()
        } catch (error) {
          console.error('Error sending message:', error)
          throw error
        }
      }
    },
    [conversationId, matchId, getToken, refreshMessages]
  )

  // Typing indicators
  const startTyping = useCallback(() => {
    const socket = socketRef.current
    if (socket && socket.connected && conversationId) {
      const user = localStorage.getItem('user')
      const userName = user ? JSON.parse(user).name : 'Unknown'

      socket.emit('typing', {
        conversationId,
        userName,
      })
    }
  }, [conversationId])

  const stopTyping = useCallback(() => {
    const socket = socketRef.current
    if (socket && socket.connected && conversationId) {
      socket.emit('stop_typing', {
        conversationId,
      })
    }
  }, [conversationId])

  return {
    messages,
    loading,
    connected,
    sendMessage,
    refreshMessages,
    startTyping,
    stopTyping,
    isTyping,
    typingUser,
  }
}
