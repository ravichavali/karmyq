import React from 'react'

interface Activity {
  id: string
  title: string
  activity_type: 'pickup_game' | 'group_run' | 'workout' | 'social' | 'other'
  scheduled_at: string
  duration_minutes?: number
  location?: string
  max_participants?: number
  current_participants: number
  status: string
  is_joined: boolean
  created_by_name: string
}

interface ActivityCardProps {
  activity: Activity
  onJoin: (activityId: string) => void
  onLeave: (activityId: string) => void
  joining: boolean
}

const TYPE_BADGE_CLASSES: Record<Activity['activity_type'], string> = {
  pickup_game: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  group_run: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  workout: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  social: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  other: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

const TYPE_LABELS: Record<Activity['activity_type'], string> = {
  pickup_game: 'Pickup Game',
  group_run: 'Group Run',
  workout: 'Workout',
  social: 'Social',
  other: 'Other',
}

function formatScheduledAt(isoString: string, durationMinutes?: number): string {
  const date = new Date(isoString)
  const datePart = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const timePart = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  let result = `${datePart} · ${timePart}`
  if (durationMinutes) {
    result += ` · ${durationMinutes} min`
  }
  return result
}

export default function ActivityCard({ activity, onJoin, onLeave, joining }: ActivityCardProps) {
  const isFull =
    activity.max_participants != null &&
    activity.current_participants >= activity.max_participants

  const participantLabel =
    activity.max_participants != null
      ? `${activity.current_participants} / ${activity.max_participants} joined`
      : `${activity.current_participants} joined`

  return (
    <div className="bg-surface-raised border border-border rounded-lg p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <h3 className="font-semibold text-text text-base truncate">{activity.title}</h3>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${TYPE_BADGE_CLASSES[activity.activity_type]}`}
          >
            {TYPE_LABELS[activity.activity_type]}
          </span>
          {isFull && !activity.is_joined && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
              Full
            </span>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="text-sm text-text-muted space-y-1">
        <div>{formatScheduledAt(activity.scheduled_at, activity.duration_minutes)}</div>
        {activity.location && <div>{activity.location}</div>}
        <div>{participantLabel}</div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-xs text-text-subtle">by {activity.created_by_name}</span>

        {activity.is_joined ? (
          <button
            onClick={() => onLeave(activity.id)}
            disabled={joining}
            className="px-4 py-1.5 text-sm font-medium rounded border border-border text-text hover:bg-surface disabled:opacity-50"
          >
            Leave
          </button>
        ) : isFull ? (
          <button
            disabled
            className="px-4 py-1.5 text-sm font-medium rounded bg-surface text-text-muted border border-border cursor-not-allowed opacity-60"
          >
            Full
          </button>
        ) : (
          <button
            onClick={() => onJoin(activity.id)}
            disabled={joining}
            className="px-4 py-1.5 text-sm font-medium rounded bg-primary text-white hover:bg-primary-dark disabled:opacity-50"
          >
            Join
          </button>
        )}
      </div>
    </div>
  )
}
