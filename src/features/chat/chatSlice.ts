import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { ChatState, Message, OrderState } from './types'
import { sendMessage, selectProductOption } from './chatThunks'

const DEFAULT_API_URL = '/api/order/chat/message'

const initialState: ChatState = {
  messages: [],
  status: 'idle',
  error: null,
  apiUrl: DEFAULT_API_URL,
  bearerToken: '',
  orderId: null,
  orderState: null,
  totalAmount: null,
}

function buildAssistantMessage(requestId: string, payload: ReturnType<typeof sendMessage.fulfilled>['payload'], prefix = 'assistant'): Message {
  return {
    id: `${prefix}-${requestId}`,
    role: 'assistant',
    content: payload.reply,
    createdAt: Date.now(),
    items: payload.items.length > 0 ? payload.items : undefined,
    pendingSelections:
      payload.state === 'SELECTING_PRODUCT' && payload.pendingSelections.length > 0
        ? payload.pendingSelections
        : undefined,
    totalAmount: payload.totalAmount ?? undefined,
  }
}

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setApiUrl(state, action: PayloadAction<string>) {
      state.apiUrl = action.payload
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
      state.orderId = null
      state.orderState = null
      state.totalAmount = null
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
        state.messages.push({
          id: `user-${action.meta.requestId}`,
          role: 'user',
          content: action.meta.arg,
          createdAt: Date.now(),
        })
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.status = 'idle'
        state.orderId = action.payload.orderId
        state.orderState = action.payload.state as OrderState
        state.totalAmount = action.payload.totalAmount
        state.messages.push(buildAssistantMessage(action.meta.requestId, action.payload))
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.status = 'error'
        state.error = action.error.message ?? 'Erro ao enviar mensagem'
      })
      .addCase(selectProductOption.pending, (state, action) => {
        state.status = 'loading'
        state.error = null
        state.messages.push({
          id: `user-select-${action.meta.requestId}`,
          role: 'user',
          content: action.meta.arg.summary,
          createdAt: Date.now(),
        })
      })
      .addCase(selectProductOption.fulfilled, (state, action) => {
        state.status = 'idle'
        state.orderId = action.payload.orderId
        state.orderState = action.payload.state as OrderState
        state.totalAmount = action.payload.totalAmount
        state.messages.push(buildAssistantMessage(action.meta.requestId, action.payload, 'assistant-select'))
      })
      .addCase(selectProductOption.rejected, (state, action) => {
        state.status = 'error'
        state.error = action.error.message ?? 'Erro ao selecionar produto'
      })
  },
})

export const { setApiUrl, setToken, addMessage, clearMessages, clearError } = chatSlice.actions
export default chatSlice.reducer
