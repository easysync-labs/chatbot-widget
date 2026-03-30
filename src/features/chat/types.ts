export type MessageRole = 'user' | 'assistant' | 'system'
export type OrderState = 'START' | 'ADDING_ITEMS' | 'SELECTING_PRODUCT' | 'CONFIRMING' | 'DONE'

export interface OrderProductOptionDto {
  index: number
  productId: number
  subProductId: number
  productName: string
  subDescription?: string
  manufacturer?: string
}

export interface PendingItemSelectionDto {
  itemIndex: number
  itemName: string
  quantity: number
  options: OrderProductOptionDto[]
}

export interface SelectionEntry {
  itemIndex: number
  optionIndex: number
}

export interface OrderItemDto {
  productId: number
  productName: string
  quantity: number
  unitPrice: number
  subtotal: number
}

export interface Message {
  id: string
  role: MessageRole
  content: string
  createdAt: number
  items?: OrderItemDto[]
  pendingSelections?: PendingItemSelectionDto[]
  totalAmount?: number
}

export interface ChatState {
  messages: Message[]
  status: 'idle' | 'loading' | 'error'
  error: string | null
  apiUrl: string
  bearerToken: string
  orderId: number | null
  orderState: OrderState | null
  totalAmount: number | null
}

// API types
export interface OrderMessageRequest {
  message: string
}

export interface OrderMessageResponse {
  orderId: number
  state: OrderState
  reply: string
  items?: OrderItemDto[]
  pendingSelections?: PendingItemSelectionDto[]
  totalAmount?: number
}
