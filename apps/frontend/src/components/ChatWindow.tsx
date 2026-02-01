import React, { useState, useEffect, useRef } from 'react'
import { useMessaging } from '../contexts/MessagingContext'
import MessageBubble from './MessageBubble'

interface ChatWindowProps {
  conversationId: string
}

const ChatWindow: React.FC<ChatWindowProps> = ({ conversationId }) => {
  const {
    messages,
    currentConversation,
    loading,
    error,
    typing,
    sendMessage,
    startTyping,
    selectConversation,
  } = useMessaging()

  const [messageInput, setMessageInput] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Get current user
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user')
      if (userStr) {
        const user = JSON.parse(userStr)
        setUserId(user.id)
      }
    }
  }, [])

  // Load conversation on mount
  useEffect(() => {
    if (conversationId) {
      selectConversation(conversationId)
    }
  }, [conversationId, selectConversation])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageInput(e.target.value)
    startTyping()
  }

  const handleSend = () => {
    if (messageInput.trim()) {
      sendMessage(messageInput)
      setMessageInput('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const getOtherParticipants = () => {
    if (!currentConversation || !userId) return []
    return currentConversation.participants?.filter((p) => p.id !== userId) || []
  }

  const otherParticipants = getOtherParticipants()
  const typingUsers = Array.from(typing.values())

  if (loading && !currentConversation) {
    return (
      <div className="chat-window loading">
        <div className="loading-message">Loading conversation...</div>
        <style jsx>{`
          .chat-window.loading {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            background-color: #f9f9f9;
          }
          .loading-message {
            color: #666;
            font-size: 14px;
          }
        `}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div className="chat-window error">
        <div className="error-message">Error: {error}</div>
        <style jsx>{`
          .chat-window.error {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            background-color: #fff5f5;
          }
          .error-message {
            color: #ff4444;
            font-size: 14px;
          }
        `}</style>
      </div>
    )
  }

  if (!currentConversation) {
    return (
      <div className="chat-window empty">
        <div className="empty-message">Select a conversation to start messaging</div>
        <style jsx>{`
          .chat-window.empty {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            background-color: #f9f9f9;
          }
          .empty-message {
            color: #999;
            font-size: 14px;
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="chat-window">
      {/* Header */}
      <div className="chat-header">
        <div className="header-info">
          <h3 className="chat-title">
            {otherParticipants.map((p) => p.name).join(', ')}
          </h3>
          <p className="chat-subtitle">
            {otherParticipants.map((p) => p.email).join(', ')}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="no-messages">
            <div className="no-messages-icon">💬</div>
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <>
            {messages.map((message) => {
              // Debug logging
              if (!message || typeof message !== 'object') {
                console.error('Invalid message in ChatWindow:', message)
                return null
              }
              if (!message.id) {
                console.error('Message missing id:', message)
                return null
              }
              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwn={message.sender_id === userId}
                />
              )
            })}
            {typingUsers.length > 0 && (
              <div className="typing-indicator">
                <span className="typing-text">
                  {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing
                </span>
                <span className="typing-dots">
                  <span>.</span><span>.</span><span>.</span>
                </span>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="message-input-container">
        <textarea
          ref={inputRef}
          className="message-input"
          placeholder="Type a message..."
          value={messageInput}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          rows={1}
        />
        <button
          className="send-button"
          onClick={handleSend}
          disabled={!messageInput.trim()}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M2 10l16-8-8 16-2-8-6-2z" />
          </svg>
        </button>
      </div>

      <style jsx>{`
        .chat-window {
          display: flex;
          flex-direction: column;
          height: 100%;
          background-color: white;
        }

        .chat-header {
          padding: 16px 20px;
          border-bottom: 1px solid #e0e0e0;
          background-color: white;
        }

        .header-info h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #1a1a1a;
        }

        .chat-subtitle {
          margin: 4px 0 0 0;
          font-size: 13px;
          color: #666;
        }

        .messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          background-color: #f9f9f9;
        }

        .no-messages {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #999;
        }

        .no-messages-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }

        .no-messages p {
          font-size: 14px;
          margin: 0;
        }

        .typing-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          color: #666;
          font-size: 13px;
          font-style: italic;
        }

        .typing-dots {
          display: inline-flex;
          gap: 2px;
        }

        .typing-dots span {
          animation: blink 1.4s infinite;
        }

        .typing-dots span:nth-child(2) {
          animation-delay: 0.2s;
        }

        .typing-dots span:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes blink {
          0%, 60%, 100% {
            opacity: 0;
          }
          30% {
            opacity: 1;
          }
        }

        .message-input-container {
          display: flex;
          align-items: flex-end;
          gap: 12px;
          padding: 16px 20px;
          border-top: 1px solid #e0e0e0;
          background-color: white;
        }

        .message-input {
          flex: 1;
          padding: 10px 14px;
          border: 1px solid #d0d0d0;
          border-radius: 20px;
          font-size: 14px;
          font-family: inherit;
          resize: none;
          max-height: 120px;
          outline: none;
          transition: border-color 0.2s;
        }

        .message-input:focus {
          border-color: #0070f3;
        }

        .send-button {
          padding: 10px;
          background-color: #0070f3;
          color: white;
          border: none;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .send-button:hover:not(:disabled) {
          background-color: #0060df;
        }

        .send-button:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  )
}

export default ChatWindow
