import { useEffect, useRef } from 'react'
import { Message } from '../../features/chat/types'
import { MessageItem } from './MessageItem'

interface MessageListProps {
  messages: Message[]
  isLoading: boolean
}

function TypingIndicator() {
  return (
    <div className="chat-typing flex justify-start mb-4">
      <div className="chat-typing-avatar flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center mr-2 mt-1">
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2"
          />
        </svg>
      </div>
      <div className="chat-typing-bubble bg-white border border-gray-200 rounded-2xl rounded-bl-sm shadow-sm px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          <span className="chat-typing-dot w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <span className="chat-typing-dot w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <span className="chat-typing-dot w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
        </div>
      </div>
    </div>
  )
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const visibleMessages = messages.filter((m) => m.role !== 'system')

  return (
    <div className="chat-msg-list flex-1 overflow-y-auto px-4 py-4 space-y-0">
      {visibleMessages.length === 0 && !isLoading && (
        <div className="chat-empty flex flex-col items-center justify-center h-full text-center py-16">
          <div className="chat-empty-icon w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <p className="chat-empty-title text-gray-500 font-medium">Como posso ajudar?</p>
          <p className="chat-empty-subtitle text-gray-400 text-sm mt-1">Envie uma mensagem para começar</p>
        </div>
      )}

      {messages.map((message) =>
        message.role !== 'system' ? (
          <MessageItem key={message.id} message={message} />
        ) : null
      )}

      {isLoading && <TypingIndicator />}

      <div ref={bottomRef} />
    </div>
  )
}
