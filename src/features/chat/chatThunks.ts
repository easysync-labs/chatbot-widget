import { createAsyncThunk } from '@reduxjs/toolkit'
import { RootState } from '../../app/store'
import { sendChatMessage, selectProducts, ChatResult } from '../../services/api'
import { SelectionEntry } from './types'

export const sendMessage = createAsyncThunk<ChatResult, string, { state: RootState }>(
  'chat/sendMessage',
  async (content, { getState }) => {
    const { apiUrl, bearerToken } = getState().chat
    return sendChatMessage(apiUrl, content, bearerToken)
  }
)

export interface SelectProductPayload {
  selections: SelectionEntry[]
  summary: string
}

export const selectProductOption = createAsyncThunk<ChatResult, SelectProductPayload, { state: RootState }>(
  'chat/selectProductOption',
  async ({ selections }, { getState }) => {
    const { apiUrl, bearerToken } = getState().chat
    const selectUrl = apiUrl.replace('/message', '/select-product')
    return selectProducts(selectUrl, selections, bearerToken)
  }
)
