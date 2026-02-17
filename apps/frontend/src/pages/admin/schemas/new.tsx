import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { uiSchemaService } from '@/lib/api'
import Layout from '@/components/Layout'
import { UISchema } from '@karmyq/shared/schemas/ui'
import { requireAdmin, isAdmin } from '@/utils/admin-auth'

const builtInTypes = ['generic', 'ride', 'service', 'event', 'borrow']

export default function NewSchemaPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [type, setType] = useState('generic')
  const [label, setLabel] = useState('')
  const [icon, setIcon] = useState('✨')
  const [color, setColor] = useState('#10b981')
  const [description, setDescription] = useState('')
  const [sections, setSections] = useState<any[]>([])
  const [authChecked, setAuthChecked] = useState(false)

  // Check admin authentication
  useEffect(() => {
    if (!requireAdmin(router)) {
      setAuthChecked(true)
      return
    }
    setAuthChecked(true)
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!label.trim()) {
      setError('Label is required')
      return
    }

    try {
      setLoading(true)
      const response = await uiSchemaService.createSchema({
        type,
        label,
        icon,
        color,
        description,
        sections
      })
      router.push(`/admin/schemas/${response.data.schema.id}/edit`)
    } catch (err: any) {
      console.error('Failed to create schema:', err)
      setError(err.response?.data?.message || 'Failed to create schema')
    } finally {
      setLoading(false)
    }
  }

  const addSection = () => {
    setSections([...sections, { id: crypto.randomUUID(), title: 'New Section', fields: [] }])
  }

  if (loading) {
    return (
      <Layout title="Create New Schema - Karmyq">
        <Head>
          <title>Create New Schema - Karmyq</title>
        </Head>
        <div className="container mx-auto px-4 py-8">
          <div className="mb-6">
            <Link href="/admin/schemas" className="text-primary hover:text-primary-dark mb-4 inline-block">
              ← Back to Schema List
            </Link>
            <h1 className="text-3xl font-bold text-text mb-2">Create New Schema</h1>
            <p className="text-text-muted mb-6">
              Define a new request type with custom form fields and validation rules.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                {error}
              </div>
            )}

            <div className="bg-surface rounded-lg p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">
                  Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-4 py-3 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={!!builtInTypes.find(t => type === t)}
                >
                  <option value="">Select a type...</option>
                  {builtInTypes.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)} - Built-in type
                    </option>
                  ))}
                </select>
                {builtInTypes.includes(type) && (
                  <p className="text-sm text-primary mt-1">
                    ℹ️ Built-in types use Zod validation. Custom types will use JSON Schema.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">
                  Label *
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full px-4 py-3 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., Dog Walking, Tutoring, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">
                  Icon (emoji)
                </label>
                <input
                  type="text"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  className="w-full px-4 py-3 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="✨"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">
                  Color
                </label>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full h-12 px-4 py-3 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Describe when and how to use this request type..."
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-text">Form Sections</h3>
                {sections.map((section, index) => (
                  <div key={section.id} className="bg-surface rounded p-4 space-y-4">
                    <div className="flex justify-between items-center">
                      <input
                        type="text"
                        value={section.title}
                        onChange={(e) => {
                          const newSections = [...sections]
                          newSections[index].title = e.target.value
                          setSections(newSections)
                        }}
                        className="flex-1 px-4 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newSections = sections.filter(s => s.id !== section.id)
                          setSections(newSections)
                        }}
                        className="px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addSection}
                className="w-full py-3 bg-surface border border-border rounded hover:bg-surface-raised text-primary font-medium"
              >
                + Add Section
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary text-white rounded-lg hover:bg-primary-dark font-semibold disabled:bg-primary-medium"
            >
              {loading ? 'Creating...' : 'Create Schema'}
            </button>
          </form>
        </div>
      </Layout>
    )
  }
}
