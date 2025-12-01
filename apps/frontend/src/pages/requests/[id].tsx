import { useEffect } from 'react'
import { useRouter } from 'next/router'

/**
 * Request Detail Page - Redirects to Dashboard
 *
 * This page is now deprecated in favor of the unified dashboard experience (v5.3.0).
 * When users click on a request notification or link, they are redirected to the
 * dashboard where all requests are displayed in a post-and-comment structure.
 *
 * Future Enhancement: Add URL parameter to auto-scroll to specific request
 * e.g., /dashboard?highlight=request-id
 */
export default function RequestDetailPage() {
  const router = useRouter()
  const { id } = router.query

  useEffect(() => {
    // Redirect to dashboard
    // Future: Add ?highlight=${id} to auto-scroll to this request
    router.push('/dashboard')
  }, [router, id])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 mt-4">Redirecting to dashboard...</p>
      </div>
    </div>
  )
}
