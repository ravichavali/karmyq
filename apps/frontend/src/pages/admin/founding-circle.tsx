import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '@/components/admin/AdminLayout'
import { foundingCircleAdminService, FoundingCircleStatus } from '@/lib/api'
import { isAdmin, requireAdmin } from '@/utils/admin-auth'

type Submission = {
  id: string
  email: string
  lens: string | null
  contribution: string | null
  concern: string | null
  source_page: string
  status: FoundingCircleStatus
  created_at: string
  reviewed_at: string | null
}

const FILTERS: Array<{ label: string; status?: FoundingCircleStatus }> = [
  { label: 'All' },
  { label: 'New', status: 'new' },
  { label: 'Reviewed', status: 'reviewed' },
  { label: 'Contacted', status: 'contacted' },
  { label: 'Archived', status: 'archived' },
]

function formatDate(value?: string | null): string {
  if (!value) return 'Not reviewed'
  return new Date(value).toLocaleString()
}

export default function FoundingCircleAdminPage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [filter, setFilter] = useState<FoundingCircleStatus | undefined>('new')
  const [items, setItems] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    requireAdmin(router)
    setAuthChecked(true)
  }, [router])

  useEffect(() => {
    if (!authChecked || !isAdmin()) return

    let stale = false
    async function load() {
      setLoading(true)
      try {
        const res = await foundingCircleAdminService.listSubmissions({ status: filter, limit: 50, offset: 0 })
        if (!stale) {
          setItems(res.data.items)
          setError('')
        }
      } catch (err: any) {
        if (!stale) setError(err?.response?.data?.message ?? 'Could not load submissions')
      } finally {
        if (!stale) setLoading(false)
      }
    }

    load()
    return () => {
      stale = true
    }
  }, [authChecked, filter])

  async function updateStatus(id: string, status: FoundingCircleStatus) {
    try {
      const res = await foundingCircleAdminService.updateSubmissionStatus(id, status)
      setItems((current) => current.map((item) => (item.id === id ? res.data : item)))
      setError('')
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Could not update submission')
    }
  }

  return (
    <AdminLayout title="Founding Circle">
      <main className="p-6 max-w-5xl">
        <h1 className="text-2xl font-semibold text-text mb-2">Founding-circle submissions</h1>
        <p className="text-sm text-text-muted mb-4">
          Review notes from karmyq.org/join. No notifications are sent from this page.
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {FILTERS.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setFilter(item.status)}
              className={`btn-secondary text-sm ${filter === item.status ? 'border-primary text-primary' : ''}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        {loading ? (
          <p className="text-sm text-text-muted">Loading submissions...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-text-muted">No submissions in this view.</p>
        ) : (
          <div className="grid gap-3">
            {items.map((item) => (
              <article key={item.id} className="kq-card">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-semibold text-text">{item.email}</p>
                    {item.lens && <p className="text-sm text-text-muted">{item.lens}</p>}
                    <p className="kq-quiet-meta">
                      Status: {item.status} | Source: {item.source_page} | Created: {formatDate(item.created_at)}
                    </p>
                    <p className="kq-quiet-meta">Reviewed: {formatDate(item.reviewed_at)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-secondary text-sm" onClick={() => updateStatus(item.id, 'reviewed')}>
                      Mark reviewed
                    </button>
                    <button type="button" className="btn-secondary text-sm" onClick={() => updateStatus(item.id, 'contacted')}>
                      Mark contacted
                    </button>
                    <button type="button" className="btn-secondary text-sm" onClick={() => updateStatus(item.id, 'archived')}>
                      Archive
                    </button>
                  </div>
                </div>
                {item.contribution && <p className="text-sm text-text mt-3 whitespace-pre-line">{item.contribution}</p>}
                {item.concern && <p className="text-sm text-text-muted mt-2 whitespace-pre-line">{item.concern}</p>}
              </article>
            ))}
          </div>
        )}
      </main>
    </AdminLayout>
  )
}
