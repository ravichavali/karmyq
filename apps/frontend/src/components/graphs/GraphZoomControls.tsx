// Sprint 113 / BUG-027 — the shared zoom affordance for every belonging-graph surface. Presentational
// only: it renders the in/out/reset buttons and calls back. The d3.zoom wiring lives in the single
// owner (TrustGraphHEB), so no surface ever mounts two control clusters.
interface GraphZoomControlsProps {
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  className?: string
}

const BTN =
  'w-8 h-8 flex items-center justify-center rounded-md bg-surface-raised border border-border ' +
  'text-text-muted hover:bg-surface hover:text-text shadow-xs transition-colors text-lg leading-none'

export default function GraphZoomControls({ onZoomIn, onZoomOut, onReset, className = '' }: GraphZoomControlsProps) {
  return (
    <div className={`absolute top-2 right-2 z-10 flex flex-col gap-1 ${className}`}>
      <button type="button" aria-label="Zoom in" onClick={onZoomIn} className={BTN}>+</button>
      <button type="button" aria-label="Zoom out" onClick={onZoomOut} className={BTN}>−</button>
      <button type="button" aria-label="Reset zoom" onClick={onReset} className={`${BTN} text-sm`}>⤢</button>
    </div>
  )
}
