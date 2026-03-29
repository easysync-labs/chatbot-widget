import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { ChatState, Message } from './types'
import { sendMessage } from './chatThunks'

const DEFAULT_API_URL = '/api/chatbot/chat'

const initialState: ChatState = {
  messages: [],
  status: 'idle',
  error: null,
  apiUrl: DEFAULT_API_URL,
}

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setApiUrl(state, action: PayloadAction<string>) {
      state.apiUrl = action.payload
    },
    addMessage(state, action: PayloadAction<Message>) {
      state.messages.push(action.payload)
    },
    clearMessages(state) {
      state.messages = []
      state.status = 'idle'
      state.error = null
    },
    clearError(state) {
      state.error = null
      state.status = 'idle'
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendMessage.pending, (state, action) => {
        state.status = 'loading'
        state.error = null
        // Add user message immediately so it shows while waiting
        state.messages.push({
          id: `user-${action.meta.requestId}`,
          role: 'user',
          content: action.meta.arg,
          createdAt: Date.now(),
        })
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.status = 'idle'
        state.messages.push({
          id: `assistant-${action.meta.requestId}`,
          role: 'assistant',
          content: action.payload.reply,
          createdAt: Date.now(),
          items: action.payload.items.length > 0 ? action.payload.items : undefined,
        })
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.status = 'error'
        state.error = action.error.message ?? 'Erro ao enviar mensagem'
      })
  },
})

export const { setApiUrl, addMessage, clearMessages, clearError } = chatSlice.actions
export default chatSlice.reducer
