/**
 * Polyfills mínimos pra rodar libs Node-ish (sockjs-client, etc) dentro
 * de Web Worker, ANTES de qualquer outro import.
 *
 * Imports ES são hoisted no topo do módulo — pôr os shims aqui e
 * `import './worker-polyfills'` PRIMEIRO no worker.ts garante que estes
 * globals existem antes do sockjs-client ser avaliado.
 */
const _g = self as any
if (typeof _g.window === 'undefined') _g.window = _g
if (typeof _g.document === 'undefined') {
  _g.document = {
    createElement: () => ({}),
    body: null,
    addEventListener: () => {},
    removeEventListener: () => {},
  }
}
if (typeof _g.process === 'undefined') {
  _g.process = {
    env: { NODE_ENV: 'production' },
    nextTick: (fn: () => void) => setTimeout(fn, 0),
    browser: true,
  }
}
if (typeof _g.location === 'undefined') {
  _g.location = { protocol: 'https:', host: '', href: '' }
}

export {}
