'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { communityLinksService } from '../../lib/api'

interface CommunityLink {
  id: string
  community_a_id: string
  community_b_id: string
  link_type: 'sister' | 'parent_child' | 'split_origin'
  trust_carry_factor: number
  show_in_sister_feeds: boolean
  status: 'pending' | 'active' | 'inactive'
  partner_community_id: string
  partner_community_name: string
  created_at: string
}

interface CommunityLinksProps {
  communityId: string
  isAdmin: boolean
}

const LINK_TYPE_LABELS: Record<string, string> = {
  sister: 'Sister Community',
  parent_child: 'Parent / Child',
  split_origin: 'Split Origin',
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-500',
}

export default function CommunityLinks({ communityId, isAdmin }: CommunityLinksProps) {
  const [links, setLinks] = useState<CommunityLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPropose, setShowPropose] = useState(false)

  // Proposal form state
  const [targetId, setTargetId] = useState('')
  const [linkType, setLinkType] = useState<'sister' | 'parent_child' | 'split_origin'>('sister')
  const [showInFeeds, setShowInFeeds] = useState(false)
  const [proposing, setProposing] = useState(false)
  const [proposeError, setProposeError] = useState<string | null>(null)

  const loadLinks = useCallback(async () => {
    try {
      setLoading(true)
      const res = await communityLinksService.getLinks(communityId)
      setLinks(res.data?.links ?? res.data?.data ?? [])
    } catch {
      setError('Failed to load community links')
    } finally {
      setLoading(false)
    }
  }, [communityId])

  useEffect(() => {
    loadLinks()
  }, [loadLinks])

  async function handlePropose(e: React.FormEvent) {
    e.preventDefault()
    if (!targetId.trim()) return
    setProposing(true)
    setProposeError(null)
    try {
      await communityLinksService.proposeLink(communityId, {
        target_community_id: targetId.trim(),
        link_type: linkType,
        show_in_sister_feeds: showInFeeds,
      })
      setTargetId('')
      setLinkType('sister')
      setShowInFeeds(false)
      setShowPropose(false)
      await loadLinks()
    } catch (err: any) {
      setProposeError(err?.response?.data?.message ?? 'Failed to propose link')
    } finally {
      setProposing(false)
    }
  }

  async function handleApprove(linkId: string) {
    try {
      await communityLinksService.approveLink(communityId, linkId)
      await loadLinks()
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to approve link')
    }
  }

  async function handleToggleFeed(link: CommunityLink) {
    try {
      await communityLinksService.updateLink(communityId, link.id, {
        show_in_sister_feeds: !link.show_in_sister_feeds,
      })
      await loadLinks()
    } catch {
      setError('Failed to update link settings')
    }
  }

  async function handleRemove(linkId: string) {
    if (!confirm('Remove this community link?')) return
    try {
      await communityLinksService.removeLink(communityId, linkId)
      await loadLinks()
    } catch {
      setError('Failed to remove link')
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-500 py-4">Loading community links…</div>
  }

  const activeLinks = links.filter(l => l.status === 'active')
  const pendingLinks = links.filter(l => l.status === 'pending')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Linked Communities</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Sister communities share trust and optional feed content
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowPropose(v => !v)}
            className="text-xs px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            {showPropose ? 'Cancel' : '+ Propose Link'}
          </button>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
          {error}
        </div>
      )}

      {/* Propose Link Form */}
      {isAdmin && showPropose && (
        <form onSubmit={handlePropose} className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <p className="text-xs font-medium text-gray-700">Propose a link to another community</p>

          <div>
            <label className="block text-xs text-gray-600 mb-1">Target Community ID</label>
            <input
              type="text"
              value={targetId}
              onChange={e => setTargetId(e.target.value)}
              placeholder="paste community UUID"
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">Link Type</label>
            <select
              value={linkType}
              onChange={e => setLinkType(e.target.value as typeof linkType)}
              className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full"
            >
              <option value="sister">Sister Community (peer, 40% trust carry)</option>
              <option value="parent_child">Parent / Child (60% trust carry)</option>
              <option value="split_origin">Split Origin (50% trust carry)</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={showInFeeds}
              onChange={e => setShowInFeeds(e.target.checked)}
              className="rounded"
            />
            Show their open requests in our feed
          </label>

          {proposeError && (
            <p className="text-xs text-red-600">{proposeError}</p>
          )}

          <button
            type="submit"
            disabled={proposing}
            className="text-xs px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {proposing ? 'Proposing…' : 'Send Proposal'}
          </button>
        </form>
      )}

      {/* Pending links awaiting our approval */}
      {pendingLinks.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Pending Approval</p>
          <ul className="space-y-2">
            {pendingLinks.map(link => (
              <li key={link.id} className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                <div>
                  <span className="text-sm font-medium text-gray-800">{link.partner_community_name}</span>
                  <span className="ml-2 text-xs text-gray-500">{LINK_TYPE_LABELS[link.link_type]}</span>
                </div>
                {isAdmin && link.community_b_id === communityId && (
                  <button
                    onClick={() => handleApprove(link.id)}
                    className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700"
                  >
                    Approve
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Active links */}
      {activeLinks.length > 0 ? (
        <ul className="space-y-2">
          {activeLinks.map(link => (
            <li key={link.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-800 truncate">
                    {link.partner_community_name}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_BADGE[link.status]}`}>
                    {link.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {LINK_TYPE_LABELS[link.link_type]} · {Math.round(link.trust_carry_factor * 100)}% trust carry
                </p>
              </div>

              {isAdmin && (
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer" title="Show in sister feed">
                    <input
                      type="checkbox"
                      checked={link.show_in_sister_feeds}
                      onChange={() => handleToggleFeed(link)}
                      className="rounded"
                    />
                    Feed
                  </label>
                  <button
                    onClick={() => handleRemove(link.id)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        !pendingLinks.length && (
          <p className="text-sm text-gray-400 text-center py-4">
            No linked communities yet.
          </p>
        )
      )}
    </div>
  )
}
