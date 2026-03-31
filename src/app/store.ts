import { configureStore } from '@reduxjs/toolkit'
import chatReducer from '../features/chat/chatSlice'

export function makeStore() {
  return configureStore({
    reducer: {
      chat: chatReducer,
    },
  })
}

// Tipo derivado da factory — não de uma instância singleton
export type AppStore = ReturnType<typeof makeStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
