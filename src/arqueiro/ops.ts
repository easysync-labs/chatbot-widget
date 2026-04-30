/**
 * Operações forward + backward manuais pra CelulaDist em JS.
 *
 * Tudo Float32Array, escrito pra clareza não pra max performance.
 * Backward calcula gradientes por operação direto na call.
 */
import { Shape } from './tensor'

/** Tamanho total de um shape. */
export function nelem(shape: Shape): number {
  return shape.reduce((a, b) => a * b, 1)
}

/** out[i] = a[i] + b[i] (in-place sobre out). a/b/out shape igual. */
export function addInto(out: Float32Array, a: Float32Array, b: Float32Array): void {
  for (let i = 0; i < out.length; i++) out[i] = a[i] + b[i]
}

/** out += a */
export function accumulate(out: Float32Array, a: Float32Array): void {
  for (let i = 0; i < out.length; i++) out[i] += a[i]
}

/** out *= scalar */
export function scaleInPlace(out: Float32Array, s: number): void {
  for (let i = 0; i < out.length; i++) out[i] *= s
}

/**
 * GELU exata. fwd: y = 0.5 * x * (1 + tanh(√(2/π) * (x + 0.044715 * x^3)))
 * Aproximação tanh padrão (mesma que PyTorch).
 */
const GELU_C0 = Math.sqrt(2 / Math.PI)
const GELU_C1 = 0.044715
export function gelu(x: number): number {
  const inner = GELU_C0 * (x + GELU_C1 * x * x * x)
  return 0.5 * x * (1 + Math.tanh(inner))
}
/** Derivada da GELU em x: dy/dx */
export function geluGrad(x: number): number {
  const x3 = x * x * x
  const inner = GELU_C0 * (x + GELU_C1 * x3)
  const tanh = Math.tanh(inner)
  const sech2 = 1 - tanh * tanh
  const dInner = GELU_C0 * (1 + 3 * GELU_C1 * x * x)
  return 0.5 * (1 + tanh) + 0.5 * x * sech2 * dInner
}

/** Embedding lookup: out[b,t,d] = weight[ids[b,t], d]. */
export function embeddingForward(
  weight: Float32Array, // [vocab, dim]
  ids: Int32Array, // [B*T]
  vocab: number, dim: number,
): Float32Array {
  const out = new Float32Array(ids.length * dim)
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    if (id < 0 || id >= vocab) continue
    const src = id * dim
    const dst = i * dim
    for (let d = 0; d < dim; d++) out[dst + d] = weight[src + d]
  }
  return out
}
/** Backward do embedding: gW[id] += gOut[i]. Atomicamente acumula. */
export function embeddingBackward(
  ids: Int32Array, // [B*T]
  gOut: Float32Array, // [B*T*dim]
  gWeight: Float32Array, // [vocab*dim] — modificado in-place (acumula)
  vocab: number, dim: number,
): void {
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    if (id < 0 || id >= vocab) continue
    const dst = id * dim
    const src = i * dim
    for (let d = 0; d < dim; d++) gWeight[dst + d] += gOut[src + d]
  }
}

/** Softmax + cross-entropy combinados (estável numericamente).
 * logits: [B*T, vocab]; labels: [B*T] (Int32).
 * Retorna {loss (scalar), grad (logits → grad)}.
 */
export function softmaxCrossEntropy(
  logits: Float32Array,
  labels: Int32Array,
  vocab: number,
): { loss: number; grad: Float32Array } {
  const N = labels.length
  const grad = new Float32Array(logits.length)
  let totalLoss = 0
  for (let n = 0; n < N; n++) {
    const off = n * vocab
    // max pra estabilidade
    let max = -Infinity
    for (let v = 0; v < vocab; v++) if (logits[off + v] > max) max = logits[off + v]
    // sum exp
    let sumExp = 0
    for (let v = 0; v < vocab; v++) sumExp += Math.exp(logits[off + v] - max)
    const lse = Math.log(sumExp) + max
    const y = labels[n]
    totalLoss += lse - logits[off + y]
    // grad: softmax - one_hot(label), dividido por N (mean reduction)
    const invN = 1 / N
    for (let v = 0; v < vocab; v++) {
      grad[off + v] = (Math.exp(logits[off + v] - lse) - (v === y ? 1 : 0)) * invN
    }
  }
  return { loss: totalLoss / N, grad }
}

/**
 * Linear (matmul + bias): out[b, ovocab] = sum_d (x[b,d] * W[ovocab,d]) + b[ovocab].
 * x: [N, in], W: [out, in], bias: [out] → out: [N, out].
 */
export function linearForward(
  x: Float32Array, w: Float32Array, bias: Float32Array,
  N: number, inDim: number, outDim: number,
): Float32Array {
  const y = new Float32Array(N * outDim)
  for (let n = 0; n < N; n++) {
    const xOff = n * inDim
    const yOff = n * outDim
    for (let o = 0; o < outDim; o++) {
      let acc = bias[o]
      const wOff = o * inDim
      for (let i = 0; i < inDim; i++) acc += x[xOff + i] * w[wOff + i]
      y[yOff + o] = acc
    }
  }
  return y
}
/** Backward do Linear. Retorna gX e acumula em gW + gB. */
export function linearBackward(
  gY: Float32Array, x: Float32Array, w: Float32Array,
  N: number, inDim: number, outDim: number,
  gW: Float32Array, gB: Float32Array,
): Float32Array {
  const gX = new Float32Array(N * inDim)
  for (let n = 0; n < N; n++) {
    const xOff = n * inDim
    const yOff = n * outDim
    for (let o = 0; o < outDim; o++) {
      const gy = gY[yOff + o]
      gB[o] += gy
      const wOff = o * inDim
      for (let i = 0; i < inDim; i++) {
        gW[wOff + i] += gy * x[xOff + i]
        gX[xOff + i] += gy * w[wOff + i]
      }
    }
  }
  return gX
}

/** Cross product 3D em blocos com pad interno (dim%3 != 0).
 * w_im: [dim] (broadcast sobre B,T) ou [B*T, dim]; x_im: [B*T, dim].
 * Retorna cross [B*T, dim]; n_pad = (-dim)%3, blocos = (dim+pad)/3.
 *
 * Pra simplificar, assume w_im é vetor [dim] (mesma forma do agg["S_W_IM"]).
 */
export function cross3dBlock(
  wIm: Float32Array, // [dim]
  xIm: Float32Array, // [N, dim]
  N: number, dim: number,
): Float32Array {
  const out = new Float32Array(N * dim)
  const pad = (3 - (dim % 3)) % 3
  const dimPadded = dim + pad
  const blocks = dimPadded / 3
  // pra cada bloco de 3 elementos, cross w × x
  // (a×b)_i = a_(i+1)*b_(i+2) - a_(i+2)*b_(i+1)
  for (let n = 0; n < N; n++) {
    const xOff = n * dim
    const oOff = n * dim
    for (let bi = 0; bi < blocks; bi++) {
      const base = bi * 3
      const w0 = base + 0 < dim ? wIm[base + 0] : 0
      const w1 = base + 1 < dim ? wIm[base + 1] : 0
      const w2 = base + 2 < dim ? wIm[base + 2] : 0
      const x0 = base + 0 < dim ? xIm[xOff + base + 0] : 0
      const x1 = base + 1 < dim ? xIm[xOff + base + 1] : 0
      const x2 = base + 2 < dim ? xIm[xOff + base + 2] : 0
      // cross = w × x
      if (base + 0 < dim) out[oOff + base + 0] = w1 * x2 - w2 * x1
      if (base + 1 < dim) out[oOff + base + 1] = w2 * x0 - w0 * x2
      if (base + 2 < dim) out[oOff + base + 2] = w0 * x1 - w1 * x0
    }
  }
  return out
}
