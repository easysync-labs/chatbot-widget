/**
 * Cliente socket.io pro canal /arqueiro do server.
 *
 * Conexão autenticada via JWT no handshake (`auth: { token }`). Server
 * (NestJS ArqueiroGateway) valida no handleConnection e rejeita se inválido.
 *
 * Fase 1: só estabelece o canal e expõe events. Push/pull de jobs continua
 * via REST (job_json/submit_json) por enquanto. Próxima fase migra também.
 */
import { io, Socket } from 'socket.io-client'

export interface SocketEvents {
  ready: { userId: string }
  unauthorized: { reason: string }
  // genéricos: server pode emitir qualquer event customizado
  [key: string]: unknown
}

export interface SocketHandle {
  /** Atualiza o token (reconecta com novo auth). */
  updateToken: (token: string | null) => void
  /** Encerra o canal. */
  stop: () => void
  /** Acesso bruto ao Socket pra subscribe a eventos extra. */
  raw: () => Socket
}

export interface ArqueiroSocketConfig {
  /** Base URL do server (ex: https://api.easysync.com.br). Ele anexa /arqueiro internamente. */
  serverUrl: string
  /** Bearer JWT pra handshake. */
  token: string
  onReady?: (info: { userId: string }) => void
  onUnauthorized?: (info: { reason: string }) => void
  onConnect?: () => void
  onDisconnect?: (reason: string) => void
  onError?: (err: Error) => void
  /** Handler genérico — recebe (eventName, payload) pra qualquer evento custom do general. */
  onEvent?: (eventName: string, payload: unknown) => void
}

/** Lista de eventos "internos" que NÃO disparam onEvent (apenas onReady/onUnauthorized). */
const INTERNAL_EVENTS = new Set([
  'connect', 'disconnect', 'connect_error', 'ready', 'unauthorized',
])

export function connectArqueiroSocket(cfg: ArqueiroSocketConfig): SocketHandle {
  const url = cfg.serverUrl.replace(/\/+$/, '')
  let socket: Socket = io(`${url}/arqueiro`, {
    auth: { token: cfg.token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 2_000,
    reconnectionDelayMax: 30_000,
    timeout: 10_000,
    autoConnect: true,
  })

  socket.on('connect', () => cfg.onConnect?.())
  socket.on('disconnect', (reason: string) => cfg.onDisconnect?.(reason))
  socket.on('connect_error', (err: Error) => cfg.onError?.(err))
  socket.on('ready', (info: { userId: string }) => cfg.onReady?.(info))
  socket.on('unauthorized', (info: { reason: string }) => {
    cfg.onUnauthorized?.(info)
    // server vai disconnect; deixa o reconnect tentar com novo token (se atualizado)
  })

  // Catch-all pra eventos custom (feature do socket.io v4: socket.onAny)
  socket.onAny((eventName: string, payload: unknown) => {
    if (INTERNAL_EVENTS.has(eventName)) return
    cfg.onEvent?.(eventName, payload)
  })

  return {
    updateToken(token: string | null) {
      if (!token) {
        socket.disconnect()
        return
      }
      // socket.io: pra trocar auth, precisa desconectar e re-criar
      socket.auth = { token }
      socket.disconnect()
      socket.connect()
    },
    stop() {
      try { socket.disconnect() } catch { /* ignore */ }
    },
    raw() { return socket },
  }
}
