/**
 * Arqueiro Web Worker (stub v0.2.0)
 *
 * Roda em thread separada do widget. Hoje só pinga /arqueiro/health
 * a cada 60s pra validar canal + auth com o general da organização.
 *
 * Próxima versão (v0.3.0) vai treinar a CelulaDist localmente e submeter
 * deltas via /arqueiro/submit. A infra de bootstrap, auth e idle detection
 * é a mesma — apenas adiciona o loop de training.
 */

type StartMsg = { type: 'start'; generalUrl: string; token?: string; pingIntervalMs?: number }
type TokenMsg = { type: 'token'; token: string | null }
type StopMsg = { type: 'stop' }
type InMsg = StartMsg | TokenMsg | StopMsg

type OutMsg =
  | { type: 'boot' }
  | { type: 'ping'; ok: boolean; status?: number; latencyMs: number; info?: unknown; error?: string }
  | { type: 'stats'; pings: number; ok: number; fail: number; uptimeS: number }
  | { type: 'stopped' }

const state = {
  generalUrl: '',
  token: null as string | null,
  timer: 0 as unknown as ReturnType<typeof setInterval>,
  pingIntervalMs: 60_000,
  stopped: false,
  bootTs: Date.now(),
  pings: 0,
  ok: 0,
  fail: 0,
}

function post(msg: OutMsg) {
  ;(self as unknown as Worker).postMessage(msg)
}

async function ping() {
  if (state.stopped || !state.generalUrl) return
  const t0 = performance.now()
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (state.token) headers.Authorization = `Bearer ${state.token}`
  state.pings++
  try {
    const r = await fetch(`${state.generalUrl}/arqueiro/health`, {
      method: 'GET',
      headers,
      // Não envia cookie cross-origin (auth é Bearer-only)
      credentials: 'omit',
      // Timeout via AbortController
      signal: AbortSignal.timeout(10_000),
    })
    const latencyMs = Math.round(performance.now() - t0)
    if (r.ok) {
      state.ok++
      const info = await r.json().catch(() => ({}))
      post({ type: 'ping', ok: true, status: r.status, latencyMs, info })
    } else {
      state.fail++
      post({ type: 'ping', ok: false, status: r.status, latencyMs })
    }
  } catch (err) {
    state.fail++
    post({
      type: 'ping',
      ok: false,
      latencyMs: Math.round(performance.now() - t0),
      error: err instanceof Error ? err.message : String(err),
    })
  }
  post({
    type: 'stats',
    pings: state.pings,
    ok: state.ok,
    fail: state.fail,
    uptimeS: Math.round((Date.now() - state.bootTs) / 1000),
  })
}

self.onmessage = (ev: MessageEvent<InMsg>) => {
  const msg = ev.data
  if (msg.type === 'start') {
    state.generalUrl = msg.generalUrl.replace(/\/+$/, '')
    state.token = msg.token ?? null
    if (msg.pingIntervalMs) state.pingIntervalMs = msg.pingIntervalMs
    if (state.timer) clearInterval(state.timer)
    state.timer = setInterval(ping, state.pingIntervalMs)
    void ping() // ping inicial
  } else if (msg.type === 'token') {
    state.token = msg.token
  } else if (msg.type === 'stop') {
    state.stopped = true
    if (state.timer) clearInterval(state.timer)
    post({ type: 'stopped' })
  }
}

post({ type: 'boot' })
