import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { messagingService } from '../lib/api'

export interface Message {
  id: string
  sender_id: string
  conversation_id: string
  content: string
  status: string
  created_at: string
  sender?: {
    id: string
    name: string
    email: string
  }
}

export interface Conversation {
  id: string
  request_match_id: string | null
  last_message_at: string | null
  created_at: string
  participants?: any[]
  last_message?: Message
}

interface MessagingContextValue {
  socket: Socket | null
  connected: boolean
  conversations: Conversation[]
  currentConversation: Conversation | null
  messages: Message[]
  loading: boolean
  error: string | null
  typing: Map<string, string> // userId -> userName
  fetchConversations: () => Promise<void>
  selectConversation: (conversationId: string) => Promise<void>
  sendMessage: (content: string) => void
  startTyping: () => void
  stopTyping: () => void
  createConversation: (matchId: string, participantIds: string[]) => Promise<Conversation>
}

const MessagingContext = createContext<MessagingContextValue | undefined>(undefined)

interface MessagingProviderProps {
  children: ReactNode
}

export const MessagingProvider: React.FC<MessagingProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [typing, setTyping] = useState<Map<string, string>>(new Map())
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('')
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Get user from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user')
      if (userStr) {
        try {
          const user = JSON.parse(userStr)
          setUserId(user.id)
          setUserName(user.name)
        } catch (e) {
          console.error('Failed to parse user:', e)
        }
      }
    }
  }, [])

  // Initialize Socket.IO connection
  useEffect(() => {
    if (!userId) return

    const socketUrl = messagingService.getSocketUrl()
    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
    })

    newSocket.on('connect', () => {
      console.log('Socket.IO connected')
      setConnected(true)
      // Authenticate with user ID
      newSocket.emit('authenticate', userId)
    })

    newSocket.on('disconnect', () => {
      console.log('Socket.IO disconnected')
      setConnected(false)
    })

    newSocket.on('new_message', (message: Message) => {
      console.log('New message received:', message)
      console.log('Message type check:', {
        isObject: typeof message === 'object',
        hasId: !!message?.id,
        hasContent: !!message?.content,
        hasConversationId: !!message?.conversation_id,
        hasSenderId: !!message?.sender_id,
        hasCreatedAt: !!message?.created_at,
        contentType: typeof message?.content,
      })

      // Validate message structure
      if (!message || typeof message !== 'object' || !message.id || !message.content) {
        console.error('Invalid message structure received:', message)
        return
      }

      // Add message to current conversation if it matches
      if (currentConversation && message.conversation_id === currentConversation.id) {
        setMessages((prev) => [...prev, message])
      }

      // Update conversation list with new last message
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === message.conversation_id
            ? { ...conv, last_message: message, last_message_at: message.created_at }
            : conv
        )
      )
    })

    newSocket.on('user_typing', ({ userId: typingUserId, userName }) => {
      setTyping((prev) => new Map(prev).set(typingUserId, userName))
    })

    newSocket.on('user_stop_typing', ({ userId: typingUserId }) => {
      setTyping((prev) => {
        const newMap = new Map(prev)
        newMap.delete(typingUserId)
        return newMap
      })
    })

    newSocket.on('messages_read', ({ conversationId, userId: readUserId }) => {
      if (currentConversation && conversationId === currentConversation.id) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.sender_id !== readUserId && msg.status === 'sent'
              ? { ...msg, status: 'read' }
              : msg
          )
        )
      }
    })

    newSocket.on('message_error', ({ error }) => {
      console.error('Message error:', error)
      setError(error)
    })

    setSocket(newSocket)

    return () => {
      newSocket.close()
    }
  }, [userId])

  // Fetch user's conversations (userId is extracted from JWT on backend)
  const fetchConversations = useCallback(async () => {
    if (!userId) return

    setLoading(true)
    setError(null)

    try {
      const response = await messagingService.getConversations()
      setConversations(response.data.data)
    } catch (err: any) {
      console.error('Failed to fetch conversations:', err)
      setError(err.message || 'Failed to fetch conversations')
    } finally {
      setLoading(false)
    }
  }, [userId])

  // Select and join a conversation
  const selectConversation = useCallback(async (conversationId: string) => {
    if (!userId || !socket) return

    setLoading(true)
    setError(null)

    try {
      // Leave previous conversation room
      if (currentConversation) {
        socket.emit('leave_conversation', currentConversation.id)
      }

      // Fetch conversation details (userId from JWT)
      const convResponse = await messagingService.getConversation(conversationId)
      const conversation = convResponse.data.data

      // Fetch messages (userId from JWT)
      const messagesResponse = await messagingService.getMessages(conversationId, { limit: 50 })
      const messagesList = messagesResponse.data.data

      setCurrentConversation(conversation)
      setMessages(messagesList)

      // Join conversation room
      socket.emit('join_conversation', conversationId)

      // Mark messages as read
      socket.emit('mark_as_read', { conversationId, userId })
    } catch (err: any) {
      console.error('Failed to select conversation:', err)
      setError(err.message || 'Failed to select conversation')
    } finally {
      setLoading(false)
    }
  }, [userId, socket, currentConversation])

  // Send a message
  const sendMessage = useCallback((content: string) => {
    if (!socket || !currentConversation || !userId || !content.trim()) return

    socket.emit('send_message', {
      conversationId: currentConversation.id,
      senderId: userId,
      content: content.trim(),
    })

    // Stop typing
    stopTyping()
  }, [socket, currentConversation, userId])

  // Start typing indicator
  const startTyping = useCallback(() => {
    if (!socket || !currentConversation || !userId) return

    socket.emit('typing', {
      conversationId: currentConversation.id,
      userId,
      userName,
    })

    // Reset typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping()
    }, 3000)
  }, [socket, currentConversation, userId, userName])

  // Stop typing indicator
  const stopTyping = useCallback(() => {
    if (!socket || !currentConversation || !userId) return

    socket.emit('stop_typing', {
      conversationId: currentConversation.id,
      userId,
    })

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }
  }, [socket, currentConversation, userId])

  // Create conversation for a match
  const createConversation = useCallback(async (matchId: string, participantIds: string[]) => {
    try {
      const response = await messagingService.createConversation(matchId, participantIds)
      const conversation = response.data.data

      // Add to conversations list
      setConversations((prev) => [conversation, ...prev])

      return conversation
    } catch (err: any) {
      console.error('Failed to create conversation:', err)
      throw err
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    if (userId) {
      fetchConversations()
    }
  }, [userId, fetchConversations])

  const value: MessagingContextValue = {
    socket,
    connected,
    conversations,
    currentConversation,
    messages,
    loading,
    error,
    typing,
    fetchConversations,
    selectConversation,
    sendMessage,
    startTyping,
    stopTyping,
    createConversation,
  }

  return (
    <MessagingContext.Provider value={value}>
      {children}
    </MessagingContext.Provider>
  )
}

export const useMessaging = () => {
  const context = useContext(MessagingContext)
  if (context === undefined) {
    throw new Error('useMessaging must be used within a MessagingProvider')
  }
  return context
}
