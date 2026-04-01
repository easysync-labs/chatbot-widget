import { useEffect, useMemo, useState } from 'react'
import { Provider } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'
import { makeStore } from '../../app/store'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { setBaseUrl, setToken, clearMessages, setError } from '../../features/chat/chatSlice'
import { loginUser } from '../../features/chat/chatThunks'
import { deleteChatHistory } from '../../services/api'
import { useChat } from '../hooks/useChat'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'

export interface ChatWindowProps {
  baseUrl?: string
  theme?: 'light' | 'dark'
  title?: string
  subtitle?: string
  token?: string
  storeKey?: string
}

export function ChatWindow(props: ChatWindowProps) {
  const { store, persistor } = useMemo(() => makeStore(props.storeKey ?? 'chatbot'), [props.storeKey])
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ChatWindowInner {...props} />
      </PersistGate>
    </Provider>
  )
}

function ChatWindowInner({
  baseUrl = '',
  theme = 'light',
  title = 'EasySync Chat',
  subtitle = 'Assistente de vendas',
  token,
}: ChatWindowProps) {
  const dispatch = useAppDispatch()
  const bearerToken = useAppSelector((s) => s.chat.bearerToken)
  const storedBaseUrl = useAppSelector((s) => s.chat.baseUrl)
  const loginStatus = useAppSelector((s) => s.chat.status)
  const loginError = useAppSelector((s) => s.chat.error)
  const { messages, isLoading, error, send, dismissError } = useChat()

  const [loginBaseUrl, setLoginBaseUrl] = useState(baseUrl || 'http://localhost:8080')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    dispatch(setBaseUrl(baseUrl))
  }, [baseUrl, dispatch])

  useEffect(() => {
    if (token !== undefined) {
      dispatch(setToken(token))
    }
  }, [token, dispatch])

  const isLoggedIn = !!token || !!bearerToken
  const isDark = theme === 'dark'

  if (!isLoggedIn) {
    return (
      <div
        className={`chat-window flex flex-col h-full min-h-0 overflow-hidden rounded-2xl border shadow-lg items-center justify-center ${
          isDark ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'
        }`}
      >
        <div className={`w-full max-w-sm p-8 rounded-2xl shadow-md ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-blue-500 flex items-center justify-center shadow-sm">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
              </svg>
            </div>
            <div>
              <h2 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</h2>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{subtitle}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                URL do servidor
              </label>
              <input
                type="text"
                className={`w-full text-sm px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-400 ${
                  isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-200 text-gray-800'
                }`}
                value={loginBaseUrl}
                onChange={(e) => setLoginBaseUrl(e.target.value)}
                placeholder="http://localhost:8080"
              />
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                Usuário
              </label>
              <input
                type="text"
                className={`w-full text-sm px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-400 ${
                  isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-200 text-gray-800'
                }`}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="usuário"
                autoComplete="username"
              />
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                Senha
              </label>
              <input
                type="password"
                className={`w-full text-sm px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-400 ${
                  isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-200 text-gray-800'
                }`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') dispatch(loginUser({ baseUrl: loginBaseUrl, username, password }))
                }}
              />
            </div>

            {loginError && (
              <p className="text-xs text-red-500">{loginError}</p>
            )}

            <button
              className="w-full mt-1 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-blue-500 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              disabled={loginStatus === 'loading'}
              onClick={() => dispatch(loginUser({ baseUrl: loginBaseUrl, username, password }))}
            >
              {loginStatus === 'loading' ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </div>
      </div>
    )
  }

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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
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
          {!token && (
            <button
              className={`chat-logout-btn p-2 rounded-lg transition-colors ${
                isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              }`}
              onClick={() => dispatch(setToken(''))}
              title="Sair"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          )}
          <button
            className={`chat-clear-btn p-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
            }`}
            onClick={async () => {
              try {
                await deleteChatHistory(baseUrl || storedBaseUrl, bearerToken || undefined)
                dispatch(clearMessages())
              } catch (err) {
                dispatch(setError(err instanceof Error ? err.message : 'Erro ao excluir histórico'))
              }
            }}
            title="Limpar conversa"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
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
