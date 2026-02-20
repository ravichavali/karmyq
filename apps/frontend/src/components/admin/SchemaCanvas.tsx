import FieldPalette from './FieldPalette'
import SectionCanvas from './SectionCanvas'
import { AdminField } from './FieldEditor'
import { FieldType } from '@karmyq/shared/schemas/ui'

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

interface Props {
  schema: AdminSchema
  saving: boolean
  onUpdateSection: (sectionId: string, updates: Partial<AdminSection>) => void
  onDeleteSection: (sectionId: string) => void
  onAddSection: () => void
  onAddField: (sectionId: string, type: string) => void
  onUpdateField: (sectionId: string, fieldId: string, updates: Partial<AdminField>) => void
  onDeleteField: (sectionId: string, fieldId: string) => void
  onMoveField: (sectionId: string, fromIndex: number, toIndex: number) => void
  onSaveDraft: () => void
  onPublish: () => void
}

// Preview renders each field as a read-only example
function FieldPreview({ field }: { field: AdminField }) {
  const placeholder = field.placeholder ?? `e.g., ${field.label.toLowerCase()}`

  switch (field.type) {
    case 'text':
      return (
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">
            {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <div className="w-full px-3 py-2 border border-border rounded text-sm text-text-subtle bg-surface">
            {placeholder}
          </div>
          {field.helpText && <p className="text-xs text-text-subtle mt-1">{field.helpText}</p>}
        </div>
      )
    case 'textarea':
      return (
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">
            {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <div className="w-full px-3 py-2 border border-border rounded text-sm text-text-subtle bg-surface h-16">
            {placeholder}
          </div>
          {field.helpText && <p className="text-xs text-text-subtle mt-1">{field.helpText}</p>}
        </div>
      )
    case 'number':
      return (
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">
            {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <div className="w-full px-3 py-2 border border-border rounded text-sm text-text-subtle bg-surface">
            0 {(field as any).unit}
          </div>
        </div>
      )
    case 'select':
      return (
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">
            {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <div className="w-full px-3 py-2 border border-border rounded text-sm text-text-subtle bg-surface flex justify-between">
            <span>{field.options?.[0]?.label ?? 'Select…'}</span>
            <span>▾</span>
          </div>
        </div>
      )
    case 'datetime':
      return (
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">
            {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <div className="w-full px-3 py-2 border border-border rounded text-sm text-text-subtle bg-surface">
            📅 MM/DD/YYYY HH:MM
          </div>
          {field.helpText && <p className="text-xs text-text-subtle mt-1">{field.helpText}</p>}
        </div>
      )
    case 'checkbox':
      return (
        <label className="flex items-center gap-2 cursor-not-allowed">
          <div className="w-4 h-4 border border-border rounded bg-surface flex-shrink-0" />
          <span className="text-sm text-text">{field.label}</span>
          {field.helpText && <span className="text-xs text-text-subtle ml-1">— {field.helpText}</span>}
        </label>
      )
    case 'location':
      return (
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">
            {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <div className="w-full px-3 py-2 border border-border rounded text-sm text-text-subtle bg-surface">
            📍 {placeholder}
          </div>
        </div>
      )
    case 'button_group':
      return (
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">
            {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <div className="flex gap-2 flex-wrap">
            {(field.options ?? [{ label: 'Option 1', value: '1' }, { label: 'Option 2', value: '2' }]).map((opt, i) => (
              <div
                key={i}
                className={`px-3 py-1.5 rounded border text-xs ${i === 0 ? 'border-primary bg-primary-light text-primary' : 'border-border bg-surface text-text-muted'}`}
              >
                {opt.label}
              </div>
            ))}
          </div>
        </div>
      )
    case 'chip_select':
      return (
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">
            {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <div className="flex gap-2 flex-wrap">
            {(field.options ?? [{ label: 'Option 1', value: '1' }, { label: 'Option 2', value: '2' }]).map((opt, i) => (
              <div key={i} className="px-3 py-1.5 rounded-full border border-border bg-surface text-xs text-text-muted">
                {opt.label}
              </div>
            ))}
          </div>
        </div>
      )
    case 'range':
      return (
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">
            {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <input type="range" className="w-full" disabled />
        </div>
      )
    default:
      return (
        <div className="text-xs text-text-subtle border border-dashed border-border rounded px-3 py-2">
          {field.label} ({field.type})
        </div>
      )
  }
}

function SchemaPreviewPanel({ schema }: { schema: AdminSchema }) {
  return (
    <div className="w-72 flex-shrink-0 border-l border-border bg-surface overflow-y-auto">
      <div className="p-3 border-b border-border">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Live Preview</p>
        <p className="text-xs text-text-subtle mt-0.5">How members will see this form</p>
      </div>
      <div className="p-4 space-y-6">
        {schema.sections.length === 0 && (
          <p className="text-xs text-text-subtle text-center py-8">Add sections and fields to see a preview</p>
        )}
        {schema.sections.map((section) => (
          <div key={section.id}>
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">{section.title}</h4>
            <div className="space-y-3">
              {section.fields.map((field) => (
                <FieldPreview key={field.id} field={field} />
              ))}
              {section.fields.length === 0 && (
                <p className="text-xs text-text-subtle italic">No fields yet</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SchemaCanvas({
  schema,
  saving,
  onUpdateSection,
  onDeleteSection,
  onAddSection,
  onAddField,
  onUpdateField,
  onDeleteField,
  onMoveField,
  onSaveDraft,
  onPublish,
}: Props) {
  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
      {/* 3-panel layout */}
      <div className="flex flex-1 overflow-hidden rounded-lg border border-border">
        {/* Left: Field palette */}
        <FieldPalette onAddField={(type: FieldType, sectionId: string) => onAddField(sectionId, type)} />

        {/* Middle: Section canvas */}
        <SectionCanvas
          sections={schema.sections}
          onUpdateSection={onUpdateSection}
          onDeleteSection={onDeleteSection}
          onAddSection={onAddSection}
          onAddField={onAddField}
          onUpdateField={onUpdateField}
          onDeleteField={onDeleteField}
          onMoveField={onMoveField}
        />

        {/* Right: Live preview */}
        <SchemaPreviewPanel schema={schema} />
      </div>

      {/* Save / Publish bar */}
      <div className="flex items-center justify-end gap-3 pt-4">
        {saving && <span className="text-xs text-text-subtle">Saving…</span>}
        <button
          onClick={onSaveDraft}
          disabled={saving}
          className="px-5 py-2 border border-border rounded hover:bg-surface-raised text-sm font-medium disabled:opacity-50"
        >
          Save Draft
        </button>
        {schema.status === 'draft' && (
          <button
            onClick={onPublish}
            disabled={saving}
            className="px-5 py-2 bg-primary text-white rounded hover:bg-primary-dark text-sm font-medium disabled:bg-primary-medium"
          >
            Publish
          </button>
        )}
      </div>
    </div>
  )
}
