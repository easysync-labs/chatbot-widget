import {
  ChatbotChatRequest,
  ChatbotChatResponse,
  ChatbotResponseItem,
} from '../features/chat/types'

const PATHS = {
  login: '/api/login',
  chat: '/api/chatbot/chat',
  userProfiles: '/api/chatbot/user-profile',
  storeProfile: '/api/chatbot/profile',
  selectProduct: '/api/chatbot/select-product',
}

// -------------------- Select Product (carrinho via STOMP) --------------------

/**
 * Notifica o backend de uma seleção do widget. O backend dispara
 * ProductSelectedEvent via STOMP no canal privado do usuário, e o PDV
 * adiciona o produto ao carrinho aberto.
 *
 * Fire-and-forget: o widget não bloqueia na resposta — se o backend falhar,
 * a conversa segue normalmente (o LLM ainda recebe o "Selecionei:" como texto).
 */
export interface ChatbotSelectProductRequest {
  productId: number
  subProductId: number
  productName?: string | null
  subDescription?: string | null
  manufacturer?: string | null
  unitPrice?: number | null
  quantity?: number
}

export async function notifyProductSelected(
  baseUrl: string,
  body: ChatbotSelectProductRequest,
  bearerToken?: string,
): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`
  try {
    await fetch(buildUrl(baseUrl, PATHS.selectProduct), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
  } catch (err) {
    console.warn('[chatbot-widget] notifyProductSelected falhou', err)
  }
}

// -------------------- Store Profile (config da loja, isomorfismo cross-cliente) --------------------

/**
 * Tudo que vira "personalidade do chat" específica do cliente.
 * Esses campos alimentam o system prompt do assistente, o prompt de extração
 * de produtos e o domain guard. O backend é stateless em relação ao domínio —
 * sem esses dados o bot funciona, mas perde a especialização do varejo.
 */
export interface ChatbotStoreProfileResponse {
  razaoSocial?: string | null
  tradingNames?: string[]
  storeName?: string | null
  assistantName?: string | null
  domainKeywords?: string[]
  businessSegment?: string | null
  mainProducts?: string | null
  targetAudience?: string | null
  additionalContext?: string | null
  promptPreview?: string | null
}

export interface ChatbotStoreProfileRequest {
  storeName?: string | null
  assistantName?: string | null
  domainKeywords?: string[]
  businessSegment?: string | null
  mainProducts?: string | null
  targetAudience?: string | null
  additionalContext?: string | null
}

export async function getStoreProfile(
  baseUrl: string,
  bearerToken?: string,
): Promise<ChatbotStoreProfileResponse> {
  const headers: Record<string, string> = {}
  if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`
  const r = await fetch(buildUrl(baseUrl, PATHS.storeProfile), { headers })
  if (!r.ok) {
    const text = await r.text().catch(() => '')
    throw new Error(`Erro ${r.status}: ${text || r.statusText}`)
  }
  return r.json()
}

export async function updateStoreProfile(
  baseUrl: string,
  body: ChatbotStoreProfileRequest,
  bearerToken?: string,
): Promise<ChatbotStoreProfileResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`
  const r = await fetch(buildUrl(baseUrl, PATHS.storeProfile), {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const text = await r.text().catch(() => '')
    throw new Error(`Erro ${r.status}: ${text || r.statusText}`)
  }
  return r.json()
}

// -------------------- User Profile (admin) --------------------

export interface ChatbotUserProfile {
  id?: number
  role: string
  specialty?: string | null
  systemPromptAddon?: string | null
  memoryAccess?: string | null
  canCreateOrder?: boolean
  canSeeCost?: boolean
  canConfig?: boolean
  defaultModel?: string
  maxTokens?: number
  allowedTools?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface ChatbotUserProfileRequest {
  specialty?: string | null
  systemPromptAddon?: string | null
  memoryAccess?: string
  canCreateOrder?: boolean
  canSeeCost?: boolean
  canConfig?: boolean
  defaultModel?: string
  maxTokens?: number
  allowedTools?: string | null
}

export async function listUserProfiles(baseUrl: string, bearerToken?: string): Promise<ChatbotUserProfile[]> {
  const headers: Record<string, string> = {}
  if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`
  const r = await fetch(buildUrl(baseUrl, PATHS.userProfiles), { headers })
  if (!r.ok) {
    const text = await r.text().catch(() => '')
    throw new Error(`Erro ${r.status}: ${text || r.statusText}`)
  }
  return r.json()
}

export async function updateUserProfile(
  baseUrl: string,
  role: string,
  patch: ChatbotUserProfileRequest,
  bearerToken?: string,
): Promise<ChatbotUserProfile> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`
  const r = await fetch(buildUrl(baseUrl, `${PATHS.userProfiles}/${encodeURIComponent(role)}`), {
    method: 'PUT',
    headers,
    body: JSON.stringify(patch),
  })
  if (!r.ok) {
    const text = await r.text().catch(() => '')
    throw new Error(`Erro ${r.status}: ${text || r.statusText}`)
  }
  return r.json()
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

function buildUrl(baseUrl: string, path: string): string {
  return baseUrl.replace(/\/$/, '') + path
}

export interface ChatResult {
  reply: string
  items: ChatbotResponseItem[]
  sessionId: string
}

/**
 * Envia o histórico completo da conversa pro {@code /api/chatbot/chat} e
 * recebe reply + grupos de produtos + sessionId (gerado pelo servidor no 1º
 * turn, reusado nos seguintes pra preservar contexto persistido).
 */
export async function sendChatMessage(
  baseUrl: string,
  payload: ChatbotChatRequest,
  bearerToken?: string,
): Promise<ChatResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`

  const response = await fetch(buildUrl(baseUrl, PATHS.chat), {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Erro ${response.status}: ${text || response.statusText}`)
  }

  const data: ChatbotChatResponse = await response.json()
  return {
    reply: data.reply,
    items: data.items ?? [],
    sessionId: data.sessionId,
  }
}
