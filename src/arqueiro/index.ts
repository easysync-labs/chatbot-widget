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

export interface ArqueiroConfig {
  /** URL base do general (ou rota proxiada do chatbot, ex: "/api/arqueiro"). */
  generalUrl: string
  /** Bearer token usado no Authorization header. Pode mudar com login/refresh. */
  token?: string | null
  /** Intervalo entre pings (default 60s). */
  pingIntervalMs?: number
  /** Callback opcional pra logs/telemetria local. */
  onPing?: (ok: boolean, status?: number, latencyMs?: number, info?: unknown, error?: string) => void
  onStats?: (s: { pings: number; ok: number; fail: number; uptimeS: number }) => void
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
    }
  }

  // Espera worker bootar antes de mandar start (evita race com onmessage handler)
  // Em prática o worker já está pronto antes do primeiro postMessage; mas pra
  // robustez, manda start e o worker enfileira.
  worker.postMessage({
    type: 'start',
    generalUrl: config.generalUrl,
    token: config.token ?? null,
    pingIntervalMs: config.pingIntervalMs ?? 60_000,
  })

  return {
    stop() {
      worker.postMessage({ type: 'stop' })
      // Termina worker depois de pequeno delay pra deixar 'stopped' chegar
      setTimeout(() => worker.terminate(), 200)
    },
    updateToken(token: string | null) {
      worker.postMessage({ type: 'token', token })
    },
  }
}
