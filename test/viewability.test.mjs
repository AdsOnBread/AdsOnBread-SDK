import assert from 'node:assert/strict'
import test from 'node:test'
import { observeView } from '../viewability.js'

function harness() {
  const previous = {
    document: globalThis.document,
    IntersectionObserver: globalThis.IntersectionObserver,
    window: globalThis.window,
  }
  const calls = []
  let callback
  let connected = true
  const element = {
    get isConnected() { return connected },
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 }),
    contains: () => true,
  }
  const document = {
    visibilityState: 'visible',
    elementFromPoint: () => element,
    addEventListener() {},
    removeEventListener() {},
  }
  globalThis.document = document
  globalThis.window = { innerWidth: 100, innerHeight: 100 }
  globalThis.IntersectionObserver = class {
    constructor(fn) { callback = fn }
    observe() {}
    disconnect() {}
  }
  return {
    calls, document, element,
    emit(ratio) { callback([{ intersectionRatio: ratio, isVisible: true }]) },
    remove() { connected = false },
    restore() { Object.assign(globalThis, previous) },
    send: async (_url, options) => { calls.push(JSON.parse(options.body)) },
  }
}

test('a strict 70% threshold needs one continuous second', async () => {
  const h = harness()
  try {
    const stop = observeView(h.element, { impressionId: 'imp' }, 'key', 'https://edge.example', 'token', '1.2.0', h.send)
    h.emit(0.7)
    await new Promise((resolve) => setTimeout(resolve, 50))
    assert.equal(h.calls.length, 0)
    h.emit(0.71)
    await new Promise((resolve) => setTimeout(resolve, 1050))
    assert.equal(h.calls.length, 1)
    assert.equal(h.calls[0].impression_id, 'imp')
    assert.ok(h.calls[0].visible_ratio > 0.7)
    assert.ok(h.calls[0].duration_ms >= 1000)
    h.emit(1)
    assert.equal(h.calls.length, 1)
    stop()
  } finally { h.restore() }
})

test('dropping below threshold resets the timer', async () => {
  const h = harness()
  try {
    const stop = observeView(h.element, { impressionId: 'imp' }, 'key', 'https://edge.example', 'token', '1.2.0', h.send)
    h.emit(0.8)
    await new Promise((resolve) => setTimeout(resolve, 500))
    h.emit(0.6)
    h.emit(0.8)
    await new Promise((resolve) => setTimeout(resolve, 600))
    assert.equal(h.calls.length, 0)
    await new Promise((resolve) => setTimeout(resolve, 450))
    assert.equal(h.calls.length, 1)
    stop()
  } finally { h.restore() }
})
