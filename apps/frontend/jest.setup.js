// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'
import 'fake-indexeddb/auto'

// Polyfill structuredClone for jsdom (required by fake-indexeddb)
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = (obj) => JSON.parse(JSON.stringify(obj))
}

// Sprint 100 / F4 — the canonical RequestCard is now clickable (it calls useRouter to open the
// request detail), so any test that mounts it must have a Next router in context or it throws
// "NextRouter was not mounted". Provide a benign default mock globally; tests that assert on routing
// override it with their own jest.mock('next/router', …), which takes precedence over this default.
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn().mockResolvedValue(undefined),
    pathname: '/',
    route: '/',
    query: {},
    asPath: '/',
    events: { on: jest.fn(), off: jest.fn(), emit: jest.fn() },
  }),
}))
