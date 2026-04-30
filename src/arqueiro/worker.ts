/**
 * Arqueiro Web Worker (v0.5.0) — treina CelulaDist localmente, comunica via WS.
 *
 * REST do server foi removido em v0.5.0. Agora:
 *   - Conecta socket.io em ${serverUrl}/arqueiro com JWT no handshake
 *   - emit('job_request') → recebe state_dict + corpus
 *   - treina N steps batch B em JS puro
 *   - emit('submit', { state_dict, losses, ... }) → ack
 *   - sleep entre jobs e repete
 *
 * socket.io-client funciona em Web Worker (sem dependência de DOM).
 */
import { StateDict, stateDictFromJSON, stateDictToJSON } from './tensor'
import { Cell } from './celula'
import { AdamW, clipGradNorm } from './adam'
import { io, Socket } from 'socket.io-client'

type StartMsg = {
  type: 'start'
  serverUrl: string
  token?: string | null
  pingIntervalMs?: number
  trainEnabled?: boolean
}
type TokenMsg = { type: 'token'; token: string | null }
type StopMsg = { type: 'stop' }
type InMsg = StartMsg | TokenMsg | StopMsg

type OutMsg =
  | { type: 'boot' }
  | { type: 'connect' }
  | { type: 'disconnect'; reason: string }
  | { type: 'ready'; userId: string }
  | { type: 'unauthorized'; reason: string }
  | { type: 'health'; ok: boolean; latencyMs: number; info?: unknown; error?: string }
  | { type: 'job'; ok: boolean; loss?: number; lossInicial?: number; lossFinal?: number; nSteps?: number; wallMs?: number; error?: string }
  | { type: 'event'; name: string; payload: unknown }
  | { type: 'stats'; jobs: number; pings: number; ok: number; fail: number; uptimeS: number }
  | { type: 'stopped' }

const state = {
  serverUrl: '',
  token: null as string | null,
  socket: null as Socket | null,
  jobLoopRunning: false,
  pingTimer: 0 as unknown as ReturnType<typeof setInterval>,
  pingIntervalMs: 60_000,
  trainEnabled: true,
  stopped: false,
  bootTs: Date.now(),
  pings: 0,
  ok: 0,
  fail: 0,
  jobs: 0,
}

function post(msg: OutMsg) {
  ;(self as unknown as Worker).postMessage(msg)
}

function ensureSocket() {
  if (state.socket || !state.serverUrl) return
  const url = state.serverUrl.replace(/\/+$/, '')
  state.socket = io(`${url}/arqueiro`, {
    auth: { token: state.token || '' },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 2_000,
    reconnectionDelayMax: 30_000,
    timeout: 10_000,
  })
  state.socket.on('connect', () => post({ type: 'connect' }))
  state.socket.on('disconnect', (reason: string) =>
    post({ type: 'disconnect', reason }))
  state.socket.on('ready', (info: { userId: string }) =>
    post({ type: 'ready', userId: info.userId }))
  state.socket.on('unauthorized', (info: { reason: string }) =>
    post({ type: 'unauthorized', reason: info.reason }))
  state.socket.onAny((event: string, payload: unknown) => {
    if (['connect', 'disconnect', 'ready', 'unauthorized', 'connect_error'].includes(event)) return
    post({ type: 'event', name: event, payload })
  })
}

async function ping() {
  if (state.stopped || !state.socket?.connected) return
  const t0 = performance.now()
  state.pings++
  try {
    const ack = await state.socket.timeout(10_000).emitWithAck('health')
    const latencyMs = Math.round(performance.now() - t0)
    if (ack?.ok) {
      state.ok++
      post({ type: 'health', ok: true, latencyMs, info: ack })
    } else {
      state.fail++
      post({ type: 'health', ok: false, latencyMs, error: 'no ok' })
    }
  } catch (err) {
    state.fail++
    post({
      type: 'health', ok: false,
      latencyMs: Math.round(performance.now() - t0),
      error: err instanceof Error ? err.message : String(err),
    })
  }
  post({
    type: 'stats', jobs: state.jobs, pings: state.pings,
    ok: state.ok, fail: state.fail,
    uptimeS: Math.round((Date.now() - state.bootTs) / 1000),
  })
}

function encodeBytes(s: string): Int32Array {
  const enc = new TextEncoder().encode(s)
  const out = new Int32Array(enc.length)
  for (let i = 0; i < enc.length; i++) out[i] = enc[i]
  return out
}

function getBatch(data: Int32Array, batch: number, ctx: number) {
  if (data.length <= ctx + 1) throw new Error(`corpus muito curto: ${data.length} <= ${ctx + 1}`)
  const x = new Int32Array(batch * ctx)
  const y = new Int32Array(batch * ctx)
  for (let b = 0; b < batch; b++) {
    const start = Math.floor(Math.random() * (data.length - ctx - 1))
    for (let t = 0; t < ctx; t++) {
      x[b * ctx + t] = data[start + t]
      y[b * ctx + t] = data[start + t + 1]
    }
  }
  return { x, y, B: batch, T: ctx }
}

async function runOneJob(): Promise<void> {
  if (!state.trainEnabled || !state.socket?.connected) return
  const t0 = performance.now()

  const ack: any = await state.socket
    .timeout(30_000)
    .emitWithAck('job_request')
    .catch((e: any) => ({ ok: false, error: String(e) }))
  if (!ack?.ok) {
    post({ type: 'job', ok: false, error: ack?.error || 'no job' })
    return
  }
  const job = ack.data as {
    state_dict: Record<string, { data: number[]; shape: number[] }>
    corpus_chunk: string; n_steps: number; batch_size: number; ctx: number; lr: number
  }

  const sd: StateDict = stateDictFromJSON(job.state_dict)
  const cell = new Cell(sd)
  const opt = new AdamW(sd, job.lr || 1e-3)
  const data = encodeBytes(job.corpus_chunk)

  const losses: number[] = []
  for (let step = 0; step < job.n_steps; step++) {
    const { x, y, B, T } = getBatch(data, job.batch_size, job.ctx)
    cell.zeroGrad()
    const loss = cell.trainStep(x, y, B, T)
    if (!isFinite(loss)) break
    clipGradNorm(cell.grads, 1.0)
    opt.update(sd, cell.grads)
    losses.push(loss)
    // Yield no event loop a cada step pra socket.io poder processar ping/pong
    // (treino síncrono Float32Array bloqueia handler do socket).
    await new Promise(r => setTimeout(r, 0))
  }
  const wallMs = Math.round(performance.now() - t0)
  const lossInicial = losses.slice(0, 5).reduce((a, b) => a + b, 0) / Math.max(losses.slice(0, 5).length, 1)
  const lossFinal = losses.slice(-5).reduce((a, b) => a + b, 0) / Math.max(losses.slice(-5).length, 1)

  state.jobs++
  const sub: any = await state.socket
    .timeout(30_000)
    .emitWithAck('submit', {
      state_dict: stateDictToJSON(sd),
      loss_inicial: lossInicial,
      loss_final: lossFinal,
      n_steps_completed: losses.length,
      wall_time_seconds: wallMs / 1000,
      arqueiro_id: 'js-worker',
      device: 'cpu-js',
    })
    .catch((e: any) => ({ ok: false, error: String(e) }))

  post({
    type: 'job',
    ok: !!sub?.ok,
    loss: lossFinal, lossInicial, lossFinal,
    nSteps: losses.length, wallMs,
    error: sub?.ok ? undefined : sub?.error,
  })
}

async function jobLoop() {
  if (state.jobLoopRunning) return
  state.jobLoopRunning = true
  while (!state.stopped) {
    if (state.socket?.connected) {
      try {
        await runOneJob()
      } catch (err) {
        post({ type: 'job', ok: false, error: err instanceof Error ? err.message : String(err) })
      }
    }
    for (let i = 0; i < 30 && !state.stopped; i++) await new Promise(r => setTimeout(r, 1000))
  }
  state.jobLoopRunning = false
}

self.onmessage = (ev: MessageEvent<InMsg>) => {
  const msg = ev.data
  if (msg.type === 'start') {
    state.serverUrl = msg.serverUrl.replace(/\/+$/, '')
    state.token = msg.token ?? null
    if (msg.pingIntervalMs) state.pingIntervalMs = msg.pingIntervalMs
    if (msg.trainEnabled !== undefined) state.trainEnabled = msg.trainEnabled
    ensureSocket()
    if (state.pingTimer) clearInterval(state.pingTimer)
    state.pingTimer = setInterval(ping, state.pingIntervalMs)
    if (state.trainEnabled) void jobLoop()
  } else if (msg.type === 'token') {
    state.token = msg.token
    if (state.socket) {
      state.socket.disconnect()
      state.socket = null
      ensureSocket()
    }
  } else if (msg.type === 'stop') {
    state.stopped = true
    if (state.pingTimer) clearInterval(state.pingTimer)
    state.socket?.disconnect()
    state.socket = null
    post({ type: 'stopped' })
  }
}

post({ type: 'boot' })
