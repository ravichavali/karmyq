/**
 * Sprint 131 D5: geocoding reaches Nominatim through Node 24's built-in fetch, not node-fetch (#225 superseded).
 *
 * Every other geocoding test injects `fetchImpl: jest.fn()`, so none of them could see what the node-fetch 3 bump
 * would have done: require('node-fetch') returns an object there, not a function, and 3.x has no `timeout` option.
 * callNominatimAPI swallows errors, so either defect shows up as "200 with empty results", never as a crash.
 * Every case here therefore runs the REAL global fetch over HTTP against a 127.0.0.1 stub, and asserts on results.
 */
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const zlib = require('node:zlib')
const { spawn } = require('node:child_process')
const { once } = require('node:events')
const request = require('supertest')
const {
  DEFAULT_USER_AGENT,
  NOMINATIM_SEARCH_URL,
  callNominatimAPI,
  createGeocodingService,
} = require('../../src/geocodingService')
const { createApp } = require('../../src/geocodingApp')

const ROWS = [
  { display_name: 'Main St, Portland, Oregon', lat: '45.5', lon: '-122.6', type: 'road' },
  { display_name: 'Main St, Salem, Oregon', lat: '44.9', lon: '-123.0', type: 'road' },
]
const MAPPED = [
  { display_name: 'Main St, Portland, Oregon', address: 'Main St', lat: 45.5, lng: -122.6, type: 'road' },
  { display_name: 'Main St, Salem, Oregon', address: 'Main St', lat: 44.9, lng: -123.0, type: 'road' },
]
const TEST_TIMEOUT_MS = 200
// Generous against a loaded CI runner (20x the test timeout), yet below the 5000 ms production value.
const WATCHDOG_MS = 4000
const TIMEOUT_MESSAGE = 'The operation was aborted due to timeout'

const realFetch = globalThis.fetch
let stub
let stubBase
let received
let behaviour
let fetchSpy

beforeAll(async () => {
  stub = http.createServer((req, res) => {
    received.push({ method: req.method, url: req.url, headers: req.headers })
    const mode = behaviour.shift() ?? 'gzip'
    if (mode === 'hang') return // never answer
    if (mode === 'stall') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.write('[') // headers sent, body never finishes
      return
    }
    if (mode === '503') {
      res.writeHead(503, { 'content-type': 'text/plain', connection: 'close' })
      return res.end('busy')
    }
    res.writeHead(200, { 'content-type': 'application/json', 'content-encoding': 'gzip', connection: 'close' })
    res.end(zlib.gzipSync(JSON.stringify(ROWS)))
  })
  await new Promise(resolve => stub.listen(0, '127.0.0.1', resolve))
  stubBase = `http://127.0.0.1:${stub.address().port}`
})

afterAll(async () => {
  stub.closeAllConnections()
  await new Promise(resolve => stub.close(resolve))
})

beforeEach(() => {
  received = []
  behaviour = []
  // Every case, including those that rely on the default fetchImpl: the global fetch may dial only the stub.
  // If the nominatimUrl seam were dropped, the public URL would reach this guard and throw, never the network.
  fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(loopbackFetch)
})

afterEach(() => jest.restoreAllMocks())

function captureLogger() {
  const errors = []
  return { errors, logger: { log: () => {}, warn: () => {}, error: (...args) => errors.push(args) } }
}

const missPool = () => ({ query: jest.fn().mockResolvedValue({ rows: [] }) })

// The real fetch, refusing any URL outside `allowedPrefix` (optionally rewriting it to the stub first). If the `url`
// seam were ignored, a test would otherwise dial Nominatim; this makes it throw instead.
const guardedFetch = (allowedPrefix, rewrite = target => target) => (url, init) => {
  const target = String(url)
  if (!target.startsWith(allowedPrefix)) throw new Error(`unexpected outbound URL: ${target}`)
  return realFetch(rewrite(target), init)
}
const loopbackFetch = (url, init) => guardedFetch(`${stubBase}/`)(url, init)

function expectNominatimRequest(req, q) {
  expect(req.method).toBe('GET')
  expect(req.url).toBe(`/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`)
  expect(req.headers['user-agent']).toBe(DEFAULT_USER_AGENT)
}

describe('geocoding reaches Nominatim through the real built-in fetch (Sprint 131 D5)', () => {
  it('defaults to the global fetch: sends the identifying User-Agent and maps every row of a gzip answer', async () => {
    const { errors, logger } = captureLogger()
    const service = createGeocodingService({
      pool: missPool(), logger, throttleIntervalMs: 0, nominatimUrl: `${stubBase}/search`,
    })

    const result = await service.search('Main St')

    // First, so a dropped nominatimUrl seam fails by showing that nothing reached the stub (the guard refused it).
    expect(received).toHaveLength(1)
    expect(errors).toEqual([])
    expect(result).toEqual({ ok: true, data: { results: MAPPED, source: 'nominatim', cached: false } })
    expect(fetchSpy).toHaveBeenCalledTimes(1) // the default IS the global fetch
    expectNominatimRequest(received[0], 'main st')
  })

  it('logs the status and returns no results on a non-2xx answer', async () => {
    const { errors, logger } = captureLogger()
    behaviour = ['503']

    const results = await callNominatimAPI(loopbackFetch, 'main st', logger, { url: `${stubBase}/search` })

    expect(results).toEqual([])
    expect(errors).toEqual([['Nominatim API error: 503']])
    expect(received).toHaveLength(1)
  })

  it.each(['hang', 'stall'])(
    'times out a call that %ss, and the next cache miss still reaches Nominatim',
    async (mode) => {
      const { errors, logger } = captureLogger()
      const service = createGeocodingService({
        pool: missPool(), logger, throttleIntervalMs: 0,
        nominatimUrl: `${stubBase}/search`, nominatimTimeoutMs: TEST_TIMEOUT_MS,
      })
      behaviour = [mode, 'gzip']

      const started = Date.now()
      const first = await service.search('Main St')
      const elapsed = Date.now() - started
      const second = await service.search('Salem')

      expect(first.data.results).toEqual([])
      expect(elapsed).toBeGreaterThanOrEqual(TEST_TIMEOUT_MS - 20)
      expect(elapsed).toBeLessThan(WATCHDOG_MS)
      expect(errors).toEqual([['Nominatim API call failed:', TIMEOUT_MESSAGE]])
      expect(second.data.results).toEqual(MAPPED)
      expect(received).toHaveLength(2)
      expectNominatimRequest(received[1], 'salem')
    },
    10_000,
  )

  it('uses a 5000 ms timeout in production, where no override is passed', async () => {
    const timeoutSpy = jest.spyOn(AbortSignal, 'timeout')
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) })

    await callNominatimAPI(fetchImpl, 'main st', captureLogger().logger)

    expect(timeoutSpy).toHaveBeenCalledTimes(1)
    expect(timeoutSpy).toHaveBeenCalledWith(5000)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(`${NOMINATIM_SEARCH_URL}?q=main%20st&format=json&limit=5&addressdetails=1`)
    expect(init.signal).toBe(timeoutSpy.mock.results[0].value)
  })

  it('serves /search through createApp with no fetchImpl, exactly as index.js builds it', async () => {
    // Production timeout, observed through the production composition: a default injected anywhere between
    // createApp and callNominatimAPI (e.g. `nominatimTimeoutMs = 50000`) must fail here, not only in the helper case.
    const timeoutSpy = jest.spyOn(AbortSignal, 'timeout')
    // Redirect only the Nominatim origin to the stub. Anything else throws, so this case can never reach the internet.
    fetchSpy.mockImplementation(
      guardedFetch(`${NOMINATIM_SEARCH_URL}?`, target => target.replace(NOMINATIM_SEARCH_URL, `${stubBase}/search`))
    )
    const app = createApp({ pool: missPool(), logger: captureLogger().logger, throttleIntervalMs: 0 })

    const res = await request(app).get('/search').query({ q: 'Main St' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, data: { results: MAPPED, source: 'nominatim', cached: false } })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(timeoutSpy).toHaveBeenCalledTimes(1)
    expect(timeoutSpy).toHaveBeenCalledWith(5000)
    expect(fetchSpy.mock.calls[0][1].signal).toBe(timeoutSpy.mock.results[0].value)
    expect(received).toHaveLength(1)
    expectNominatimRequest(received[0], 'main st')
  })
})

describe('index.js boots under plain node with no node-fetch import (Sprint 131 D5)', () => {
  it('starts listening, and its source neither requires node-fetch nor injects a fetchImpl', async () => {
    const serviceRoot = path.resolve(__dirname, '..', '..')
    const source = fs.readFileSync(path.join(serviceRoot, 'index.js'), 'utf8')
    expect(source).not.toMatch(/node-fetch/)
    expect(source).not.toMatch(/fetchImpl/)

    const child = spawn(process.execPath, ['index.js'], {
      cwd: serviceRoot,
      env: { ...process.env, PORT: '0', DATABASE_URL: '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    try {
      await new Promise((resolve, reject) => {
        const deadline = setTimeout(() => reject(new Error(`no listen line in 8 s\nstdout:\n${stdout}\nstderr:\n${stderr}`)), 8000)
        child.stdout.on('data', chunk => {
          stdout += chunk
          if (stdout.includes('Geocoding Cache Service running on port')) { clearTimeout(deadline); resolve() }
        })
        child.stderr.on('data', chunk => { stderr += chunk })
        child.on('exit', code => { clearTimeout(deadline); reject(new Error(`exited ${code}\nstderr:\n${stderr}`)) })
      })
    } finally {
      child.removeAllListeners('exit')
      // Wait for the kill to land, so the child and its pipes never outlive the test.
      if (child.exitCode === null && child.signalCode === null) {
        const exited = once(child, 'exit')
        child.kill()
        await exited
      }
    }
    expect(stderr).toBe('')
  }, 15_000)
})
