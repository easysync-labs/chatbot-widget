import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Message } from '../../features/chat/types'
import { ProductCards } from './ProductCards'
import { ProductOptions } from './ProductOptions'

interface MessageItemProps {
  message: Message
}

export function MessageItem({ message }: MessageItemProps) {
  const { role, content } = message

  if (role === 'system') {
    return (
      <div className="chat-msg-system flex justify-center my-2">
        <span className="chat-msg-system-text text-xs text-gray-400 italic px-4 py-1 bg-gray-100 rounded-full">
          {content}
        </span>
      </div>
    )
  }

  const isUser = role === 'user'

  return (
    <div className={`chat-msg-row flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="chat-msg-avatar flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center mr-2 mt-1">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2"
            />
          </svg>
        </div>
      )}

      <div className={`flex flex-col gap-2 ${isUser ? '' : 'max-w-[80%]'}`}>
        <div
          className={`chat-msg-bubble rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? 'bg-blue-600 text-white rounded-br-sm max-w-[75vw]'
              : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm shadow-sm'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{content}</p>
          ) : (
            <div className="chat-msg-markdown prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          )}
        </div>

        {!isUser && message.pendingSelections && message.pendingSelections.length > 0 && (
          <ProductOptions pendingSelections={message.pendingSelections} />
        )}
        {!isUser && message.items && message.items.length > 0 && (
          <ProductCards items={message.items} totalAmount={message.totalAmount} />
        )}
      </div>

      {isUser && (
        <div className="chat-msg-avatar flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center ml-2 mt-1">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
      )}
    </div>
  )
}
