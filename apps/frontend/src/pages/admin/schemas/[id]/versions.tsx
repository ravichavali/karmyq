import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import AdminLayout from '@/components/admin/AdminLayout'
import { uiSchemaService } from '@/lib/api'
import { requireAdmin, isAdmin } from '@/utils/admin-auth'

interface SchemaVersion {
  id: string
  version: number
  schema_snapshot: any
  created_at: string
  changed_by: string
  change_description: string
}

export default function VersionHistoryPage() {
  const router = useRouter()
  const { id } = router.query

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [versions, setVersions] = useState<SchemaVersion[]>([])
  const [selectedVersion, setSelectedVersion] = useState<SchemaVersion | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  // Check admin authentication
  useEffect(() => {
    if (!requireAdmin(router)) {
      setAuthChecked(true)
      return
    }
    setAuthChecked(true)
  }, [router])

  useEffect(() => {
    if (authChecked && isAdmin() && id) {
      loadVersions()
    }
  }, [id, authChecked])

  const loadVersions = async () => {
    try {
      setLoading(true)
      const response = await uiSchemaService.getSchemaVersions(id as string)
      setVersions(response.data.versions)
      setError('')
    } catch (err: any) {
      console.error('Failed to load versions:', err)
      setError(err.response?.data?.message || 'Failed to load version history')
    } finally {
      setLoading(false)
    }
  }

  const handleRollback = async (version: SchemaVersion) => {
    if (!confirm(`Rollback to version ${version.version}?\n\nThis will create a new version ${version.version + 1} with the old version content.`)) {
      return
    }

    try {
      setLoading(true)
      await uiSchemaService.rollbackSchema(id as string, version.version)
      setError('')
      alert(`Successfully rolled back to version ${version.version}`)
      // Reload versions
      await loadVersions()
    } catch (err: any) {
      console.error('Failed to rollback:', err)
      setError(err.response?.data?.message || 'Failed to rollback')
    } finally {
      setLoading(false)
    }
  }

  const formatJSON = (obj: any): string => {
    return JSON.stringify(obj, null, 2)
  }

  if (loading && !versions.length) {
    return (
      <AdminLayout title="Version History">
        <Head>
          <title>Version History - Loading...</title>
        </Head>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
            <p className="mt-4 text-text-muted">Loading version history...</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (error && !versions.length) {
    return (
      <AdminLayout title="Version History">
        <Head>
          <title>Version History - Error</title>
        </Head>
        <div className="container mx-auto px-4 py-8">
          <Link href={`/admin/schemas/${id}/edit`} className="text-primary hover:text-primary-dark mb-2 inline-block">
            ← Back to Editor
          </Link>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Version History">
      <Head>
        <title>Version History - {versions[0]?.schema_snapshot?.label || 'Schema'}</title>
      </Head>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href={`/admin/schemas/${id}/edit`} className="text-primary hover:text-primary-dark mb-2 inline-block">
            ← Back to Editor
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-text mb-6">Version History</h1>
        <p className="text-text-muted mb-6">
          Track all changes and rollback to previous versions if needed.
        </p>

        <div className="space-y-6">
          {versions.map((version, index) => (
            <div
              key={version.id}
              className={`border rounded-lg p-6 transition-all ${
                selectedVersion?.id === version.id
                  ? 'border-2 border-primary bg-primary-light'
                  : 'border border-border bg-surface hover:shadow-md'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="text-2xl font-bold text-primary">v{version.version}</div>
                  <div className="text-xs text-text-subtle">
                    {new Date(version.created_at).toLocaleString()}
                  </div>
                </div>
                {version.change_description && (
                  <div className="text-sm text-text-muted mt-1">
                    {version.change_description}
                  </div>
                )}
                <button
                  onClick={() => setSelectedVersion(version)}
                  className="px-4 py-2 bg-surface border border-border rounded hover:bg-surface-raised text-sm disabled:bg-gray-100 disabled:text-gray-400"
                >
                  {selectedVersion?.id === version.id ? 'Selected' : 'Rollback'}
                </button>
              </div>

              {/* Diff View - Simplified */}
              <div className="mt-4 border-t border-border rounded bg-surface p-4">
                <h4 className="text-md font-semibold text-text mb-2">Change Summary</h4>
                <div className="text-sm text-text-muted">
                  Changed by: {version.changed_by}
                </div>
              </div>

              <div className="border-t border-border rounded bg-surface p-4">
                <h4 className="text-md font-semibold text-text mb-2">Schema Snapshot</h4>
                <pre className="text-xs bg-surface-dark text-text-muted p-4 rounded overflow-auto max-h-64">
                  {formatJSON(version.schema_snapshot)}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  )
}
