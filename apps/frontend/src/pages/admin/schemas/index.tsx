import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { uiSchemaService } from '@/lib/api'
import Layout from '@/components/Layout'
import { requireAdmin, isAdmin } from '@/utils/admin-auth'

interface AdminSchema {
  id: string
  type: string
  version: number
  label: string
  icon: string
  color: string
  description: string
  status: 'draft' | 'published' | 'archived'
  sections: any[]
}

interface SchemaListResponse {
  schemas: AdminSchema[]
  total: number
}

export default function SchemaListPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [schemas, setSchemas] = useState<AdminSchema[]>([])
  const [filter, setFilter] = useState<{ status?: string; type?: string }>({})
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
    if (authChecked && isAdmin()) {
      fetchSchemas()
    }
  }, [authChecked])

  const fetchSchemas = async () => {
    try {
      setLoading(true)
      const response = await uiSchemaService.getAdminSchemas(filter)
      setSchemas(response.data.schemas)
      setError('')
    } catch (err: any) {
      console.error('Failed to fetch schemas', { error: err instanceof Error ? err.message : String(err) })
      setError(err.response?.data?.message || 'Failed to load schemas')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateNew = () => {
    router.push('/admin/schemas/new')
  }

  const handleEdit = (schema: AdminSchema) => {
    router.push(`/admin/schemas/${schema.id}/edit`)
  }

  const handleViewVersions = (schema: AdminSchema) => {
    router.push(`/admin/schemas/${schema.id}/versions`)
  }

  const getStatusBadge = (schema: AdminSchema) => {
    const statusColors = {
      draft: 'bg-yellow-100 text-yellow-800',
      published: 'bg-green-100 text-green-800',
      archived: 'bg-gray-200 text-gray-600'
    }
    return statusColors[schema.status as keyof typeof statusColors] || 'bg-gray-200 text-gray-600'
  }

  const filteredSchemas = schemas.filter(schema => {
    if (filter.status && schema.status !== filter.status) return false
    if (filter.type && schema.type !== filter.type) return false
    return true
  })

  return (
      <Layout title="Schema Management - Karmyq">
        <Head>
          <title>Schema Management - Karmyq</title>
        </Head>
        <div className="container mx-auto px-4 py-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-text">Schema Management</h1>
            <p className="text-text-muted mb-4">
              Manage request type schemas. Create, edit, and publish custom forms without code changes.
            </p>
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => setFilter({})}
                className="px-4 py-2 border border-border rounded hover:bg-surface"
              >
                All
              </button>
              <button
                onClick={() => setFilter({ status: 'draft' })}
                className={`px-4 py-2 border border rounded ${
                  filter.status === 'draft'
                    ? 'border-primary bg-primary-light text-primary'
                    : 'border-border bg-surface text-text-muted'
                }`}
              >
                Drafts
              </button>
              <button
                onClick={() => setFilter({ status: 'published' })}
                className={`px-4 py-2 border border rounded ${
                  filter.status === 'published'
                    ? 'border-primary bg-primary-light text-primary'
                    : 'border-border bg-surface text-text-muted'
                }`}
              >
                Published
              </button>
              <button
                onClick={() => setFilter({ status: 'archived' })}
                className={`px-4 py-2 border border rounded ${
                  filter.status === 'archived'
                    ? 'border-primary bg-primary-light text-primary'
                    : 'border-border bg-surface text-text-muted'
                }`}
              >
                Archived
              </button>
            </div>
          </div>

          <button
            onClick={handleCreateNew}
            className="w-full py-3 bg-primary text-white rounded-lg hover:bg-primary-dark font-semibold"
          >
            + Create New Schema
          </button>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
              <p className="mt-4 text-text-muted">Loading schemas...</p>
            </div>
          ) : filteredSchemas.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-muted">No schemas found</p>
              {Object.keys(filter).length === 0 && (
                <p className="text-sm text-text-subtle mt-2">
                  Try adjusting filters or create a new schema.
                </p>
              )}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSchemas.map((schema) => (
                <div
                  key={schema.id}
                  onClick={() => handleEdit(schema)}
                  className="bg-surface-raised rounded-lg shadow-sm hover:shadow-md cursor-pointer transition-all border border-border p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold"
                        style={{
                          backgroundColor: schema.color,
                          color: 'white'
                        }}
                      >
                        {schema.icon}
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-text mb-1">{schema.label}</h3>
                        <p className="text-sm text-text-muted mb-2">{schema.description || 'No description'}</p>
                        <div className="flex items-center gap-2 mt-3">
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-medium ${
                              getStatusBadge(schema)
                            }`}
                          >
                            {schema.status}
                          </span>
                          <span className="text-xs text-text-subtle">v{schema.version}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(schema)}
                        className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark text-sm font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleViewVersions(schema)}
                        className="px-4 py-2 bg-surface text-text-muted rounded hover:bg-surface-raised text-sm font-medium"
                      >
                        History
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Layout>
  )
}
