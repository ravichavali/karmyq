import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { communityService, requestService, reputationService } from '@/lib/api'
import Layout from '@/components/Layout'
import CommunityConfigEditor from '@/components/CommunityConfigEditor'
import CommunityTrustQuestionnaire from '@/components/CommunityTrustQuestionnaire'
import TrustModelDiff from '@/components/TrustModelDiff'
import { CommunityConfig } from '@/types/community-config'
import { answersToConfig, QuestionnaireAnswers } from '@/lib/trust-model'
import { REQUEST_TYPES } from '@/components/requests/RequestTypeSelector'
import CommunityLinks from '@/components/community/CommunityLinks'

interface Member {
  id: string
  user_id: string
  user_name: string
  user_email: string
  role: string
  status: string
  joined_at: string
  invited_by_name?: string
  join_request_message?: string
}

interface CommunitySettings {
  request_ttl_days: number
  offer_ttl_days: number
  match_ttl_days: number
  notification_ttl_days: number
  message_ttl_days: number
  session_ttl_days: number
  karma_decay_enabled: boolean
  karma_half_life_months: number
}

interface Norm {
  id: string
  description: string
  rationale: string
  status: string
  creator_name: string
  approval_count: number
  created_at: string
}

interface Community {
  id: string
  name: string
  description: string
  current_members: number
  max_members: number
  access_type: 'public' | 'private'
  creator_id: string
  creator_name: string
  status: string
  members: Member[]
}

type ValidTab = 'overview' | 'members' | 'norms' | 'requests' | 'insights' | 'settings' | 'providers';

const OLD_TAB_MAP: Record<string, ValidTab> = {
  manage: 'members',
  pending: 'members',
  config: 'settings',
  stats: 'insights',
  export: 'insights',
  links: 'settings',
};

const VALID_TABS: ValidTab[] = ['overview', 'members', 'norms', 'requests', 'insights', 'settings', 'providers'];

export default function CommunityDetailPage() {
  const router = useRouter()
  const { id } = router.query
  const [community, setCommunity] = useState<Community | null>(null)
  const [norms, setNorms] = useState<Norm[]>([])
  const [config, setConfig] = useState<CommunityConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<ValidTab>('overview')
  const [memberFilter, setMemberFilter] = useState<'active' | 'pending'>('active')
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [communityCollectives, setCommunityCollectives] = useState<any[]>([])
  const [providerConfig, setProviderConfig] = useState({ provider_services_enabled: false, provider_min_personal_trust_score: 0, provider_services_list: [] as string[] })
  const [savingProviderConfig, setSavingProviderConfig] = useState(false)
  const [settings, setSettings] = useState<CommunitySettings | null>(null)
  const [editedSettings, setEditedSettings] = useState<CommunitySettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [editedConfig, setEditedConfig] = useState<CommunityConfig | null>(null)
  const [configErrors, setConfigErrors] = useState<Record<string, string>>({})
  const [configSaving, setConfigSaving] = useState(false)
  const [stats, setStats] = useState<any>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [communityTrust, setCommunityTrust] = useState<any>(null)
  const [loadingTrust, setLoadingTrust] = useState(false)
  const [networkMetrics, setNetworkMetrics] = useState<any>(null)
  const [exporting, setExporting] = useState(false)
  const [communityRequests, setCommunityRequests] = useState<any[]>([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [showQuestionnaire, setShowQuestionnaire] = useState(false)
  const [showDiff, setShowDiff] = useState(false)
  const [memberTrustScores, setMemberTrustScores] = useState<Record<string, number | null>>({})
  const [proposedConfig, setProposedConfig] = useState<Partial<CommunityConfig> | null>(null)
  const [requestStatusFilter, setRequestStatusFilter] = useState<string>('open')
  const [newNorm, setNewNorm] = useState({ description: '', rationale: '' })
  const [showNormForm, setShowNormForm] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [joiningCommunity, setJoiningCommunity] = useState(false)

  useEffect(() => {
    // Only run on client-side (not during SSR)
    if (typeof window === 'undefined') {
      return
    }

    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    if (!token) {
      router.push('/login')
      return
    }
    if (userData) {
      setCurrentUser(JSON.parse(userData))
    }
  }, [router])

  useEffect(() => {
    if (id) {
      fetchCommunity()
      fetchNorms()
      fetchConfig()
      fetchSettings()
      fetchStats()
    }
  }, [id])

  // Redirect old tab names to new equivalents (backwards compat)
  useEffect(() => {
    const raw = router.query.tab as string | undefined;
    if (!raw) return;
    if (VALID_TABS.includes(raw as ValidTab)) {
      setActiveTab(raw as ValidTab);
    } else if (OLD_TAB_MAP[raw]) {
      router.replace(
        { pathname: router.pathname, query: { ...router.query, tab: OLD_TAB_MAP[raw] } },
        undefined,
        { shallow: true }
      );
      setActiveTab(OLD_TAB_MAP[raw]);
    }
  }, [router.query.tab])

  // Trigger tab-specific data fetches when the active tab changes
  useEffect(() => {
    if (!id) return
    if (activeTab === 'members') {
      fetchMemberTrustScores()
    } else if (activeTab === 'insights') {
      if (!stats) fetchStats()
      if (!communityTrust) fetchCommunityTrust()
      if (!networkMetrics) fetchNetworkMetrics()
    } else if (activeTab === 'requests') {
      fetchCommunityRequests()
    }
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchCommunity = async () => {
    try {
      setLoading(true)
      const response = await communityService.getCommunity(id as string)
      setCommunity(response.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load community')
    } finally {
      setLoading(false)
    }
  }

  const fetchNorms = async () => {
    try {
      const response = await communityService.getNorms(id as string)
      setNorms(response.data.norms || response.data)
    } catch (err: any) {
      console.error('Failed to load norms:', err)
    }
  }

  const fetchConfig = async () => {
    try {
      const response = await communityService.getConfig(id as string)
      // Backend returns { data: { config: {...}, community_id, template_source } }
      // Response interceptor unwraps outer layer, so response.data.config contains the actual config
      setConfig(response.data.config)
      setEditedConfig(response.data.config)
    } catch (err: any) {
      console.error('Failed to load configuration:', err)
    }
  }

  const fetchSettings = async () => {
    try {
      const response = await communityService.getSettings(id as string)
      setSettings(response.data)
      setEditedSettings(response.data)
    } catch (err: any) {
      const defaults: CommunitySettings = {
        request_ttl_days: 60, offer_ttl_days: 60, match_ttl_days: 90,
        notification_ttl_days: 30, message_ttl_days: 90, session_ttl_days: 30,
        karma_decay_enabled: true, karma_half_life_months: 6,
      }
      setSettings(defaults)
      setEditedSettings(defaults)
    }
  }

  const fetchStats = async () => {
    try {
      setLoadingStats(true)
      const response = await communityService.getStats(id as string)
      setStats(response.data)
    } catch (err: any) {
      console.error('Failed to load statistics:', err)
    } finally {
      setLoadingStats(false)
    }
  }

  const fetchCommunityTrust = async () => {
    try {
      setLoadingTrust(true)
      const response = await reputationService.getCommunityTrust(id as string)
      setCommunityTrust(response.data ?? null)
    } catch { /* non-fatal */ } finally {
      setLoadingTrust(false)
    }
  }

  const fetchNetworkMetrics = async () => {
    try {
      const response = await reputationService.getNetworkMetrics(id as string)
      setNetworkMetrics(response.data ?? null)
    } catch { /* non-fatal */ }
  }

  const fetchCommunityRequests = async (status?: string) => {
    if (!id) return
    try {
      setLoadingRequests(true)
      const response = await requestService.getRequests({ community_id: id as string, status: status || requestStatusFilter || undefined, limit: 50 })
      const data = response.data
      const requests = Array.isArray(data) ? data : (data?.requests ?? [])
      setCommunityRequests(requests)
    } catch (err: any) {
      console.error('Failed to load community requests:', err)
      setCommunityRequests([])
    } finally {
      setLoadingRequests(false)
    }
  }

  const fetchMemberTrustScores = async () => {
    if (!community?.members) return
    const members = community.members.filter((m: any) => m.status === 'active')
    const results = await Promise.allSettled(
      members.map((m: any) => reputationService.getTrustScore(m.user_id, id as string))
    )
    const scores: Record<string, number | null> = {}
    members.forEach((m: any, i: number) => {
      const r = results[i]
      scores[m.user_id] = r.status === 'fulfilled' ? (r.value.data?.data?.score ?? null) : null
    })
    setMemberTrustScores(scores)
  }

  const handleUpdateMemberRole = async (userId: string, newRole: string) => {
    if (!currentUser || !id) return
    try {
      await communityService.updateMember(id as string, userId, { role: newRole, admin_user_id: currentUser.id })
      fetchCommunity()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update member role')
    }
  }

  const handleApproveMember = async (userId: string) => {
    if (!currentUser || !id) return
    try {
      await communityService.updateMember(id as string, userId, { status: 'active', admin_user_id: currentUser.id })
      fetchCommunity()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to approve member')
    }
  }

  const handleRejectMember = async (userId: string) => {
    if (!currentUser || !id) return
    try {
      await communityService.removeMember(id as string, userId, currentUser.id)
      fetchCommunity()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to reject member')
    }
  }

  const handleRemoveMember = async (userId: string, userName: string) => {
    if (!currentUser || !id) return
    if (!confirm(`Are you sure you want to remove ${userName} from the community?`)) return
    try {
      await communityService.removeMember(id as string, userId, currentUser.id)
      fetchCommunity()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to remove member')
    }
  }

  const handleSaveSettings = async () => {
    if (!currentUser || !id || !editedSettings) return
    setSaving(true)
    try {
      await communityService.updateSettings(id as string, { ...editedSettings, user_id: currentUser.id })
      setSettings(editedSettings)
      alert('Settings saved successfully!')
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const validateConfig = (cfg: CommunityConfig): Record<string, string> => {
    const errors: Record<string, string> = {}
    const weightSum = cfg.trust_depth_weight + cfg.trust_breadth_weight
    if (Math.abs(weightSum - 1.0) > 0.01) errors.trust_weights = `Weights sum to ${weightSum.toFixed(2)}, must equal 1.0`
    const names = cfg.enabled_request_types.map(t => t.name)
    if (new Set(names).size !== names.length) errors.request_types = 'Request type names must be unique'
    return errors
  }

  const handleSaveConfig = async () => {
    if (!currentUser || !id || !editedConfig) return
    const errors = validateConfig(editedConfig)
    if (Object.keys(errors).length > 0) { setConfigErrors(errors); alert('Please fix validation errors before saving'); return }
    setConfigSaving(true)
    try {
      await communityService.updateConfig(id as string, editedConfig)
      setConfig(editedConfig)
      setConfigErrors({})
      alert('Configuration saved successfully!')
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save configuration')
    } finally {
      setConfigSaving(false)
    }
  }

  const handleExport = async (type: 'full' | 'members' | 'activity', format: 'json' | 'csv') => {
    if (!id) return
    setExporting(true)
    try {
      let response: any, filename: string
      if (type === 'full') { response = await communityService.exportCommunityData(id as string, { format }); filename = `community-${id}-export.${format}` }
      else if (type === 'members') { response = await communityService.exportMembers(id as string, format); filename = `members-${id}.${format}` }
      else { response = await communityService.exportActivity(id as string, format); filename = `activity-${id}.${format}` }
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

  const handleCreateNorm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser || !newNorm.description) return

    try {
      await communityService.createNorm(id as string, {
        description: newNorm.description,
        rationale: newNorm.rationale,
        created_by: currentUser.id,
      })
      setNewNorm({ description: '', rationale: '' })
      setShowNormForm(false)
      fetchNorms()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create norm')
    }
  }

  const handleApproveNorm = async (normId: string) => {
    if (!currentUser) return
    try {
      await communityService.approveNorm(id as string, normId, currentUser.id)
      fetchNorms()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to approve norm')
    }
  }

  const handleJoinCommunity = async () => {
    if (!currentUser || !id || !community) return

    setJoiningCommunity(true)
    try {
      await communityService.joinCommunity(id as string, {
        user_id: currentUser.id
      })
      // Refresh community data to show updated member list
      await fetchCommunity()

      if (community.access_type === 'public') {
        alert('Successfully joined the community!')
      } else {
        alert('Join request submitted! Waiting for admin approval.')
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to join community')
    } finally {
      setJoiningCommunity(false)
    }
  }

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser || !id || !inviteEmail) return

    try {
      // In a real app, you'd look up the user by email first
      // For now, this is a placeholder - you'd need a user lookup endpoint
      alert(`Invitation feature coming soon! Would invite: ${inviteEmail}`)
      setShowInviteModal(false)
      setInviteEmail('')
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to send invitation')
    }
  }

  const membershipRecord = community?.members.find((m: Member) => m.user_id === currentUser?.id)
  const isMember = membershipRecord?.status === 'active'
  const isPending = membershipRecord?.status === 'pending'
  const isAdmin = membershipRecord?.role === 'admin' && membershipRecord?.status === 'active'
  const isModerator = membershipRecord?.role === 'moderator' && membershipRecord?.status === 'active'
  const isAdminOrMod = isAdmin || isModerator

  const pendingCount = isAdminOrMod
    ? (community?.members ?? []).filter((m: any) => m.status === 'pending').length
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-text-subtle">Loading...</div>
      </div>
    )
  }

  if (error || !community) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500">{error || 'Community not found'}</div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>{community.name} - Karmyq</title>
      </Head>
      <Layout title={community.name}>
        <div className="container mx-auto px-4 py-8">
          {/* Community Header */}
          <div className="bg-surface-raised rounded-lg shadow-md p-8 mb-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h1 className="text-3xl font-bold mb-2">{community.name}</h1>
                <p className="text-text-muted">{community.description}</p>
              </div>
              {!isMember && !isPending && (
                <button
                  onClick={handleJoinCommunity}
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
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full"
                  style={{
                    width: `${(community.current_members / community.max_members) * 100}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-surface-raised rounded-lg shadow-md mb-6">
            {/* Tab navigation */}
            <div className="border-b border-gray-200 mb-6">
              <nav className="-mb-px flex space-x-4 overflow-x-auto" aria-label="Tabs">
                {(['overview', 'members', 'norms'] as ValidTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`relative whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize ${
                      activeTab === tab
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab === 'members' ? (
                      <span className="relative">
                        members
                        {isAdminOrMod && pendingCount > 0 && activeTab !== 'members' && (
                          <span className="absolute -top-1 -right-3 w-2 h-2 bg-red-500 rounded-full" />
                        )}
                      </span>
                    ) : tab}
                  </button>
                ))}

                {isAdminOrMod && (
                  <>
                    {(['requests', 'insights', 'providers'] as ValidTab[]).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize ${
                          activeTab === tab
                            ? 'border-indigo-500 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </>
                )}

                {isAdmin && (
                  <button
                    onClick={() => setActiveTab('settings')}
                    className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize ${
                      activeTab === 'settings'
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    settings
                  </button>
                )}
              </nav>
            </div>

            <div className="p-6">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div>
                  <h3 className="text-xl font-semibold mb-4">About this Community</h3>
                  <p className="text-text-muted mb-6">
                    {community.description || 'No description provided.'}
                  </p>
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

                  {/* Community Vitality Badge */}
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

                  {/* Configuration Highlights */}
                  {config && (
                    <div className="mt-8">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-semibold">How This Community Works</h3>
                        <button
                          onClick={() => setActiveTab('settings')}
                          className="text-sm text-primary hover:text-primary-dark font-medium"
                        >
                          View Full Configuration →
                        </button>
                      </div>

                      <div className="grid md:grid-cols-2 gap-6">
                        {/* Karma Mechanics */}
                        <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200 rounded-lg p-5">
                          <h4 className="font-semibold text-text mb-3 flex items-center gap-2">
                            <span className="text-xl">💎</span>
                            Karma Mechanics
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-text-muted">Karma Split:</span>
                              <span className="font-medium text-text">
                                {config.karma_split_helper}% helper / {config.karma_split_requestor}% requestor
                              </span>
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
                              <div className="text-xs text-text-muted mt-1">
                                ✓ Karma is bankable (no decay)
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Trust Mechanics */}
                        <div className="bg-gradient-to-br from-primary-light to-accent-light border border-primary-medium rounded-lg p-5">
                          <h4 className="font-semibold text-text mb-3 flex items-center gap-2">
                            <span className="text-xl">🤝</span>
                            Trust Mechanics
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-text-muted">Trust Model:</span>
                              <span className="font-medium text-text">
                                {config.trust_depth_weight > 0.6 ? 'Depth-focused' :
                                 config.trust_breadth_weight > 0.6 ? 'Breadth-focused' : 'Balanced'}
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

                        {/* Request Types */}
                        <div className="bg-gradient-to-br from-accent-light to-karmyq-brown-50 border border-accent rounded-lg p-5">
                          <h4 className="font-semibold text-text mb-3 flex items-center gap-2">
                            <span className="text-xl">📋</span>
                            Request Types
                          </h4>
                          {(() => {
                            const validNames = new Set<string>(REQUEST_TYPES.map((t) => t.value as string))
                            const filtered = config.enabled_request_types.filter((rt) => validNames.has(rt.name as string))
                            const normalizedEnabledTypes = filtered.length > 0
                              ? filtered
                              : REQUEST_TYPES.map((t) => ({ name: t.value as string, karma_multiplier: 1.0 }))
                            return (
                          <div className="grid grid-cols-2 gap-2">
                            {REQUEST_TYPES.map((type) => {
                              const match = normalizedEnabledTypes.find((rt) => rt.name === (type.value as string))
                              const enabled = !!match
                              return (
                                <div
                                  key={type.value}
                                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                                    enabled
                                      ? 'border-primary bg-primary-light text-text'
                                      : 'border-border bg-surface text-text-subtle opacity-50'
                                  }`}
                                >
                                  <span>{type.icon}</span>
                                  <span className="font-medium">{type.label}</span>
                                  {enabled && match!.karma_multiplier !== 1.0 && (
                                    <span className="ml-auto text-xs text-primary font-semibold">
                                      ×{match!.karma_multiplier}
                                    </span>
                                  )}
                                  {!enabled && (
                                    <span className="ml-auto text-xs text-text-subtle">off</span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                            )
                          })()}
                        </div>

                        {/* Community Rules */}
                        <div className="bg-gradient-to-br from-karmyq-green-50 to-karmyq-green-100 border border-success rounded-lg p-5">
                          <h4 className="font-semibold text-text mb-3 flex items-center gap-2">
                            <span className="text-xl">📜</span>
                            Community Rules
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-text-muted">Size Limit:</span>
                              <span className="font-medium text-text">
                                {community.current_members} / {config.member_cap} members
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-text-muted">Visibility:</span>
                              <span className="font-medium text-text">
                                {config.visibility_mode === 'public' ? '👁️ Public' :
                                 config.visibility_mode === 'members_only' ? '🔒 Members Only' :
                                 '🔓 Hybrid'}
                              </span>
                            </div>
                            {config.join_approval_required && (
                              <div className="text-xs text-text-muted">✓ Join approval required</div>
                            )}
                            {config.request_approval_required && (
                              <div className="text-xs text-text-muted">✓ Request approval required</div>
                            )}
                            {config.new_member_karma_lockout_days > 0 && (
                              <div className="text-xs text-text-muted">
                                ⚠️ {config.new_member_karma_lockout_days} day karma lockout for new members
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {config.template_source && (
                        <div className="mt-4 bg-primary-light border border-primary-medium rounded-lg p-4">
                          <p className="text-sm text-primary-dark">
                            <strong>Based on Template:</strong> {config.template_source}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Members Tab */}
              {activeTab === 'members' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold">Members</h3>
                    {isAdminOrMod && (
                      <button
                        onClick={() => setShowInviteModal(true)}
                        className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
                      >
                        Invite Member
                      </button>
                    )}
                  </div>

                  {/* Non-admin: original card view */}
                  {!isAdminOrMod && (
                    <div className="space-y-3">
                      {community.members.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-4 bg-surface rounded-lg"
                        >
                          <div>
                            <div className="font-semibold">{member.user_name}</div>
                            <div className="text-sm text-text-muted">{member.user_email}</div>
                            {member.invited_by_name && (
                              <div className="text-xs text-text-subtle">
                                Invited by {member.invited_by_name}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              className={`px-3 py-1 rounded text-sm font-medium ${
                                member.role === 'admin'
                                  ? 'bg-accent-light text-accent-dark'
                                  : 'bg-gray-200 text-text-muted'
                              }`}
                            >
                              {member.role}
                            </span>
                            {(() => {
                              const score = memberTrustScores[member.user_id]
                              const colorClass = score === null || score === undefined
                                ? 'bg-gray-100 text-gray-400'
                                : score >= 75
                                ? 'bg-green-100 text-green-700'
                                : score >= 50
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-gray-100 text-gray-400'
                              return (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
                                  {score !== null && score !== undefined ? `★ ${score}` : '—'}
                                </span>
                              )
                            })()}
                            <span className="text-xs text-text-subtle">
                              {new Date(member.joined_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Admin/Mod: filter row + table/pending view */}
                  {isAdminOrMod && (
                    <div>
                      {/* Filter row */}
                      <div className="flex items-center gap-4 mb-4">
                        <button
                          onClick={() => setMemberFilter('active')}
                          className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                            memberFilter === 'active'
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          Active ({(community.members ?? []).filter((m: any) => m.status === 'active').length})
                        </button>
                        <button
                          onClick={() => setMemberFilter('pending')}
                          className={`relative px-3 py-1.5 rounded-md text-sm font-medium ${
                            memberFilter === 'pending'
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          Pending ({pendingCount})
                          {pendingCount > 0 && memberFilter !== 'pending' && (
                            <span className="absolute -top-1 -right-1 block h-2 w-2 rounded-full bg-red-500" />
                          )}
                        </button>
                      </div>

                      {/* Active members table */}
                      {memberFilter === 'active' && (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                <th className="px-4 py-3" />
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {(community.members ?? [])
                                .filter((m: any) => m.status === 'active')
                                .map((member) => {
                                  const isSelf = member.user_id === currentUser?.id;
                                  const isCreator = member.user_id === community?.creator_id;
                                  const disabled = isSelf || isCreator;
                                  return (
                                    <tr key={member.user_id}>
                                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {member.user_name}
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                        {member.user_email}
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(member.joined_at).toLocaleDateString()}
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap">
                                        {isAdmin ? (
                                          <select
                                            value={member.role}
                                            onChange={(e) => handleUpdateMemberRole(member.user_id, e.target.value)}
                                            disabled={disabled}
                                            className="px-3 py-1 border border-border rounded text-sm disabled:bg-border-light"
                                          >
                                            <option value="member">Member</option>
                                            <option value="moderator">Moderator</option>
                                            <option value="admin">Admin</option>
                                          </select>
                                        ) : (
                                          <span className="px-3 py-1 text-sm text-text-muted">{member.role}</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap text-right">
                                        {isAdmin && !isSelf && !isCreator ? (
                                          <button
                                            onClick={() => handleRemoveMember(member.user_id, member.user_name)}
                                            className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
                                          >
                                            Remove
                                          </button>
                                        ) : isCreator ? (
                                          <span className="px-3 py-1 bg-accent-light text-accent-dark rounded text-sm">Creator</span>
                                        ) : null}
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Pending join requests */}
                      {memberFilter === 'pending' && (
                        <div className="space-y-3">
                          {(community.members ?? [])
                            .filter((m: any) => m.status === 'pending')
                            .map((member) => (
                              <div key={member.user_id} className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <div className="flex-1">
                                  <div className="font-semibold">{member.user_name}</div>
                                  <div className="text-sm text-text-muted">{member.user_email}</div>
                                  <div className="text-xs text-text-subtle">Requested {new Date(member.joined_at).toLocaleDateString()}</div>
                                  {member.join_request_message && (
                                    <div className="mt-2 text-sm text-text-muted bg-surface-raised p-2 rounded border border-yellow-300">
                                      <span className="font-medium">Message:</span> {member.join_request_message}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                  <button onClick={() => handleApproveMember(member.user_id)} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Approve</button>
                                  <button onClick={() => handleRejectMember(member.user_id)} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Reject</button>
                                </div>
                              </div>
                            ))}
                          {pendingCount === 0 && (
                            <p className="text-sm text-gray-500 text-center py-8">No pending join requests.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Norms Tab */}
              {activeTab === 'norms' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold">Community Norms</h3>
                    {isMember && !showNormForm && (
                      <button
                        onClick={() => setShowNormForm(true)}
                        className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
                      >
                        Propose Norm
                      </button>
                    )}
                  </div>

                  {showNormForm && (
                    <form onSubmit={handleCreateNorm} className="bg-primary-light p-4 rounded-lg mb-4">
                      <h4 className="font-semibold mb-3">Propose New Norm</h4>
                      <input
                        type="text"
                        placeholder="Norm description"
                        value={newNorm.description}
                        onChange={(e) => setNewNorm({ ...newNorm, description: e.target.value })}
                        className="w-full px-4 py-2 border border-border rounded mb-2"
                        required
                      />
                      <textarea
                        placeholder="Rationale (optional)"
                        value={newNorm.rationale}
                        onChange={(e) => setNewNorm({ ...newNorm, rationale: e.target.value })}
                        className="w-full px-4 py-2 border border-border rounded mb-2"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
                        >
                          Submit
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowNormForm(false)}
                          className="px-4 py-2 bg-gray-200 text-text-muted rounded hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="space-y-3">
                    {norms.length === 0 ? (
                      <p className="text-text-subtle">No norms yet. Members can propose norms to establish community guidelines.</p>
                    ) : (
                      norms.map((norm) => (
                        <div key={norm.id} className="p-4 bg-surface rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <p className="font-medium">{norm.description}</p>
                              {norm.rationale && (
                                <p className="text-sm text-text-muted mt-1">{norm.rationale}</p>
                              )}
                              <p className="text-xs text-text-subtle mt-2">
                                Proposed by {norm.creator_name}
                              </p>
                            </div>
                            <span
                              className={`px-3 py-1 rounded text-sm font-medium ${
                                norm.status === 'active'
                                  ? 'bg-success-light text-green-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {norm.status}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-3">
                            <span className="text-sm text-text-muted">
                              {norm.approval_count} approval{norm.approval_count !== 1 ? 's' : ''}
                            </span>
                            {isMember && norm.status === 'proposed' && (
                              <button
                                onClick={() => handleApproveNorm(norm.id)}
                                className="px-3 py-1 bg-primary text-white text-sm rounded hover:bg-primary-dark"
                              >
                                Approve
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Configuration Tab */}
              {/* Admin: Unified Settings Tab */}
              {activeTab === 'settings' && isAdmin && (
                <div className="space-y-8">

                  {/* Section 1: Community Configuration */}
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Community Configuration</h2>

                    {/* Summary card — key current values */}
                    {config && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-600">Karma split (helper):</span>{' '}
                          <span className="text-gray-900">{config.karma_split_helper ?? 'default'}%</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600">Trust path max hops:</span>{' '}
                          <span className="text-gray-900">{config.trust_path_max_hops ?? 'default'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600">Visibility:</span>{' '}
                          <span className="text-gray-900">{config.visibility_mode ?? 'default'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600">Join approval:</span>{' '}
                          <span className="text-gray-900">{config.join_approval_required ? 'Required' : 'Open'}</span>
                        </div>
                      </div>
                    )}

                    {config && (
                      <div>
                        <p className="text-text-muted mb-6">
                          {community.creator_id === currentUser?.id
                            ? 'Configure trust, karma, and coordination mechanics for your community.'
                            : 'View the configuration that defines how trust, karma, and coordination work in this community.'}
                        </p>

                        {/* Founder: Revisit trust model banner */}
                        {community.creator_id === currentUser?.id && !showQuestionnaire && !showDiff && (
                          <div className="mb-6 flex items-center justify-between rounded-lg border border-border bg-surface p-4">
                            <div>
                              <p className="font-medium text-text text-sm">Revisit your trust model</p>
                              <p className="text-xs text-text-muted mt-0.5">
                                Answer 6 questions and see what the system would propose based on how your community has evolved.
                              </p>
                            </div>
                            <button
                              onClick={() => { setShowQuestionnaire(true); setShowDiff(false); setProposedConfig(null) }}
                              className="ml-4 flex-shrink-0 px-4 py-2 text-sm bg-primary text-white rounded hover:bg-primary-dark font-medium"
                            >
                              Revisit
                            </button>
                          </div>
                        )}

                        {/* Inline questionnaire */}
                        {community.creator_id === currentUser?.id && showQuestionnaire && (
                          <div className="mb-6 rounded-lg border border-border bg-surface p-6">
                            <CommunityTrustQuestionnaire
                              mode="revisit"
                              onComplete={(answers: QuestionnaireAnswers) => {
                                const inferred = answersToConfig(answers)
                                setProposedConfig(inferred)
                                setShowQuestionnaire(false)
                                setShowDiff(true)
                              }}
                              onBack={() => setShowQuestionnaire(false)}
                            />
                          </div>
                        )}

                        {/* Diff view */}
                        {community.creator_id === currentUser?.id && showDiff && proposedConfig && editedConfig && (
                          <div className="mb-6">
                            <TrustModelDiff
                              current={editedConfig}
                              proposed={proposedConfig}
                              onApplyAll={() => {
                                setEditedConfig(prev => prev ? { ...prev, ...proposedConfig } : prev)
                                setShowDiff(false)
                                setProposedConfig(null)
                              }}
                              onApplySelective={(fields) => {
                                setEditedConfig(prev => {
                                  if (!prev || !proposedConfig) return prev
                                  const patch: Partial<CommunityConfig> = {}
                                  fields.forEach(f => { (patch as any)[f] = (proposedConfig as any)[f] })
                                  return { ...prev, ...patch }
                                })
                                setShowDiff(false)
                                setProposedConfig(null)
                              }}
                              onDiscard={() => { setShowDiff(false); setProposedConfig(null) }}
                            />
                          </div>
                        )}

                        {community.creator_id === currentUser?.id && editedConfig ? (
                          <>
                            <CommunityConfigEditor
                              config={editedConfig}
                              onChange={(newConfig) => { setEditedConfig(newConfig); setConfigErrors({}) }}
                              errors={configErrors}
                            />
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
                            <p className="text-sm text-primary-dark"><strong>Template:</strong> This community was created using the "{config.template_source}" template.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <hr className="border-gray-200" />

                  {/* Section 2: Linked Communities */}
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Linked Communities</h2>
                    <CommunityLinks communityId={community.id} isAdmin={isAdmin} />
                  </div>

                  <hr className="border-gray-200" />

                  {/* Section 3: Advanced settings */}
                  <div>
                    <button
                      onClick={() => setShowAdvancedSettings(v => !v)}
                      className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
                    >
                      <span>{showAdvancedSettings ? '▾' : '▸'}</span>
                      <span>Advanced</span>
                    </button>

                    {showAdvancedSettings && editedSettings && (
                      <div className="mt-4 space-y-4">
                        <div className="bg-surface rounded-lg p-6">
                          <h4 className="font-semibold text-lg mb-4">Data Retention (TTL)</h4>
                          <div className="grid md:grid-cols-2 gap-4">
                            {([['request_ttl_days', 'Help Requests (days)'], ['offer_ttl_days', 'Help Offers (days)'], ['match_ttl_days', 'Completed Matches (days)'], ['notification_ttl_days', 'Notifications (days)'], ['message_ttl_days', 'Messages (days)'], ['session_ttl_days', 'Sessions (days)']] as const).map(([field, label]) => (
                              <div key={field}>
                                <label className="block text-sm font-medium text-text-muted mb-1">{label}</label>
                                <input type="number" value={(editedSettings as any)[field]}
                                  onChange={(e) => setEditedSettings({ ...editedSettings, [field]: parseInt(e.target.value) || 60 })}
                                  className="w-full px-4 py-2 border border-border rounded" min="1" max="365" />
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="bg-surface rounded-lg p-6">
                          <h4 className="font-semibold text-lg mb-4">Reputation Decay</h4>
                          <div className="space-y-4">
                            <div className="flex items-center gap-3">
                              <input type="checkbox" id="karma_decay" checked={editedSettings.karma_decay_enabled}
                                onChange={(e) => setEditedSettings({ ...editedSettings, karma_decay_enabled: e.target.checked })}
                                className="w-5 h-5 rounded" />
                              <label htmlFor="karma_decay" className="font-medium">Enable karma decay</label>
                            </div>
                            {editedSettings.karma_decay_enabled && (
                              <div className="ml-8">
                                <label className="block text-sm font-medium text-text-muted mb-1">Decay half-life (months)</label>
                                <input type="number" value={editedSettings.karma_half_life_months}
                                  onChange={(e) => setEditedSettings({ ...editedSettings, karma_half_life_months: parseInt(e.target.value) || 6 })}
                                  className="w-32 px-4 py-2 border border-border rounded" min="1" max="24" />
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
              )}

              {/* Admin/Mod: Insights Tab (unified Stats + Export) */}
              {activeTab === 'insights' && isAdminOrMod && (
                <div className="space-y-8">

                  {/* Section 1: Community stats */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold text-gray-900">Community Insights</h2>
                      <button onClick={fetchStats} disabled={loadingStats} className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark disabled:bg-primary-medium">
                        {loadingStats ? 'Refreshing...' : 'Refresh'}
                      </button>
                    </div>

                    {loadingStats && !stats && <div className="text-center py-12 text-text-subtle">Loading statistics...</div>}
                    {stats && (
                      <div className="grid md:grid-cols-4 gap-4">
                        <div className="bg-surface-raised rounded-lg shadow p-4 border-l-4 border-primary">
                          <div className="text-sm text-text-muted mb-1">Total Exchanges</div>
                          <div className="text-3xl font-bold text-primary">{stats.matches?.completed_matches || 0}</div>
                          <div className="text-xs text-text-subtle mt-1">{stats.matches?.matches_completed_this_month || 0} this month</div>
                        </div>
                        <div className="bg-surface-raised rounded-lg shadow p-4 border-l-4 border-success">
                          <div className="text-sm text-text-muted mb-1">Active Requests</div>
                          <div className="text-3xl font-bold text-success">{stats.requests?.open_requests || 0}</div>
                          <div className="text-xs text-text-subtle mt-1">{stats.requests?.matched_requests || 0} matched</div>
                        </div>
                        <div className="bg-surface-raised rounded-lg shadow p-4 border-l-4 border-accent">
                          <div className="text-sm text-text-muted mb-1">Avg Karma</div>
                          <div className="text-3xl font-bold text-accent">{stats.karma?.avg_karma || 0}</div>
                          <div className="text-xs text-text-subtle mt-1">Max: {stats.karma?.max_karma || 0}</div>
                        </div>
                        <div className="bg-surface-raised rounded-lg shadow p-4 border-l-4 border-primary">
                          <div className="text-sm text-text-muted mb-1">This Week</div>
                          <div className="text-3xl font-bold">{stats.matches?.matches_completed_this_week || 0}</div>
                          <div className="text-xs text-text-subtle mt-1">{stats.requests?.requests_this_week || 0} requests</div>
                        </div>
                      </div>
                    )}

                    {/* Community Trust Score Panel */}
                    {loadingTrust && !communityTrust && (
                      <div className="mt-6 text-center py-8 text-text-subtle">Loading trust data...</div>
                    )}
                    {communityTrust && (() => {
                      const score: number = communityTrust.score ?? 0
                      const barColor = score >= 80 ? '#16a34a' : score >= 60 ? '#0d9488' : score >= 40 ? '#d97706' : '#92400e'
                      const prev: number | undefined = communityTrust.previous_score
                      const delta = prev !== undefined ? score - prev : 0
                      const trendStr = delta > 0 ? `↑ +${delta} since last week` : delta < 0 ? `↓ ${delta} since last week` : ''
                      const lastUpdated = communityTrust.last_calculated
                        ? new Date(communityTrust.last_calculated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : 'Unknown'
                      return (
                        <div className="mt-6 bg-surface-raised rounded-lg shadow p-5">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-base font-semibold">Community Trust Score</h4>
                            <span className="text-2xl font-bold" style={{ color: barColor }}>{score} / 100</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
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
                              <div className="text-xs text-text-subtle mt-1">Cross-comm help rate</div>
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

                    {/* Network Cohesion Panel */}
                    {networkMetrics && (() => {
                      const cohesionScore: number = networkMetrics.score ?? 0
                      const cohesionColor = cohesionScore >= 80 ? '#16a34a' : cohesionScore >= 60 ? '#0d9488' : cohesionScore >= 40 ? '#d97706' : '#92400e'
                      const computedStr = networkMetrics.computedAt
                        ? new Date(networkMetrics.computedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : 'recently'
                      return (
                        <div className="mt-4 bg-surface-raised rounded-lg shadow p-5">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-base font-semibold">Network Cohesion</h4>
                            <div className="flex items-center gap-2">
                              <span className="text-2xl font-bold" style={{ color: cohesionColor }}>{cohesionScore} / 100</span>
                              {networkMetrics.label && (
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: cohesionColor, color: '#fff' }}>{networkMetrics.label}</span>
                              )}
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
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
                              <span className="text-sm font-bold">{networkMetrics.avgPathLength !== undefined ? `${networkMetrics.avgPathLength.toFixed(1)}°` : '—'}</span>
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
                  </div>

                  {isAdmin && (
                    <>
                      <hr className="border-gray-200" />

                      {/* Section 2: Export data */}
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Export Data</h2>
                        <div className="space-y-6">
                          {([['full', 'Full Community Export', 'Export all community data including members, requests, matches, norms, settings, and karma records.'],
                             ['members', 'Members List', 'Export a list of all community members with their roles and join dates.'],
                             ['activity', 'Activity Report', 'Export member activity including karma, trust scores, helps given and received.']] as const).map(([type, title, desc]) => (
                            <div key={type} className="bg-surface rounded-lg p-6">
                              <h4 className="font-semibold text-lg mb-2">{title}</h4>
                              <p className="text-sm text-text-muted mb-4">{desc}</p>
                              <div className="flex gap-3">
                                <button onClick={() => handleExport(type, 'json')} disabled={exporting} className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark disabled:bg-primary-medium">
                                  {exporting ? 'Exporting...' : 'Export JSON'}
                                </button>
                                <button onClick={() => handleExport(type, 'csv')} disabled={exporting} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-green-400">
                                  {exporting ? 'Exporting...' : 'Export CSV'}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                </div>
              )}

              {/* Admin/Mod: Providers Tab */}
              {activeTab === 'providers' && isAdminOrMod && (
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
                        <label className="block text-sm font-medium text-text mb-1">Minimum personal trust score to appear ({providerConfig.provider_min_personal_trust_score})</label>
                        <input
                          type="range"
                          min={0}
                          max={100}
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

                    <button
                      disabled={savingProviderConfig}
                      onClick={async () => {
                        setSavingProviderConfig(true)
                        try {
                          await communityService.updateConfig(id as string, providerConfig)
                          alert('Provider settings saved')
                        } catch (err: any) {
                          alert(err?.message ?? 'Failed to save')
                        } finally {
                          setSavingProviderConfig(false)
                        }
                      }}
                      className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary-dark transition disabled:opacity-50"
                    >
                      {savingProviderConfig ? 'Saving...' : 'Save provider settings'}
                    </button>
                  </div>

                  <div>
                    <h4 className="text-base font-semibold text-text mb-3">Collectives serving this community</h4>
                    {communityCollectives.length === 0 ? (
                      <p className="text-sm text-text-muted">No collectives linked yet. Collective admins can link their collective to this community.</p>
                    ) : (
                      <div className="space-y-2">
                        {communityCollectives.map((c: any) => (
                          <div key={c.id} className="flex items-center justify-between bg-surface-raised rounded-lg border border-border px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-text">{c.name}</p>
                              <p className="text-xs text-text-subtle">{c.member_count} provider{c.member_count !== 1 ? 's' : ''}</p>
                            </div>
                            <Link href={`/providers/collectives/${c.id}`} className="text-xs text-primary hover:underline">View</Link>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Admin/Mod: Requests Tab */}
              {activeTab === 'requests' && isAdminOrMod && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold">Community Requests</h3>
                    <div className="flex gap-2">
                      {(['open', 'pending', 'matched', 'completed'] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => { setRequestStatusFilter(s); fetchCommunityRequests(s) }}
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
                    <div className="text-center py-8 text-text-muted text-sm">Loading requests...</div>
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
                                req.urgency === 'critical' ? 'bg-red-100 text-red-700' :
                                req.urgency === 'high' ? 'bg-orange-100 text-orange-700' :
                                req.urgency === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {req.urgency}
                              </span>
                            </div>
                            {req.description && (
                              <p className="text-sm text-text-muted line-clamp-1">{req.description}</p>
                            )}
                            <p className="text-xs text-text-subtle mt-1">by {req.requester_name}</p>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <span className={`text-xs px-2 py-1 rounded font-medium ${
                              req.status === 'open' ? 'bg-green-100 text-green-700' :
                              req.status === 'matched' ? 'bg-blue-100 text-blue-700' :
                              req.status === 'completed' ? 'bg-gray-100 text-gray-600' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                              {req.status}
                            </span>
                            <p className="text-xs text-text-subtle mt-1">
                              {new Date(req.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Invite Member Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-surface-raised rounded-lg p-8 max-w-md w-full mx-4">
              <h3 className="text-2xl font-bold mb-4">Invite Member</h3>
              <form onSubmit={handleInviteMember}>
                <div className="mb-4">
                  <label htmlFor="inviteEmail" className="block text-sm font-medium text-text-muted mb-2">
                    User Email
                  </label>
                  <input
                    type="email"
                    id="inviteEmail"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-border rounded focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="user@example.com"
                    required
                  />
                  <p className="mt-2 text-sm text-text-subtle">
                    Enter the email address of the person you want to invite. They must have an account.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
                  >
                    Send Invitation
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowInviteModal(false)
                      setInviteEmail('')
                    }}
                    className="px-4 py-2 bg-gray-200 text-text-muted rounded hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </Layout>
    </>
  )
}
