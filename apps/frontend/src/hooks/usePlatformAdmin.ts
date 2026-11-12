import { useEffect, useState } from 'react'
import { platformRoleService } from '@/lib/api'

export interface PlatformAdminState {
  /** True until the live check has answered (or was skipped for lack of a token). */
  loading: boolean
  /** True only when auth-service answered `platformAdmin: true` for the signed-in user. */
  platformAdmin: boolean
}

const hasToken = () => {
  try {
    return typeof window !== 'undefined' && localStorage.getItem('token') !== null
  } catch {
    return false
  }
}

/**
 * Sprint 141 (BUG-073, ADR-105): is the signed-in user a platform admin (an `auth.platform_admins` grant)?
 *
 * A hint for showing platform admin UI, never the boundary: every platform surface re-checks the grant live.
 * It fails closed. No token, a failed request, or any answer other than a literal `platformAdmin: true` gives
 * `false`, and it never throws.
 */
export function usePlatformAdmin(): PlatformAdminState {
  const [state, setState] = useState<PlatformAdminState>({ loading: true, platformAdmin: false })

  useEffect(() => {
    if (!hasToken()) {
      setState({ loading: false, platformAdmin: false })
      return
    }
    let cancelled = false
    ;(async () => {
      let platformAdmin = false
      try {
        const res = await platformRoleService.get()
        platformAdmin = res?.data?.platformAdmin === true
      } catch {
        platformAdmin = false
      }
      if (!cancelled) setState({ loading: false, platformAdmin })
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return state
}

/**
 * For the platform admin pages. No token → `/login`; not a platform admin (or the check failed) → `/dashboard`.
 * Returns true only once the live check has said yes, so a page renders and fetches nothing administrative before.
 */
export function usePlatformAdminGate(router: { push: (url: string) => unknown }): boolean {
  const { loading, platformAdmin } = usePlatformAdmin()
  const signedIn = hasToken()

  useEffect(() => {
    if (!signedIn) {
      router.push('/login')
      return
    }
    if (!loading && !platformAdmin) router.push('/dashboard')
  }, [router, signedIn, loading, platformAdmin])

  return signedIn && !loading && platformAdmin
}
