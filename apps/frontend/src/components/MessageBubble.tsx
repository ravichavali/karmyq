import React from 'react'
import { Message } from '../contexts/MessagingContext'

interface MessageBubbleProps {
  message: Message
  isOwn: boolean
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isOwn }) => {
  // Defensive check - ensure message is valid
  if (!message || typeof message !== 'object') {
    console.error('Invalid message object:', message)
    return null
  }

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp)
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    } catch (e) {
      return ''
    }
  }

  // Ensure content is a string
  const messageContent = typeof message.content === 'string'
    ? message.content
    : (typeof message.content === 'object' && message.content !== null)
      ? JSON.stringify(message.content)
      : String(message.content || '')

  // Ensure timestamp is valid
  const timestamp = message.created_at ? String(message.created_at) : ''

  // Ensure status is valid
  const messageStatus = message.status ? String(message.status) : 'sent'

  return (
    <div className={`message-bubble-container ${isOwn ? 'own' : 'other'}`}>
      <div className="message-bubble">
        {!isOwn && message.sender && typeof message.sender === 'object' && message.sender.name && (
          <div className="sender-name">{String(message.sender.name)}</div>
        )}
        <div className="message-content">{messageContent}</div>
        <div className="message-meta">
          <span className="message-time">{formatTime(timestamp)}</span>
          {isOwn && (
            <span className="message-status">
              {messageStatus === 'read' ? '✓✓' : '✓'}
            </span>
          )}
        </div>
      </div>

      <style jsx>{`
        .message-bubble-container {
          display: flex;
          margin-bottom: 12px;
        }

        .message-bubble-container.own {
          justify-content: flex-end;
        }

        .message-bubble-container.other {
          justify-content: flex-start;
        }

        .message-bubble {
          max-width: 70%;
          padding: 10px 14px;
          border-radius: 16px;
          word-wrap: break-word;
        }

        .message-bubble-container.own .message-bubble {
          background-color: #0070f3;
          color: white;
          border-bottom-right-radius: 4px;
        }

        .message-bubble-container.other .message-bubble {
          background-color: #f0f0f0;
          color: #1a1a1a;
          border-bottom-left-radius: 4px;
        }

        .sender-name {
          font-size: 11px;
          font-weight: 600;
          color: #666;
          margin-bottom: 4px;
        }

        .message-content {
          font-size: 14px;
          line-height: 1.4;
          white-space: pre-wrap;
        }

        .message-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 4px;
          justify-content: flex-end;
        }

        .message-time {
          font-size: 10px;
          opacity: 0.7;
        }

        .message-status {
          font-size: 11px;
          opacity: 0.8;
        }
      `}</style>
    </div>
  )
}

export default MessageBubble
