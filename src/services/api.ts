import {
  ChatbotChatRequest,
  ChatbotChatResponse,
  ChatbotResponseItem,
} from '../features/chat/types'

const PATHS = {
  login: '/api/login',
  chat: '/api/chatbot/chat',
  userProfiles: '/api/chatbot/user-profile',
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
