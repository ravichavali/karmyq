import { useEffect } from 'react'
import { useRouter } from 'next/router'

/**
 * Redirects /communities/[id]/admin to /communities/[id]
 * Admin functionality is now integrated into the community page (role-gated tabs).
 */
export default function CommunityAdminRedirect() {
  const router = useRouter()
  const { id, tab } = router.query

  useEffect(() => {
    if (id) {
      router.replace(`/communities/${id}${tab ? `?tab=${tab}` : ''}`)
    }
  }, [id, tab, router])

  return null
}
