/**
 * Sprint 119 — one shared write sequence for a real authenticated session. Three real-auth
 * sites (login, register, invite) each hand-rolled the same localStorage writes; drift risk
 * (register once forgot to clear demoContext). The helper's contract is EXACT:
 *   setAuthSession: store token / refreshToken / user, clear demoContext — nothing more.
 *     It never touches ApiClient token plumbing (the request interceptor reads localStorage
 *     per request, #140) and tolerates a missing refreshToken.
 *   clearAuthSession: remove token / refreshToken / user / demoContext.
 *
 * demo.tsx is intentionally NOT migrated: the tour stores demoContext and REMOVES refreshToken
 * by design (the demo session must expire — apps/frontend/CONTEXT.md). A source-level guard
 * below keeps that inversion from being "helpfully" refactored away.
 */
import fs from 'fs'
import path from 'path'
import { setAuthSession, clearAuthSession } from '../../src/lib/session'

const USER = { id: 'user-1', name: 'Nova New', communities: [] }

describe('setAuthSession', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('stores token, refreshToken and user, and clears demoContext — nothing more', () => {
    localStorage.setItem('demoContext', '{"demo":true}')
    localStorage.setItem('karmyq_browse_mode', 'community') // unrelated keys are untouched

    setAuthSession({ token: 'tok.1', refreshToken: 'refresh-1', user: USER })

    expect(localStorage.getItem('token')).toBe('tok.1')
    expect(localStorage.getItem('refreshToken')).toBe('refresh-1')
    expect(JSON.parse(localStorage.getItem('user') || '{}')).toEqual(USER)
    expect(localStorage.getItem('demoContext')).toBeNull()
    expect(localStorage.getItem('karmyq_browse_mode')).toBe('community')
  })

  it('tolerates a missing refreshToken — never stores the string "undefined"', () => {
    setAuthSession({ token: 'tok.1', user: USER })

    expect(localStorage.getItem('token')).toBe('tok.1')
    expect(localStorage.getItem('refreshToken')).toBeNull()
    expect(JSON.parse(localStorage.getItem('user') || '{}')).toEqual(USER)
  })

  it('a missing refreshToken REMOVES a previous account\'s leftover one (no cross-account refresh)', () => {
    localStorage.setItem('refreshToken', 'user-a-refresh')

    setAuthSession({ token: 'tok.user-b', user: USER })

    // If user A's refreshToken survived, user B's first 401 would silently refresh into A's
    // identity via the api.ts refresh interceptor.
    expect(localStorage.getItem('refreshToken')).toBeNull()
  })

  it('never touches ApiClient token plumbing (interceptor reads localStorage per request, #140)', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../src/lib/session.ts'), 'utf8')
    expect(source).not.toMatch(/@\/lib\/api|lib\/api|axios|defaults\.headers/)
  })
})

describe('clearAuthSession', () => {
  it('removes token, refreshToken, user and demoContext, and nothing else', () => {
    localStorage.clear()
    localStorage.setItem('token', 'tok.1')
    localStorage.setItem('refreshToken', 'refresh-1')
    localStorage.setItem('user', JSON.stringify(USER))
    localStorage.setItem('demoContext', '{"demo":true}')
    localStorage.setItem('karmyq_browse_mode', 'community')

    clearAuthSession()

    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('refreshToken')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
    expect(localStorage.getItem('demoContext')).toBeNull()
    expect(localStorage.getItem('karmyq_browse_mode')).toBe('community')
  })
})

describe('demo.tsx intentionally keeps its inline session writes (guard)', () => {
  it('still stores demoContext and still REMOVES refreshToken — the demo tour must expire', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../src/pages/demo.tsx'), 'utf8')
    expect(source).toMatch(/removeItem\(['"]refreshToken['"]\)/)
    expect(source).toMatch(/setItem\(['"]demoContext['"]/)
    expect(source).not.toMatch(/setAuthSession/)
  })
})
