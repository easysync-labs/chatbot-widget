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

  worker.onmessage = (ev: MessageEvent) => {
    const m = ev.data
    switch (m?.type) {
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
