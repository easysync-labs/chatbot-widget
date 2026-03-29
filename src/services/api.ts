import { Message, ChatApiResponse, ResponseItem } from '../features/chat/types'

export interface ChatResult {
  reply: string
  items: ResponseItem[]
}

export async function sendChatMessage(apiUrl: string, messages: Message[]): Promise<ChatResult> {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: messages.map(({ role, content }) => ({ role, content })),
    }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Erro ${response.status}: ${text || response.statusText}`)
  }

  const data: ChatApiResponse = await response.json()
  return { reply: data.reply, items: data.items ?? [] }
}
