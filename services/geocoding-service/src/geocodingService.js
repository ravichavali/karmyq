const DEFAULT_USER_AGENT = 'Karmyq/1.0 (mutual aid platform; https://karmyq.com)'

function normalizeQuery(query) {
  return String(query || '').toLowerCase().trim().replace(/\s+/g, ' ')
}

function validateSearchQuery(query) {
  if (typeof query !== 'string') {
    return { ok: false, code: 'INVALID_QUERY', message: 'Query must be at least 2 characters' }
  }

  const trimmed = query.trim()
  if (trimmed.length < 2) {
    return { ok: false, code: 'INVALID_QUERY', message: 'Query must be at least 2 characters' }
  }

  const sanitized = trimmed.slice(0, 200)
  if (!/^[a-zA-Z0-9\s,.-]+$/.test(sanitized)) {
    return { ok: false, code: 'INVALID_QUERY', message: 'Query contains unsupported characters' }
  }

  return { ok: true, value: normalizeQuery(sanitized) }
}

function createExternalThrottle(intervalMs) {
  let lastRun = 0
  let chain = Promise.resolve()

  return function throttled(fn) {
    const run = chain.catch(() => undefined).then(async () => {
      const elapsed = Date.now() - lastRun
      if (lastRun > 0 && elapsed < intervalMs) {
        await new Promise(resolve => setTimeout(resolve, intervalMs - elapsed))
      }

      lastRun = Date.now()
      return fn()
    })

    chain = run.catch(() => undefined)
    return run
  }
}

module.exports = {
  DEFAULT_USER_AGENT,
  normalizeQuery,
  validateSearchQuery,
  createExternalThrottle,
}
