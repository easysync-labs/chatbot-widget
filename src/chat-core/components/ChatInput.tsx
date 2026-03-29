import { useState, useRef, KeyboardEvent, useEffect } from 'react'

interface ChatInputProps {
  onSend: (message: string) => void
  isLoading: boolean
  disabled?: boolean
}

export function ChatInput({ onSend, isLoading, disabled }: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [value])

  const handleSend = () => {
    if (!value.trim() || isLoading || disabled) return
    onSend(value)
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const isDisabled = isLoading || disabled

  return (
    <div className="chat-input-area border-t border-gray-200 bg-white px-4 py-3">
      <div className="chat-input-container flex items-end gap-2 bg-gray-50 border border-gray-300 rounded-2xl px-4 py-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
        <textarea
          ref={textareaRef}
          className="chat-textarea flex-1 bg-transparent resize-none outline-none text-sm text-gray-800 placeholder-gray-400 max-h-40 py-1.5"
          placeholder="Digite sua mensagem... (Enter para enviar, Shift+Enter para nova linha)"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isDisabled}
          rows={1}
        />
        <button
          className={`chat-send-btn flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
            value.trim() && !isDisabled
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
          onClick={handleSend}
          disabled={!value.trim() || isDisabled}
          title="Enviar mensagem"
        >
          {isLoading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          )}
        </button>
      </div>
      <p className="chat-input-hint text-xs text-gray-400 text-center mt-1.5">
        Shift + Enter para nova linha
      </p>
    </div>
  )
}
