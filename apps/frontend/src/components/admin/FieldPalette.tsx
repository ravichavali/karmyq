import { FieldType } from '@karmyq/shared/schemas/ui'

interface PaletteItem {
  type: FieldType
  label: string
  icon: string
  description: string
}

const PALETTE_ITEMS: PaletteItem[] = [
  { type: 'text', label: 'Text', icon: '✏️', description: 'Short text input' },
  { type: 'textarea', label: 'Textarea', icon: '📝', description: 'Long text input' },
  { type: 'number', label: 'Number', icon: '🔢', description: 'Numeric input' },
  { type: 'select', label: 'Select', icon: '▾', description: 'Dropdown list' },
  { type: 'datetime', label: 'Date & Time', icon: '📅', description: 'Date/time picker' },
  { type: 'checkbox', label: 'Checkbox', icon: '☑️', description: 'Boolean toggle' },
  { type: 'location', label: 'Location', icon: '📍', description: 'Address / place' },
  { type: 'button_group', label: 'Button Group', icon: '⊙', description: 'Single-select buttons' },
  { type: 'chip_select', label: 'Chip Select', icon: '🏷️', description: 'Multi-select chips' },
  { type: 'range', label: 'Range', icon: '↔️', description: 'Numeric range slider' },
]

interface Props {
  onAddField: (type: FieldType, sectionId: string) => void
}

export default function FieldPalette({ onAddField }: Props) {
  const handleDragStart = (e: React.DragEvent, type: FieldType) => {
    e.dataTransfer.setData('palette/fieldType', type)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div className="w-52 flex-shrink-0 bg-surface border-r border-border overflow-y-auto">
      <div className="p-3 border-b border-border">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Field Types</p>
        <p className="text-xs text-text-subtle mt-0.5">Drag into a section</p>
      </div>
      <div className="p-2 space-y-1">
        {PALETTE_ITEMS.map((item) => (
          <div
            key={item.type}
            draggable
            onDragStart={(e) => handleDragStart(e, item.type)}
            className="flex items-center gap-2 px-3 py-2 rounded cursor-grab hover:bg-surface-raised border border-transparent hover:border-border active:cursor-grabbing select-none"
            title={item.description}
          >
            <span className="text-base">{item.icon}</span>
            <span className="text-sm font-medium text-text">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
