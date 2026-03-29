import { useEffect, useState } from 'react'

export interface DibsCardProps {
  requestTitle: string
  scheduledFor: string
  expiresAt: string
  onAccept: () => void
  onDecline: () => void
}

function formatScheduled(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function computeCountdown(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'Expired'
  const totalMinutes = Math.floor(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0 && minutes > 0) return `Expires in ${hours}h ${minutes}m`
  if (hours > 0) return `Expires in ${hours}h`
  return `Expires in ${minutes}m`
}

export default function DibsCard({
  requestTitle,
  scheduledFor,
  expiresAt,
  onAccept,
  onDecline,
}: DibsCardProps) {
  const [countdown, setCountdown] = useState(() => computeCountdown(expiresAt))
  const [actioning, setActioning] = useState<'accept' | 'decline' | null>(null)

  // Recalculate countdown every minute
  useEffect(() => {
    const tick = () => setCountdown(computeCountdown(expiresAt))
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [expiresAt])

  const expired = new Date(expiresAt).getTime() <= Date.now()

  const handleAccept = async () => {
    setActioning('accept')
    try {
      await Promise.resolve(onAccept())
    } finally {
      setActioning(null)
    }
  }

  const handleDecline = async () => {
    setActioning('decline')
    try {
      await Promise.resolve(onDecline())
    } finally {
      setActioning(null)
    }
  }

  return (
    <div className="card p-4 mb-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-text truncate">{requestTitle}</p>
          <p className="text-sm text-text-muted mt-0.5">
            Scheduled: {formatScheduled(scheduledFor)}
          </p>
        </div>
        <span
          className={`text-xs font-medium shrink-0 ${
            expired ? 'text-red-500' : 'text-amber-600'
          }`}
        >
          {countdown}
        </span>
      </div>

      {!expired && (
        <div className="flex justify-end gap-2 mt-3">
          <button
            className="text-xs py-1 px-2 rounded bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50"
            disabled={actioning !== null}
            onClick={handleAccept}
          >
            {actioning === 'accept' ? 'Accepting…' : 'Accept'}
          </button>
          <button
            className="text-xs py-1 px-2 rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
            disabled={actioning !== null}
            onClick={handleDecline}
          >
            {actioning === 'decline' ? 'Declining…' : 'Decline'}
          </button>
        </div>
      )}
    </div>
  )
}
