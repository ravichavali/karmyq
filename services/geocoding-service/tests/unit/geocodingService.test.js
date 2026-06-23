const {
  normalizeQuery,
  validateSearchQuery,
  createExternalThrottle,
} = require('../../src/geocodingService')

describe('geocodingService helpers', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  test('normalizes query case and whitespace', () => {
    expect(normalizeQuery('  San   Jose  ')).toBe('san jose')
  })

  test('rejects short or unsafe queries', () => {
    expect(validateSearchQuery('s')).toMatchObject({ ok: false, code: 'INVALID_QUERY' })
    expect(validateSearchQuery('Oakland<script>')).toMatchObject({ ok: false, code: 'INVALID_QUERY' })
  })

  test('allows common real-address punctuation and accents', () => {
    expect(validateSearchQuery("O'Connor Ave")).toMatchObject({ ok: true, value: "o'connor ave" })
    expect(validateSearchQuery('Café Réveille #2/3')).toMatchObject({ ok: true, value: 'café réveille #2/3' })
  })

  test('throttle waits before a second external call', async () => {
    jest.useFakeTimers()
    const throttle = createExternalThrottle(1000)
    const calls = []

    const first = throttle(() => {
      calls.push('first')
      return Promise.resolve('first')
    })
    await first

    const second = throttle(() => {
      calls.push('second')
      return Promise.resolve('second')
    })

    expect(calls).toEqual(['first'])
    jest.advanceTimersByTime(1000)
    await second
    expect(calls).toEqual(['first', 'second'])
  })

  test('throttle recovers after a rejected external call', async () => {
    jest.useFakeTimers()
    const throttle = createExternalThrottle(1000)
    const calls = []

    await expect(throttle(() => {
      calls.push('first')
      return Promise.reject(new Error('temporary network failure'))
    })).rejects.toThrow('temporary network failure')

    const second = throttle(() => {
      calls.push('second')
      return Promise.resolve('second')
    })

    jest.advanceTimersByTime(1000)
    await expect(second).resolves.toBe('second')
    expect(calls).toEqual(['first', 'second'])
  })
})
