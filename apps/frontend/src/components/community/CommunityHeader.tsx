import Link from 'next/link'
import type { Community } from '@/hooks/useCommunityData'

interface Props {
  community: Community
  isMember: boolean
  isPending: boolean
  isAdmin: boolean
  joiningCommunity: boolean
  onJoin: () => void
}

export default function CommunityHeader({ community, isMember, isPending, isAdmin, joiningCommunity, onJoin }: Props) {
  return (
    <div className="bg-surface-raised rounded-lg shadow-md p-8 mb-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">{community.name}</h1>
          <p className="text-text-muted">{community.description}</p>
        </div>
        {!isMember && !isPending && (
          <button
            onClick={onJoin}
            disabled={joiningCommunity || community.current_members >= community.max_members}
            className={`px-6 py-2 rounded disabled:cursor-not-allowed ${
              joiningCommunity || community.current_members >= community.max_members
                ? 'bg-gray-400 text-white'
                : community.access_type === 'private'
                ? 'bg-accent text-white hover:bg-accent-dark'
                : 'bg-primary text-white hover:bg-primary-dark'
            }`}
          >
            {joiningCommunity
              ? 'Joining...'
              : community.current_members >= community.max_members
              ? 'Community Full'
              : community.access_type === 'private'
              ? 'Request to Join'
              : 'Join Community'}
          </button>
        )}
        {isPending && (
          <div className="px-6 py-2 bg-yellow-100 text-yellow-800 rounded font-medium">
            ⏳ Join Request Pending
          </div>
        )}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6 text-sm text-text-muted">
          <span>Created by {community.creator_name}</span>
          <span>•</span>
          <span>
            {community.current_members} / {community.max_members} members
          </span>
        </div>
        {isAdmin && (
          <Link
            href="/admin/schemas"
            className="px-4 py-2 bg-surface border border-border rounded hover:bg-surface-raised text-sm font-medium text-text-muted"
          >
            Schema Manager →
          </Link>
        )}
      </div>
      <div className="mt-4">
        <div className="w-full bg-border-light rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full"
            style={{ width: `${(community.current_members / community.max_members) * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}
