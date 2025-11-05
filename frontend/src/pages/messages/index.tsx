import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { useMessaging } from '@/contexts/MessagingContext'

export default function MessagesPage() {
  const router = useRouter()
  const { conversations, loading, error, fetchConversations } = useMessaging()
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }

    const userStr = localStorage.getItem('user')
    if (userStr) {
      const user = JSON.parse(userStr)
      setUserId(user.id)
    }
  }, [router])

  useEffect(() => {
    if (userId) {
      fetchConversations()
    }
  }, [userId])

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' })
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  const getOtherParticipants = (conversation: any) => {
    if (!userId) return []
    return conversation.participants?.filter((p: any) => p.id !== userId) || []
  }

  return (
    <>
      <Head>
        <title>Messages - Karmyq</title>
      </Head>
      <Layout title="Messages">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-md max-w-4xl mx-auto">
            {loading && conversations.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                Loading conversations...
              </div>
            )}

            {error && (
              <div className="p-12 text-center text-red-600">{error}</div>
            )}

            {!loading && !error && conversations.length === 0 && (
              <div className="p-12 text-center">
                <div className="text-6xl mb-4">💬</div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  No conversations yet
                </h3>
                <p className="text-gray-500 mb-6">
                  When you match with someone, you'll be able to message them here
                </p>
                <Link
                  href="/requests"
                  className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Browse Requests
                </Link>
              </div>
            )}

            {conversations.length > 0 && (
              <div className="conversation-list">
                {conversations.map((conversation) => {
                  const otherParticipants = getOtherParticipants(conversation)
                  const lastMessage = conversation.last_message

                  return (
                    <Link
                      key={conversation.id}
                      href={`/messages/${conversation.id}`}
                      className="conversation-item"
                    >
                      <div className="conversation-avatar">
                        {otherParticipants.length > 0
                          ? otherParticipants[0].name.charAt(0).toUpperCase()
                          : '?'}
                      </div>
                      <div className="conversation-content">
                        <div className="conversation-header">
                          <h3 className="conversation-name">
                            {otherParticipants.map((p) => p.name).join(', ') || 'Unknown'}
                          </h3>
                          <span className="conversation-time">
                            {formatTime(conversation.last_message_at)}
                          </span>
                        </div>
                        <p className="conversation-preview">
                          {lastMessage?.content || 'No messages yet'}
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <style jsx>{`
          .conversation-list {
            border-top: 1px solid #e0e0e0;
          }

          .conversation-item {
            display: flex;
            gap: 16px;
            padding: 16px 20px;
            border-bottom: 1px solid #e0e0e0;
            cursor: pointer;
            transition: background-color 0.2s;
            text-decoration: none;
            color: inherit;
          }

          .conversation-item:hover {
            background-color: #f8f9fa;
          }

          .conversation-avatar {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background-color: #0070f3;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            font-weight: 600;
            flex-shrink: 0;
          }

          .conversation-content {
            flex: 1;
            min-width: 0;
          }

          .conversation-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 4px;
          }

          .conversation-name {
            font-size: 16px;
            font-weight: 600;
            color: #1a1a1a;
            margin: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .conversation-time {
            font-size: 12px;
            color: #999;
            flex-shrink: 0;
            margin-left: 12px;
          }

          .conversation-preview {
            font-size: 14px;
            color: #666;
            margin: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        `}</style>
      </Layout>
    </>
  )
}
