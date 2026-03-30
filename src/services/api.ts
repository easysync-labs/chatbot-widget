import { OrderMessageResponse, OrderItemDto, PendingItemSelectionDto, SelectionEntry, OrderState } from '../features/chat/types'

export interface ChatResult {
  reply: string
  orderId: number
  state: OrderState
  items: OrderItemDto[]
  pendingSelections: PendingItemSelectionDto[]
  totalAmount: number | null
}

export async function sendChatMessage(apiUrl: string, message: string, bearerToken?: string): Promise<ChatResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Erro ${response.status}: ${text || response.statusText}`)
  }

  const data: OrderMessageResponse = await response.json()
  return {
    reply: data.reply,
    orderId: data.orderId,
    state: data.state,
    items: data.items ?? [],
    pendingSelections: data.pendingSelections ?? [],
    totalAmount: data.totalAmount ?? null,
  }
}

export async function selectProducts(apiUrl: string, selections: SelectionEntry[], bearerToken?: string): Promise<ChatResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ selections }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Erro ${response.status}: ${text || response.statusText}`)
  }

  const data: OrderMessageResponse = await response.json()
  return {
    reply: data.reply,
    orderId: data.orderId,
    state: data.state,
    items: data.items ?? [],
    pendingSelections: data.pendingSelections ?? [],
    totalAmount: data.totalAmount ?? null,
  }
}
