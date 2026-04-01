import { createAsyncThunk } from '@reduxjs/toolkit'
import { RootState } from '../../app/store'
import { login, sendChatMessage, selectProducts, ChatResult } from '../../services/api'
import { SelectionEntry } from './types'

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

export const sendMessage = createAsyncThunk<ChatResult, string, { state: RootState }>(
  'chat/sendMessage',
  async (content, { getState }) => {
    const { baseUrl, bearerToken } = getState().chat
    return sendChatMessage(baseUrl, content, bearerToken)
  }
)

export interface SelectProductPayload {
  selections: SelectionEntry[]
  summary: string
}

export const selectProductOption = createAsyncThunk<ChatResult, SelectProductPayload, { state: RootState }>(
  'chat/selectProductOption',
  async ({ selections }, { getState }) => {
    const { baseUrl, bearerToken } = getState().chat
    return selectProducts(baseUrl, selections, bearerToken)
  }
)
