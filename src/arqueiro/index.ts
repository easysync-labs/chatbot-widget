/**
 * Arqueiro Manager — controle do Web Worker do lado main.
 *
 * v0.5.0: socket.io vive DENTRO do worker (não mais split entre threads).
 * Manager só spawna worker e repassa eventos ao chamador via callbacks.
 *
 * Workflow geral (Multiverso Distribuído):
 *   browser (worker socket.io) → server (NestJS broker) → general (HTTP) → coord
 */
import ArqueiroWorker from './worker?worker&inline'

export type ArqueiroTransport = 'socketio' | 'stomp'

export interface ArqueiroConfig {
  /** URL base do broker (NestJS pra socketio, Spring pra stomp).
   *  Ex: https://api.easysync.com.br ou https://homologacao-app.easysync.com.br */
  serverUrl: string
  /** Bearer JWT — handshake (socketio.auth.token / STOMP CONNECT Authorization). */
  token?: string | null
  /** Intervalo entre pings via WS (default 60s). */
  pingIntervalMs?: number
  /** Habilita training loop (default true). */
  trainEnabled?: boolean
  /** Protocolo do broker. 'socketio' (default, NestJS) ou 'stomp' (Spring /ws). */
  transport?: ArqueiroTransport
  /** UserId do JWT — usado em transport=stomp quando o WebSocketConfig do
   *  servidor exige path explícito /user/{userId}/queue/... (caso do PDV
   *  Spring com ChannelInterceptor de segurança). Sem isso, o subscribe é
   *  silenciosamente bloqueado. */
  userId?: string | number
  // ---- Callbacks ----
  onConnect?: () => void
  onDisconnect?: (reason: string) => void
  onReady?: (info: { userId: string }) => void
  onUnauthorized?: (reason: string) => void
  onHealth?: (ok: boolean, latencyMs: number, info?: unknown, error?: string) => void
  onJob?: (ok: boolean, info?: { loss?: number; lossInicial?: number; lossFinal?: number; nSteps?: number; wallMs?: number; error?: string }) => void
  onStats?: (s: { jobs: number; pings: number; ok: number; fail: number; uptimeS: number }) => void
  /** Eventos custom emitidos pelo server gateway (broadcast, etc). */
  onEvent?: (eventName: string, payload: unknown) => void
}

export interface ArqueiroHandle {
  stop: () => void
  updateToken: (token: string | null) => void
}

export function startArqueiro(config: ArqueiroConfig): ArqueiroHandle {
  const worker = new ArqueiroWorker()

  // Erros não capturados dentro do worker normalmente ficam só no devtools
  // do worker. Surface-amos no console main pra debug ficar visível.
  worker.onerror = (ev: ErrorEvent) => {
    console.error('[arqueiro:worker] erro fatal:', ev.message, ev.filename, ev.lineno, ev.error)
  }
  worker.onmessageerror = (ev: MessageEvent) => {
    console.error('[arqueiro:worker] message error:', ev.data)
  }

  worker.onmessage = (ev: MessageEvent) => {
    const m = ev.data
    if (!m) return
    // Log dos eventos vitais pra debug em produção
    if (m.type === 'connect') console.debug('[arqueiro] connect')
    if (m.type === 'disconnect') console.debug('[arqueiro] disconnect:', m.reason)
    if (m.type === 'ready') console.debug('[arqueiro] ready user=', m.userId)
    if (m.type === 'unauthorized') console.warn('[arqueiro] unauthorized:', m.reason)
    switch (m.type) {
      case 'connect': config.onConnect?.(); break
      case 'disconnect': config.onDisconnect?.(m.reason); break
      case 'ready': config.onReady?.({ userId: m.userId }); break
      case 'unauthorized': config.onUnauthorized?.(m.reason); break
      case 'health': config.onHealth?.(m.ok, m.latencyMs, m.info, m.error); break
      case 'job': config.onJob?.(m.ok, m); break
      case 'stats': config.onStats?.(m); break
      case 'event': config.onEvent?.(m.name, m.payload); break
    }
  }

  worker.postMessage({
    type: 'start',
    serverUrl: config.serverUrl,
    token: config.token ?? null,
    pingIntervalMs: config.pingIntervalMs ?? 60_000,
    trainEnabled: config.trainEnabled ?? true,
    transport: config.transport ?? 'socketio',
    userId: config.userId != null ? String(config.userId) : null,
  })

  return {
    stop() {
      worker.postMessage({ type: 'stop' })
      setTimeout(() => worker.terminate(), 200)
    },
    updateToken(token: string | null) {
      worker.postMessage({ type: 'token', token })
    },
  }
}
