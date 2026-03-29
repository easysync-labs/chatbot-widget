import { useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { sendMessage } from '../../features/chat/chatThunks'
import { clearMessages, clearError } from '../../features/chat/chatSlice'

export function useChat() {
  const dispatch = useAppDispatch()
  const messages = useAppSelector((state) => state.chat.messages)
  const status = useAppSelector((state) => state.chat.status)
  const error = useAppSelector((state) => state.chat.error)

  const send = useCallback(
    (content: string) => {
      const trimmed = content.trim()
      if (!trimmed) return
      dispatch(sendMessage(trimmed))
    },
    [dispatch]
  )

  const reset = useCallback(() => {
    dispatch(clearMessages())
  }, [dispatch])

  const dismissError = useCallback(() => {
    dispatch(clearError())
  }, [dispatch])

  return {
    messages,
    status,
    error,
    isLoading: status === 'loading',
    send,
    reset,
    dismissError,
  }
}
