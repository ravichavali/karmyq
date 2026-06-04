import { useEffect, useState } from 'react'
import Link from 'next/link'
import { requestService } from '@/lib/api'
import { isBoostActive } from '@/utils/boost'
import UnifiedFeed from '@/components/Feed/UnifiedFeed'
import type { Community, Member } from '@/hooks/useCommunityData'

interface Props {
  communityRequests: any[]
  loadingRequests: boolean
  loadingStats: boolean
  stats: any
  communityTrust: any
  loadingTrust: boolean
  networkMetrics: any
  community: Community
  communityId: string
  isAdmin: boolean
  isAdminOrMod: boolean
  refetchCommunityRequests: (status?: string) => Promise<void>
}

export default function BrowseTab({
  communityRequests, loadingRequests, loadingStats, stats,
  communityTrust, loadingTrust, networkMetrics,
  community, communityId, isAdmin, isAdminOrMod,
  refetchCommunityRequests,
}: Props) {
  const [requestStatusFilter, setRequestStatusFilter] = useState<string>('open')
  const [exporting, setExporting] = useState(false)
  const [boostingRequest, setBoostingRequest] = useState<string | null>(null)
  const [actionDropdownOpen, setActionDropdownOpen] = useState<string | null>(null)
  const [showTriageModal, setShowTriageModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<any>(null)
  const [triageUrgency, setTriageUrgency] = useState('')
  const [triageNote, setTriageNote] = useState('')
  const [selectedResponderId, setSelectedResponderId] = useState('')
  const [proposingMatch, setProposingMatch] = useState(false)
  const [savingTriage, setSavingTriage] = useState(false)
  const [showMemberPicker, setShowMemberPicker] = useState(false)
  const [memberPickerRequest, setMemberPickerRequest] = useState<any>(null)
  const [memberPickerSearch, setMemberPickerSearch] = useState('')
  const [memberPickerSelected, setMemberPickerSelected] = useState<Member | null>(null)
  const [memberPickerConfirm, setMemberPickerConfirm] = useState(false)

  // Close action dropdown on outside click
  useEffect(() => {
    if (!actionDropdownOpen) return
    const handleOutsideClick = () => setActionDropdownOpen(null)
    document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [actionDropdownOpen])

  // Close member picker on Escape
  useEffect(() => {
    if (!showMemberPicker) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMemberPicker()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [showMemberPicker])

  const handleCloseTriageModal = () => {
    setShowTriageModal(false)
    setSelectedRequest(null)
    setTriageUrgency('')
    setTriageNote('')
    setSelectedResponderId('')
    setProposingMatch(false)
  }

  const closeMemberPicker = () => {
    setShowMemberPicker(false)
    setMemberPickerRequest(null)
    setMemberPickerSearch('')
    setMemberPickerSelected(null)
    setMemberPickerConfirm(false)
  }

  const handleExport = async (type: 'full' | 'members' | 'activity', format: 'json' | 'csv') => {
    const { communityService } = await import('@/lib/api')
    setExporting(true)
    try {
      let response: any, filename: string
      if (type === 'full') { response = await communityService.exportCommunityData(communityId, { format }); filename = `community-${communityId}-export.${format}` }
      else if (type === 'members') { response = await communityService.exportMembers(communityId, format); filename = `members-${communityId}.${format}` }
      else { response = await communityService.exportActivity(communityId, format); filename = `activity-${communityId}.${format}` }
      const blob = format === 'csv' ? new Blob([response.data], { type: 'text/csv' }) : new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename
      document.body.appendChild(a); a.click()
      window.URL.revokeObjectURL(url); document.body.removeChild(a)
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to export data')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Admin summary cards */}
      {isAdminOrMod && (
        <div>
          {loadingStats && !stats ? (
            <div className="grid md:grid-cols-3 gap-4 mb-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-surface-raised rounded-lg p-4 border border-border animate-pulse">
                  <div className="h-3 bg-border rounded w-1/2 mb-2" />
                  <div className="h-8 bg-border rounded w-1/3 mb-1" />
                  <div className="h-2 bg-border rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : stats ? (
            <div className="grid md:grid-cols-3 gap-4 mb-2">
              <div className="bg-surface-raised rounded-lg p-4 border-l-4 border-primary">
                <div className="text-sm text-text-muted mb-1">Open Requests</div>
                <div className="text-3xl font-bold text-primary">{stats.requests?.open_requests || 0}</div>
                <div className="text-xs text-text-subtle mt-1">{stats.requests?.matched_requests || 0} matched</div>
              </div>
              <div className="bg-surface-raised rounded-lg p-4 border-l-4 border-success">
                <div className="text-sm text-text-muted mb-1">Fulfilled Rate</div>
                <div className="text-3xl font-bold text-success">
                  {stats.matches?.completed_matches && stats.requests?.total_requests
                    ? `${Math.round((stats.matches.completed_matches / stats.requests.total_requests) * 100)}%`
                    : stats.matches?.completed_matches ? `${stats.matches.completed_matches}` : '—'}
                </div>
                <div className="text-xs text-text-subtle mt-1">{stats.matches?.completed_matches || 0} completed</div>
              </div>
              <div className="bg-surface-raised rounded-lg p-4 border-l-4 border-accent">
                <div className="text-sm text-text-muted mb-1">Avg Response Time</div>
                <div className="text-3xl font-bold text-accent">
                  {stats.matches?.avg_response_time_hours ? `${Math.round(stats.matches.avg_response_time_hours)}h` : '—'}
                </div>
                <div className="text-xs text-text-subtle mt-1">{stats.matches?.matches_completed_this_week || 0} this week</div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Member-facing community feed — the canonical unified feed + community texture (everyone).
          Sprint 86 / ADR-066: replaces BrowseTab's bespoke request cards. */}
      <div>
        <h3 className="text-xl font-semibold mb-4">Community Requests</h3>
        <UnifiedFeed
          view="community"
          communityId={communityId}
          communityType={community?.community_type === 'group' ? 'group' : 'mutual_aid'}
        />
      </div>

      {/* Admin management list: all-status requests with triage/boost/propose controls. Kept here
          (not in the canonical feed) because the unified feed only serves open, fillable requests —
          admins still need to see/manage pending/matched/completed. */}
      {isAdminOrMod && (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Manage requests</h3>
          <div className="flex gap-2">
            {(['open', 'pending', 'matched', 'completed'] as const).map(s => (
              <button
                key={s}
                onClick={() => { setRequestStatusFilter(s); refetchCommunityRequests(s) }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                  requestStatusFilter === s
                    ? 'bg-primary text-white border-primary'
                    : 'bg-surface text-text-muted border-border hover:border-primary'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {loadingRequests ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="p-4 bg-surface rounded-lg border border-border animate-pulse">
                <div className="h-4 bg-border rounded w-2/3 mb-2" />
                <div className="h-3 bg-border rounded w-1/2 mb-1" />
                <div className="h-2 bg-border rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : communityRequests.length === 0 ? (
          <div className="text-center py-8 text-text-muted text-sm">No {requestStatusFilter} requests found.</div>
        ) : (
          <div className="space-y-3">
            {communityRequests.map((req: any) => (
              <div key={req.id} className="flex items-start justify-between gap-4 p-4 bg-surface rounded-lg border border-border hover:border-primary-medium transition">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link href={`/requests/${req.id}`} className="font-medium text-text hover:text-primary truncate">
                      {req.title}
                    </Link>
                    <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full ${
                      req.urgency === 'urgent' ? 'bg-red-100 text-red-700' :
                      req.urgency === 'high' ? 'bg-orange-100 text-orange-700' :
                      req.urgency === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-surface-raised text-text-muted'
                    }`}>{req.urgency}</span>
                    {isBoostActive(req) && (
                      <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                        ⚡ Boosted
                      </span>
                    )}
                  </div>
                  {req.description && <p className="text-sm text-text-muted line-clamp-1">{req.description}</p>}
                  <p className="text-xs text-text-subtle mt-1">by {req.requester_name}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <span className={`text-xs px-2 py-1 rounded font-medium ${
                    req.status === 'open' ? 'bg-green-100 text-green-700' :
                    req.status === 'matched' ? 'bg-blue-100 text-blue-700' :
                    req.status === 'completed' ? 'bg-surface-raised text-text-muted' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>{req.status}</span>
                  <p className="text-xs text-text-subtle mt-1">{new Date(req.created_at).toLocaleDateString()}</p>
                  {isAdminOrMod && (
                    <div className="relative mt-2">
                      <div className="flex items-center justify-end gap-1">
                        {req.admin_note && (
                          <span title={req.admin_note} className="text-xs text-primary" aria-label="Has admin note">📋</span>
                        )}
                        <button
                          onClick={() => { setSelectedRequest(req); setTriageUrgency(req.urgency ?? ''); setTriageNote(req.admin_note ?? ''); setShowTriageModal(true) }}
                          className="text-xs px-2 py-1 border border-primary-medium text-primary rounded hover:bg-primary-light transition"
                        >
                          Triage
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setActionDropdownOpen(actionDropdownOpen === req.id ? null : req.id) }}
                          className="text-xs px-2 py-1 border border-border text-text-muted rounded hover:bg-surface-raised transition"
                        >
                          Actions ▾
                        </button>
                      </div>
                      {actionDropdownOpen === req.id && (
                        <div className="absolute right-0 mt-1 w-48 bg-surface-raised border border-border rounded-lg shadow-lg z-10">
                          <button
                            onClick={async () => {
                              setBoostingRequest(req.id)
                              try {
                                if (isBoostActive(req)) {
                                  await requestService.removeBoost(req.id, { community_id: communityId })
                                } else {
                                  await requestService.boostRequest(req.id, { community_id: communityId })
                                }
                                await refetchCommunityRequests()
                              } catch (err: any) {
                                alert(err?.response?.data?.message ?? err?.message ?? 'Failed to update boost')
                              } finally {
                                setBoostingRequest(null); setActionDropdownOpen(null)
                              }
                            }}
                            disabled={boostingRequest === req.id}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-surface transition disabled:opacity-50"
                          >
                            {isBoostActive(req) ? 'Remove Boost' : '⚡ Boost (48h)'}
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await requestService.markUrgent(req.id, { community_id: communityId, urgent: true })
                                await refetchCommunityRequests()
                              } catch (err: any) {
                                alert(err?.response?.data?.message ?? err?.message ?? 'Failed to mark urgent')
                              } finally { setActionDropdownOpen(null) }
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-surface transition"
                          >
                            Mark Urgent
                          </button>
                          {req.status === 'open' && (
                            <button
                              onClick={() => { setMemberPickerRequest(req); setShowMemberPicker(true); setActionDropdownOpen(null) }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-surface transition"
                            >
                              Propose a Match
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Insights panels */}
      {isAdminOrMod && (
        <div className="space-y-4">
          {loadingTrust && !communityTrust && (
            <div className="bg-surface-raised rounded-lg p-5 animate-pulse">
              <div className="h-4 bg-border rounded w-1/3 mb-3" />
              <div className="h-3 bg-border rounded-full w-full mb-4" />
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="text-center">
                    <div className="h-6 bg-border rounded w-1/2 mx-auto mb-1" />
                    <div className="h-3 bg-border rounded w-2/3 mx-auto" />
                  </div>
                ))}
              </div>
            </div>
          )}
          {communityTrust && (() => {
            const score: number = communityTrust.score ?? 0
            const barColor = score >= 80 ? '#16a34a' : score >= 60 ? '#0d9488' : score >= 40 ? '#d97706' : '#92400e'
            const prev: number | undefined = communityTrust.previous_score
            const delta = prev !== undefined ? score - prev : 0
            const trendStr = delta > 0 ? `+${delta} since last week` : delta < 0 ? `${delta} since last week` : ''
            const lastUpdated = communityTrust.last_calculated
              ? new Date(communityTrust.last_calculated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : 'Unknown'
            return (
              <div className="bg-surface-raised rounded-lg shadow p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-base font-semibold">Community Trust Score</h4>
                  <span className="text-2xl font-bold" style={{ color: barColor }}>{score} / 100</span>
                </div>
                <div className="w-full bg-border-light rounded-full h-3 mb-4">
                  <div className="h-3 rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: barColor }} />
                </div>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-lg font-bold">{communityTrust.member_quality_score ?? 0} / 40</div>
                    <div className="text-xs font-medium text-text-muted">Member Quality</div>
                    <div className="text-xs text-text-subtle mt-1">Avg trust of active members</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">{communityTrust.bonding_score ?? 0} / 30</div>
                    <div className="text-xs font-medium text-text-muted">Bonding</div>
                    <div className="text-xs text-text-subtle mt-1">Completion &amp; retention rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">{communityTrust.bridging_score ?? 0} / 30</div>
                    <div className="text-xs font-medium text-text-muted">Bridging</div>
                    <div className="text-xs text-text-subtle mt-1">Cross-group connections</div>
                  </div>
                </div>
                <div className="text-xs text-text-subtle flex items-center gap-3">
                  <span>{communityTrust.active_member_count ?? 0} active members</span>
                  <span>·</span>
                  <span>Last updated: {lastUpdated}</span>
                  {trendStr && (
                    <>
                      <span>·</span>
                      <span style={{ color: delta > 0 ? '#16a34a' : '#d97706' }}>{trendStr}</span>
                    </>
                  )}
                </div>
              </div>
            )
          })()}

          {networkMetrics && (() => {
            const cohesionScore: number = networkMetrics.score ?? 0
            const cohesionColor = cohesionScore >= 80 ? '#16a34a' : cohesionScore >= 60 ? '#0d9488' : cohesionScore >= 40 ? '#d97706' : '#92400e'
            const computedStr = networkMetrics.computedAt
              ? new Date(networkMetrics.computedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : 'recently'
            return (
              <div className="bg-surface-raised rounded-lg shadow p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-base font-semibold">Network Cohesion</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold" style={{ color: cohesionColor }}>{cohesionScore} / 100</span>
                    {networkMetrics.label && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: cohesionColor, color: '#fff' }}>{networkMetrics.label}</span>
                    )}
                  </div>
                </div>
                <div className="w-full bg-border-light rounded-full h-3 mb-4">
                  <div className="h-3 rounded-full transition-all" style={{ width: `${cohesionScore}%`, backgroundColor: cohesionColor }} />
                </div>
                <div className="space-y-2 mb-4">
                  <div className="flex items-baseline gap-3">
                    <span className="text-sm font-semibold w-28">Reciprocity</span>
                    <span className="text-sm font-bold">{networkMetrics.reciprocity !== undefined ? `${Math.round(networkMetrics.reciprocity * 100)}%` : '—'}</span>
                    <span className="text-xs text-text-subtle">Most help flows both ways</span>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-sm font-semibold w-28">Density</span>
                    <span className="text-sm font-bold">{networkMetrics.density !== undefined ? `${Math.round(networkMetrics.density * 100)}%` : '—'}</span>
                    <span className="text-xs text-text-subtle">1 in {networkMetrics.density ? Math.round(1 / networkMetrics.density) : '?'} possible pairs have helped</span>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-sm font-semibold w-28">Clustering</span>
                    <span className="text-sm font-bold">{networkMetrics.clustering !== undefined ? networkMetrics.clustering.toFixed(2) : '—'}</span>
                    <span className="text-xs text-text-subtle">Your helpers know each other</span>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-sm font-semibold w-28">Avg path</span>
                    <span className="text-sm font-bold">{networkMetrics.avgPathLength !== undefined ? `${networkMetrics.avgPathLength.toFixed(1)}` : '—'}</span>
                    <span className="text-xs text-text-subtle">Everyone reachable in ~{networkMetrics.avgPathLength ? Math.round(networkMetrics.avgPathLength) : '?'} hops</span>
                  </div>
                </div>
                <div className="text-xs text-text-subtle flex items-center gap-3">
                  <span>{networkMetrics.uniqueEdges ?? 0} unique helping pairs</span>
                  <span>·</span>
                  <span>computed {computedStr}</span>
                </div>
              </div>
            )
          })()}

          {isAdmin && (
            <div className="bg-surface-raised rounded-lg p-5">
              <h4 className="text-base font-semibold mb-3">Export Data</h4>
              <div className="flex flex-wrap gap-3">
                {(['full', 'members', 'activity'] as const).map((type) => {
                  const label = type === 'full' ? 'Full Export' : type.charAt(0).toUpperCase() + type.slice(1)
                  return (
                    <div key={type} className="flex gap-2">
                      <button onClick={() => handleExport(type, 'json')} disabled={exporting} className="px-3 py-1.5 text-sm bg-primary text-white rounded hover:bg-primary-dark disabled:bg-primary-medium">
                        {label} JSON
                      </button>
                      <button onClick={() => handleExport(type, 'csv')} disabled={exporting} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-green-400">
                        {label} CSV
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Triage Modal */}
      {showTriageModal && selectedRequest && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => { if (e.target === e.currentTarget) handleCloseTriageModal() }}
        >
          <div className="bg-surface-raised rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">Triage Request</h3>
            <p className="text-sm text-text-muted mb-4 truncate">{selectedRequest.title}</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-text-muted mb-1">Urgency</label>
              <select
                value={triageUrgency}
                onChange={(e) => setTriageUrgency(e.target.value)}
                className="w-full border border-border rounded px-3 py-2 text-sm"
              >
                <option value="">— no override —</option>
                <option value="urgent">urgent</option>
                <option value="high">high</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-text-muted mb-1">Admin note</label>
              <textarea
                value={triageNote}
                onChange={(e) => setTriageNote(e.target.value)}
                rows={3}
                className="w-full border border-border rounded px-3 py-2 text-sm"
                placeholder="Internal note (not visible to members)"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={handleCloseTriageModal} className="px-4 py-2 text-sm text-text-muted hover:text-text">Cancel</button>
              <button
                onClick={async () => {
                  if (!triageUrgency && !triageNote) return
                  setSavingTriage(true)
                  try {
                    await requestService.adminTriageRequest(selectedRequest.id, {
                      community_id: communityId,
                      ...(triageUrgency && { urgency: triageUrgency as 'urgent' | 'high' | 'medium' | 'low' }),
                      ...(triageNote && { note: triageNote }),
                    })
                    await refetchCommunityRequests()
                    handleCloseTriageModal()
                  } catch (err: any) {
                    alert(err?.message ?? 'Failed to save')
                  } finally {
                    setSavingTriage(false)
                  }
                }}
                disabled={savingTriage || (!triageUrgency && !triageNote)}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                {savingTriage ? 'Saving…' : 'Save'}
              </button>
            </div>
            {selectedRequest?.status === 'open' && (
              <div className="mt-6 pt-4 border-t border-border">
                <h4 className="text-sm font-medium text-text-muted mb-2">Propose a connector</h4>
                <p className="text-xs text-text-subtle mb-3">Select an active community member to connect with the requester.</p>
                <select
                  value={selectedResponderId}
                  onChange={(e) => setSelectedResponderId(e.target.value)}
                  className="w-full border border-border rounded px-3 py-2 text-sm mb-3"
                >
                  <option value="">— select a connector —</option>
                  {(community?.members ?? [])
                    .filter((m: Member) => m.status === 'active' && m.user_id !== selectedRequest?.requester_id)
                    .map((m: Member) => <option key={m.user_id} value={m.user_id}>{m.user_name ?? m.user_id}</option>)}
                </select>
                <button
                  onClick={async () => {
                    if (!selectedResponderId) return
                    setProposingMatch(true)
                    try {
                      await requestService.proposeMatch(selectedRequest.id, { user_id: selectedResponderId, community_id: communityId })
                      await refetchCommunityRequests()
                      handleCloseTriageModal()
                    } catch (err: any) {
                      alert(err?.response?.data?.message ?? err?.message ?? 'Failed to propose match')
                    } finally { setProposingMatch(false) }
                  }}
                  disabled={proposingMatch || !selectedResponderId}
                  className="w-full px-4 py-2 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                >
                  {proposingMatch ? 'Proposing…' : 'Propose match'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MemberPicker Modal */}
      {showMemberPicker && memberPickerRequest && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => { if (e.target === e.currentTarget) closeMemberPicker() }}
        >
          <div className="bg-surface-raised rounded-lg p-6 w-full max-w-md" role="dialog" aria-modal="true">
            <h3 className="text-lg font-medium mb-2">Propose a Match</h3>
            <p className="text-sm text-text-muted mb-4 truncate">For: {memberPickerRequest.title}</p>
            {!memberPickerConfirm ? (
              <>
                <input
                  type="text"
                  value={memberPickerSearch}
                  onChange={(e) => setMemberPickerSearch(e.target.value)}
                  placeholder="Search members..."
                  className="w-full border border-border rounded px-3 py-2 text-sm mb-3 focus:ring-2 focus:ring-primary focus:border-transparent"
                  autoFocus
                />
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {(community?.members ?? [])
                    .filter((m: Member) => m.status === 'active' && m.user_id !== memberPickerRequest?.requester_id)
                    .filter((m: Member) => !memberPickerSearch || m.user_name.toLowerCase().includes(memberPickerSearch.toLowerCase()) || m.user_email.toLowerCase().includes(memberPickerSearch.toLowerCase()))
                    .map((m: Member) => (
                      <button
                        key={m.user_id}
                        onClick={() => { setMemberPickerSelected(m); setMemberPickerConfirm(true) }}
                        className="w-full text-left px-3 py-2 rounded text-sm hover:bg-surface transition flex items-center justify-between"
                      >
                        <span className="font-medium text-text">{m.user_name}</span>
                        <span className="text-xs text-text-subtle">{m.role}</span>
                      </button>
                    ))}
                </div>
              </>
            ) : memberPickerSelected ? (
              <div className="text-center py-4">
                <p className="text-sm text-text-muted mb-4">
                  Propose <strong>{memberPickerSelected.user_name}</strong> as a match for this request?
                </p>
                <div className="flex gap-2 justify-center">
                  <button onClick={() => { setMemberPickerConfirm(false); setMemberPickerSelected(null) }} className="px-4 py-2 text-sm text-text-muted hover:text-text">Back</button>
                  <button
                    onClick={async () => {
                      try {
                        await requestService.proposeMatch(memberPickerRequest.id, { user_id: memberPickerSelected!.user_id, community_id: communityId })
                        await refetchCommunityRequests()
                        closeMemberPicker()
                      } catch (err: any) {
                        alert(err?.response?.data?.message ?? err?.message ?? 'Failed to propose match')
                      }
                    }}
                    className="px-4 py-2 text-sm bg-primary text-white rounded hover:bg-primary-dark"
                  >
                    Confirm Match
                  </button>
                </div>
              </div>
            ) : null}
            <div className="flex justify-end mt-4 pt-3 border-t border-border">
              <button onClick={closeMemberPicker} className="text-sm text-text-muted hover:text-text">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
