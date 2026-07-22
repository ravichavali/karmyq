// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'
import 'fake-indexeddb/auto'

// Polyfill structuredClone for jsdom (required by fake-indexeddb)
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = (obj) => JSON.parse(JSON.stringify(obj))
}

// Sprint 120 PR C — jsdom does not expose TextEncoder/TextDecoder, which every browser does.
// lib/jwt.ts needs TextDecoder to read UTF-8 JWT payloads (BUG-032), so bring the Node built-ins in.
if (typeof globalThis.TextDecoder === 'undefined' || typeof globalThis.TextEncoder === 'undefined') {
  const { TextDecoder, TextEncoder } = require('util')
  globalThis.TextDecoder = globalThis.TextDecoder ?? TextDecoder
  globalThis.TextEncoder = globalThis.TextEncoder ?? TextEncoder
}

// Sprint 111 — the belonging-graph surfaces track container width via ResizeObserver (useLazyGraphData)
// and TrustGraphHEB. jsdom ships neither, so provide a benign no-op stub. IntersectionObserver is left
// undefined on purpose: lazy graph loads construct it, and the immediate-mode tests assert that the
// /network explorer never does.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
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
