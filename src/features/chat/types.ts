export type MessageRole = 'user' | 'assistant' | 'system'

export interface ProductResult {
  productId: number
  subProductId: number
  subDescription: string | null
  shortDescription: string
  fullDescription: string | null
  manufacturer: string | null
  score: number
}

export interface ResponseItem {
  item: string
  products: ProductResult[]
}

export interface Message {
  id: string
  role: MessageRole
  content: string
  createdAt: number
  items?: ResponseItem[]
}

export interface ChatState {
  messages: Message[]
  status: 'idle' | 'loading' | 'error'
  error: string | null
  apiUrl: string
}

// API types
export interface ChatApiMessage {
  role: MessageRole
  content: string
}

export interface ChatApiRequest {
  messages: ChatApiMessage[]
}

export interface ChatApiResponse {
  reply: string
  items?: ResponseItem[]
}
