import { createAsyncThunk } from '@reduxjs/toolkit'
import { RootState } from '../../app/store'
import { sendChatMessage, ChatResult } from '../../services/api'

export const sendMessage = createAsyncThunk<ChatResult, string, { state: RootState }>(
  'chat/sendMessage',
  async (_content, { getState }) => {
    const { messages, apiUrl } = getState().chat
    // messages already includes the user message added by the pending handler
    return sendChatMessage(apiUrl, messages)
  }
)
