import { useState, useEffect, useRef, useCallback } from 'react'
import { messagingService } from '@/lib/api'
import { useMessaging } from '@/hooks/useMessaging'

interface Props {
  matchId: string
  otherUserName: string
  currentUserId: string
}

export default function ExpandableConversation({ matchId, otherUserName, currentUserId }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [unread, setUnread] = useState(0)
  const [fetchError, setFetchError] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  // Track unread count across re-renders without triggering effects
  const prevMessageCountRef = useRef(0)

  const {
    messages,
    loading,
    sendMessage: sendMessageWS,
    refreshMessages,
  } = useMessaging({
    matchId,
    conversationId,
    enabled: expanded,
  })

  // Fetch conversation when expanded
  useEffect(() => {
    if (!expanded || conversationId) return
    setFetchError(false)
    messagingService
      .getMatchConversation(matchId)
      .then((res) => {
        // The response interceptor unwraps data.data, so res.data is the inner payload
        const conv = res.data
        if (!conv) {
          setFetchError(true)
          return
        }
        // API may return { conversation_id } or { id } depending on endpoint shape
        const id: string = conv.conversation_id ?? conv.id
        if (!id) {
          setFetchError(true)
          return
        }
        setConversationId(id)
      })
      .catch(() => {
        setFetchError(true)
      })
  }, [expanded, matchId, conversationId])

  // Load messages once conversationId is set
  useEffect(() => {
    if (conversationId && expanded) {
      refreshMessages()
    }
  }, [conversationId, expanded, refreshMessages])

  // Scroll to bottom when messages change — only when the widget is open
  useEffect(() => {
    if (expanded) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, expanded])

  // Count messages from the other user that arrive while the widget is collapsed
  useEffect(() => {
    const newCount = messages.length - prevMessageCountRef.current
    if (newCount > 0) {
      if (!expanded) {
        // Only increment the badge when the panel is closed (user can't see messages)
        const newMessages = messages.slice(prevMessageCountRef.current)
        const fromOther = newMessages.filter((m) => m.sender_id !== currentUserId).length
        if (fromOther > 0) {
          setUnread((n) => n + fromOther)
        }
      }
      prevMessageCountRef.current = messages.length
    }
  }, [messages, expanded, currentUserId])

  const handleToggle = useCallback(() => {
    setExpanded((v) => {
      const next = !v
      if (next) {
        // Opening: reset unread (prevMessageCountRef stays in sync via the messages effect)
        setUnread(0)
      }
      return next
    })
  }, [])

  const handleSend = async () => {
    const content = input.trim()
    if (!content || !conversationId) return
    setInput('')
    setSending(true)
    try {
      await sendMessageWS(content)
    } catch {
      setInput(content) // restore on error
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mt-3">
      {/* Toggle button */}
      <button
        onClick={handleToggle}
        className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors"
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} conversation with ${otherUserName}`}
      >
        <svg
          className="w-3.5 h-3.5 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <span>{otherUserName}</span>
        {!expanded && unread > 0 && (
          <span className="ml-0.5 bg-blue-500 text-white text-[10px] font-semibold rounded-full px-1.5 py-0.5 leading-none">
            {unread}
          </span>
        )}
        <span className="ml-1 text-[10px]">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Expandable panel — CSS max-height transition */}
      <div
        style={{
          maxHeight: expanded ? '320px' : '0px',
          overflow: 'hidden',
          transition: 'max-height 0.2s ease',
        }}
      >
        <div className="mt-2 border border-border rounded-lg overflow-hidden bg-surface">
          {/* Messages */}
          <div className="overflow-y-auto p-3 space-y-2" style={{ maxHeight: '240px' }}>
            {loading && (
              <p className="text-xs text-text-muted text-center py-4">Loading…</p>
            )}
            {!loading && fetchError && (
              <p className="text-xs text-text-muted italic text-center py-4">
                Start the conversation
              </p>
            )}
            {!loading && !fetchError && messages.length === 0 && conversationId && (
              <p className="text-xs text-text-muted italic text-center py-4">
                Start the conversation
              </p>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}
              >
                <span
                  className={`text-xs rounded-lg px-2.5 py-1.5 max-w-[80%] leading-relaxed ${
                    msg.sender_id === currentUserId
                      ? 'bg-primary text-white'
                      : 'bg-border text-text'
                  }`}
                >
                  {msg.content}
                </span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input row */}
          <div className="flex gap-2 p-2 border-t border-border bg-surface-raised">
            <input
              className="flex-1 text-xs border border-border rounded px-2 py-1.5 bg-background text-text placeholder-text-muted focus:outline-none focus:border-primary"
              placeholder="Message…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              disabled={sending}
            />
            <button
              className="text-xs bg-primary text-white rounded px-2.5 py-1.5 disabled:opacity-50 hover:bg-primary-dark transition-colors"
              onClick={handleSend}
              disabled={!input.trim() || !conversationId || sending}
            >
              {sending ? '…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
