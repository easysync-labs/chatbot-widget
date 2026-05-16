import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { ChatState, Message } from './types'
import { sendMessage, loginUser } from './chatThunks'

const initialState: ChatState = {
  messages: [],
  status: 'idle',
  error: null,
  baseUrl: '',
  bearerToken: '',
  sessionId: null,
}

function buildAssistantMessage(
  requestId: string,
  payload: ReturnType<typeof sendMessage.fulfilled>['payload'],
): Message {
  return {
    id: `assistant-${requestId}`,
    role: 'assistant',
    content: payload.reply,
    createdAt: Date.now(),
    items: payload.items.length > 0 ? payload.items : undefined,
  }
}

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setBaseUrl(state, action: PayloadAction<string>) {
      state.baseUrl = action.payload
    },
    setToken(state, action: PayloadAction<string>) {
      state.bearerToken = action.payload
    },
    addMessage(state, action: PayloadAction<Message>) {
      state.messages.push(action.payload)
    },
    clearMessages(state) {
      state.messages = []
      state.status = 'idle'
      state.error = null
      state.sessionId = null  // próxima mensagem cria sessão nova no servidor
    },
    clearError(state) {
      state.error = null
      state.status = 'idle'
    },
    setError(state, action: PayloadAction<string>) {
      state.error = action.payload
      state.status = 'error'
    },
    setSessionId(state, action: PayloadAction<string | null>) {
      state.sessionId = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendMessage.pending, (state, action) => {
        state.status = 'loading'
        state.error = null
        state.messages.push({
          id: `user-${action.meta.requestId}`,
          role: 'user',
          content: action.meta.arg,
          createdAt: Date.now(),
        })
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.status = 'idle'
        // Captura sessionId do servidor (gerado no 1º turn, mantido nos seguintes).
        if (action.payload.sessionId) {
          state.sessionId = action.payload.sessionId
        }
        state.messages.push(buildAssistantMessage(action.meta.requestId, action.payload))
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.status = 'error'
        state.error = action.error.message ?? 'Erro ao enviar mensagem'
      })
      .addCase(loginUser.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.status = 'idle'
        state.bearerToken = action.payload
        state.baseUrl = action.meta.arg.baseUrl
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.status = 'error'
        state.error = action.error.message ?? 'Erro ao fazer login'
      })
  },
})

export const {
  setBaseUrl,
  setToken,
  addMessage,
  clearMessages,
  clearError,
  setError,
  setSessionId,
} = chatSlice.actions
export default chatSlice.reducer
