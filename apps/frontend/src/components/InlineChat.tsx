import { useState, useEffect, useRef } from 'react'
import { messagingService } from '@/lib/api'
import { useMessaging } from '@/hooks/useMessaging'

interface InlineChatProps {
  matchId: string
  currentUserId: string
  isRequester: boolean
  matchStatus: 'proposed' | 'matched' | 'rejected'
  otherParticipantName: string
}

export default function InlineChat({
  matchId,
  currentUserId,
  otherParticipantName,
}: InlineChatProps) {
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Use the WebSocket messaging hook
  const {
    messages,
    loading,
    connected,
    sendMessage: sendMessageWS,
    refreshMessages,
    startTyping,
    stopTyping,
    isTyping,
    typingUser,
  } = useMessaging({
    matchId,
    conversationId,
    enabled: isExpanded, // Only connect when expanded
  })

  // Fetch conversation ID and initial messages when expanded
  useEffect(() => {
    if (isExpanded && !conversationId) {
      fetchConversation()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded, matchId])

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom()
    }
  }, [messages])

  const fetchConversation = async () => {
    try {
      const response = await messagingService.getMatchConversation(matchId)
      setConversationId(response.data.data.conversation_id)
      // Messages will be loaded by the hook after conversationId is set
    } catch (error) {
      console.error('Error fetching conversation', { error: error instanceof Error ? error.message : String(error) })
    }
  }

  // Refresh messages when conversationId is available
  useEffect(() => {
    if (conversationId && isExpanded) {
      refreshMessages()
    }
  }, [conversationId, isExpanded, refreshMessages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || sending) return

    try {
      setSending(true)
      stopTyping() // Stop typing indicator before sending

      await sendMessageWS(newMessage.trim())
      setNewMessage('')

      // Scroll to bottom after sending
      setTimeout(() => scrollToBottom(), 100)
    } catch (error) {
      console.error('Error sending message', { error: error instanceof Error ? error.message : String(error) })
      const err = error as { message?: string }
      alert(err.message || 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const handleTyping = (value: string) => {
    setNewMessage(value)

    // Start typing indicator
    if (value.trim()) {
      startTyping()

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      // Stop typing indicator after 1 second of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping()
      }, 1000)
    } else {
      stopTyping()
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  const messageCount = messages.length

  return (
    <div className="mt-4 border-t border-border pt-4">
      {/* Header - Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left hover:bg-surface rounded-lg px-3 py-2 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <span className="text-sm font-medium text-text-muted">
            Chat with {otherParticipantName}
          </span>
          {messageCount > 0 && (
            <span className="text-xs text-text-subtle">({messageCount} message{messageCount !== 1 ? 's' : ''})</span>
          )}
          {connected && isExpanded && (
            <span className="flex items-center gap-1 text-xs text-success">
              <div className="w-2 h-2 bg-success-light0 rounded-full"></div>
              Live
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-text-subtle transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Messages - Expandable */}
      {isExpanded && (
        <div className="mt-3 bg-surface rounded-lg border border-border overflow-hidden">
          {/* Messages List */}
          <div className="max-h-80 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-text-subtle mt-2">Loading messages...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <p className="text-sm text-text-subtle">No messages yet</p>
                <p className="text-xs text-text-subtle mt-1">Start the conversation!</p>
              </div>
            ) : (
              <>
                {messages.map((message) => {
                  const isSender = message.sender_id === currentUserId
                  return (
                    <div key={message.id} className={`flex ${isSender ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs ${isSender ? 'order-2' : 'order-1'}`}>
                        <div
                          className={`rounded-lg px-4 py-2 ${
                            isSender
                              ? 'bg-primary text-white'
                              : 'bg-surface-raised text-text border border-border'
                          }`}
                        >
                          <p className="text-sm leading-relaxed">{message.content}</p>
                        </div>
                        <p className={`text-xs text-text-subtle mt-1 ${isSender ? 'text-right' : 'text-left'}`}>
                          {formatTime(message.created_at)}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </>
            )}

            {/* Typing Indicator */}
            {isTyping && typingUser && (
              <div className="flex justify-start">
                <div className="bg-gray-200 rounded-lg px-4 py-2">
                  <div className="flex items-center gap-1">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-surface0 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-surface0 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-surface0 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    <span className="text-xs text-text-muted ml-2">{typingUser} is typing...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Message Input */}
          <form onSubmit={handleSendMessage} className="border-t border-border p-3 bg-surface-raised">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => handleTyping(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sending}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
