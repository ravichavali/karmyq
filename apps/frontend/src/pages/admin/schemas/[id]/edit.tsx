import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { uiSchemaService } from '@/lib/api'
import AdminLayout from '@/components/admin/AdminLayout'
import dynamic from 'next/dynamic'

const SchemaCanvas = dynamic(() => import('@/components/admin/SchemaCanvas'), {
  loading: () => <div className="card p-8 text-center text-text-muted animate-pulse">Loading canvas...</div>,
  ssr: false,
})
import EmojiPicker from '@/components/admin/EmojiPicker'
import { requireAdmin, isAdmin } from '@/utils/admin-auth'

// Admin schema is the database record representation (includes id, status, etc.)
interface AdminField {
  id: string
  type: string
  label: string
  required: boolean
  placeholder?: string
  helpText?: string
}

interface AdminSection {
  id: string
  title: string
  description?: string
  fields: AdminField[]
}

interface AdminSchema {
  id: string
  type: string
  version: number
  label: string
  icon: string
  color: string
  description: string
  status: 'draft' | 'published' | 'archived'
  sections: AdminSection[]
}

interface SchemaVersion {
  id: string
  version: number
  schema_snapshot: AdminSchema
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
  const [schema, setSchema] = useState<AdminSchema | null>(null)
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
      const response = await uiSchemaService.getAdminSchema(id as string)
      setSchema(response.data.schema)
      setValidationErrors([])
    } catch (err: any) {
      console.error('Failed to load schema', { error: err instanceof Error ? err.message : String(err) })
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
      console.error('Failed to load versions', { error: err instanceof Error ? err.message : String(err) })
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
      console.error('Failed to publish schema', { error: err instanceof Error ? err.message : String(err) })
      const data = err.response?.data
      const detail = data?.errors?.length
        ? `${data.message}:\n• ${data.errors.join('\n• ')}`
        : data?.message || 'Failed to publish schema'
      setError(detail)
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
      console.error('Failed to archive schema', { error: err instanceof Error ? err.message : String(err) })
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
      console.error('Failed to rollback schema', { error: err instanceof Error ? err.message : String(err) })
      setError(err.response?.data?.message || 'Failed to rollback schema')
    } finally {
      setSaving(false)
    }
  }

  const saveSchema = async (updatedSchema: AdminSchema) => {
    try {
      setSaving(true)
      await uiSchemaService.updateSchema(updatedSchema.id, {
        label: updatedSchema.label,
        icon: updatedSchema.icon,
        color: updatedSchema.color,
        description: updatedSchema.description,
        sections: updatedSchema.sections,
      })
      setError('')
    } catch (err: any) {
      console.error('Failed to save schema', { error: err instanceof Error ? err.message : String(err) })
      setError(err.response?.data?.message || 'Failed to save schema')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateSection = (sectionId: string, updates: Partial<AdminSection>) => {
    if (!schema) return

    const updatedSections = schema.sections.map(section => {
      if (section.id === sectionId) {
        return { ...section, ...updates }
      }
      return section
    })

    const updatedSchema = { ...schema, sections: updatedSections }
    setSchema(updatedSchema)
    saveSchema(updatedSchema)
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

    const updatedSchema = { ...schema, sections: updatedSections }
    setSchema(updatedSchema)
    saveSchema(updatedSchema)
  }

  const handleAddField = (sectionId: string, type: string = 'text') => {
    if (!schema) return

    const newField = {
      id: crypto.randomUUID(),
      type,
      label: type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ') + ' field',
      required: false,
    }

    const updatedSections = schema.sections.map(section => {
      if (section.id === sectionId) {
        return { ...section, fields: [...section.fields, newField] }
      }
      return section
    })

    const updatedSchema = { ...schema, sections: updatedSections }
    setSchema(updatedSchema)
    saveSchema(updatedSchema)
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

    const updatedSchema = { ...schema, sections: updatedSections }
    setSchema(updatedSchema)
    saveSchema(updatedSchema)
  }

  const handleAddSection = () => {
    if (!schema) return

    const newSection = {
      id: crypto.randomUUID(),
      title: 'New Section',
      fields: [],
    }

    const updatedSchema = { ...schema, sections: [...schema.sections, newSection] }
    setSchema(updatedSchema)
    saveSchema(updatedSchema)
  }

  const handleDeleteSection = (sectionId: string) => {
    if (!schema) return

    const updatedSections = schema.sections.filter(section => section.id !== sectionId)
    const updatedSchema = { ...schema, sections: updatedSections }
    setSchema(updatedSchema)
    saveSchema(updatedSchema)
  }

  const handleMoveSection = (dragIndex: number, dropIndex: number) => {
    if (!schema) return

    const sections = [...schema.sections]
    const [draggedSection] = sections.splice(dragIndex, 1)
    sections.splice(dropIndex, 0, draggedSection)
    setSchema({ ...schema, sections })
  }

  const handleMoveField = (sectionId: string, dragIndex: number, dropIndex: number) => {
    if (!schema) return

    const sections = [...schema.sections]
    const section = sections.find(s => s.id === sectionId)

    if (!section) return

    const fields = [...section.fields]
    const [draggedField] = fields.splice(dragIndex, 1)

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
      console.error('Validation failed', { error: err instanceof Error ? err.message : String(err) })
      setValidationErrors([err.response?.data?.message || 'Validation failed'])
    }
  }

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
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 whitespace-pre-line">
              {error}
            </div>
          )}

          {schema && (
            <>
              {/* Header */}
              <div className="bg-surface-raised rounded-lg shadow p-6 mb-6">
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-4">
                    <div className="w-48 flex-shrink-0">
                      <EmojiPicker
                        value={schema.icon}
                        label=""
                        onChange={(emoji) => {
                          const updated = { ...schema, icon: emoji }
                          setSchema(updated)
                          saveSchema(updated)
                        }}
                      />
                    </div>
                    <div>
                      <h1 className="text-3xl font-bold text-text mb-2">{schema.label}</h1>
                      <p className="text-text-muted mb-2">
                        Type: <span className="font-medium text-primary">{schema.type}</span> •
                        Version: <span className="font-medium text-primary">v{schema.version}</span>
                      </p>
                    </div>
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
                    <SchemaCanvas
                      schema={schema}
                      saving={saving}
                      onUpdateSection={handleUpdateSection}
                      onDeleteSection={handleDeleteSection}
                      onAddSection={handleAddSection}
                      onAddField={handleAddField}
                      onUpdateField={handleUpdateField}
                      onDeleteField={handleDeleteField}
                      onMoveField={handleMoveField}
                      onSaveDraft={() => saveSchema(schema)}
                      onPublish={() => setShowPublishDialog(true)}
                    />
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
              </div>

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
