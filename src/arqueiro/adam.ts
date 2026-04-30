/**
 * AdamW minimal — atualiza state in-place.
 *
 * Compatível com torch.optim.AdamW default:
 *   m_t = β1*m_{t-1} + (1-β1)*g
 *   v_t = β2*v_{t-1} + (1-β2)*g²
 *   m̂ = m_t / (1-β1^t), v̂ = v_t / (1-β2^t)
 *   p ← p - lr * (m̂/(√v̂+ε) + wd*p)
 *
 * Pra MVP arqueiro, weight_decay=0 (mais simples).
 */
import { Tensor, StateDict } from './tensor'

export class AdamW {
  lr: number
  beta1: number
  beta2: number
  eps: number
  step: number
  m: StateDict
  v: StateDict

  constructor(state: StateDict, lr: number = 1e-3,
              beta1: number = 0.9, beta2: number = 0.999, eps: number = 1e-8) {
    this.lr = lr; this.beta1 = beta1; this.beta2 = beta2; this.eps = eps
    this.step = 0
    this.m = {}
    this.v = {}
    for (const k of Object.keys(state)) {
      this.m[k] = Tensor.zeros([...state[k].shape])
      this.v[k] = Tensor.zeros([...state[k].shape])
    }
  }

  /** Aplica grads em state in-place. */
  update(state: StateDict, grads: StateDict): void {
    this.step++
    const t = this.step
    const correction1 = 1 - Math.pow(this.beta1, t)
    const correction2 = 1 - Math.pow(this.beta2, t)
    const lrCorr = this.lr / correction1
    const b1 = this.beta1, b2 = this.beta2
    for (const k of Object.keys(state)) {
      const p = state[k].data
      const g = grads[k].data
      const m = this.m[k].data
      const v = this.v[k].data
      for (let i = 0; i < p.length; i++) {
        const gi = g[i]
        m[i] = b1 * m[i] + (1 - b1) * gi
        v[i] = b2 * v[i] + (1 - b2) * gi * gi
        const mh = m[i]
        const vh = v[i] / correction2
        p[i] -= lrCorr * mh / (Math.sqrt(vh) + this.eps)
      }
    }
  }
}

/** Clipping de norma global (similar a torch.nn.utils.clip_grad_norm_). */
export function clipGradNorm(grads: StateDict, maxNorm: number = 1.0): number {
  let totalSq = 0
  for (const k of Object.keys(grads)) {
    const g = grads[k].data
    for (let i = 0; i < g.length; i++) totalSq += g[i] * g[i]
  }
  const total = Math.sqrt(totalSq)
  if (total > maxNorm) {
    const scale = maxNorm / total
    for (const k of Object.keys(grads)) {
      const g = grads[k].data
      for (let i = 0; i < g.length; i++) g[i] *= scale
    }
  }
  return total
}
