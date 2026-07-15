/**
 * Sprint 119 — the ONE write sequence for a real authenticated session, shared by every
 * real-auth site (login, register, invite). Storage only: the API clients' request interceptor
 * reads the token from localStorage per request (#140), so no ApiClient plumbing belongs here.
 *
 * demo.tsx is deliberately NOT a caller — the demo tour stores `demoContext` and REMOVES the
 * refreshToken so the read-only session expires (apps/frontend/CONTEXT.md).
 */
export function setAuthSession(data: { token: string; refreshToken?: string; user: unknown }): void {
  localStorage.setItem('token', data.token)
  if (data.refreshToken) {
    localStorage.setItem('refreshToken', data.refreshToken)
  } else {
    // Auth responses always carry a refreshToken today — but if one ever doesn't, a PREVIOUS
    // account's leftover refreshToken must not survive under the new session (the 401 refresh
    // interceptor would silently re-issue the OLD identity). Fail safe: refresh fails → login.
    localStorage.removeItem('refreshToken')
  }
  localStorage.setItem('user', JSON.stringify(data.user))
  // A real sign-in ends any leftover read-only demo state.
  localStorage.removeItem('demoContext')
}

/** Remove every trace of the session — logout, or stored auth state found missing/corrupt. */
export function clearAuthSession(): void {
  localStorage.removeItem('token')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('user')
  localStorage.removeItem('demoContext')
}

/**
 * Has this member completed (or skipped) the /welcome arrival moment? Honors the legacy
 * global key so pre-S118 accounts never re-arrive.
 */
export function hasOnboarded(userId: string): boolean {
  return Boolean(
    localStorage.getItem(`karmyq_onboarded:${userId}`) || localStorage.getItem('karmyq_onboarded')
  )
}

/**
 * A join is a FIRST-EVER join when the member belongs to nothing yet and has never been through
 * arrival. Evaluate BEFORE the join call — a successful join refreshes the stored JWT.
 */
export function isFirstEverJoin(user: { id: string; communities?: unknown[] }): boolean {
  return (user.communities ?? []).length === 0 && !hasOnboarded(user.id)
}

/** The sessionStorage key /welcome reads its arrival context from. */
export const ARRIVAL_KEY = 'karmyq_arrival'

export interface ArrivalContext {
  path: 'open' | 'invite'
  /** The account the context belongs to — /welcome drops a context stamped for another login. */
  userId?: string
  communityId?: string
  communityName?: string
  inviterId?: string
  inviterName?: string
}

/**
 * Hand arrival context to /welcome (S118/ADR-085) — the ONE writer for every arrival path.
 * /welcome owns writing the onboarded key on completion/skip; never pre-set it here.
 */
export function beginArrival(ctx: ArrivalContext): void {
  sessionStorage.setItem(ARRIVAL_KEY, JSON.stringify(ctx))
}
