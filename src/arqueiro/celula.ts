/**
 * CelulaDist port em JS (TypeScript) — forward + backward manuais.
 *
 * Idêntico em arquitetura ao multiverso_distribuido/celula_dist.py:
 *   vocab=256, dim=32, z=[8,16,8], ctx=128
 *   Embedding(256,32) + Embedding(128,32)
 *   3 Atomos PRTSU
 *   Linear(33, 256)
 *
 * Total: ~22.2k parâmetros. Backward analítico em todos.
 */
import { Tensor, StateDict, cloneStateDict } from './tensor'
import {
  embeddingForward, embeddingBackward,
  softmaxCrossEntropy,
  linearForward, linearBackward,
  cross3dBlock,
  gelu, geluGrad,
} from './ops'

export interface CellConfig {
  vocab: number
  dim: number
  z: [number, number, number]
  ctx: number
  c: number // x_re constant
}

export const DEFAULT_CONFIG: CellConfig = {
  vocab: 256, dim: 32, z: [8, 16, 8], ctx: 128, c: 1.0,
}

/** Caches por átomo pra backward. Tudo Float32Array. */
interface AtomoCache {
  // inputs
  xRe: Float32Array  // [N,1]
  xIm: Float32Array  // [N,dim]
  N: number
  // aggregated values (escalar/vetor [dim])
  P: number          // P_W_RE
  R: Float32Array    // R_W_IM [dim]
  T_re: number       // T_W_RE
  T_im: Float32Array // T_W_IM [dim]
  U_re: number       // U_W_RE
  U_im: Float32Array // U_W_IM [dim]
  S: Float32Array    // S_W_IM [dim]
}

/** Forward de UM Atomo. Retorna {re [N,1], i [N,dim], cache}. */
export function atomoForward(
  xRe: Float32Array, xIm: Float32Array, // [N,1], [N,dim]
  N: number, dim: number, z: number,
  pp: Float32Array, rr: Float32Array, tt: Float32Array, ss: Float32Array, uu: Float32Array,
  wRe: Float32Array, // [z,1] flatten = [z]
  wIm: Float32Array, // [z,dim]
): { re: Float32Array; im: Float32Array; cache: AtomoCache } {
  // aggregate (mean sobre eixo z)
  const invZ = 1 / z
  let P = 0, T_re = 0, U_re = 0
  for (let zi = 0; zi < z; zi++) {
    P += pp[zi] * wRe[zi]
    T_re += tt[zi] * wRe[zi]
    U_re += uu[zi] * wRe[zi]
  }
  P *= invZ; T_re *= invZ; U_re *= invZ

  const R = new Float32Array(dim)
  const T_im = new Float32Array(dim)
  const U_im = new Float32Array(dim)
  const S = new Float32Array(dim)
  for (let zi = 0; zi < z; zi++) {
    const woff = zi * dim
    const r_z = rr[zi], t_z = tt[zi], u_z = uu[zi], s_z = ss[zi]
    for (let d = 0; d < dim; d++) {
      const w = wIm[woff + d]
      R[d] += r_z * w
      T_im[d] += t_z * w
      U_im[d] += u_z * w
      S[d] += s_z * w
    }
  }
  for (let d = 0; d < dim; d++) {
    R[d] *= invZ; T_im[d] *= invZ; U_im[d] *= invZ; S[d] *= invZ
  }

  // re [N,1], im [N,dim]
  const re = new Float32Array(N)
  const im = new Float32Array(N * dim)
  for (let n = 0; n < N; n++) {
    const xr = xRe[n]
    const xOff = n * dim
    // re: P * xRe - sum_d (R[d] * xIm[n,d])
    let sumR = 0
    for (let d = 0; d < dim; d++) sumR += R[d] * xIm[xOff + d]
    re[n] = P * xr - sumR
    // im_sym + im_anti  (cross é adicionado depois)
    for (let d = 0; d < dim; d++) {
      const xi = xIm[xOff + d]
      im[xOff + d] = T_re * xi + xr * T_im[d] + U_re * xi - xr * U_im[d]
    }
  }
  // cross product 3D em blocos
  const cross = cross3dBlock(S, xIm, N, dim)
  for (let i = 0; i < im.length; i++) im[i] += cross[i]

  return { re, im, cache: { xRe, xIm, N, P, R, T_re, T_im, U_re, U_im, S } }
}

/** Backward de UM Atomo. Acumula grads em gP/gR/gT/gS/gU/gW. Retorna gXre, gXim. */
export function atomoBackward(
  gRe: Float32Array, // [N]
  gIm: Float32Array, // [N,dim]
  cache: AtomoCache,
  dim: number, z: number,
  pp: Float32Array, rr: Float32Array, tt: Float32Array, ss: Float32Array, uu: Float32Array,
  wRe: Float32Array, wIm: Float32Array,
  gP_param: Float32Array, gR_param: Float32Array, gT_param: Float32Array,
  gS_param: Float32Array, gU_param: Float32Array,
  gWRe: Float32Array, gWIm: Float32Array,
): { gXre: Float32Array; gXim: Float32Array } {
  const { xRe, xIm, N, P, R, T_re, T_im, U_re, U_im, S } = cache
  const gXre = new Float32Array(N)
  const gXim = new Float32Array(N * dim)

  // Acumuladores de gradientes do agg
  let gP = 0, gT_re = 0, gU_re = 0
  const gR = new Float32Array(dim)
  const gT_im = new Float32Array(dim)
  const gU_im = new Float32Array(dim)
  const gS = new Float32Array(dim)

  // Backward do im_sym + im_anti (sem cross ainda)
  // im[n,d] = T_re*xim + xr*T_im[d] + U_re*xim - xr*U_im[d] + cross[n,d]
  for (let n = 0; n < N; n++) {
    const xr = xRe[n]
    const xOff = n * dim
    // Backward de re[n] = P*xr - sum_d (R[d]*xim[n,d])
    const gReN = gRe[n]
    gP += gReN * xr
    gXre[n] += P * gReN
    for (let d = 0; d < dim; d++) {
      const xi = xIm[xOff + d]
      gR[d] -= gReN * xi
      gXim[xOff + d] -= R[d] * gReN
    }
    // Backward do im[n,d] (parte sem cross)
    for (let d = 0; d < dim; d++) {
      const gI = gIm[xOff + d]
      const xi = xIm[xOff + d]
      // T_re*xi
      gT_re += gI * xi
      gXim[xOff + d] += T_re * gI
      // xr*T_im[d]
      gXre[n] += gI * T_im[d]
      gT_im[d] += gI * xr
      // U_re*xi
      gU_re += gI * xi
      gXim[xOff + d] += U_re * gI
      // -xr*U_im[d]
      gXre[n] -= gI * U_im[d]
      gU_im[d] -= gI * xr
    }
  }

  // Backward do cross3d_block(S, xIm)
  // Pra cada bloco bi de 3 elementos:
  // out[base+0] = S[base+1]*x[base+2] - S[base+2]*x[base+1]
  // out[base+1] = S[base+2]*x[base+0] - S[base+0]*x[base+2]
  // out[base+2] = S[base+0]*x[base+1] - S[base+1]*x[base+0]
  const pad = (3 - (dim % 3)) % 3
  const blocks = (dim + pad) / 3
  for (let n = 0; n < N; n++) {
    const xOff = n * dim
    for (let bi = 0; bi < blocks; bi++) {
      const base = bi * 3
      const i0in = base + 0 < dim
      const i1in = base + 1 < dim
      const i2in = base + 2 < dim
      const x0 = i0in ? xIm[xOff + base + 0] : 0
      const x1 = i1in ? xIm[xOff + base + 1] : 0
      const x2 = i2in ? xIm[xOff + base + 2] : 0
      const s0 = i0in ? S[base + 0] : 0
      const s1 = i1in ? S[base + 1] : 0
      const s2 = i2in ? S[base + 2] : 0
      const g0 = i0in ? gIm[xOff + base + 0] : 0
      const g1 = i1in ? gIm[xOff + base + 1] : 0
      const g2 = i2in ? gIm[xOff + base + 2] : 0
      // gS
      if (i0in) gS[base + 0] += -g1 * x2 + g2 * x1
      if (i1in) gS[base + 1] += g0 * x2 - g2 * x0
      if (i2in) gS[base + 2] += -g0 * x1 + g1 * x0
      // gXim (do cross)
      if (i0in) gXim[xOff + base + 0] += g1 * s2 - g2 * s1
      if (i1in) gXim[xOff + base + 1] += -g0 * s2 + g2 * s0
      if (i2in) gXim[xOff + base + 2] += g0 * s1 - g1 * s0
    }
  }

  // Now propagar gP, gR, gT_re, gT_im, gU_re, gU_im, gS pra (p, r, t, s, u, w_re, w_im)
  // Lembrando: agg = mean_z, então fator (1/z) já está embutido.
  // Backward por elétron zi:
  //   gp[zi] = gP * w_re[zi] / z
  //   gr[zi] = sum_d (gR[d] * w_im[zi,d]) / z
  //   gt[zi] = (gT_re * w_re[zi] + sum_d gT_im[d] * w_im[zi,d]) / z
  //   gu[zi] = (gU_re * w_re[zi] + sum_d gU_im[d] * w_im[zi,d]) / z
  //   gs[zi] = sum_d (gS[d] * w_im[zi,d]) / z
  //   gw_re[zi] = (gP * p[zi] + gT_re * t[zi] + gU_re * u[zi]) / z
  //   gw_im[zi,d] = (gR[d]*r[zi] + gT_im[d]*t[zi] + gU_im[d]*u[zi] + gS[d]*s[zi]) / z
  const invZ = 1 / z
  for (let zi = 0; zi < z; zi++) {
    const wre = wRe[zi]
    const woff = zi * dim
    let gr_z = 0, gs_z = 0, gt_im_z = 0, gu_im_z = 0
    for (let d = 0; d < dim; d++) {
      const w = wIm[woff + d]
      gr_z += gR[d] * w
      gs_z += gS[d] * w
      gt_im_z += gT_im[d] * w
      gu_im_z += gU_im[d] * w
      // gw_im
      gWIm[woff + d] += (gR[d] * rr[zi] + gT_im[d] * tt[zi]
                        + gU_im[d] * uu[zi] + gS[d] * ss[zi]) * invZ
    }
    gP_param[zi] += gP * wre * invZ
    gR_param[zi] += gr_z * invZ
    gT_param[zi] += (gT_re * wre + gt_im_z) * invZ
    gU_param[zi] += (gU_re * wre + gu_im_z) * invZ
    gS_param[zi] += gs_z * invZ
    gWRe[zi] += (gP * pp[zi] + gT_re * tt[zi] + gU_re * uu[zi]) * invZ
  }

  return { gXre, gXim }
}

/** Cell — forward + backward + retorna grad_state_dict. */
export class Cell {
  cfg: CellConfig
  state: StateDict
  // grads correspondentes (mesmas keys, zerados a cada call)
  grads: StateDict

  constructor(state: StateDict, cfg: CellConfig = DEFAULT_CONFIG) {
    this.cfg = cfg
    this.state = state
    this.grads = {}
    for (const k of Object.keys(state)) {
      this.grads[k] = Tensor.zeros([...state[k].shape])
    }
  }

  /** Zera todos os gradientes. */
  zeroGrad(): void {
    for (const k of Object.keys(this.grads)) this.grads[k].zero()
  }

  /** Forward + backward. Retorna loss (scalar). Acumula grads em this.grads. */
  trainStep(ids: Int32Array, labels: Int32Array, B: number, T: number): number {
    const { vocab, dim, z, c } = this.cfg
    const N = B * T

    // ===== forward =====
    // x_im = emb[ids] + pos[arange(T)]
    const embW = this.state['emb.weight'].data
    const posW = this.state['pos.weight'].data
    const xIm = embeddingForward(embW, ids, vocab, dim) // [N, dim]
    // adiciona pos[t] em cada (b,t)
    for (let b = 0; b < B; b++) {
      for (let t = 0; t < T; t++) {
        const off = (b * T + t) * dim
        const pOff = t * dim
        for (let d = 0; d < dim; d++) xIm[off + d] += posW[pOff + d]
      }
    }
    // x_re = constante c
    const xRe = new Float32Array(N).fill(c)

    // Atomos a1 a2 a3
    const a1 = atomoForward(xRe, xIm, N, dim, z[0],
      this.state['a1.p'].data, this.state['a1.r'].data, this.state['a1.t'].data,
      this.state['a1.s'].data, this.state['a1.u'].data,
      this.state['a1.w_re'].data, this.state['a1.w_im'].data)

    // gelu(i1)
    const gelui1 = new Float32Array(a1.im.length)
    for (let i = 0; i < a1.im.length; i++) gelui1[i] = gelu(a1.im[i])

    const a2 = atomoForward(a1.re, gelui1, N, dim, z[1],
      this.state['a2.p'].data, this.state['a2.r'].data, this.state['a2.t'].data,
      this.state['a2.s'].data, this.state['a2.u'].data,
      this.state['a2.w_re'].data, this.state['a2.w_im'].data)

    const gelui2 = new Float32Array(a2.im.length)
    for (let i = 0; i < a2.im.length; i++) gelui2[i] = gelu(a2.im[i])

    const a3 = atomoForward(a2.re, gelui2, N, dim, z[2],
      this.state['a3.p'].data, this.state['a3.r'].data, this.state['a3.t'].data,
      this.state['a3.s'].data, this.state['a3.u'].data,
      this.state['a3.w_re'].data, this.state['a3.w_im'].data)

    const gelui3 = new Float32Array(a3.im.length)
    for (let i = 0; i < a3.im.length; i++) gelui3[i] = gelu(a3.im[i])

    // cat([r3, gelu(i3)], dim=-1) — per row
    const catSize = 1 + dim
    const catBuf = new Float32Array(N * catSize)
    for (let n = 0; n < N; n++) {
      catBuf[n * catSize] = a3.re[n]
      const gOff = n * dim
      const cOff = n * catSize + 1
      for (let d = 0; d < dim; d++) catBuf[cOff + d] = gelui3[gOff + d]
    }

    // logits = head(catBuf)
    const headW = this.state['head.weight'].data // [vocab, catSize]
    const headB = this.state['head.bias'].data   // [vocab]
    const logits = linearForward(catBuf, headW, headB, N, catSize, vocab)

    // Loss (softmax + CE)
    const { loss, grad: gLogits } = softmaxCrossEntropy(logits, labels, vocab)

    // ===== backward =====
    // Linear backward
    const gHeadW = this.grads['head.weight'].data
    const gHeadB = this.grads['head.bias'].data
    const gCat = linearBackward(gLogits, catBuf, headW, N, catSize, vocab, gHeadW, gHeadB)

    // Split gCat → gR3 + g_gelu_i3
    const gR3 = new Float32Array(N)
    const gGeluI3 = new Float32Array(N * dim)
    for (let n = 0; n < N; n++) {
      gR3[n] = gCat[n * catSize]
      const cOff = n * catSize + 1
      const gOff = n * dim
      for (let d = 0; d < dim; d++) gGeluI3[gOff + d] = gCat[cOff + d]
    }
    // d/dx gelu(x): geluGrad(x), aplicado em a3.im
    const gI3 = new Float32Array(a3.im.length)
    for (let i = 0; i < a3.im.length; i++) gI3[i] = gGeluI3[i] * geluGrad(a3.im[i])

    // Atomo3 backward → gR2 (entrada xRe), gGeluI2 (entrada xIm)
    const a3back = atomoBackward(gR3, gI3, a3.cache, dim, z[2],
      this.state['a3.p'].data, this.state['a3.r'].data, this.state['a3.t'].data,
      this.state['a3.s'].data, this.state['a3.u'].data,
      this.state['a3.w_re'].data, this.state['a3.w_im'].data,
      this.grads['a3.p'].data, this.grads['a3.r'].data, this.grads['a3.t'].data,
      this.grads['a3.s'].data, this.grads['a3.u'].data,
      this.grads['a3.w_re'].data, this.grads['a3.w_im'].data)

    // a3.cache.xIm é gelui2 → backward gelu pra obter gI2
    const gI2 = new Float32Array(a2.im.length)
    for (let i = 0; i < a2.im.length; i++) gI2[i] = a3back.gXim[i] * geluGrad(a2.im[i])

    // Atomo2 backward
    const a2back = atomoBackward(a3back.gXre, gI2, a2.cache, dim, z[1],
      this.state['a2.p'].data, this.state['a2.r'].data, this.state['a2.t'].data,
      this.state['a2.s'].data, this.state['a2.u'].data,
      this.state['a2.w_re'].data, this.state['a2.w_im'].data,
      this.grads['a2.p'].data, this.grads['a2.r'].data, this.grads['a2.t'].data,
      this.grads['a2.s'].data, this.grads['a2.u'].data,
      this.grads['a2.w_re'].data, this.grads['a2.w_im'].data)

    const gI1 = new Float32Array(a1.im.length)
    for (let i = 0; i < a1.im.length; i++) gI1[i] = a2back.gXim[i] * geluGrad(a1.im[i])

    // Atomo1 backward
    const a1back = atomoBackward(a2back.gXre, gI1, a1.cache, dim, z[0],
      this.state['a1.p'].data, this.state['a1.r'].data, this.state['a1.t'].data,
      this.state['a1.s'].data, this.state['a1.u'].data,
      this.state['a1.w_re'].data, this.state['a1.w_im'].data,
      this.grads['a1.p'].data, this.grads['a1.r'].data, this.grads['a1.t'].data,
      this.grads['a1.s'].data, this.grads['a1.u'].data,
      this.grads['a1.w_re'].data, this.grads['a1.w_im'].data)

    // gXim do átomo 1 = gradient pra (emb[ids] + pos[t])
    // a1back.gXim é shape [N, dim]
    // Embedding backward: acumula em gEmb (sob ids[i])
    embeddingBackward(ids, a1back.gXim, this.grads['emb.weight'].data, vocab, dim)
    // Pos backward: pos[t] aparece em todas amostras com o mesmo t — acumula sobre B
    const gPos = this.grads['pos.weight'].data
    for (let b = 0; b < B; b++) {
      for (let t = 0; t < T; t++) {
        const off = (b * T + t) * dim
        const pOff = t * dim
        for (let d = 0; d < dim; d++) gPos[pOff + d] += a1back.gXim[off + d]
      }
    }
    // a1back.gXre = gradient pra x_re (constante 1.0) — não precisa backprop

    return loss
  }
}

/** Snapshot do estado inicial (deep copy) pra calcular delta = final - initial. */
export function snapshotState(sd: StateDict): StateDict {
  return cloneStateDict(sd)
}

/** Calcula delta = current - initial (pra submeter ao general). */
export function computeDelta(current: StateDict, initial: StateDict): StateDict {
  const out: StateDict = {}
  for (const k of Object.keys(current)) {
    const c = current[k].data
    const i = initial[k].data
    const d = new Float32Array(c.length)
    for (let j = 0; j < c.length; j++) d[j] = c[j] - i[j]
    out[k] = new Tensor(d, [...current[k].shape])
  }
  return out
}
