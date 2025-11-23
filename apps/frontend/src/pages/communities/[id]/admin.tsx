import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { communityService } from '@/lib/api'
import Layout from '@/components/Layout'

interface Member {
  id: string
  user_id: string
  user_name: string
  user_email: string
  role: string
  status: string
  joined_at: string
  invited_by_name?: string
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
  const [activeTab, setActiveTab] = useState<'members' | 'pending' | 'settings' | 'export'>('members')
  const [exporting, setExporting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editedSettings, setEditedSettings] = useState<CommunitySettings | null>(null)

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
    }
  }, [id])

  const fetchCommunity = async () => {
    try {
      setLoading(true)
      const response = await communityService.getCommunity(id as string)
      setCommunity(response.data.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load community')
    } finally {
      setLoading(false)
    }
  }

  const fetchSettings = async () => {
    try {
      const response = await communityService.getSettings(id as string)
      setSettings(response.data.data)
      setEditedSettings(response.data.data)
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
        <div className="text-gray-500">Loading...</div>
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
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
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
                className="text-blue-600 hover:text-blue-800 mb-2 inline-block"
              >
                ← Back to Community
              </Link>
              <h1 className="text-3xl font-bold">{community.name} - Admin Panel</h1>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-3xl font-bold text-blue-600">{activeMembers.length}</div>
              <div className="text-sm text-gray-600">Active Members</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-3xl font-bold text-yellow-600">{pendingMembers.length}</div>
              <div className="text-sm text-gray-600">Pending Requests</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-3xl font-bold text-green-600">{community.max_members}</div>
              <div className="text-sm text-gray-600">Max Capacity</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-3xl font-bold text-purple-600">
                {community.access_type === 'private' ? 'Private' : 'Public'}
              </div>
              <div className="text-sm text-gray-600">Access Type</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-lg shadow">
            <div className="border-b border-gray-200">
              <nav className="flex">
                <button
                  onClick={() => setActiveTab('members')}
                  className={`px-6 py-4 font-medium ${
                    activeTab === 'members'
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Members ({activeMembers.length})
                </button>
                <button
                  onClick={() => setActiveTab('pending')}
                  className={`px-6 py-4 font-medium relative ${
                    activeTab === 'pending'
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-600 hover:text-gray-800'
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
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Settings
                </button>
                <button
                  onClick={() => setActiveTab('export')}
                  className={`px-6 py-4 font-medium ${
                    activeTab === 'export'
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-600 hover:text-gray-800'
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
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <div className="font-semibold">{member.user_name}</div>
                          <div className="text-sm text-gray-600">{member.user_email}</div>
                          <div className="text-xs text-gray-500">
                            Joined {new Date(member.joined_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <select
                            value={member.role}
                            onChange={(e) => handleUpdateMemberRole(member.user_id, e.target.value)}
                            disabled={member.user_id === currentUser?.id || member.user_id === community.creator_id}
                            className="px-3 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-100"
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
                            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded text-sm">
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
                    <p className="text-gray-500">No pending join requests.</p>
                  ) : (
                    <div className="space-y-3">
                      {pendingMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg"
                        >
                          <div>
                            <div className="font-semibold">{member.user_name}</div>
                            <div className="text-sm text-gray-600">{member.user_email}</div>
                            <div className="text-xs text-gray-500">
                              Requested {new Date(member.joined_at).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
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
                  <p className="text-gray-600 mb-6">
                    Configure data retention and reputation decay settings for this community.
                  </p>

                  <div className="space-y-6">
                    {/* Data Retention Section */}
                    <div className="bg-gray-50 rounded-lg p-6">
                      <h4 className="font-semibold text-lg mb-4">Data Retention (TTL)</h4>
                      <p className="text-sm text-gray-600 mb-4">
                        Set how long different types of data are kept before automatic cleanup.
                      </p>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Help Requests (days)
                          </label>
                          <input
                            type="number"
                            value={editedSettings.request_ttl_days}
                            onChange={(e) => setEditedSettings({
                              ...editedSettings,
                              request_ttl_days: parseInt(e.target.value) || 60
                            })}
                            className="w-full px-4 py-2 border border-gray-300 rounded"
                            min="1"
                            max="365"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Help Offers (days)
                          </label>
                          <input
                            type="number"
                            value={editedSettings.offer_ttl_days}
                            onChange={(e) => setEditedSettings({
                              ...editedSettings,
                              offer_ttl_days: parseInt(e.target.value) || 60
                            })}
                            className="w-full px-4 py-2 border border-gray-300 rounded"
                            min="1"
                            max="365"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Completed Matches (days)
                          </label>
                          <input
                            type="number"
                            value={editedSettings.match_ttl_days}
                            onChange={(e) => setEditedSettings({
                              ...editedSettings,
                              match_ttl_days: parseInt(e.target.value) || 90
                            })}
                            className="w-full px-4 py-2 border border-gray-300 rounded"
                            min="1"
                            max="365"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Notifications (days)
                          </label>
                          <input
                            type="number"
                            value={editedSettings.notification_ttl_days}
                            onChange={(e) => setEditedSettings({
                              ...editedSettings,
                              notification_ttl_days: parseInt(e.target.value) || 30
                            })}
                            className="w-full px-4 py-2 border border-gray-300 rounded"
                            min="1"
                            max="365"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Messages (days)
                          </label>
                          <input
                            type="number"
                            value={editedSettings.message_ttl_days}
                            onChange={(e) => setEditedSettings({
                              ...editedSettings,
                              message_ttl_days: parseInt(e.target.value) || 90
                            })}
                            className="w-full px-4 py-2 border border-gray-300 rounded"
                            min="1"
                            max="365"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Sessions (days)
                          </label>
                          <input
                            type="number"
                            value={editedSettings.session_ttl_days}
                            onChange={(e) => setEditedSettings({
                              ...editedSettings,
                              session_ttl_days: parseInt(e.target.value) || 30
                            })}
                            className="w-full px-4 py-2 border border-gray-300 rounded"
                            min="1"
                            max="365"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Reputation Decay Section */}
                    <div className="bg-gray-50 rounded-lg p-6">
                      <h4 className="font-semibold text-lg mb-4">Reputation Decay</h4>
                      <p className="text-sm text-gray-600 mb-4">
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
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Decay half-life (months)
                            </label>
                            <p className="text-xs text-gray-500 mb-2">
                              Time for karma to decay to half its value without activity
                            </p>
                            <input
                              type="number"
                              value={editedSettings.karma_half_life_months}
                              onChange={(e) => setEditedSettings({
                                ...editedSettings,
                                karma_half_life_months: parseInt(e.target.value) || 6
                              })}
                              className="w-32 px-4 py-2 border border-gray-300 rounded"
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
                        className="px-6 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        Reset
                      </button>
                      <button
                        onClick={handleSaveSettings}
                        disabled={saving}
                        className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400"
                      >
                        {saving ? 'Saving...' : 'Save Settings'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Export Data Tab */}
              {activeTab === 'export' && (
                <div>
                  <h3 className="text-xl font-semibold mb-4">Export Community Data</h3>
                  <p className="text-gray-600 mb-6">
                    Download community data in JSON or CSV format for reporting or backup purposes.
                  </p>

                  <div className="space-y-6">
                    {/* Full Export */}
                    <div className="bg-gray-50 rounded-lg p-6">
                      <h4 className="font-semibold text-lg mb-2">Full Community Export</h4>
                      <p className="text-sm text-gray-600 mb-4">
                        Export all community data including members, requests, matches, norms, settings, and karma records.
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleExport('full', 'json')}
                          disabled={exporting}
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400"
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
                    <div className="bg-gray-50 rounded-lg p-6">
                      <h4 className="font-semibold text-lg mb-2">Members List</h4>
                      <p className="text-sm text-gray-600 mb-4">
                        Export a list of all community members with their roles and join dates.
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleExport('members', 'json')}
                          disabled={exporting}
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400"
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
                    <div className="bg-gray-50 rounded-lg p-6">
                      <h4 className="font-semibold text-lg mb-2">Activity Report</h4>
                      <p className="text-sm text-gray-600 mb-4">
                        Export member activity including karma, trust scores, helps given and received.
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleExport('activity', 'json')}
                          disabled={exporting}
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400"
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
