import React, { useEffect, useState } from 'react'
import { communityService, reputationService } from '@/lib/api'
import dynamic from 'next/dynamic'
import CommunityLinks from '@/components/community/CommunityLinks'
import CollectiveCardRich from '@/components/providers/CollectiveCardRich'
import CollectiveDiscoveryPanel from '@/components/providers/CollectiveDiscoveryPanel'
import CommunityTrustQuestionnaire from '@/components/CommunityTrustQuestionnaire'
import TrustModelDiff from '@/components/TrustModelDiff'
import { REQUEST_TYPES } from '@/components/requests/RequestTypeSelector'
import type { Community, CommunitySettings } from '@/hooks/useCommunityData'
import type { CommunityConfig } from '@/types/community-config'

const CommunityConfigEditor = dynamic(() => import('@/components/CommunityConfigEditor'), {
  loading: () => <div className="card p-6 text-center text-text-muted animate-pulse">Loading editor...</div>,
  ssr: false,
})

interface Props {
  section: 'overview' | 'settings' | 'providers'
  community: Community
  config: CommunityConfig | null
  settings: CommunitySettings | null
  stats: any
  communityCollectives: any[]
  currentUser: any
  isAdmin: boolean
  communityId: string
  refetchCommunityCollectives: () => Promise<void>
}

function TrustEvolutionSection({ communityId }: { communityId: string }) {
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [evolutionSummary, setEvolutionSummary] = useState<any>(null)

  useEffect(() => {
    reputationService.getCommunityEvolutionStatus(communityId)
      .then((res: any) => setStatus(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
    reputationService.getCommunityEvolutionSummary(communityId)
      .then((res: any) => setEvolutionSummary(res))
      .catch(() => {})
  }, [communityId])

  const handleToggle = async () => {
    const newValue = !status?.community_evolution_enabled
    setStatus((prev: any) => ({ ...prev, community_evolution_enabled: newValue }))
    try {
      await reputationService.updateCommunityEvolution(communityId, { community_evolution_enabled: newValue })
    } catch {
      setStatus((prev: any) => ({ ...prev, community_evolution_enabled: !newValue }))
    }
  }

  if (loading) return <div className="text-sm text-gray-400">Loading evolution settings…</div>

  const { community_evolution_enabled, cross_community_prior, opted_in_rate } = status ?? {}

  return (
    <div className="border border-gray-200 rounded-lg p-4 mt-4">
      <h3 className="font-semibold mb-2">Trust Model Evolution</h3>
      <p className="text-sm text-gray-500 mb-3">
        When enabled, members who opt in have their trust parameters calibrate automatically based on experience.
      </p>
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm">Community Trust Evolution</span>
        <button
          onClick={handleToggle}
          className={`px-3 py-1 rounded text-sm font-medium ${
            community_evolution_enabled ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
          }`}
        >
          {community_evolution_enabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>
      {opted_in_rate && (
        <div className="text-xs text-gray-500">
          {opted_in_rate.opted_in} of {opted_in_rate.total} members have enabled personal evolution
        </div>
      )}
      {cross_community_prior !== undefined && (
        <div className="text-xs text-gray-500 mt-1">
          Community cross-community trust calibration: {(cross_community_prior * 100).toFixed(0)}
        </div>
      )}
      {evolutionSummary?.first_evolution_at && (
        <div className="mt-3 border-t pt-3 space-y-1">
          <p className="text-xs text-gray-600">
            {evolutionSummary.evolved_parameter_count} parameter{evolutionSummary.evolved_parameter_count !== 1 ? 's' : ''} evolved
            since {new Date(evolutionSummary.first_evolution_at).toLocaleDateString()}
          </p>
          <p className="text-xs text-gray-400">
            Last cycle: {evolutionSummary.last_contributing_member_count} contributing members
          </p>
        </div>
      )}
      {!community_evolution_enabled && (
        <p className="text-xs text-amber-600 mt-2">Community evolution is paused. Existing config is unchanged.</p>
      )}
    </div>
  )
}

export default function ProfileTab({
  section, community, config, settings, stats, communityCollectives,
  currentUser, isAdmin, communityId,
  refetchCommunityCollectives,
}: Props) {
  const [editedConfig, setEditedConfig] = useState<CommunityConfig | null>(null)
  const [configErrors, setConfigErrors] = useState<Record<string, string>>({})
  const [configSaving, setConfigSaving] = useState(false)
  const [editedSettings, setEditedSettings] = useState<CommunitySettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [showQuestionnaire, setShowQuestionnaire] = useState(false)
  const [showDiff, setShowDiff] = useState(false)
  const [proposedConfig, setProposedConfig] = useState<Partial<CommunityConfig> | null>(null)
  const [providerConfig, setProviderConfig] = useState({
    provider_services_enabled: false,
    provider_min_personal_trust_score: 0,
    provider_services_list: [] as string[],
  })
  const [savingProviderConfig, setSavingProviderConfig] = useState(false)

  // Sync form state when server data arrives
  useEffect(() => { if (config) { setEditedConfig(config) } }, [config])
  useEffect(() => { if (settings) { setEditedSettings(settings) } }, [settings])

  const validateConfig = (cfg: CommunityConfig): Record<string, string> => {
    const errors: Record<string, string> = {}
    const weightSum = cfg.trust_depth_weight + cfg.trust_breadth_weight
    if (Math.abs(weightSum - 1.0) > 0.01) errors.trust_weights = `Weights sum to ${weightSum.toFixed(2)}, must equal 1.0`
    const names = cfg.enabled_request_types.map(t => t.name)
    if (new Set(names).size !== names.length) errors.request_types = 'Request type names must be unique'
    return errors
  }

  const handleSaveConfig = async () => {
    if (!currentUser || !editedConfig) return
    const errors = validateConfig(editedConfig)
    if (Object.keys(errors).length > 0) { setConfigErrors(errors); alert('Please fix validation errors before saving'); return }
    setConfigSaving(true)
    try {
      await communityService.updateConfig(communityId, editedConfig)
      setConfigErrors({})
      alert('Configuration saved successfully!')
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save configuration')
    } finally {
      setConfigSaving(false)
    }
  }

  const handleSaveSettings = async () => {
    if (!currentUser || !editedSettings) return
    setSaving(true)
    try {
      await communityService.updateSettings(communityId, { ...editedSettings, user_id: currentUser.id })
      alert('Settings saved successfully!')
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  // ---- Overview Section ----
  if (section === 'overview') {
    return (
      <div>
        <h3 className="text-xl font-semibold mb-4">About this Community</h3>
        <p className="text-text-muted mb-6">{community.description || 'No description provided.'}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-primary-light rounded-lg p-4">
            <div className="text-3xl font-bold text-primary">{community.current_members}</div>
            <div className="text-sm text-text-muted">Members</div>
          </div>
          <div className="bg-accent-light rounded-lg p-4">
            <div className="text-3xl font-bold text-accent">{stats?.requests?.open_requests ?? '—'}</div>
            <div className="text-sm text-text-muted">Active Requests</div>
          </div>
          <div className="bg-success-light rounded-lg p-4">
            <div className="text-3xl font-bold text-success">{stats?.matches?.completed_matches ?? '—'}</div>
            <div className="text-sm text-text-muted">Total Exchanges</div>
          </div>
          <div className="bg-surface-raised rounded-lg p-4 border border-border">
            <div className="text-3xl font-bold">{stats?.matches?.matches_completed_this_week ?? '—'}</div>
            <div className="text-sm text-text-muted">This Week</div>
          </div>
        </div>

        {stats && (() => {
          const completionsWeek = stats.matches?.matches_completed_this_week || 0
          const openRequests = stats.requests?.open_requests || 0
          const totalCompletions = stats.matches?.completed_matches || 0
          let label: string, color: string, bg: string, description: string
          if (completionsWeek >= 3 || openRequests >= 5) {
            label = 'Thriving'; color = 'text-success'; bg = 'bg-success-light border-success/30'
            description = 'This community is highly active with regular exchanges.'
          } else if (completionsWeek >= 1 || openRequests >= 2) {
            label = 'Active'; color = 'text-primary'; bg = 'bg-primary-light border-primary/20'
            description = 'Members are helping each other regularly.'
          } else if (totalCompletions >= 1) {
            label = 'Growing'; color = 'text-accent'; bg = 'bg-accent-light border-accent/20'
            description = 'This community has completed exchanges and is building momentum.'
          } else {
            label = 'Getting Started'; color = 'text-text-muted'; bg = 'bg-surface-raised border-border'
            description = 'New community — be one of the first to post a request.'
          }
          return (
            <div className={`rounded-lg border p-3 mb-6 flex items-center gap-3 ${bg}`}>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border border-current whitespace-nowrap ${color}`}>{label}</span>
              <p className="text-sm text-text-muted">{description}</p>
            </div>
          )
        })()}

        {config && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">How This Community Works</h3>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200 rounded-lg p-5">
                <h4 className="font-semibold text-text mb-3 flex items-center gap-2">
                  <span className="text-xl">💎</span> Karma Mechanics
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Karma Split:</span>
                    <span className="font-medium text-text">{config.karma_split_helper}% helper / {config.karma_split_requestor}% requestor</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Base Pool:</span>
                    <span className="font-medium text-text">{config.base_karma_pool_per_request} karma</span>
                  </div>
                  {config.karma_decay_half_life_days > 0 && (
                    <div className="flex justify-between">
                      <span className="text-text-muted">Karma Decay:</span>
                      <span className="font-medium text-text">{config.karma_decay_half_life_days} day half-life</span>
                    </div>
                  )}
                  {config.karma_decay_half_life_days === 0 && (
                    <div className="text-xs text-text-muted mt-1">✓ Karma is bankable (no decay)</div>
                  )}
                </div>
              </div>
              <div className="bg-gradient-to-br from-primary-light to-accent-light border border-primary-medium rounded-lg p-5">
                <h4 className="font-semibold text-text mb-3 flex items-center gap-2">
                  <span className="text-xl">🤝</span> Trust Mechanics
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Trust Model:</span>
                    <span className="font-medium text-text">
                      {config.trust_depth_weight > 0.6 ? 'Depth-focused' : config.trust_breadth_weight > 0.6 ? 'Breadth-focused' : 'Balanced'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-text-muted">
                    <span>{Math.round(config.trust_depth_weight * 100)}% depth</span>
                    <span>{Math.round(config.trust_breadth_weight * 100)}% breadth</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Trust Decay:</span>
                    <span className="font-medium text-text">{config.trust_decay_half_life_days} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Max Hops:</span>
                    <span className="font-medium text-text">{config.trust_path_max_hops} connections</span>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-accent-light to-karmyq-brown-50 border border-accent rounded-lg p-5">
                <h4 className="font-semibold text-text mb-3 flex items-center gap-2">
                  <span className="text-xl">📋</span> Request Types
                </h4>
                {(() => {
                  const validNames = new Set<string>(REQUEST_TYPES.map((t) => t.value as string))
                  const filtered = config.enabled_request_types.filter((rt) => validNames.has(rt.name as string))
                  const normalizedEnabled = filtered.length > 0 ? filtered : REQUEST_TYPES.map((t) => ({ name: t.value as string, karma_multiplier: 1.0 }))
                  return (
                    <div className="grid grid-cols-2 gap-2">
                      {REQUEST_TYPES.map((type) => {
                        const match = normalizedEnabled.find((rt) => rt.name === (type.value as string))
                        const enabled = !!match
                        return (
                          <div key={type.value} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${enabled ? 'border-primary bg-primary-light text-text' : 'border-border bg-surface text-text-subtle opacity-50'}`}>
                            <span>{type.icon}</span>
                            <span className="font-medium">{type.label}</span>
                            {enabled && match!.karma_multiplier !== 1.0 && <span className="ml-auto text-xs text-primary font-semibold">×{match!.karma_multiplier}</span>}
                            {!enabled && <span className="ml-auto text-xs text-text-subtle">off</span>}
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
              <div className="bg-gradient-to-br from-karmyq-green-50 to-karmyq-green-100 border border-success rounded-lg p-5">
                <h4 className="font-semibold text-text mb-3 flex items-center gap-2">
                  <span className="text-xl">📜</span> Community Rules
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Size Limit:</span>
                    <span className="font-medium text-text">{community.current_members} / {config.member_cap} members</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Visibility:</span>
                    <span className="font-medium text-text">
                      {config.visibility_mode === 'public' ? '👁️ Public' : config.visibility_mode === 'members_only' ? '🔒 Members Only' : '🔓 Hybrid'}
                    </span>
                  </div>
                  {config.join_approval_required && <div className="text-xs text-text-muted">✓ Join approval required</div>}
                  {config.request_approval_required && <div className="text-xs text-text-muted">✓ Request approval required</div>}
                  {config.new_member_karma_lockout_days > 0 && (
                    <div className="text-xs text-text-muted">⚠️ {config.new_member_karma_lockout_days} day karma lockout for new members</div>
                  )}
                </div>
              </div>
            </div>
            {config.template_source && (
              <div className="mt-4 bg-primary-light border border-primary-medium rounded-lg p-4">
                <p className="text-sm text-primary-dark"><strong>Based on Template:</strong> {config.template_source}</p>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ---- Providers Section ----
  if (section === 'providers') {
    return (
      <div className="space-y-6">
        <h3 className="text-xl font-semibold mb-2">Service Provider Settings</h3>
        <div className="bg-surface rounded-lg p-5 space-y-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text">Enable provider services</p>
              <p className="text-xs text-text-muted mt-0.5">Allow members to discover neighborhood service providers in this community.</p>
            </div>
            <button
              type="button"
              onClick={() => setProviderConfig(c => ({ ...c, provider_services_enabled: !c.provider_services_enabled }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${providerConfig.provider_services_enabled ? 'bg-primary' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${providerConfig.provider_services_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          {providerConfig.provider_services_enabled && (
            <div>
              <label className="block text-sm font-medium text-text mb-1">
                Minimum personal trust score to appear ({providerConfig.provider_min_personal_trust_score})
              </label>
              <input
                type="range" min={0} max={100}
                value={providerConfig.provider_min_personal_trust_score}
                onChange={e => setProviderConfig(c => ({ ...c, provider_min_personal_trust_score: parseInt(e.target.value, 10) }))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-text-subtle mt-1">
                <span>0 (all providers)</span>
                <span>100 (highly trusted only)</span>
              </div>
            </div>
          )}
          {isAdmin && (
            <button
              disabled={savingProviderConfig}
              onClick={async () => {
                setSavingProviderConfig(true)
                try {
                  await communityService.updateConfig(communityId, providerConfig)
                  alert('Provider settings saved')
                } catch (err: any) {
                  alert(err?.message ?? 'Failed to save')
                } finally { setSavingProviderConfig(false) }
              }}
              className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary-dark transition disabled:opacity-50"
            >
              {savingProviderConfig ? 'Saving...' : 'Save provider settings'}
            </button>
          )}
        </div>
        <div>
          <h4 className="text-base font-semibold text-text mb-3">Collectives serving this community</h4>
          {communityCollectives.length === 0 ? (
            <p className="text-sm text-text-muted">No collectives linked yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {communityCollectives.map((c: any) => <CollectiveCardRich key={c.id} collective={c} />)}
            </div>
          )}
          {isAdmin && (
            <div className="mt-4">
              <CollectiveDiscoveryPanel communityId={communityId} onLinked={refetchCommunityCollectives} />
            </div>
          )}
        </div>
      </div>
    )
  }

  // ---- Settings Section ----
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-text mb-4">Community Settings</h2>
        {config && (
          <div className="bg-surface border border-border rounded-lg p-4 mb-4 grid grid-cols-2 gap-4 text-sm">
            <div><span className="font-medium text-text-muted">Karma split (helper):</span>{' '}<span className="text-text">{config.karma_split_helper ?? 'default'}%</span></div>
            <div><span className="font-medium text-text-muted">Trust path max hops:</span>{' '}<span className="text-text">{config.trust_path_max_hops ?? 'default'}</span></div>
            <div><span className="font-medium text-text-muted">Visibility:</span>{' '}<span className="text-text">{config.visibility_mode ?? 'default'}</span></div>
            <div><span className="font-medium text-text-muted">Join approval:</span>{' '}<span className="text-text">{config.join_approval_required ? 'Required' : 'Open'}</span></div>
          </div>
        )}
        {config && (
          <div>
            <p className="text-text-muted mb-6">
              {community.creator_id === currentUser?.id
                ? 'Configure trust, karma, and coordination mechanics for your community.'
                : 'View the configuration that defines how trust, karma, and coordination work in this community.'}
            </p>
            {community.creator_id === currentUser?.id && !showQuestionnaire && !showDiff && (
              <div className="mb-6 flex items-center justify-between rounded-lg border border-border bg-surface p-4">
                <div>
                  <p className="font-medium text-text text-sm">Revisit your trust model</p>
                  <p className="text-xs text-text-muted mt-0.5">Answer 6 questions and see what the system would propose based on how your community has evolved.</p>
                </div>
                <button
                  onClick={() => { setShowQuestionnaire(true); setShowDiff(false); setProposedConfig(null) }}
                  className="ml-4 flex-shrink-0 px-4 py-2 text-sm bg-primary text-white rounded hover:bg-primary-dark font-medium"
                >
                  Revisit
                </button>
              </div>
            )}
            {community.creator_id === currentUser?.id && showQuestionnaire && (
              <div className="mb-6 rounded-lg border border-border bg-surface p-6">
                <CommunityTrustQuestionnaire
                  mode="revisit"
                  onComplete={(inferred) => { setProposedConfig(inferred); setShowQuestionnaire(false); setShowDiff(true) }}
                  onBack={() => setShowQuestionnaire(false)}
                />
              </div>
            )}
            {community.creator_id === currentUser?.id && showDiff && proposedConfig && editedConfig && (
              <div className="mb-6">
                <TrustModelDiff
                  current={editedConfig}
                  proposed={proposedConfig}
                  onApplyAll={() => { setEditedConfig(prev => prev ? { ...prev, ...proposedConfig } : prev); setShowDiff(false); setProposedConfig(null) }}
                  onApplySelective={(fields) => {
                    setEditedConfig(prev => {
                      if (!prev || !proposedConfig) return prev
                      const patch: Partial<CommunityConfig> = {}
                      fields.forEach(f => { (patch as any)[f] = (proposedConfig as any)[f] })
                      return { ...prev, ...patch }
                    })
                    setShowDiff(false); setProposedConfig(null)
                  }}
                  onDiscard={() => { setShowDiff(false); setProposedConfig(null) }}
                />
              </div>
            )}
            {community.creator_id === currentUser?.id && editedConfig ? (
              <>
                <CommunityConfigEditor
                  config={editedConfig}
                  onChange={(newConfig: CommunityConfig) => { setEditedConfig(newConfig); setConfigErrors({}) }}
                  errors={configErrors}
                />
                <div className="mt-8 space-y-4">
                  <h3 className="text-base font-semibold text-text">Feed Signal Weights</h3>
                  <p className="text-sm text-text-muted">These weights shape which requests appear first in members&apos; feeds. Values are normalized automatically.</p>
                  {([
                    { field: 'feed_weight_skill_match', label: 'Skill Match' },
                    { field: 'feed_weight_trust_distance', label: 'Trust Distance' },
                    { field: 'feed_weight_community_relevance', label: 'Community Relevance' },
                    { field: 'feed_weight_urgency', label: 'Urgency' },
                    { field: 'feed_weight_requester_trust', label: 'Requester Trust' },
                    { field: 'feed_weight_prior_interaction', label: 'Prior Interaction' },
                    { field: 'feed_weight_recency', label: 'Recency' },
                  ] as Array<{ field: keyof CommunityConfig; label: string }>).map(({ field, label }) => (
                    <div key={field}>
                      <label className="text-sm font-medium text-text">{label}</label>
                      <div className="flex items-center gap-3 mt-1">
                        <input
                          type="range" min="0" max="1" step="0.05"
                          value={(editedConfig as any)[field] ?? 0}
                          onChange={e => setEditedConfig(prev => prev ? { ...prev, [field]: parseFloat(e.target.value) } : prev)}
                          className="flex-1"
                        />
                        <span className="text-sm text-text-muted w-10 text-right">{((editedConfig as any)[field] ?? 0).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
                  <button onClick={() => { setEditedConfig(config); setConfigErrors({}) }} className="px-6 py-2 bg-gray-200 text-text-muted rounded hover:bg-gray-300">Reset</button>
                  <button onClick={handleSaveConfig} disabled={configSaving} className="px-6 py-2 bg-primary text-white rounded hover:bg-primary-dark disabled:bg-primary-medium">
                    {configSaving ? 'Saving...' : 'Save Configuration'}
                  </button>
                </div>
              </>
            ) : (
              <CommunityConfigEditor config={config} onChange={() => {}} readOnly={true} errors={{}} />
            )}
            {config.template_source && (
              <div className="mt-6 bg-primary-light border border-primary-medium rounded-lg p-4">
                <p className="text-sm text-primary-dark"><strong>Template:</strong> This community was created using the &quot;{config.template_source}&quot; template.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <hr className="border-border" />

      <div>
        <h2 className="text-xl font-semibold text-text mb-4">Linked Communities</h2>
        <CommunityLinks communityId={community.id} isAdmin={isAdmin} />
      </div>

      <hr className="border-border" />

      <div>
        <h2 className="text-xl font-semibold text-text mb-2">Trust Configuration</h2>
        {isAdmin && <TrustEvolutionSection communityId={community.id} />}
      </div>

      <hr className="border-border" />

      <div>
        <button
          onClick={() => setShowAdvancedSettings(v => !v)}
          className="flex items-center gap-2 text-sm font-medium text-text-muted hover:text-text"
        >
          <span>{showAdvancedSettings ? '▾' : '▸'}</span>
          <span>Advanced</span>
        </button>
        {showAdvancedSettings && editedSettings && (
          <div className="mt-4 space-y-4">
            <div className="bg-surface rounded-lg p-6">
              <h4 className="font-semibold text-lg mb-4">Data Retention (TTL)</h4>
              <div className="grid md:grid-cols-2 gap-4">
                {([
                  ['request_ttl_days', 'Help Requests (days)'],
                  ['offer_ttl_days', 'Help Offers (days)'],
                  ['match_ttl_days', 'Completed Matches (days)'],
                  ['notification_ttl_days', 'Notifications (days)'],
                  ['message_ttl_days', 'Messages (days)'],
                  ['session_ttl_days', 'Sessions (days)'],
                ] as const).map(([field, label]) => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-text-muted mb-1">{label}</label>
                    <input
                      type="number"
                      value={(editedSettings as any)[field]}
                      onChange={(e) => setEditedSettings({ ...editedSettings, [field]: parseInt(e.target.value) || 60 })}
                      className="w-full px-4 py-2 border border-border rounded"
                      min="1" max="365"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-surface rounded-lg p-6">
              <h4 className="font-semibold text-lg mb-4">Reputation Decay</h4>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox" id="karma_decay"
                    checked={editedSettings.karma_decay_enabled}
                    onChange={(e) => setEditedSettings({ ...editedSettings, karma_decay_enabled: e.target.checked })}
                    className="w-5 h-5 rounded"
                  />
                  <label htmlFor="karma_decay" className="font-medium">Enable karma decay</label>
                </div>
                {editedSettings.karma_decay_enabled && (
                  <div className="ml-8">
                    <label className="block text-sm font-medium text-text-muted mb-1">Decay half-life (months)</label>
                    <input
                      type="number"
                      value={editedSettings.karma_half_life_months}
                      onChange={(e) => setEditedSettings({ ...editedSettings, karma_half_life_months: parseInt(e.target.value) || 6 })}
                      className="w-32 px-4 py-2 border border-border rounded"
                      min="1" max="24"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setEditedSettings(settings)} className="px-6 py-2 bg-gray-200 text-text-muted rounded hover:bg-gray-300">Reset</button>
              <button onClick={handleSaveSettings} disabled={saving} className="px-6 py-2 bg-primary text-white rounded hover:bg-primary-dark disabled:bg-primary-medium">
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
