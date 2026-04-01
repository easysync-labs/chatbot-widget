import { configureStore } from '@reduxjs/toolkit'
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist'
import storage from 'redux-persist/lib/storage'
import chatReducer from '../features/chat/chatSlice'

export function makeStore(storeKey = 'chatbot') {
  const persistConfig = {
    key: storeKey,
    storage,

  }

  const persistedReducer = persistReducer(persistConfig, chatReducer)

  const store = configureStore({
    reducer: {
      chat: persistedReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        },
      }),
  })

  const persistor = persistStore(store)

  return { store, persistor }
}

export type AppStore = ReturnType<typeof makeStore>['store']
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
