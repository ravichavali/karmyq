import DynamicForm from '@/components/requests/DynamicForm'

export interface LivePreviewProps {
  schema: any
  onValueChange?: (value: any) => void
}

export default function LivePreview({ schema, onValueChange }: LivePreviewProps) {
  return (
    <div className="border border-border rounded-lg bg-surface p-6">
      <h3 className="text-lg font-semibold text-text mb-4">Live Preview</h3>
      <p className="text-sm text-text-muted mb-4">
        This is how the schema renders in production using DynamicForm
      </p>

      {schema ? (
        <div className="bg-surface rounded p-6">
          <DynamicForm
            schema={schema}
            value={{}}
            onChange={onValueChange || (() => {})}
          />
        </div>
      ) : (
        <div className="text-center py-12 text-text-muted">
          No schema selected for preview
        </div>
      )}
    </div>
  )
}
