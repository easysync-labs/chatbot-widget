/**
 * Arqueiro Web Worker (v0.7.0) — treina CelulaDist localmente, comunica
 * com o broker (NestJS via socket.io OU Spring via STOMP).
 *
 * Dois transports selecionáveis:
 *  - 'socketio' (default): conecta em ${serverUrl}/arqueiro com JWT no
 *    handshake auth, usa emitWithAck('rpc', ...). NestJS easysync-server.
 *  - 'stomp': conecta em ${serverUrl}/ws (SockJS-compatible Spring),
 *    JWT no header Authorization do CONNECT, envia /app/arqueiro/rpc
 *    com correlation-id, escuta /user/queue/arqueiro-reply. Integrator
 *    Java.
 *
 * O general (volunteer.py em modo --general) é único: recebe POST
 * /arqueiro/rpc do broker e despacha por evento. Mesmo {event, context}
 * dos dois lados.
 */
// PRIMEIRO IMPORT: shimar window/document/process antes de qualquer lib
// Node-ish (sockjs-client). ES module imports são hoisted, então este
// arquivo separado garante que os polyfills rodem antes dos outros imports.
import './worker-polyfills'
import { StateDict, stateDictFromJSON, stateDictToJSON } from './tensor'
import { Cell } from './celula'
import { AdamW, clipGradNorm } from './adam'
import { io, Socket } from 'socket.io-client'
import { Client as StompClient, IFrame, IMessage } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

type TransportKind = 'socketio' | 'stomp'

type StartMsg = {
  type: 'start'
  serverUrl: string
  token?: string | null
  pingIntervalMs?: number
  trainEnabled?: boolean
  transport?: TransportKind
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

interface Transport {
  connect(): void
  disconnect(): void
  isConnected(): boolean
  rpc<T = unknown>(event: string, context?: unknown, timeoutMs?: number): Promise<{ ok: boolean; data?: T; error?: string }>
}

const state = {
  serverUrl: '',
  token: null as string | null,
  transport: null as Transport | null,
  transportKind: 'socketio' as TransportKind,
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

// ============================ Socket.IO Transport ============================

function makeSocketIOTransport(): Transport {
  let socket: Socket | null = null
  return {
    connect() {
      if (socket || !state.serverUrl) return
      const url = state.serverUrl.replace(/\/+$/, '')
      socket = io(`${url}/arqueiro`, {
        auth: { token: state.token || '' },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 2_000,
        reconnectionDelayMax: 30_000,
        timeout: 10_000,
      })
      socket.on('connect', () => post({ type: 'connect' }))
      socket.on('disconnect', (reason: string) => post({ type: 'disconnect', reason }))
      socket.on('ready', (info: { userId: string }) => post({ type: 'ready', userId: info.userId }))
      socket.on('unauthorized', (info: { reason: string }) => post({ type: 'unauthorized', reason: info.reason }))
      socket.onAny((event: string, payload: unknown) => {
        if (['connect', 'disconnect', 'ready', 'unauthorized', 'connect_error'].includes(event)) return
        post({ type: 'event', name: event, payload })
      })
    },
    disconnect() {
      socket?.disconnect()
      socket = null
    },
    isConnected() {
      return !!socket?.connected
    },
    async rpc(event, context, timeoutMs = 30_000) {
      if (!socket?.connected) return { ok: false, error: 'not connected' }
      try {
        const ack: any = await socket.timeout(timeoutMs).emitWithAck('rpc', { event, context: context ?? {} })
        return ack ?? { ok: false, error: 'no ack' }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    },
  }
}

// ============================== STOMP Transport ==============================
// Conecta em ${serverUrl}/ws via WebSocket puro (sem SockJS — Web Worker não
// tem `window`). RPC via correlation-id no SEND e MESSAGE de retorno.

function makeStompTransport(): Transport {
  let client: StompClient | null = null
  let connected = false
  let userId: string | null = null
  const pending = new Map<string, (payload: any) => void>()

  function genCorrelationId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }

  return {
    connect() {
      if (client || !state.serverUrl) return
      const url = state.serverUrl.replace(/\/+$/, '')
      // Mesmo padrão do PDV existente (Websocket/index.tsx): SockJS em /ws.
      // Spring com .withSockJS() expõe SockJS no /ws e WS direto em /ws/websocket.
      // Usar SockJS aqui mantém um único path no nginx/cloudflared, e o canal
      // /user/queue/... já é per-user (Spring resolve via convertAndSendToUser).
      client = new StompClient({
        webSocketFactory: () => new SockJS(`${url}/ws`),
        connectHeaders: { Authorization: `Bearer ${state.token || ''}` },
        reconnectDelay: 2_000,
        heartbeatIncoming: 30_000,
        heartbeatOutgoing: 30_000,
      })
      client.onConnect = (frame: IFrame) => {
        connected = true
        userId = (frame.headers['user-name'] as string | undefined) || null
        post({ type: 'connect' })
        if (userId) post({ type: 'ready', userId })
        // Subscreve fila de respostas RPC
        client!.subscribe('/user/queue/arqueiro-reply', (msg: IMessage) => {
          const corr = msg.headers['correlation-id'] as string | undefined
          if (!corr) return
          const resolver = pending.get(corr)
          if (resolver) {
            pending.delete(corr)
            try {
              resolver(JSON.parse(msg.body))
            } catch (e) {
              resolver({ ok: false, error: 'parse error: ' + (e instanceof Error ? e.message : String(e)) })
            }
          }
        })
      }
      client.onStompError = (frame: IFrame) => {
        const msg = frame.headers['message'] as string | undefined
        const detail = frame.body ? `: ${frame.body.slice(0, 200)}` : ''
        post({ type: 'unauthorized', reason: (msg || 'stomp error') + detail })
      }
      client.onWebSocketError = (ev: any) => {
        post({ type: 'event', name: 'ws_error', payload: { message: ev?.message, type: ev?.type } })
      }
      client.onWebSocketClose = (ev: any) => {
        connected = false
        post({ type: 'disconnect', reason: `ws closed (code=${ev?.code} reason=${ev?.reason || 'n/a'})` })
      }
      try {
        client.activate()
      } catch (e) {
        post({ type: 'unauthorized', reason: 'activate failed: ' + (e instanceof Error ? e.message : String(e)) })
      }
    },
    disconnect() {
      try {
        client?.deactivate()
      } catch (_) { /* noop */ }
      client = null
      connected = false
      pending.clear()
    },
    isConnected() {
      return connected
    },
    async rpc(event, context, timeoutMs = 30_000) {
      if (!client || !connected) return { ok: false, error: 'not connected' }
      const corr = genCorrelationId()
      return await new Promise(resolve => {
        const timer = setTimeout(() => {
          pending.delete(corr)
          resolve({ ok: false, error: 'timeout' })
        }, timeoutMs)
        pending.set(corr, (payload) => {
          clearTimeout(timer)
          resolve(payload)
        })
        try {
          client!.publish({
            destination: '/app/arqueiro/rpc',
            headers: { 'correlation-id': corr, 'content-type': 'application/json' },
            body: JSON.stringify({ event, context: context ?? {} }),
          })
        } catch (e) {
          clearTimeout(timer)
          pending.delete(corr)
          resolve({ ok: false, error: e instanceof Error ? e.message : String(e) })
        }
      })
    },
  }
}

// =============================== Loops compartilhados =========================

async function rpc<T = unknown>(event: string, context?: unknown, timeoutMs = 30_000) {
  if (!state.transport) return { ok: false, error: 'transport not initialized' } as { ok: boolean; data?: T; error?: string }
  return state.transport.rpc<T>(event, context, timeoutMs)
}

async function ping() {
  if (state.stopped || !state.transport?.isConnected()) return
  const t0 = performance.now()
  state.pings++
  const ack = await rpc('health', {}, 10_000)
  const latencyMs = Math.round(performance.now() - t0)
  if (ack.ok) {
    state.ok++
    post({ type: 'health', ok: true, latencyMs, info: ack.data })
  } else {
    state.fail++
    post({ type: 'health', ok: false, latencyMs, error: ack.error })
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
  if (!state.trainEnabled || !state.transport?.isConnected()) return
  const t0 = performance.now()

  const ack = await rpc<{
    state_dict: Record<string, { data: number[]; shape: number[] }>
    corpus_chunk: string; n_steps: number; batch_size: number; ctx: number; lr: number
  }>('job_request')
  if (!ack.ok || !ack.data) {
    post({ type: 'job', ok: false, error: ack.error || 'no job' })
    return
  }
  const job = ack.data

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
    await new Promise(r => setTimeout(r, 0))
  }
  const wallMs = Math.round(performance.now() - t0)
  const lossInicial = losses.slice(0, 5).reduce((a, b) => a + b, 0) / Math.max(losses.slice(0, 5).length, 1)
  const lossFinal = losses.slice(-5).reduce((a, b) => a + b, 0) / Math.max(losses.slice(-5).length, 1)

  state.jobs++
  const sub = await rpc('submit', {
    state_dict: stateDictToJSON(sd),
    loss_inicial: lossInicial,
    loss_final: lossFinal,
    n_steps_completed: losses.length,
    wall_time_seconds: wallMs / 1000,
    arqueiro_id: 'js-worker',
    device: 'cpu-js',
  })

  post({
    type: 'job',
    ok: !!sub.ok,
    loss: lossFinal, lossInicial, lossFinal,
    nSteps: losses.length, wallMs,
    error: sub.ok ? undefined : sub.error,
  })
}

async function jobLoop() {
  if (state.jobLoopRunning) return
  state.jobLoopRunning = true
  while (!state.stopped) {
    if (state.transport?.isConnected()) {
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
    state.transportKind = msg.transport ?? 'socketio'
    if (msg.pingIntervalMs) state.pingIntervalMs = msg.pingIntervalMs
    if (msg.trainEnabled !== undefined) state.trainEnabled = msg.trainEnabled
    state.transport = state.transportKind === 'stomp' ? makeStompTransport() : makeSocketIOTransport()
    state.transport.connect()
    if (state.pingTimer) clearInterval(state.pingTimer)
    state.pingTimer = setInterval(ping, state.pingIntervalMs)
    if (state.trainEnabled) void jobLoop()
  } else if (msg.type === 'token') {
    state.token = msg.token
    if (state.transport) {
      state.transport.disconnect()
      state.transport.connect()
    }
  } else if (msg.type === 'stop') {
    state.stopped = true
    if (state.pingTimer) clearInterval(state.pingTimer)
    state.transport?.disconnect()
    state.transport = null
    post({ type: 'stopped' })
  }
}

post({ type: 'boot' })
