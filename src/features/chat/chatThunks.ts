import { createAsyncThunk } from '@reduxjs/toolkit'
import { RootState } from '../../app/store'
import { login, sendChatMessage, ChatResult } from '../../services/api'
import { ChatbotChatMessage } from './types'

export interface LoginPayload {
  baseUrl: string
  username: string
  password: string
}

export const loginUser = createAsyncThunk<string, LoginPayload>(
  'chat/loginUser',
  async ({ baseUrl, username, password }) => {
    return login(baseUrl, username, password)
  }
)

/**
 * Envia mensagem do usuário pro /api/chatbot/chat com o histórico completo
 * da sessão atual + sessionId atual (servidor gera no 1º turn).
 */
export const sendMessage = createAsyncThunk<ChatResult, string, { state: RootState }>(
  'chat/sendMessage',
  async (_content, { getState }) => {
    // O extraReducer `pending` (chatSlice) já adicionou a mensagem do usuário
    // ao state antes deste async fn rodar. Logo o histórico do state já é
    // exatamente o que devemos enviar — sem push extra (estava duplicando).
    const { baseUrl, bearerToken, sessionId, messages } = getState().chat

    const history: ChatbotChatMessage[] = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'system')
      .map((m) => ({ role: m.role, content: m.content }))

    return sendChatMessage(
      baseUrl,
      {
        messages: history,
        sessionId: sessionId || undefined,
        topKProducts: 5,
      },
      bearerToken,
    )
  }
)
