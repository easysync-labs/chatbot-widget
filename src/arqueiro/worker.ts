/**
 * Arqueiro Web Worker (v0.3.0) — treina CelulaDist localmente.
 *
 * Loop:
 *   1. GET /arqueiro/job_json (state_dict + corpus chunk)
 *   2. Carrega state, snapshot pra calcular delta
 *   3. Treina N steps batch B (forward+backward+adam in JS)
 *   4. POST /arqueiro/submit_json com state final + losses
 *   5. Sleep entre jobs e repete
 *
 * v0.2.0 mantida pra retro-compat (modo "ping-only" se receber payload sem state).
 */
import { StateDict, stateDictFromJSON, stateDictToJSON } from './tensor'
import { Cell } from './celula'
import { AdamW, clipGradNorm } from './adam'

type StartMsg = { type: 'start'; generalUrl: string; token?: string; pingIntervalMs?: number; trainEnabled?: boolean }
type TokenMsg = { type: 'token'; token: string | null }
type StopMsg = { type: 'stop' }
type InMsg = StartMsg | TokenMsg | StopMsg

type OutMsg =
  | { type: 'boot' }
  | { type: 'ping'; ok: boolean; status?: number; latencyMs: number; info?: unknown; error?: string }
  | { type: 'job'; ok: boolean; loss?: number; lossInicial?: number; lossFinal?: number; nSteps?: number; wallMs?: number; error?: string }
  | { type: 'stats'; jobs: number; pings: number; ok: number; fail: number; uptimeS: number }
  | { type: 'stopped' }

const state = {
  generalUrl: '',
  token: null as string | null,
  timer: 0 as unknown as ReturnType<typeof setInterval>,
  jobLoopRunning: false,
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

async function ping() {
  if (state.stopped || !state.generalUrl) return
  const t0 = performance.now()
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (state.token) headers.Authorization = `Bearer ${state.token}`
  state.pings++
  try {
    const r = await fetch(`${state.generalUrl}/arqueiro/health`, {
      method: 'GET', headers, credentials: 'omit',
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
    post({ type: 'ping', ok: false, latencyMs: Math.round(performance.now() - t0),
           error: err instanceof Error ? err.message : String(err) })
  }
  post({ type: 'stats', jobs: state.jobs, pings: state.pings, ok: state.ok, fail: state.fail,
         uptimeS: Math.round((Date.now() - state.bootTs) / 1000) })
}

/** Encode UTF-8 string em Int32Array de bytes (vocab=256). */
function encodeBytes(s: string): Int32Array {
  const enc = new TextEncoder().encode(s)
  const out = new Int32Array(enc.length)
  for (let i = 0; i < enc.length; i++) out[i] = enc[i]
  return out
}

/** Sample batch (x, y) de tokens consecutivos. */
function getBatch(data: Int32Array, batch: number, ctx: number): { x: Int32Array; y: Int32Array; B: number; T: number } {
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

async function fetchJobJson(): Promise<{
  state_dict: Record<string, { data: number[]; shape: number[] }>;
  corpus_chunk: string; n_steps: number; batch_size: number; ctx: number; lr: number;
} | null> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (state.token) headers.Authorization = `Bearer ${state.token}`
  const r = await fetch(`${state.generalUrl}/arqueiro/job_json`, {
    method: 'GET', headers, credentials: 'omit',
    signal: AbortSignal.timeout(30_000),
  })
  if (!r.ok) {
    post({ type: 'job', ok: false, error: `job_json HTTP ${r.status}` })
    return null
  }
  return await r.json()
}

async function submitJson(body: unknown): Promise<boolean> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json', Accept: 'application/json',
  }
  if (state.token) headers.Authorization = `Bearer ${state.token}`
  const r = await fetch(`${state.generalUrl}/arqueiro/submit_json`, {
    method: 'POST', headers, credentials: 'omit',
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  })
  if (!r.ok) {
    post({ type: 'job', ok: false, error: `submit HTTP ${r.status}` })
    return false
  }
  return true
}

async function runOneJob(): Promise<void> {
  if (!state.trainEnabled) return
  const t0 = performance.now()
  const job = await fetchJobJson()
  if (!job) return

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
    // Yield pra não travar o thread (browser preempção)
    if (step % 5 === 4) await new Promise(r => setTimeout(r, 0))
  }
  const wallMs = Math.round(performance.now() - t0)
  const lossInicial = losses.slice(0, 5).reduce((a, b) => a + b, 0) / Math.max(losses.slice(0, 5).length, 1)
  const lossFinal = losses.slice(-5).reduce((a, b) => a + b, 0) / Math.max(losses.slice(-5).length, 1)

  state.jobs++
  const okSubmit = await submitJson({
    state_dict: stateDictToJSON(sd),
    loss_inicial: lossInicial,
    loss_final: lossFinal,
    n_steps_completed: losses.length,
    wall_time_seconds: wallMs / 1000,
    arqueiro_id: 'js-worker',
    device: 'cpu-js',
  })
  post({ type: 'job', ok: okSubmit, loss: lossFinal, lossInicial, lossFinal,
         nSteps: losses.length, wallMs })
}

async function jobLoop() {
  if (state.jobLoopRunning) return
  state.jobLoopRunning = true
  while (!state.stopped) {
    try {
      await runOneJob()
    } catch (err) {
      post({ type: 'job', ok: false, error: err instanceof Error ? err.message : String(err) })
    }
    // Sleep 30s entre jobs (idle)
    for (let i = 0; i < 30 && !state.stopped; i++) await new Promise(r => setTimeout(r, 1000))
  }
  state.jobLoopRunning = false
}

self.onmessage = (ev: MessageEvent<InMsg>) => {
  const msg = ev.data
  if (msg.type === 'start') {
    state.generalUrl = msg.generalUrl.replace(/\/+$/, '')
    state.token = msg.token ?? null
    if (msg.pingIntervalMs) state.pingIntervalMs = msg.pingIntervalMs
    if (msg.trainEnabled !== undefined) state.trainEnabled = msg.trainEnabled
    if (state.timer) clearInterval(state.timer)
    state.timer = setInterval(ping, state.pingIntervalMs)
    void ping() // ping inicial
    if (state.trainEnabled) void jobLoop()
  } else if (msg.type === 'token') {
    state.token = msg.token
  } else if (msg.type === 'stop') {
    state.stopped = true
    if (state.timer) clearInterval(state.timer)
    post({ type: 'stopped' })
  }
}

post({ type: 'boot' })
