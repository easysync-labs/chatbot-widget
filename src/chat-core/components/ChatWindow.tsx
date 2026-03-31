import { useEffect, useMemo, useState } from 'react'
import { Provider } from 'react-redux'
import { makeStore } from '../../app/store'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { setApiUrl, setToken, clearMessages } from '../../features/chat/chatSlice'
import { useChat } from '../hooks/useChat'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'

export interface ChatWindowProps {
  apiUrl?: string
  theme?: 'light' | 'dark'
  title?: string
  subtitle?: string
  token?: string
}

export function ChatWindow(props: ChatWindowProps) {
  const store = useMemo(() => makeStore(), [])
  return (
    <Provider store={store}>
      <ChatWindowInner {...props} />
    </Provider>
  )
}

function ChatWindowInner({
  apiUrl = '/api/order/chat/message',
  theme = 'light',
  title = 'EasySync Chat',
  subtitle = 'Assistente de vendas',
  token,
}: ChatWindowProps) {
  const dispatch = useAppDispatch()
  const bearerToken = useAppSelector((s) => s.chat.bearerToken)
  const { messages, isLoading, error, send, dismissError } = useChat()
  const [tokenInput, setTokenInput] = useState(bearerToken)
  const [tokenVisible, setTokenVisible] = useState(false)

  useEffect(() => {
    dispatch(setApiUrl(apiUrl))
  }, [apiUrl, dispatch])

  useEffect(() => {
    if (token !== undefined) {
      dispatch(setToken(token))
      setTokenInput(token)
    }
  }, [token, dispatch])

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
        <div className="flex items-center gap-1">
          {!token && <button
            className={`chat-token-btn p-2 rounded-lg transition-colors ${
              bearerToken
                ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                : isDark
                ? 'hover:bg-gray-700 text-gray-400'
                : 'hover:bg-gray-100 text-gray-500'
            }`}
            onClick={() => setTokenVisible((v) => !v)}
            title="Configurar Bearer Token"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
          </button>}
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
      </div>

      {/* Token Input Bar */}
      {!token && tokenVisible && (
        <div
          className={`chat-token-bar flex items-center gap-2 px-4 py-2.5 border-b ${
            isDark ? 'bg-gray-800 border-gray-700' : 'bg-amber-50 border-amber-200'
          }`}
        >
          <svg className="w-4 h-4 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
            />
          </svg>
          <input
            type="password"
            className={`flex-1 text-xs px-2 py-1 rounded-lg border outline-none focus:ring-2 focus:ring-amber-300 ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                : 'bg-white border-amber-200 text-gray-800 placeholder-gray-400'
            }`}
            placeholder="Cole aqui o Bearer Token..."
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
          />
          <button
            className="px-3 py-1 text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
            onClick={() => {
              dispatch(setToken(tokenInput.trim()))
              setTokenVisible(false)
            }}
          >
            Salvar
          </button>
          {bearerToken && (
            <button
              className="px-2 py-1 text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
              onClick={() => {
                setTokenInput('')
                dispatch(setToken(''))
              }}
            >
              Remover
            </button>
          )}
        </div>
      )}

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
