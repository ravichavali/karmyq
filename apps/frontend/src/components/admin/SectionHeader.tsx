export interface SectionHeaderProps {
  section: {
    id: string
    title: string
    fields?: any[]
  }
  onToggle?: (sectionId: string) => void
  onDelete?: (sectionId: string) => void
  onEdit?: (section: any, updates: any) => void
}

export default function SectionHeader({ section, onToggle, onDelete, onEdit }: SectionHeaderProps) {
  const fieldCount = section.fields?.length || 0;

  return (
    <div className="flex justify-between items-center">
      <h3 className="text-lg font-semibold text-text flex-1">{section.title}</h3>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onToggle?.(section.id)}
          className="px-3 py-1 bg-surface border border-border rounded hover:bg-surface-raised text-sm"
          title={fieldCount > 0 ? 'Collapse section' : 'Expand section'}
        >
          {fieldCount > 0 ? '−' : '+'}
        </button>
        <button
          onClick={() => onEdit?.(section.id, { title: section.title })}
          className="px-3 py-1 bg-surface border border-border rounded hover:bg-surface-raised text-sm"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete?.(section.id)}
          className="px-3 py-1 bg-red-100 text-red-700 border border-red-200 rounded hover:bg-red-200 text-sm"
        >
          Remove
        </button>
      </div>
    </div>
  )
}
