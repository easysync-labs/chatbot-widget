import { OrderMessageResponse, OrderItemDto, PendingItemSelectionDto, SelectionEntry, OrderState } from '../features/chat/types'

const PATHS = {
  login: '/api/login',
  message: '/api/order/chat/message',
  selectProduct: '/api/order/chat/select-product',
  history: '/api/order/chat/history',
}

export async function login(baseUrl: string, username: string, password: string): Promise<string> {
  const response = await fetch(buildUrl(baseUrl, PATHS.login), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Erro ${response.status}: ${text || response.statusText}`)
  }

  const data = await response.json()
  if (!data.token) throw new Error('Resposta de login inválida: campo "token" ausente')
  return data.token as string
}

export interface ChatResult {
  reply: string
  orderId: number
  state: OrderState
  items: OrderItemDto[]
  pendingSelections: PendingItemSelectionDto[]
  totalAmount: number | null
}

function buildUrl(baseUrl: string, path: string): string {
  return baseUrl.replace(/\/$/, '') + path
}

export async function sendChatMessage(baseUrl: string, message: string, bearerToken?: string): Promise<ChatResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`

  const response = await fetch(buildUrl(baseUrl, PATHS.message), {
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

export async function deleteChatHistory(baseUrl: string, bearerToken?: string): Promise<void> {
  const headers: Record<string, string> = {}
  if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`

  const response = await fetch(buildUrl(baseUrl, PATHS.history), {
    method: 'DELETE',
    headers,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Erro ${response.status}: ${text || response.statusText}`)
  }
}

export async function selectProducts(baseUrl: string, selections: SelectionEntry[], bearerToken?: string): Promise<ChatResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`

  const response = await fetch(buildUrl(baseUrl, PATHS.selectProduct), {
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
