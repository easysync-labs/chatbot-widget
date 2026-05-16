export type MessageRole = 'user' | 'assistant' | 'system'

/**
 * Produto retornado pela busca vetorial do chatbot.
 * Espelha {@code ProductSearchResult} do integrator
 * (com.easysync.integrator.dto.Chatbot.ProductSearchResult).
 */
export interface ChatbotProduct {
  productId: number
  subProductId: number
  sku: string
  shortDescription?: string
  fullDescription?: string
  subDescription?: string
  manufacturer?: string
  detailedDescription?: string
  score: number

  // Hidratado via ProductPricePolicySummary da filial do usuário
  priceCompanyId?: number | null
  retailPrice?: number | null
  retailPromotionPrice?: number | null
  wholesalePrice?: number | null
  effectivePrice?: number | null
}

/** Grupo de produtos para um item extraído da mensagem do usuário. */
export interface ChatbotResponseItem {
  item: string
  products: ChatbotProduct[]
}

export interface Message {
  id: string
  role: MessageRole
  content: string
  createdAt: number
  /** Itens agrupados retornados pelo backend para esta mensagem (se houver). */
  items?: ChatbotResponseItem[]
}

export interface ChatState {
  messages: Message[]
  status: 'idle' | 'loading' | 'error'
  error: string | null
  baseUrl: string
  bearerToken: string
  /** Identificador da sessão de chat persistida no servidor (gerado no 1º turn). */
  sessionId: string | null
}

// -------------------- API types --------------------

export interface ChatbotChatMessage {
  role: MessageRole
  content: string
}

export interface ChatbotChatRequest {
  messages: ChatbotChatMessage[]
  sessionId?: string
  topKProducts?: number
  model?: string
}

export interface ChatbotChatResponse {
  reply: string
  items: ChatbotResponseItem[]
  sessionId: string
}
