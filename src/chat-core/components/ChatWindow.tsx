import { useEffect } from 'react'
import { useAppDispatch } from '../../app/hooks'
import { setApiUrl, clearMessages } from '../../features/chat/chatSlice'
import { useChat } from '../hooks/useChat'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'

export interface ChatWindowProps {
  apiUrl?: string
  theme?: 'light' | 'dark'
  title?: string
  subtitle?: string
}

export function ChatWindow({
  apiUrl = '/api/chatbot/chat',
  theme = 'light',
  title = 'EasySync Chat',
  subtitle = 'Assistente de vendas',
}: ChatWindowProps) {
  const dispatch = useAppDispatch()
  const { messages, isLoading, error, send, dismissError } = useChat()

  useEffect(() => {
    dispatch(setApiUrl(apiUrl))
  }, [apiUrl, dispatch])

  const isDark = theme === 'dark'

  return (
    <div
      className={`chat-window flex flex-col h-full min-h-0 overflow-hidden rounded-2xl border shadow-lg ${
        isDark ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'
      }`}
    >
      {/* Header */}
      <div
        className={`chat-header flex items-center justify-between px-5 py-4 border-b ${
          isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}
      >
        <div className="chat-header-info flex items-center gap-3">
          <div className="chat-header-avatar w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-blue-500 flex items-center justify-center shadow-sm">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2"
              />
            </svg>
          </div>
          <div>
            <h2 className={`chat-header-title text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {title}
            </h2>
            <div className="chat-header-status flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{subtitle}</span>
            </div>
          </div>
        </div>
        <button
          className={`chat-clear-btn p-2 rounded-lg transition-colors ${
            isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
          }`}
          onClick={() => dispatch(clearMessages())}
          title="Limpar conversa"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="chat-error flex items-center gap-2 px-4 py-2.5 bg-red-50 border-b border-red-100 text-red-700 text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="flex-1">{error}</span>
          <button onClick={dismissError} className="hover:opacity-70 transition-opacity ml-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Messages */}
      <MessageList messages={messages} isLoading={isLoading} />

      {/* Input */}
      <ChatInput onSend={send} isLoading={isLoading} />
    </div>
  )
}
