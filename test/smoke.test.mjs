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
function browserContext({ chromeValue, localValue = null, storageThrows = false, uuid = 'test-uuid', useChrome = false } = {}) {
  const requests = []
  let chromeStored = chromeValue
  let localStored = localValue
  let chromeGets = 0
  let chromeSets = 0
  let localSets = 0
  const element = () => ({
    addEventListener() {},
    appendChild() {},
    remove() {},
    setAttribute() {},
    style: { cssText: '' },
  })
  const window = {
    crypto: { randomUUID: () => uuid },
    localStorage: {
      getItem: () => {
        if (storageThrows) throw new Error('storage unavailable')
        return localStored
      },
      setItem: (_key, value) => {
        if (storageThrows) throw new Error('storage unavailable')
        localSets += 1
        localStored = value
      },
    },
  }
  const context = createContext({
    AbortController: class AbortController {
      constructor() { this.signal = {} }
      abort() {}
    },
    clearTimeout,
    console,
    document: { createElement: element, createTextNode: element, querySelector: () => null },
    fetch: async (_url, options) => {
      requests.push(JSON.parse(options.body))
      return { json: async () => ({ ad: null }), ok: true }
    },
    navigator: { language: 'en-US' },
    setTimeout,
    window,
  })
  if (useChrome) {
    context.chrome = {
      storage: {
        local: {
          get: async () => {
            chromeGets += 1
            return { adsonbread_uid: chromeStored }
          },
          set: async (value) => {
            chromeSets += 1
            chromeStored = value.adsonbread_uid
          },
        },
      },
    }
  }
  context.globalThis = context
  return {
    context,
    requests,
    stats: () => ({ chromeGets, chromeSets, chromeStored, localSets, localStored }),
    window,
  }
}

async function loadVanillaHarness(file, options) {
  const source = await readFile(new URL(file, root), 'utf8')
  const harness = browserContext(options)
  const { context } = harness
  runInContext(source, context)
  return harness
}

async function loadVanilla(file) {
  return (await loadVanillaHarness(file)).window
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

test('both live SDK entry points transmit token and sdk_version, never uid', async () => {
  for (const file of ['sdk.js', 'react.js']) {
    const source = await readFile(new URL(file, root), 'utf8')
    assert.match(source, /sdk_version:\s*VERSION/)
    assert.match(source, /token:\s*await userToken\(\)/)
    assert.doesNotMatch(source, /\buid\s*:/)
  }
})

test('sdk creates a 24-hour token and sends the new request shape', async () => {
  const harness = await loadVanillaHarness('sdk.js')

  await harness.window.AdsOnBread.load('key', 'banner', elementStub())

  const stored = JSON.parse(harness.stats().localStored)
  assert.equal(stored.id, 'test-uuid')
  assert.ok(stored.expiresAt > Date.now() + 23 * 60 * 60 * 1000)
  assert.deepEqual(harness.requests[0], {
    api_key: 'key',
    language: 'en',
    placement: 'banner',
    sdk_version: pkg.version,
    token: 'test-uuid',
  })
  assert.equal('uid' in harness.requests[0], false)
})

test('sdk reuses a valid localStorage token', async () => {
  const token = { expiresAt: Date.now() + 60_000, id: 'existing-token' }
  const harness = await loadVanillaHarness('sdk.js', { localValue: JSON.stringify(token) })

  await Promise.all([
    harness.window.AdsOnBread.load('key', 'banner', elementStub()),
    harness.window.AdsOnBread.load('key', 'banner', elementStub()),
  ])

  assert.deepEqual(harness.requests.map((body) => body.token), ['existing-token', 'existing-token'])
  assert.equal(harness.stats().localSets, 0)
})

test('sdk replaces legacy and expired values', async () => {
  const legacy = await loadVanillaHarness('sdk.js', { localValue: 'permanent-v1-value', uuid: 'rotated-legacy' })
  await legacy.window.AdsOnBread.load('key', 'banner', elementStub())
  assert.equal(JSON.parse(legacy.stats().localStored).id, 'rotated-legacy')

  const expired = await loadVanillaHarness('sdk.js', {
    localValue: JSON.stringify({ expiresAt: Date.now() - 1, id: 'expired' }),
    uuid: 'rotated-expired',
  })
  await expired.window.AdsOnBread.load('key', 'banner', elementStub())
  assert.equal(JSON.parse(expired.stats().localStored).id, 'rotated-expired')
})

test('sdk deduplicates concurrent chrome.storage initialization', async () => {
  const harness = await loadVanillaHarness('sdk.js', { useChrome: true })

  await Promise.all([
    harness.window.AdsOnBread.load('key', 'banner', elementStub()),
    harness.window.AdsOnBread.load('key', 'card', elementStub()),
  ])

  assert.equal(harness.stats().chromeGets, 1)
  assert.equal(harness.stats().chromeSets, 1)
  assert.deepEqual(harness.requests.map((body) => body.token), ['test-uuid', 'test-uuid'])
})

test('sdk replaces a legacy chrome.storage string immediately', async () => {
  const harness = await loadVanillaHarness('sdk.js', {
    chromeValue: 'permanent-v1-value',
    useChrome: true,
    uuid: 'rotated-chrome-legacy',
  })

  await harness.window.AdsOnBread.load('key', 'banner', elementStub())

  assert.equal(harness.stats().chromeStored.id, 'rotated-chrome-legacy')
  assert.equal(harness.stats().chromeSets, 1)
  assert.equal(harness.requests[0].token, 'rotated-chrome-legacy')
})

test('sdk falls back to one in-memory token when storage is unavailable', async () => {
  const harness = await loadVanillaHarness('sdk.js', { storageThrows: true })

  await harness.window.AdsOnBread.load('key', 'banner', elementStub())
  await harness.window.AdsOnBread.load('key', 'banner', elementStub())

  assert.deepEqual(harness.requests.map((body) => body.token), ['test-uuid', 'test-uuid'])
})

function elementStub() {
  return {
    appendChild() {},
    innerHTML: '',
  }
}
