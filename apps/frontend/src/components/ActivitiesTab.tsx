import React, { useCallback, useEffect, useState } from 'react'
import { communityService } from '@/lib/api'
import ActivityCard from './ActivityCard'
import CreateActivityModal from './CreateActivityModal'
// Onboarding: see src/lib/onboarding/workflows.ts → 'activities'
import { useOnboarding } from '@/hooks/useOnboarding'
import OnboardingOverlay from '@/components/OnboardingOverlay'
import { WORKFLOWS } from '@/lib/onboarding/workflows'

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

interface ActivitiesTabProps {
  communityId: string
  isAdmin: boolean
}

export default function ActivitiesTab({ communityId, isAdmin }: ActivitiesTabProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [joiningId, setJoiningId] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const { shouldShow: showActivitiesOnboarding, markSeen: markActivitiesSeen } = useOnboarding('activities')

  const fetchActivities = useCallback(async () => {
    setLoading(true)
    try {
      const res = await communityService.getActivities(communityId)
      const raw = res.data?.data ?? res.data ?? []
      setActivities(Array.isArray(raw) ? raw : [])
    } catch {
      setActivities([])
    } finally {
      setLoading(false)
    }
  }, [communityId])

  useEffect(() => {
    fetchActivities()
  }, [fetchActivities])

  async function handleJoin(activityId: string) {
    setJoiningId(activityId)
    setJoinError(null)
    try {
      await communityService.joinActivity(communityId, activityId)
      await fetchActivities()
    } catch (err: any) {
      setJoinError(err?.response?.data?.message ?? 'Failed to join activity')
    } finally {
      setJoiningId(null)
    }
  }

  async function handleLeave(activityId: string) {
    setJoiningId(activityId)
    setJoinError(null)
    try {
      await communityService.leaveActivity(communityId, activityId)
      await fetchActivities()
    } finally {
      setJoiningId(null)
    }
  }

  return (
    <div className="space-y-4">
      {showActivitiesOnboarding && (
        <OnboardingOverlay workflow={WORKFLOWS.activities} onDismiss={markActivitiesSeen} />
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-text">Activities</h3>
        {isAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 text-sm font-medium rounded bg-primary text-white hover:bg-primary-dark"
          >
            Create Activity
          </button>
        )}
      </div>

      {/* Join/Leave error */}
      {joinError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm">
          {joinError}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="bg-surface-raised border border-border rounded-lg p-4 animate-pulse h-28"
            />
          ))}
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-12 text-text-muted text-sm">
          {isAdmin
            ? 'No upcoming activities. Create one to get started.'
            : 'No upcoming activities scheduled.'}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {activities.map(activity => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              onJoin={handleJoin}
              onLeave={handleLeave}
              joining={joiningId === activity.id}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreateModal && (
        <CreateActivityModal
          communityId={communityId}
          onCreated={() => {
            setShowCreateModal(false)
            fetchActivities()
          }}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  )
}
