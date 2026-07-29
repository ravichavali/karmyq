import { useState } from 'react'

const FIELD_TYPES = [
  'text', 'textarea', 'number', 'select', 'datetime',
  'checkbox', 'location', 'button_group', 'chip_select', 'range',
]

const HAS_OPTIONS = ['select', 'button_group', 'chip_select']
const HAS_RANGE = ['number', 'range']

export interface AdminField {
  id: string
  type: string
  label: string
  required: boolean
  placeholder?: string
  helpText?: string
  key?: string
  options?: Array<{ value: string; label: string }>
  min?: number
  max?: number
  step?: number
  unit?: string
}

interface Props {
  field: AdminField
  onChange: (updates: Partial<AdminField>) => void
  onDelete: () => void
}

export default function FieldEditor({ field, onChange, onDelete }: Props) {
  const [optionInput, setOptionInput] = useState('')

  const addOption = () => {
    const trimmed = optionInput.trim()
    if (!trimmed) return
    const newOption = { value: trimmed.toLowerCase().replace(/\s+/g, '_'), label: trimmed }
    onChange({ options: [...(field.options ?? []), newOption] })
    setOptionInput('')
  }

  const removeOption = (index: number) => {
    const opts = [...(field.options ?? [])]
    opts.splice(index, 1)
    onChange({ options: opts })
  }

  const showOptions = HAS_OPTIONS.includes(field.type)
  const showRange = HAS_RANGE.includes(field.type)

  return (
    <div className="mt-1 mx-2 mb-3 bg-primary-light border border-primary/30 rounded-lg p-4 space-y-3 text-sm">
      <div className="flex justify-between items-center">
        <span className="font-semibold text-text text-sm">Edit field</span>
        <button onClick={onDelete} className="text-xs text-red-600 hover:text-red-800">
          Delete field
        </button>
      </div>

      {/* Type */}
      <div>
        <label className="block text-xs font-medium text-text-muted mb-1">Type</label>
        <select
          value={field.type}
          onChange={(e) => onChange({ type: e.target.value })}
          className="w-full px-3 py-1.5 border border-border rounded text-sm bg-surface focus:outline-hidden focus:ring-1 focus:ring-primary"
        >
          {FIELD_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Label */}
      <div>
        <label className="block text-xs font-medium text-text-muted mb-1">Label *</label>
        <input
          type="text"
          value={field.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className="w-full px-3 py-1.5 border border-border rounded text-sm bg-surface focus:outline-hidden focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Key */}
      <div>
        <label className="block text-xs font-medium text-text-muted mb-1">Key</label>
        <input
          type="text"
          value={field.key ?? field.label.toLowerCase().replace(/\s+/g, '_')}
          onChange={(e) => onChange({ key: e.target.value })}
          className="w-full px-3 py-1.5 border border-border rounded text-sm bg-surface focus:outline-hidden focus:ring-1 focus:ring-primary font-mono"
        />
      </div>

      {/* Placeholder */}
      {!['checkbox', 'datetime', 'range'].includes(field.type) && (
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">Placeholder</label>
          <input
            type="text"
            value={field.placeholder ?? ''}
            onChange={(e) => onChange({ placeholder: e.target.value })}
            className="w-full px-3 py-1.5 border border-border rounded text-sm bg-surface focus:outline-hidden focus:ring-1 focus:ring-primary"
          />
        </div>
      )}

      {/* Help text */}
      <div>
        <label className="block text-xs font-medium text-text-muted mb-1">Help text</label>
        <input
          type="text"
          value={field.helpText ?? ''}
          onChange={(e) => onChange({ helpText: e.target.value })}
          className="w-full px-3 py-1.5 border border-border rounded text-sm bg-surface focus:outline-hidden focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Required */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={field.required}
          onChange={(e) => onChange({ required: e.target.checked })}
          className="rounded"
        />
        <span className="text-sm text-text">Required</span>
      </label>

      {/* Options for select/button_group/chip_select */}
      {showOptions && (
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">Options</label>
          <div className="space-y-1 mb-2">
            {(field.options ?? []).map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex-1 px-2 py-1 bg-surface border border-border rounded text-xs">{opt.label}</span>
                <button onClick={() => removeOption(i)} className="text-red-500 hover:text-red-700 text-xs px-1">✕</button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={optionInput}
              onChange={(e) => setOptionInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOption() } }}
              placeholder="Add option…"
              className="flex-1 px-3 py-1.5 border border-border rounded text-sm bg-surface focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
            <button onClick={addOption} className="px-3 py-1.5 bg-primary text-white rounded text-sm hover:bg-primary-dark">
              Add
            </button>
          </div>
        </div>
      )}

      {/* Min/max/unit for number/range */}
      {showRange && (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Min</label>
            <input
              type="number"
              value={field.min ?? ''}
              onChange={(e) => onChange({ min: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full px-2 py-1.5 border border-border rounded text-sm bg-surface focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Max</label>
            <input
              type="number"
              value={field.max ?? ''}
              onChange={(e) => onChange({ max: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full px-2 py-1.5 border border-border rounded text-sm bg-surface focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Unit</label>
            <input
              type="text"
              value={field.unit ?? ''}
              onChange={(e) => onChange({ unit: e.target.value })}
              placeholder="km, $…"
              className="w-full px-2 py-1.5 border border-border rounded text-sm bg-surface focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      )}
    </div>
  )
}
