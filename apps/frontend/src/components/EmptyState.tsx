import Link from 'next/link'

interface EmptyStateProps {
  icon?: string
  heading: string
  body: string
  ctaLabel?: string
  ctaHref?: string
  ctaOnClick?: () => void
}

export default function EmptyState({ icon, heading, body, ctaLabel, ctaHref, ctaOnClick }: EmptyStateProps) {
  return (
    <div className="card p-8 text-center">
      {icon && <div className="text-4xl mb-4">{icon}</div>}
      <h3 className="font-semibold text-lg text-text">{heading}</h3>
      <p className="text-text-muted text-sm mt-2 mb-6">{body}</p>
      {ctaLabel && ctaHref && (
        <Link href={ctaHref} className="btn-primary inline-flex">
          {ctaLabel}
        </Link>
      )}
      {ctaLabel && ctaOnClick && (
        <button onClick={ctaOnClick} className="btn-primary inline-flex">
          {ctaLabel}
        </button>
      )}
    </div>
  )
}
