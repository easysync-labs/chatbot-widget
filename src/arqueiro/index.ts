/**
 * Arqueiro Manager — controle do Web Worker do lado main.
 *
 * Spawn lazy: só cria worker quando ChatWindow é montado com config.
 * Lifecycle: start ↔ stop. Token pode ser atualizado em runtime.
 *
 * Workflow geral (Multiverso Distribuído):
 *   browser (este worker) → general da org → coord supremo
 *
 * O general expõe HTTP server local; o backend do chatbot tipicamente
 * proxia /api/arqueiro/* → http://localhost:9211/arqueiro/* aplicando
 * o middleware JWT já existente, então o worker chama mesma origem.
 */
import ArqueiroWorker from './worker?worker&inline'
import { connectArqueiroSocket, SocketHandle } from './socket'

export interface ArqueiroConfig {
  /** URL base do general (ou rota proxiada do chatbot, ex: "/api/arqueiro"). */
  generalUrl: string
  /** Bearer token usado no Authorization header. Pode mudar com login/refresh. */
  token?: string | null
  /** Intervalo entre pings (default 60s). */
  pingIntervalMs?: number
  /** Habilita training loop (v0.3.0+). Default true. Setar false pra ping-only. */
  trainEnabled?: boolean
  /**
   * Habilita canal WebSocket bidirecional (v0.4.0 fase 1). Default true se token presente.
   * O canal conecta em `${generalUrl}/arqueiro` (socket.io namespace) com JWT no handshake.
   * Server (NestJS ArqueiroGateway) valida e mantém conexão.
   * Por enquanto só estabelece canal — broadcast/push do general vem na próxima fase.
   */
  socketEnabled?: boolean
  /** Callback opcional pra logs/telemetria local. */
  onPing?: (ok: boolean, status?: number, latencyMs?: number, info?: unknown, error?: string) => void
  onStats?: (s: { jobs: number; pings: number; ok: number; fail: number; uptimeS: number }) => void
  onJob?: (ok: boolean, info?: { loss?: number; lossInicial?: number; lossFinal?: number; nSteps?: number; wallMs?: number; error?: string }) => void
  onSocketReady?: (info: { userId: string }) => void
  onSocketEvent?: (eventName: string, payload: unknown) => void
  onSocketDisconnect?: (reason: string) => void
}

export interface ArqueiroHandle {
  stop: () => void
  updateToken: (token: string | null) => void
}

/** Spawn um arqueiro. Retorna handle pra parar. */
export function startArqueiro(config: ArqueiroConfig): ArqueiroHandle {
  const worker = new ArqueiroWorker()

  worker.onmessage = (ev: MessageEvent) => {
    const msg = ev.data
    if (msg?.type === 'ping') {
      config.onPing?.(msg.ok, msg.status, msg.latencyMs, msg.info, msg.error)
    } else if (msg?.type === 'stats') {
      config.onStats?.(msg)
    } else if (msg?.type === 'job') {
      config.onJob?.(msg.ok, msg)
    }
  }

  worker.postMessage({
    type: 'start',
    generalUrl: config.generalUrl,
    token: config.token ?? null,
    pingIntervalMs: config.pingIntervalMs ?? 60_000,
    trainEnabled: config.trainEnabled ?? true,
  })

  // Canal WS opcional (default ligado se temos token)
  let sock: SocketHandle | null = null
  const wantSocket = (config.socketEnabled ?? true) && !!config.token
  if (wantSocket) {
    sock = connectArqueiroSocket({
      serverUrl: config.generalUrl,
      token: config.token!,
      onReady: config.onSocketReady,
      onEvent: config.onSocketEvent,
      onDisconnect: config.onSocketDisconnect,
    })
  }

  return {
    stop() {
      worker.postMessage({ type: 'stop' })
      setTimeout(() => worker.terminate(), 200)
      sock?.stop()
    },
    updateToken(token: string | null) {
      worker.postMessage({ type: 'token', token })
      sock?.updateToken(token)
    },
  }
}
