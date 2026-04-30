/**
 * Tensor minimal — Float32Array + shape, sem autograd.
 *
 * Pra performance e tamanho: forward + backward escritos manualmente em celula.ts.
 * Aqui só buffers + ops elementares estritamente necessárias.
 */

export type Shape = number[]

export class Tensor {
  data: Float32Array
  shape: Shape

  constructor(data: Float32Array | number[], shape: Shape) {
    this.data = data instanceof Float32Array ? data : new Float32Array(data)
    this.shape = shape
    const expected = shape.reduce((a, b) => a * b, 1)
    if (this.data.length !== expected) {
      throw new Error(`tensor mismatch: shape ${shape} (${expected}) != data ${this.data.length}`)
    }
  }

  static zeros(shape: Shape): Tensor {
    const n = shape.reduce((a, b) => a * b, 1)
    return new Tensor(new Float32Array(n), shape)
  }

  static fromJSON(j: { data: number[]; shape: Shape }): Tensor {
    return new Tensor(new Float32Array(j.data), j.shape)
  }

  toJSON(): { data: number[]; shape: Shape } {
    return { data: Array.from(this.data), shape: this.shape }
  }

  clone(): Tensor {
    return new Tensor(new Float32Array(this.data), [...this.shape])
  }

  /** zero in-place */
  zero(): this {
    this.data.fill(0)
    return this
  }
}

export type StateDict = Record<string, Tensor>

export function stateDictFromJSON(j: Record<string, { data: number[]; shape: Shape }>): StateDict {
  const out: StateDict = {}
  for (const k of Object.keys(j)) out[k] = Tensor.fromJSON(j[k])
  return out
}

export function stateDictToJSON(sd: StateDict): Record<string, { data: number[]; shape: Shape }> {
  const out: Record<string, { data: number[]; shape: Shape }> = {}
  for (const k of Object.keys(sd)) out[k] = sd[k].toJSON()
  return out
}

/** Cópia profunda do state_dict pra calcular delta = final - inicial. */
export function cloneStateDict(sd: StateDict): StateDict {
  const out: StateDict = {}
  for (const k of Object.keys(sd)) out[k] = sd[k].clone()
  return out
}
