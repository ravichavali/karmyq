import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { uiSchemaService } from '@/lib/api'
import AdminLayout from '@/components/admin/AdminLayout'
import { UISchema } from '@karmyq/shared/schemas/ui'
import { requireAdmin, isAdmin } from '@/utils/admin-auth'

interface SchemaVersion {
  id: string
  version: number
  schema_snapshot: UISchema
  created_at: string
  changed_by: string
  change_description: string
}

export default function SchemaEditorPage() {
  const router = useRouter()
  const { id } = router.query

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [schema, setSchema] = useState<UISchema | null>(null)
  const [versions, setVersions] = useState<SchemaVersion[]>([])
  const [activeTab, setActiveTab] = useState<'sections' | 'fields' | 'preview' | 'versions'>('sections')
  const [editingField, setEditingField] = useState<any>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [showPublishDialog, setShowPublishDialog] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  // Check admin authentication
  useEffect(() => {
    if (!requireAdmin(router)) {
      setAuthChecked(true)
      return
    }
    setAuthChecked(true)
  }, [router])
  const [showArchiveDialog, setShowArchiveDialog] = useState(false)

  useEffect(() => {
    if (authChecked && isAdmin() && id) {
      loadSchema()
      loadVersions()
    }
  }, [id, authChecked])

  const loadSchema = async () => {
    try {
      setLoading(true)
      const response = await uiSchemaService.getSchema(id as string)
      setSchema(response.data.schema)
      setValidationErrors([])
    } catch (err: any) {
      console.error('Failed to load schema:', err)
      setError(err.response?.data?.message || 'Failed to load schema')
    } finally {
      setLoading(false)
    }
  }

  const loadVersions = async () => {
    try {
      const response = await uiSchemaService.getSchemaVersions(id as string)
      setVersions(response.data.versions)
    } catch (err: any) {
      console.error('Failed to load versions:', err)
      setError('Failed to load version history')
    }
  }

  const handlePublish = async () => {
    if (!schema) return

    try {
      setSaving(true)
      await uiSchemaService.publishSchema(schema.id)
      setShowPublishDialog(false)
      setError('')
      await loadSchema() // Reload to update status
    } catch (err: any) {
      console.error('Failed to publish schema:', err)
      setError(err.response?.data?.message || 'Failed to publish schema')
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async () => {
    if (!schema) return

    try {
      setSaving(true)
      await uiSchemaService.archiveSchema(schema.id)
      setShowArchiveDialog(false)
      setError('')
      await loadSchema() // Reload to update status
    } catch (err: any) {
      console.error('Failed to archive schema:', err)
      setError(err.response?.data?.message || 'Failed to archive schema')
    } finally {
      setSaving(false)
    }
  }

  const handleRollback = async (version: number) => {
    if (!schema) return

    try {
      setSaving(true)
      await uiSchemaService.rollbackSchema(schema.id, version)
      setError('')
      await loadSchema() // Reload to update version
      await loadVersions() // Reload version history
    } catch (err: any) {
      console.error('Failed to rollback schema:', err)
      setError(err.response?.data?.message || 'Failed to rollback schema')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateSection = (sectionId: string, updates: Partial<UISchema['sections'][0]>) => {
    if (!schema) return

    const updatedSections = schema.sections.map(section => {
      if (section.id === sectionId) {
        return { ...section, ...updates }
      }
      return section
    })

    setSchema({ ...schema, sections: updatedSections })
    setSaving(true)
    setTimeout(() => setSaving(false), 1000)
  }

  const handleUpdateField = (sectionId: string, fieldId: string, updates: Partial<any>) => {
    if (!schema) return

    const updatedSections = schema.sections.map(section => {
      if (section.id === sectionId) {
        const updatedFields = section.fields.map(field => {
          if (field.id === fieldId) {
            return { ...field, ...updates }
          }
          return field
        })
        return { ...section, fields: updatedFields }
      }
      return section
    })

    setSchema({ ...schema, sections: updatedSections })
  }

  const handleAddField = (sectionId: string) => {
    if (!schema) return

    const newField = {
      id: crypto.randomUUID(),
      sectionId,
      type: 'text',
      label: 'New Field',
      required: false,
    }

    handleUpdateField(sectionId, newField.id, newField)
  }

  const handleDeleteField = (sectionId: string, fieldId: string) => {
    if (!schema) return

    const updatedSections = schema.sections.map(section => {
      if (section.id === sectionId) {
        return {
          ...section,
          fields: section.fields.filter(field => field.id !== fieldId)
        }
      }
      return section
    })

    setSchema({ ...schema, sections: updatedSections })
  }

  const handleAddSection = () => {
    if (!schema) return

    const newSection = {
      id: crypto.randomUUID(),
      title: 'New Section',
      fields: [],
    }

    setSchema({ ...schema, sections: [...schema.sections, newSection] })
  }

  const handleDeleteSection = (sectionId: string) => {
    if (!schema) return

    const updatedSections = schema.sections.filter(section => section.id !== sectionId)
    setSchema({ ...schema, sections: updatedSections })
  }

  const handleMoveSection = (dragIndex: number, dropIndex: number) => {
    if (!schema) return

    const sections = [...schema.sections]
    const [draggedSection] = sections.splice(dragIndex, 1)[0]
    sections.splice(dropIndex, 0, draggedSection)
    setSchema({ ...schema, sections })
  }

  const handleMoveField = (sectionId: string, dragIndex: number, dropIndex: number, fieldDragIndex: number) => {
    if (!schema) return

    const sections = [...schema.sections]
    const section = sections.find(s => s.id === sectionId)

    if (!section) return

    const fields = [...section.fields]
    const [draggedField] = fields.splice(dragIndex, 1)[0]

    // Find where to drop (account for the removed field)
    const targetIndex = dragIndex < dropIndex ? dropIndex - 1 : dropIndex
    fields.splice(targetIndex, 0, draggedField)

    section.fields = fields
    setSchema({ ...schema, sections })
  }

  const handleValidateSchema = async () => {
    if (!schema) return

    try {
      const response = await uiSchemaService.validateSchema(schema)
      if (response.data.valid) {
        setValidationErrors([])
        alert('Schema is valid!')
      } else {
        setValidationErrors(response.data.errors || [])
      }
    } catch (err: any) {
      console.error('Validation failed:', err)
      setValidationErrors([err.response?.data?.message || 'Validation failed'])
    }
  }

  if (loading && !schema) {
    return (
      <AdminLayout title="Schema Editor">
        <Head>
          <title>Schema Editor - {schema?.label || 'Loading...'}</title>
        </Head>
        <div className="container mx-auto px-4 py-8">
          <div className="mb-6">
            <Link href="/admin/schemas" className="text-primary hover:text-primary-dark mb-2 inline-block">
              ← Back to Schemas
            </Link>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              {error}
            </div>
          )}

          {schema && (
            <>
              {/* Header */}
              <div className="bg-surface-raised rounded-lg shadow p-6 mb-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-3xl font-bold text-text mb-2">{schema.label}</h1>
                    <p className="text-text-muted mb-2">
                      Type: <span className="font-medium text-primary">{schema.type}</span> •
                      Version: <span className="font-medium text-primary">v{schema.version}</span>
                    </p>
                  </div>
                  <div className="flex gap-3">
                    {schema.status === 'published' && (
                      <button
                        onClick={handlePublish}
                        className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark disabled:bg-primary-medium"
                      >
                        Unpublish
                      </button>
                    )}
                    {schema.status === 'draft' && (
                      <button
                        onClick={() => setShowPublishDialog(true)}
                        className="px-4 py-2 bg-surface border border-border rounded hover:bg-surface-raised"
                      >
                        Publish
                      </button>
                    )}
                    {schema.status === 'published' && (
                      <button
                        onClick={() => setShowArchiveDialog(true)}
                        className="px-4 py-2 bg-surface border border-border rounded hover:bg-surface-raised"
                      >
                        Archive
                      </button>
                    )}
                    <button
                      onClick={handleValidateSchema}
                      className="px-4 py-2 bg-surface border border-border rounded hover:bg-surface-raised"
                    >
                      Validate
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="bg-surface rounded-lg shadow mb-6">
                <nav className="flex space-x-1 border-b border-border">
                  <button
                    onClick={() => setActiveTab('sections')}
                    className={`px-6 py-3 text-sm font-medium transition-all ${
                      activeTab === 'sections'
                        ? 'border-b-2 border-b-primary bg-primary-light text-primary'
                        : 'border-b-2 border-transparent hover:text-primary'
                    }`}
                  >
                    Sections
                  </button>
                  <button
                    onClick={() => setActiveTab('fields')}
                    className={`px-6 py-3 text-sm font-medium transition-all ${
                      activeTab === 'fields'
                        ? 'border-b-2 border-b-primary bg-primary-light text-primary'
                        : 'border-b-2 border-transparent hover:text-primary'
                    }`}
                  >
                    Fields
                  </button>
                  <button
                    onClick={() => setActiveTab('preview')}
                    className={`px-6 py-3 text-sm font-medium transition-all ${
                      activeTab === 'preview'
                        ? 'border-b-2 border-b-primary bg-primary-light text-primary'
                        : 'border-b-2 border-transparent hover:text-primary'
                    }`}
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => setActiveTab('versions')}
                    className={`px-6 py-3 text-sm font-medium transition-all ${
                      activeTab === 'versions'
                        ? 'border-b-2 border-b-primary bg-primary-light text-primary'
                        : 'border-b-2 border-transparent hover:text-primary'
                    }`}
                  >
                    Versions
                  </button>
                </nav>

                {/* Tab Content */}
                <div className="p-6">
                  {activeTab === 'sections' && (
                    // This will be replaced with SectionList component
                    <div className="space-y-4">
                      {schema.sections.map((section, index) => (
                        <div key={section.id} className="bg-surface rounded-lg p-4">
                          <div className="flex justify-between items-center mb-2">
                            <h3 className="text-lg font-semibold">{section.title}</h3>
                            <button
                              onClick={() => handleDeleteSection(section.id)}
                              className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                            >
                              Remove
                            </button>
                          </div>
                          <div>
                            {section.fields.map((field) => (
                              <div key={field.id} className="bg-surface rounded p-3 mb-2">
                                <span className="text-sm text-text-muted">{field.label} ({field.type})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === 'fields' && (
                    // This will be replaced with FieldList component
                    <div className="space-y-4">
                      {schema.sections.map((section) => (
                        <div key={section.id} className="mb-6">
                          <h3 className="text-lg font-semibold mb-4">{section.title}</h3>
                          <div className="space-y-3">
                            {section.fields.map((field) => (
                              <div key={field.id} className="bg-surface rounded p-3">
                                <span className="text-sm text-text-muted">{field.label} ({field.type})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === 'preview' && (
                    // This will be replaced with LivePreview component
                    <div className="border border-border rounded-lg p-6">
                      <h3 className="text-lg font-semibold mb-4">Live Preview</h3>
                      <div className="text-sm text-text-muted">
                        Preview of how this schema renders in production DynamicForm
                      </div>
                      <div className="bg-surface rounded p-6">
                        <div className="text-center py-12 text-text-muted">
                          Preview will render here using DynamicForm component
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'versions' && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold mb-4">Version History</h3>
                      {versions.map((version, index) => (
                        <div key={version.id} className="bg-surface rounded-lg p-4 mb-3">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="text-sm font-medium text-primary">v{version.version}</div>
                              <div className="text-xs text-text-muted">
                                {new Date(version.created_at).toLocaleString()}
                              </div>
                              <div className="text-xs text-text-subtle mt-1">
                                Changed by: {version.changed_by}
                              </div>
                            </div>
                            <button
                              onClick={() => handleRollback(version.version)}
                              className="px-3 py-1 bg-surface border border-border rounded hover:bg-surface-raised text-sm"
                              disabled={saving}
                            >
                              Rollback
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Publish Dialog */}
              {showPublishDialog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-surface rounded-lg shadow-xl p-6 max-w-md">
                    <h2 className="text-xl font-semibold mb-4">Publish Schema?</h2>
                    <p className="text-text-muted mb-6">
                      This will make the schema live and available to all users.
                    </p>
                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={() => setShowPublishDialog(false)}
                        className="px-6 py-2 bg-surface border border-border rounded hover:bg-surface-raised"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handlePublish}
                        disabled={saving}
                        className="px-6 py-2 bg-primary text-white rounded hover:bg-primary-dark disabled:bg-primary-medium"
                      >
                        {saving ? 'Publishing...' : 'Publish'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Archive Dialog */}
              {showArchiveDialog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-surface rounded-lg shadow-xl p-6 max-w-md">
                    <h2 className="text-xl font-semibold mb-4">Archive Schema?</h2>
                    <p className="text-text-muted mb-6">
                      This will hide the schema from users and prevent new requests.
                      {schema.status === 'published' && '⚠️ Published schemas cannot be restored via UI - use rollback instead.'}
                    </p>
                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={() => setShowArchiveDialog(false)}
                        className="px-6 py-2 bg-surface border border-border rounded hover:bg-surface-raised"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleArchive}
                        disabled={saving || schema.status === 'published'}
                        className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-red-400"
                      >
                        {saving ? 'Archiving...' : 'Archive'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Loading state */}
          {!schema && !error && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
              <p className="mt-4 text-text-muted">Loading schema...</p>
            </div>
          )}
        </div>
      </AdminLayout>
    )
  }
}
