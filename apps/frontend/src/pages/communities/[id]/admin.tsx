import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { communityService } from '@/lib/api'
import Layout from '@/components/Layout'
import CommunityConfigEditor from '@/components/CommunityConfigEditor'
import { CommunityConfig } from '@/types/community-config'

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

export default function CommunityAdminPage() {
  const router = useRouter()
  const { id } = router.query
  const [community, setCommunity] = useState<Community | null>(null)
  const [settings, setSettings] = useState<CommunitySettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'members' | 'pending' | 'settings' | 'config' | 'stats' | 'export'>('members')
  const [exporting, setExporting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editedSettings, setEditedSettings] = useState<CommunitySettings | null>(null)
  const [config, setConfig] = useState<CommunityConfig | null>(null)
  const [editedConfig, setEditedConfig] = useState<CommunityConfig | null>(null)
  const [configErrors, setConfigErrors] = useState<Record<string, string>>({})
  const [configSaving, setConfigSaving] = useState(false)
  const [stats, setStats] = useState<any>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  useEffect(() => {
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
      fetchSettings()
      fetchConfig()
    }
  }, [id])

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

  const fetchSettings = async () => {
    try {
      const response = await communityService.getSettings(id as string)
      setSettings(response.data)
      setEditedSettings(response.data)
    } catch (err: any) {
      console.error('Failed to load settings:', err)
      // Use defaults if settings not found
      const defaults: CommunitySettings = {
        request_ttl_days: 60,
        offer_ttl_days: 60,
        match_ttl_days: 90,
        notification_ttl_days: 30,
        message_ttl_days: 90,
        session_ttl_days: 30,
        karma_decay_enabled: true,
        karma_half_life_months: 6
      }
      setSettings(defaults)
      setEditedSettings(defaults)
    }
  }

  const fetchConfig = async () => {
    try {
      const response = await communityService.getConfig(id as string)
      setConfig(response.data.config)
      setEditedConfig(response.data.config)
    } catch (err: any) {
      console.error('Failed to load configuration:', err)
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

  const handleUpdateMemberRole = async (userId: string, newRole: string) => {
    if (!currentUser || !id) return

    try {
      await communityService.updateMember(id as string, userId, {
        role: newRole,
        admin_user_id: currentUser.id
      })
      fetchCommunity()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update member role')
    }
  }

  const handleApproveMember = async (userId: string) => {
    if (!currentUser || !id) return

    try {
      await communityService.updateMember(id as string, userId, {
        status: 'active',
        admin_user_id: currentUser.id
      })
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

    if (!confirm(`Are you sure you want to remove ${userName} from the community?`)) {
      return
    }

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
      await communityService.updateSettings(id as string, {
        ...editedSettings,
        user_id: currentUser.id
      })
      setSettings(editedSettings)
      alert('Settings saved successfully!')
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const validateConfig = (config: CommunityConfig): Record<string, string> => {
    const errors: Record<string, string> = {}

    // Trust weights must sum to 1.0
    const weightSum = config.trust_depth_weight + config.trust_breadth_weight
    if (Math.abs(weightSum - 1.0) > 0.01) {
      errors.trust_weights = `Weights sum to ${weightSum.toFixed(2)}, must equal 1.0`
    }

    // Request type names must be unique
    const names = config.enabled_request_types.map(t => t.name)
    if (new Set(names).size !== names.length) {
      errors.request_types = 'Request type names must be unique'
    }

    return errors
  }

  const handleSaveConfig = async () => {
    if (!currentUser || !id || !editedConfig) return

    // Validate configuration
    const errors = validateConfig(editedConfig)
    if (Object.keys(errors).length > 0) {
      setConfigErrors(errors)
      alert('Please fix validation errors before saving')
      return
    }

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
      let response;
      let filename;

      if (type === 'full') {
        response = await communityService.exportCommunityData(id as string, { format });
        filename = `community-${id}-export.${format}`;
      } else if (type === 'members') {
        response = await communityService.exportMembers(id as string, format);
        filename = `members-${id}.${format}`;
      } else {
        response = await communityService.exportActivity(id as string, format);
        filename = `activity-${id}.${format}`;
      }

      // Create download link
      const blob = format === 'csv'
        ? new Blob([response.data], { type: 'text/csv' })
        : new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to export data');
    } finally {
      setExporting(false);
    }
  }

  // Check if current user is admin
  const membershipRecord = community?.members.find((m: Member) => m.user_id === currentUser?.id)
  const isAdmin = membershipRecord?.role === 'admin' && membershipRecord?.status === 'active'

  // Filter members by status
  const activeMembers = community?.members.filter(m => m.status === 'active') || []
  const pendingMembers = community?.members.filter(m => m.status === 'pending') || []

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

  if (!isAdmin) {
    return (
      <Layout title="Access Denied">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
            <h2 className="text-2xl font-bold text-red-800 mb-4">Access Denied</h2>
            <p className="text-red-600 mb-6">You must be a community admin to access this page.</p>
            <Link
              href={`/communities/${id}`}
              className="px-6 py-2 bg-primary text-white rounded hover:bg-primary-dark"
            >
              Back to Community
            </Link>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <>
      <Head>
        <title>Admin - {community.name} - Karmyq</title>
      </Head>
      <Layout title={`Admin: ${community.name}`}>
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <Link
                href={`/communities/${id}`}
                className="text-primary hover:text-primary-dark mb-2 inline-block"
              >
                ← Back to Community
              </Link>
              <h1 className="text-3xl font-bold">{community.name} - Admin Panel</h1>
            </div>
            {community.creator_id === currentUser?.id && (
              <Link
                href="/admin/schemas"
                className="px-4 py-2 bg-surface border border-border rounded hover:bg-surface-raised text-sm font-medium text-text-muted"
              >
                Schema Manager →
              </Link>
            )}
          </div>

          {/* Stats Cards */}
          <div className="grid md:grid-cols-4 gap-4 mb-6">
            <div className="bg-surface-raised rounded-lg shadow p-4">
              <div className="text-3xl font-bold text-primary">{activeMembers.length}</div>
              <div className="text-sm text-text-muted">Active Members</div>
            </div>
            <div className="bg-surface-raised rounded-lg shadow p-4">
              <div className="text-3xl font-bold text-yellow-600">{pendingMembers.length}</div>
              <div className="text-sm text-text-muted">Pending Requests</div>
            </div>
            <div className="bg-surface-raised rounded-lg shadow p-4">
              <div className="text-3xl font-bold text-success">{community.max_members}</div>
              <div className="text-sm text-text-muted">Max Capacity</div>
            </div>
            <div className="bg-surface-raised rounded-lg shadow p-4">
              <div className="text-3xl font-bold text-accent">
                {community.access_type === 'private' ? 'Private' : 'Public'}
              </div>
              <div className="text-sm text-text-muted">Access Type</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-surface-raised rounded-lg shadow">
            <div className="border-b border-border">
              <nav className="flex">
                <button
                  onClick={() => setActiveTab('members')}
                  className={`px-6 py-4 font-medium ${
                    activeTab === 'members'
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  Members ({activeMembers.length})
                </button>
                <button
                  onClick={() => setActiveTab('pending')}
                  className={`px-6 py-4 font-medium relative ${
                    activeTab === 'pending'
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  Pending Requests ({pendingMembers.length})
                  {pendingMembers.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {pendingMembers.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`px-6 py-4 font-medium ${
                    activeTab === 'settings'
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  Settings
                </button>
                <button
                  onClick={() => setActiveTab('config')}
                  className={`px-6 py-4 font-medium ${
                    activeTab === 'config'
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  Configuration
                </button>
                <button
                  onClick={() => {
                    setActiveTab('stats')
                    if (!stats) fetchStats()
                  }}
                  className={`px-6 py-4 font-medium ${
                    activeTab === 'stats'
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  Statistics
                </button>
                <button
                  onClick={() => setActiveTab('export')}
                  className={`px-6 py-4 font-medium ${
                    activeTab === 'export'
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  Export Data
                </button>
              </nav>
            </div>

            <div className="p-6">
              {/* Active Members Tab */}
              {activeTab === 'members' && (
                <div>
                  <h3 className="text-xl font-semibold mb-4">Manage Members</h3>
                  <div className="space-y-3">
                    {activeMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-4 bg-surface rounded-lg"
                      >
                        <div>
                          <div className="font-semibold">{member.user_name}</div>
                          <div className="text-sm text-text-muted">{member.user_email}</div>
                          <div className="text-xs text-text-subtle">
                            Joined {new Date(member.joined_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <select
                            value={member.role}
                            onChange={(e) => handleUpdateMemberRole(member.user_id, e.target.value)}
                            disabled={member.user_id === currentUser?.id || member.user_id === community.creator_id}
                            className="px-3 py-1 border border-border rounded text-sm disabled:bg-border-light"
                          >
                            <option value="member">Member</option>
                            <option value="moderator">Moderator</option>
                            <option value="admin">Admin</option>
                          </select>
                          {member.user_id !== currentUser?.id && member.user_id !== community.creator_id && (
                            <button
                              onClick={() => handleRemoveMember(member.user_id, member.user_name)}
                              className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
                            >
                              Remove
                            </button>
                          )}
                          {member.user_id === community.creator_id && (
                            <span className="px-3 py-1 bg-accent-light text-accent-dark rounded text-sm">
                              Creator
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pending Requests Tab */}
              {activeTab === 'pending' && (
                <div>
                  <h3 className="text-xl font-semibold mb-4">Pending Join Requests</h3>
                  {pendingMembers.length === 0 ? (
                    <p className="text-text-subtle">No pending join requests.</p>
                  ) : (
                    <div className="space-y-3">
                      {pendingMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="font-semibold">{member.user_name}</div>
                            <div className="text-sm text-text-muted">{member.user_email}</div>
                            <div className="text-xs text-text-subtle">
                              Requested {new Date(member.joined_at).toLocaleDateString()}
                            </div>
                            {member.join_request_message && (
                              <div className="mt-2 text-sm text-text-muted bg-surface-raised p-2 rounded border border-yellow-300">
                                <span className="font-medium">Message:</span> {member.join_request_message}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={() => handleApproveMember(member.user_id)}
                              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleRejectMember(member.user_id)}
                              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Settings Tab */}
              {activeTab === 'settings' && editedSettings && (
                <div>
                  <h3 className="text-xl font-semibold mb-4">Community Settings</h3>
                  <p className="text-text-muted mb-6">
                    Configure data retention and reputation decay settings for this community.
                  </p>

                  <div className="space-y-6">
                    {/* Data Retention Section */}
                    <div className="bg-surface rounded-lg p-6">
                      <h4 className="font-semibold text-lg mb-4">Data Retention (TTL)</h4>
                      <p className="text-sm text-text-muted mb-4">
                        Set how long different types of data are kept before automatic cleanup.
                      </p>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-text-muted mb-1">
                            Help Requests (days)
                          </label>
                          <input
                            type="number"
                            value={editedSettings.request_ttl_days}
                            onChange={(e) => setEditedSettings({
                              ...editedSettings,
                              request_ttl_days: parseInt(e.target.value) || 60
                            })}
                            className="w-full px-4 py-2 border border-border rounded"
                            min="1"
                            max="365"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-text-muted mb-1">
                            Help Offers (days)
                          </label>
                          <input
                            type="number"
                            value={editedSettings.offer_ttl_days}
                            onChange={(e) => setEditedSettings({
                              ...editedSettings,
                              offer_ttl_days: parseInt(e.target.value) || 60
                            })}
                            className="w-full px-4 py-2 border border-border rounded"
                            min="1"
                            max="365"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-text-muted mb-1">
                            Completed Matches (days)
                          </label>
                          <input
                            type="number"
                            value={editedSettings.match_ttl_days}
                            onChange={(e) => setEditedSettings({
                              ...editedSettings,
                              match_ttl_days: parseInt(e.target.value) || 90
                            })}
                            className="w-full px-4 py-2 border border-border rounded"
                            min="1"
                            max="365"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-text-muted mb-1">
                            Notifications (days)
                          </label>
                          <input
                            type="number"
                            value={editedSettings.notification_ttl_days}
                            onChange={(e) => setEditedSettings({
                              ...editedSettings,
                              notification_ttl_days: parseInt(e.target.value) || 30
                            })}
                            className="w-full px-4 py-2 border border-border rounded"
                            min="1"
                            max="365"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-text-muted mb-1">
                            Messages (days)
                          </label>
                          <input
                            type="number"
                            value={editedSettings.message_ttl_days}
                            onChange={(e) => setEditedSettings({
                              ...editedSettings,
                              message_ttl_days: parseInt(e.target.value) || 90
                            })}
                            className="w-full px-4 py-2 border border-border rounded"
                            min="1"
                            max="365"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-text-muted mb-1">
                            Sessions (days)
                          </label>
                          <input
                            type="number"
                            value={editedSettings.session_ttl_days}
                            onChange={(e) => setEditedSettings({
                              ...editedSettings,
                              session_ttl_days: parseInt(e.target.value) || 30
                            })}
                            className="w-full px-4 py-2 border border-border rounded"
                            min="1"
                            max="365"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Reputation Decay Section */}
                    <div className="bg-surface rounded-lg p-6">
                      <h4 className="font-semibold text-lg mb-4">Reputation Decay</h4>
                      <p className="text-sm text-text-muted mb-4">
                        Configure how karma decays over time to encourage ongoing participation.
                      </p>
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id="karma_decay_enabled"
                            checked={editedSettings.karma_decay_enabled}
                            onChange={(e) => setEditedSettings({
                              ...editedSettings,
                              karma_decay_enabled: e.target.checked
                            })}
                            className="w-5 h-5 rounded"
                          />
                          <label htmlFor="karma_decay_enabled" className="font-medium">
                            Enable karma decay
                          </label>
                        </div>
                        {editedSettings.karma_decay_enabled && (
                          <div className="ml-8">
                            <label className="block text-sm font-medium text-text-muted mb-1">
                              Decay half-life (months)
                            </label>
                            <p className="text-xs text-text-subtle mb-2">
                              Time for karma to decay to half its value without activity
                            </p>
                            <input
                              type="number"
                              value={editedSettings.karma_half_life_months}
                              onChange={(e) => setEditedSettings({
                                ...editedSettings,
                                karma_half_life_months: parseInt(e.target.value) || 6
                              })}
                              className="w-32 px-4 py-2 border border-border rounded"
                              min="1"
                              max="24"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Save Button */}
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => setEditedSettings(settings)}
                        className="px-6 py-2 bg-gray-200 text-text-muted rounded hover:bg-gray-300"
                      >
                        Reset
                      </button>
                      <button
                        onClick={handleSaveSettings}
                        disabled={saving}
                        className="px-6 py-2 bg-primary text-white rounded hover:bg-primary-dark disabled:bg-primary-medium"
                      >
                        {saving ? 'Saving...' : 'Save Settings'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Configuration Tab */}
              {activeTab === 'config' && editedConfig && (
                <div>
                  <h3 className="text-xl font-semibold mb-4">Community Configuration</h3>
                  <p className="text-text-muted mb-6">
                    Configure your community's trust mechanics, karma distribution, and coordination rules.
                    These settings define how karma, trust, and coordination work in your community.
                  </p>

                  {/* Configuration Resources */}
                  {community.creator_id === currentUser?.id && (
                    <div className="bg-primary-light border border-primary-medium rounded-lg p-4 mb-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-primary-dark">Need Inspiration?</h4>
                          <p className="text-sm text-primary-dark mt-1">
                            Explore configurations from thriving communities
                          </p>
                        </div>
                        <Link
                          href="/communities/configs/public"
                          className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark text-sm font-medium transition-colors"
                        >
                          View Thriving Communities →
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* Founder-only check */}
                  {community.creator_id !== currentUser?.id ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                      <h4 className="font-semibold text-yellow-900 mb-2">Founder Access Only</h4>
                      <p className="text-yellow-800">
                        Only the community founder can modify the configuration. You can view the current settings below.
                      </p>
                      <div className="mt-4">
                        <CommunityConfigEditor
                          config={config!}
                          onChange={() => {}} // No-op for read-only
                          readOnly={true}
                          errors={{}}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <CommunityConfigEditor
                        config={editedConfig}
                        onChange={(newConfig) => {
                          setEditedConfig(newConfig)
                          // Clear errors when config changes
                          setConfigErrors({})
                        }}
                        errors={configErrors}
                      />

                      {/* Save Button */}
                      <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
                        <button
                          onClick={() => {
                            setEditedConfig(config)
                            setConfigErrors({})
                          }}
                          className="px-6 py-2 bg-gray-200 text-text-muted rounded hover:bg-gray-300"
                        >
                          Reset
                        </button>
                        <button
                          onClick={handleSaveConfig}
                          disabled={configSaving}
                          className="px-6 py-2 bg-primary text-white rounded hover:bg-primary-dark disabled:bg-primary-medium"
                        >
                          {configSaving ? 'Saving...' : 'Save Configuration'}
                        </button>
                      </div>

                      {/* Warning Message */}
                      <div className="mt-4 bg-primary-light border border-primary-medium rounded-lg p-4">
                        <p className="text-sm text-primary-dark">
                          <strong>Note:</strong> Configuration changes affect how trust scores, karma distribution,
                          and request types work. Existing data is not recalculated when you change these settings.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Statistics Tab */}
              {activeTab === 'stats' && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold">Community Statistics</h3>
                    <button
                      onClick={fetchStats}
                      disabled={loadingStats}
                      className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark disabled:bg-primary-medium"
                    >
                      {loadingStats ? 'Refreshing...' : 'Refresh'}
                    </button>
                  </div>

                  {loadingStats && !stats && (
                    <div className="text-center py-12">
                      <div className="text-text-subtle">Loading statistics...</div>
                    </div>
                  )}

                  {stats && (
                    <div className="space-y-6">
                      {/* Community Health Score */}
                      <div className="bg-gradient-to-br from-primary-light to-accent-light border border-primary-medium rounded-lg p-6">
                        <h4 className="text-lg font-semibold mb-4 text-primary-dark">Community Health Score</h4>
                        <div className="flex items-center gap-6">
                          <div className="flex-shrink-0">
                            <div className="w-32 h-32 rounded-full bg-surface-raised shadow-lg flex items-center justify-center">
                              <div className="text-center">
                                <div className="text-4xl font-bold text-primary">
                                  {Math.min(100, Math.round(
                                    (stats.matches?.completed_matches || 0) * 2 +
                                    (stats.requests?.open_requests || 0) * 0.5 +
                                    (stats.members?.active_members || 0) * 1.5
                                  ))}
                                </div>
                                <div className="text-sm text-text-muted">/ 100</div>
                              </div>
                            </div>
                          </div>
                          <div className="flex-1">
                            <p className="text-text-muted mb-3">
                              Your community health is calculated based on member engagement, help exchanges, and active requests.
                            </p>
                            <div className="grid grid-cols-3 gap-3">
                              <div className="bg-surface-raised rounded p-3">
                                <div className="text-xs text-text-muted">Engagement</div>
                                <div className="text-lg font-bold text-success">
                                  {stats.matches?.matches_completed_this_month > 5 ? 'High' : stats.matches?.matches_completed_this_month > 2 ? 'Medium' : 'Low'}
                                </div>
                              </div>
                              <div className="bg-surface-raised rounded p-3">
                                <div className="text-xs text-text-muted">Activity</div>
                                <div className="text-lg font-bold text-primary">
                                  {stats.requests?.requests_this_week > 3 ? 'High' : stats.requests?.requests_this_week > 1 ? 'Medium' : 'Low'}
                                </div>
                              </div>
                              <div className="bg-surface-raised rounded p-3">
                                <div className="text-xs text-text-muted">Growth</div>
                                <div className="text-lg font-bold text-accent">
                                  {stats.members?.active_members > community.current_members * 0.8 ? 'Strong' : 'Steady'}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Key Metrics Grid */}
                      <div className="grid md:grid-cols-4 gap-4">
                        <div className="bg-surface-raised rounded-lg shadow p-4 border-l-4 border-primary">
                          <div className="text-sm text-text-muted mb-1">Total Exchanges</div>
                          <div className="text-3xl font-bold text-primary">{stats.matches?.completed_matches || 0}</div>
                          <div className="text-xs text-text-subtle mt-1">
                            {stats.matches?.matches_completed_this_month || 0} this month
                          </div>
                        </div>
                        <div className="bg-surface-raised rounded-lg shadow p-4 border-l-4 border-karmyq-teal-500">
                          <div className="text-sm text-text-muted mb-1">Active Requests</div>
                          <div className="text-3xl font-bold text-success">{stats.requests?.open_requests || 0}</div>
                          <div className="text-xs text-text-subtle mt-1">
                            {stats.requests?.matched_requests || 0} matched
                          </div>
                        </div>
                        <div className="bg-surface-raised rounded-lg shadow p-4 border-l-4 border-karmyq-orange-500">
                          <div className="text-sm text-text-muted mb-1">Avg Karma</div>
                          <div className="text-3xl font-bold text-accent">{stats.karma?.avg_karma || 0}</div>
                          <div className="text-xs text-text-subtle mt-1">
                            Max: {stats.karma?.max_karma || 0}
                          </div>
                        </div>
                        <div className="bg-surface-raised rounded-lg shadow p-4 border-l-4 border-karmyq-brown-500">
                          <div className="text-sm text-text-muted mb-1">This Week</div>
                          <div className="text-3xl font-bold text-karmyq-orange-600">{stats.matches?.matches_completed_this_week || 0}</div>
                          <div className="text-xs text-text-subtle mt-1">
                            {stats.requests?.requests_this_week || 0} requests
                          </div>
                        </div>
                      </div>

                      {/* Top Contributors */}
                      <div className="grid md:grid-cols-2 gap-6">
                        {/* Top Helpers */}
                        <div className="bg-surface-raised rounded-lg shadow p-6">
                          <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <span className="text-2xl">🏆</span>
                            Top Helpers This Month
                          </h4>
                          {stats.topHelpers && stats.topHelpers.length > 0 ? (
                            <div className="space-y-3">
                              {stats.topHelpers.map((helper: any, index: number) => (
                                <div key={helper.user_id} className="flex items-center justify-between p-3 bg-surface rounded">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                                      index === 0 ? 'bg-yellow-500' :
                                      index === 1 ? 'bg-gray-400' :
                                      index === 2 ? 'bg-orange-600' :
                                      'bg-gray-300'
                                    }`}>
                                      {index + 1}
                                    </div>
                                    <div>
                                      <div className="font-semibold">{helper.name}</div>
                                      <div className="text-sm text-text-muted">{helper.help_count} helps</div>
                                    </div>
                                  </div>
                                  {helper.avg_karma && (
                                    <div className="text-sm text-accent font-semibold">
                                      {helper.avg_karma} karma
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-text-subtle">No helpers this month yet.</p>
                          )}
                        </div>

                        {/* Top Requesters */}
                        <div className="bg-surface-raised rounded-lg shadow p-6">
                          <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <span className="text-2xl">📋</span>
                            Top Requesters This Month
                          </h4>
                          {stats.topRequesters && stats.topRequesters.length > 0 ? (
                            <div className="space-y-3">
                              {stats.topRequesters.map((requester: any, index: number) => (
                                <div key={requester.user_id} className="flex items-center justify-between p-3 bg-surface rounded">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                                      index === 0 ? 'bg-primary' :
                                      index === 1 ? 'bg-primary' :
                                      index === 2 ? 'bg-primary-medium' :
                                      'bg-gray-300'
                                    }`}>
                                      {index + 1}
                                    </div>
                                    <div>
                                      <div className="font-semibold">{requester.name}</div>
                                      <div className="text-sm text-text-muted">{requester.request_count} requests</div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-text-subtle">No requests this month yet.</p>
                          )}
                        </div>
                      </div>

                      {/* Activity Chart - Last 30 Days */}
                      <div className="bg-surface-raised rounded-lg shadow p-6">
                        <h4 className="text-lg font-semibold mb-4">Activity Trend (Last 30 Days)</h4>
                        {stats.dailyActivity && stats.dailyActivity.length > 0 ? (
                          <div className="space-y-4">
                            <div className="flex gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-primary rounded"></div>
                                <span>Requests</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-success-light0 rounded"></div>
                                <span>Matches</span>
                              </div>
                            </div>
                            <div className="h-64 flex items-end justify-between gap-1">
                              {stats.dailyActivity.slice(0, 30).reverse().map((day: any, index: number) => {
                                const maxValue = Math.max(
                                  ...stats.dailyActivity.map((d: any) => Math.max(d.requests || 0, d.matches || 0))
                                );
                                const requestHeight = maxValue > 0 ? ((day.requests || 0) / maxValue) * 100 : 0;
                                const matchHeight = maxValue > 0 ? ((day.matches || 0) / maxValue) * 100 : 0;

                                return (
                                  <div key={index} className="flex-1 flex flex-col items-center gap-1 group relative">
                                    <div className="w-full flex flex-col justify-end h-56 gap-0.5">
                                      <div
                                        className="w-full bg-primary rounded-t hover:bg-primary transition-all"
                                        style={{ height: `${requestHeight}%`, minHeight: day.requests > 0 ? '4px' : '0' }}
                                        title={`${day.requests} requests`}
                                      ></div>
                                      <div
                                        className="w-full bg-success-light0 hover:bg-green-600 transition-all"
                                        style={{ height: `${matchHeight}%`, minHeight: day.matches > 0 ? '4px' : '0' }}
                                        title={`${day.matches} matches`}
                                      ></div>
                                    </div>
                                    {index % 5 === 0 && (
                                      <div className="text-xs text-text-subtle transform rotate-45 origin-top-left mt-1">
                                        {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                      </div>
                                    )}
                                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full mt-12 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                                      {new Date(day.date).toLocaleDateString()}<br/>
                                      Requests: {day.requests || 0}<br/>
                                      Matches: {day.matches || 0}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <p className="text-text-subtle">No activity data available.</p>
                        )}
                      </div>

                      {/* Summary Stats */}
                      <div className="bg-surface rounded-lg p-6">
                        <h4 className="text-lg font-semibold mb-4">Summary</h4>
                        <div className="grid md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="font-medium text-text-muted mb-2">Members</div>
                            <ul className="space-y-1 text-text-muted">
                              <li>• {stats.members?.active_members || 0} active</li>
                              <li>• {stats.members?.pending_members || 0} pending</li>
                              <li>• {stats.members?.admin_count || 0} admins</li>
                              <li>• {stats.members?.moderator_count || 0} moderators</li>
                            </ul>
                          </div>
                          <div>
                            <div className="font-medium text-text-muted mb-2">Requests</div>
                            <ul className="space-y-1 text-text-muted">
                              <li>• {stats.requests?.total_requests || 0} total</li>
                              <li>• {stats.requests?.open_requests || 0} open</li>
                              <li>• {stats.requests?.matched_requests || 0} matched</li>
                              <li>• {stats.requests?.completed_requests || 0} completed</li>
                            </ul>
                          </div>
                          <div>
                            <div className="font-medium text-text-muted mb-2">Matches</div>
                            <ul className="space-y-1 text-text-muted">
                              <li>• {stats.matches?.total_matches || 0} total</li>
                              <li>• {stats.matches?.proposed_matches || 0} proposed</li>
                              <li>• {stats.matches?.active_matches || 0} active</li>
                              <li>• {stats.matches?.completed_matches || 0} completed</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Export Data Tab */}
              {activeTab === 'export' && (
                <div>
                  <h3 className="text-xl font-semibold mb-4">Export Community Data</h3>
                  <p className="text-text-muted mb-6">
                    Download community data in JSON or CSV format for reporting or backup purposes.
                  </p>

                  <div className="space-y-6">
                    {/* Full Export */}
                    <div className="bg-surface rounded-lg p-6">
                      <h4 className="font-semibold text-lg mb-2">Full Community Export</h4>
                      <p className="text-sm text-text-muted mb-4">
                        Export all community data including members, requests, matches, norms, settings, and karma records.
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleExport('full', 'json')}
                          disabled={exporting}
                          className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark disabled:bg-primary-medium"
                        >
                          {exporting ? 'Exporting...' : 'Export JSON'}
                        </button>
                        <button
                          onClick={() => handleExport('full', 'csv')}
                          disabled={exporting}
                          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-green-400"
                        >
                          {exporting ? 'Exporting...' : 'Export CSV'}
                        </button>
                      </div>
                    </div>

                    {/* Members Export */}
                    <div className="bg-surface rounded-lg p-6">
                      <h4 className="font-semibold text-lg mb-2">Members List</h4>
                      <p className="text-sm text-text-muted mb-4">
                        Export a list of all community members with their roles and join dates.
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleExport('members', 'json')}
                          disabled={exporting}
                          className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark disabled:bg-primary-medium"
                        >
                          {exporting ? 'Exporting...' : 'Export JSON'}
                        </button>
                        <button
                          onClick={() => handleExport('members', 'csv')}
                          disabled={exporting}
                          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-green-400"
                        >
                          {exporting ? 'Exporting...' : 'Export CSV'}
                        </button>
                      </div>
                    </div>

                    {/* Activity Report */}
                    <div className="bg-surface rounded-lg p-6">
                      <h4 className="font-semibold text-lg mb-2">Activity Report</h4>
                      <p className="text-sm text-text-muted mb-4">
                        Export member activity including karma, trust scores, helps given and received.
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleExport('activity', 'json')}
                          disabled={exporting}
                          className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark disabled:bg-primary-medium"
                        >
                          {exporting ? 'Exporting...' : 'Export JSON'}
                        </button>
                        <button
                          onClick={() => handleExport('activity', 'csv')}
                          disabled={exporting}
                          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-green-400"
                        >
                          {exporting ? 'Exporting...' : 'Export CSV'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Layout>
    </>
  )
}
