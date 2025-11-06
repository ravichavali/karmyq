import { useState, useEffect } from 'react'
import Link from 'next/link'
import { messagingService } from '@/lib/api'

interface Message {
  id: string
  content: string
  sender_id: string
  created_at: string
}

interface Conversation {
  id: string
  match_id: string
  last_message: string | Message | null
  last_message_at: string
  unread_count: number
  other_user_name: string
}

export default function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [unreadTotal, setUnreadTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      setUser(JSON.parse(userData))
    }
  }, [])

  useEffect(() => {
    if (isOpen && user) {
      fetchConversations()
    }
  }, [isOpen, user])

  const fetchConversations = async () => {
    if (!user) return

    try {
      setLoading(true)
      const response = await messagingService.getConversations(user.id)
      const convos = response.data.data || []
      setConversations(convos)

      // Calculate total unread
      const total = convos.reduce((sum: number, conv: Conversation) => sum + (conv.unread_count || 0), 0)
      setUnreadTotal(total)
    } catch (err) {
      console.error('Failed to load conversations:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating Button - Minimized State */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-16 h-16 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center z-50"
          aria-label="Open messages"
        >
          <svg
            className="w-7 h-7"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
          {unreadTotal > 0 && (
            <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {unreadTotal > 9 ? '9+' : unreadTotal}
            </span>
          )}
        </button>
      )}

      {/* Floating Panel - Expanded State */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-white rounded-lg shadow-2xl flex flex-col z-50 border border-gray-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-blue-600 text-white rounded-t-lg">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
              <h3 className="font-semibold">Messages</h3>
              {unreadTotal > 0 && (
                <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                  {unreadTotal}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/messages"
                className="p-1 hover:bg-blue-700 rounded transition-colors"
                title="Open full messages"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </Link>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-blue-700 rounded transition-colors"
                aria-label="Minimize"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <svg className="animate-spin h-8 w-8 mx-auto mb-2 text-blue-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <p className="text-sm">Loading conversations...</p>
                </div>
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center px-4">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-sm font-medium mb-2">No messages yet</p>
                  <p className="text-xs text-gray-400">
                    When you help someone or get help, you'll see conversations here
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {conversations.map((conv) => (
                  <Link
                    key={conv.id}
                    href={`/messages/${conv.id}`}
                    className="block px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-gray-900 truncate">
                            {conv.other_user_name}
                          </p>
                          {conv.unread_count > 0 && (
                            <span className="px-1.5 py-0.5 bg-blue-600 text-white text-xs font-bold rounded-full">
                              {conv.unread_count}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 truncate">
                          {typeof conv.last_message === 'string'
                            ? conv.last_message
                            : conv.last_message && typeof conv.last_message === 'object'
                            ? conv.last_message.content
                            : 'No messages yet'}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {conv.last_message_at ? new Date(conv.last_message_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <Link
              href="/messages"
              className="block text-center text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              View All Messages →
            </Link>
          </div>
        </div>
      )}
    </>
  )
}
