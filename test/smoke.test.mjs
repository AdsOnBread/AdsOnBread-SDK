// Smoke tests for the AdsOnBread SDK. Zero dependencies on purpose: the
// package ships with no devDependencies so that `npm install github:...`
// never has a build or install step to run. `react` is installed
// unsaved in CI for the React test only.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createContext, runInContext } from 'node:vm'

const root = new URL('..', import.meta.url)
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'))

// Minimal DOM stub. The SDKs only build detached elements at load time —
// nothing here needs to be a faithful DOM, it just has to exist.
function browserContext() {
  const element = () => ({
    addEventListener() {},
    appendChild() {},
    remove() {},
    setAttribute() {},
    style: { cssText: '' },
  })
  const window = {
    crypto: { randomUUID: () => 'test-uuid' },
    localStorage: { getItem: () => null, setItem() {} },
  }
  const context = createContext({
    console,
    document: { createElement: element, createTextNode: element, querySelector: () => null },
    navigator: { language: 'en-US' },
    window,
  })
  context.globalThis = context
  return { context, window }
}

async function loadVanilla(file) {
  const source = await readFile(new URL(file, root), 'utf8')
  const { context, window } = browserContext()
  runInContext(source, context)
  return window
}

test('every shipped file reports the package version', async () => {
  for (const file of ['sdk.js', 'test-sdk.js', 'react.js']) {
    const source = await readFile(new URL(file, root), 'utf8')
    assert.ok(
      source.includes(`'${pkg.version}'`),
      `${file} does not contain the package version ${pkg.version} — bump it or fix package.json`,
    )
  }
})

test('sdk.js exposes window.AdsOnBread', async () => {
  const window = await loadVanilla('sdk.js')
  assert.equal(typeof window.AdsOnBread.load, 'function')
  assert.equal(window.AdsOnBread.version, pkg.version)
})

test('test-sdk.js exposes window.AdsOnBreadTest', async () => {
  const window = await loadVanilla('test-sdk.js')
  assert.equal(typeof window.AdsOnBreadTest.load, 'function')
  assert.equal(typeof window.AdsOnBreadTest.destroy, 'function')
  assert.equal(window.AdsOnBreadTest.version, pkg.version)
})

test('react.js exports AdsOnBreadSlot', async () => {
  const { AdsOnBreadSlot, VERSION } = await import(new URL('react.js', root))
  assert.equal(typeof AdsOnBreadSlot, 'function')
  assert.equal(VERSION, pkg.version)
})

test('package.json ships every file publishers install', () => {
  for (const file of ['sdk.js', 'test-sdk.js', 'react.js', 'react.d.ts']) {
    assert.ok(pkg.files.includes(file), `package.json "files" is missing ${file}`)
  }
})
