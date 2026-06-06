import Link from 'next/link'
import type { Community } from '@/hooks/useCommunityData'

interface Props {
  community: Community
  isMember: boolean
  isPending: boolean
  isAdmin: boolean
  joiningCommunity: boolean
  onJoin: () => void
  onShowFission?: () => void
}

const DUNBAR_CAP = 150

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Sprint 89 / ADR-068 — the warm community hero. Opens the page as a *neighbourhood*: serif name,
 * mission quote, a few member faces, and the visible Dunbar cap bar ("capped on purpose"). Embeds
 * the join CTA for non-members/pending (same logic as the retired CommunityHeader), and keeps the
 * admin size-alert / Schema Manager affordances so nothing functional is lost in the reskin.
 */
export default function CommunityHero({ community, isMember, isPending, isAdmin, joiningCommunity, onJoin, onShowFission }: Props) {
  const activeMembers = (community.members ?? []).filter((m) => m.status === 'active')
  const cap = community.max_members || DUNBAR_CAP
  const current = community.current_members
  const roomForMore = Math.max(cap - current, 0)
  const fillPct = Math.min((current / cap) * 100, 100)
  const isFull = current >= cap

  const faceMembers = activeMembers.slice(0, 3)
  const overflow = current - faceMembers.length

  return (
    <div className="kq-hero">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <div className="kq-eyebrow">A place you belong to</div>
          <h1 className="kq-hero-name">{community.name}</h1>
          {community.description && <p className="kq-hero-mission">“{community.description}”</p>}
        </div>
        {!isMember && !isPending && (
          <button
            onClick={onJoin}
            disabled={joiningCommunity || isFull}
            className={`flex-none px-6 py-2 rounded disabled:cursor-not-allowed ${
              joiningCommunity || isFull
                ? 'bg-gray-400 text-white'
                : community.access_type === 'private'
                ? 'bg-accent text-white hover:bg-accent-dark'
                : 'bg-primary text-white hover:bg-primary-dark'
            }`}
          >
            {joiningCommunity
              ? 'Joining...'
              : isFull
              ? 'Community Full'
              : community.access_type === 'private'
              ? 'Request to Join'
              : 'Join Community'}
          </button>
        )}
        {isPending && (
          <div className="flex-none px-6 py-2 bg-yellow-100 text-yellow-800 rounded font-medium">
            ⏳ Join Request Pending
          </div>
        )}
      </div>

      <div className="kq-capline mt-2">
        {faceMembers.length > 0 && (
          <div className="kq-faces">
            {faceMembers.map((m) => (
              <span key={m.user_id} className="kq-face" title={m.user_name}>{initials(m.user_name)}</span>
            ))}
            {overflow > 0 && <span className="kq-face more">+{overflow}</span>}
          </div>
        )}
        <span><b className="text-text font-semibold">{current}</b> {current === 1 ? 'neighbour' : 'neighbours'} · room for <b className="text-text font-semibold">{roomForMore}</b> more</span>
        {community.creator_name && <span className="text-text-subtle">· stewarded by {community.creator_name}</span>}
      </div>

      <div className="kq-capbar">
        <div className="kq-capbar-fill" style={{ width: `${fillPct}%` }} />
      </div>
      <p className="kq-quiet-meta mt-2">Capped at {cap}, on purpose — small enough that people still know each other.</p>

      {isAdmin && (
        <div className="mt-4">
          <Link
            href="/admin/schemas"
            className="px-4 py-2 bg-surface border border-border rounded hover:bg-surface-raised text-sm font-medium text-text-muted"
          >
            Schema Manager →
          </Link>
        </div>
      )}

      {community.size_alert && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          {community.size_alert === 'urgent_split'
            ? `⚠️ This community has ${current} members — consider splitting to maintain cohesion.`
            : community.size_alert === 'recommend_split'
            ? `This community is approaching its optimal size. A split may help maintain trust.`
            : `Community growing — ${current}/${cap} members.`}
          {isAdmin && !community.active_split_proposal && onShowFission && (
            <button onClick={onShowFission} className="ml-2 underline font-medium">
              Propose Split →
            </button>
          )}
        </div>
      )}
    </div>
  )
}
