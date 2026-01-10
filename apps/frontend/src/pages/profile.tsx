import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { api, communityService, reputationService, userSettingsService } from '@/lib/api'
import InvitationChain, { InvitationChainSkeleton } from '@/components/InvitationChain'
import { useInvitationChain } from '@/hooks/useInvitationChain'

const AVAILABLE_SKILLS = [
  'driving',
  'moving',
  'childcare',
  'pet_care',
  'tech_support',
  'coding',
  'home_repair',
  'handyman',
  'electrical',
  'plumbing',
  'carpentry',
  'gardening',
  'cooking',
  'baking',
  'tutoring',
  'languages',
  'career_advice',
  'design',
  'writing',
  'photography',
  'music',
  'art',
  'cleaning',
  'organizing'
]

interface UserSkill {
  id: string
  skill: string
  created_at: string
}

interface Community {
  id: string
  name: string
  description: string
  current_members: number
  max_members: number
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [skills, setSkills] = useState<UserSkill[]>([])
  const [communities, setCommunities] = useState<Community[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showSkillSelector, setShowSkillSelector] = useState(false)
  const [selectedSkill, setSelectedSkill] = useState('')

  // Profile editing states
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [bio, setBio] = useState('')

  // Karma & privacy states
  const [karmaData, setKarmaData] = useState<any>(null)
  const [loadingKarma, setLoadingKarma] = useState(false)
  const [showKarmaToMe, setShowKarmaToMe] = useState(false)
  const [selectedCommunityId, setSelectedCommunityId] = useState<string>('')

  // Fetch invitation chain
  const { chain: invitationChain, loading: loadingChain } = useInvitationChain({ enabled: !!user })

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')

    if (!token) {
      router.push('/login')
      return
    }

    if (userData) {
      const parsedUser = JSON.parse(userData)
      setUser(parsedUser)
      setName(parsedUser.name || '')
      setEmail(parsedUser.email || '')
      setBio(parsedUser.bio || '')
      fetchUserSkills(parsedUser.id)
      fetchUserCommunities(parsedUser.id)
      fetchPrivacySettings()
    }
  }, [router])

  // Fetch karma when privacy settings or selected community changes
  useEffect(() => {
    if (showKarmaToMe && selectedCommunityId) {
      fetchKarmaData(selectedCommunityId)
    }
  }, [showKarmaToMe, selectedCommunityId])

  const fetchUserCommunities = async (userId: string) => {
    try {
      const response = await communityService.getMyCommunities(userId)
      const communitiesData = response.data.data || []
      setCommunities(communitiesData)

      // Set first community as selected for karma display
      if (communitiesData.length > 0 && !selectedCommunityId) {
        setSelectedCommunityId(communitiesData[0].id)
      }
    } catch (err: any) {
      console.error('Failed to load communities:', err)
    }
  }

  const fetchPrivacySettings = async () => {
    try {
      const response = await userSettingsService.getPrivacySettings()
      // Access the nested data property since the interceptor isn't unwrapping correctly
      const settings = response.data || response
      setShowKarmaToMe(settings.show_my_karma_to_me || false)
    } catch (err: any) {
      console.error('Failed to load privacy settings:', err)
    }
  }

  const fetchKarmaData = async (communityId: string) => {
    if (!communityId || !showKarmaToMe) return

    try {
      setLoadingKarma(true)
      const response = await reputationService.getMyKarma(communityId)
      setKarmaData(response)
    } catch (err: any) {
      console.error('Failed to load karma:', err)
      setKarmaData(null)
    } finally {
      setLoadingKarma(false)
    }
  }

  const handleToggleKarmaDisplay = async () => {
    try {
      setSaving(true)
      const newValue = !showKarmaToMe
      await userSettingsService.updatePrivacySettings({ show_my_karma_to_me: newValue })
      setShowKarmaToMe(newValue)

      if (newValue && selectedCommunityId) {
        // Fetch karma data when enabling
        await fetchKarmaData(selectedCommunityId)
      } else {
        // Clear karma data when disabling
        setKarmaData(null)
      }

      setSuccess(newValue ? 'Karma display enabled' : 'Karma display disabled')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update settings')
      setTimeout(() => setError(''), 3000)
    } finally {
      setSaving(false)
    }
  }

  const fetchUserSkills = async (userId: string) => {
    try {
      setLoading(true)
      const response = await api.get(`/users/${userId}/skills`)
      setSkills(response.data.data || [])
    } catch (err: any) {
      console.error('Failed to load skills:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddSkill = async () => {
    if (!user || !selectedSkill) return

    // Check if skill already exists
    if (skills.some(s => s.skill === selectedSkill)) {
      setError('You already have this skill')
      setTimeout(() => setError(''), 3000)
      return
    }

    try {
      setSaving(true)
      await api.post(`/users/${user.id}/skills`, { skill: selectedSkill })
      await fetchUserSkills(user.id)
      setSelectedSkill('')
      setShowSkillSelector(false)
      setSuccess('Skill added successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add skill')
      setTimeout(() => setError(''), 3000)
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveSkill = async (skillId: string) => {
    if (!user) return

    try {
      await api.delete(`/users/${user.id}/skills/${skillId}`)
      await fetchUserSkills(user.id)
      setSuccess('Skill removed successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to remove skill')
      setTimeout(() => setError(''), 3000)
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      setSaving(true)
      const response = await api.put(`/users/${user.id}`, {
        name,
        bio
      })

      // Update local storage
      const updatedUser = { ...user, name, bio }
      localStorage.setItem('user', JSON.stringify(updatedUser))
      setUser(updatedUser)
      setEditing(false)
      setSuccess('Profile updated successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update profile')
      setTimeout(() => setError(''), 3000)
    } finally {
      setSaving(false)
    }
  }

  const availableSkillsToAdd = AVAILABLE_SKILLS.filter(
    skill => !skills.some(s => s.skill === skill)
  )

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading profile...</div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>My Profile - Karmyq</title>
      </Head>
      <Layout>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">My Profile</h1>
            <p className="text-gray-600">
              Manage your profile information and skills to help match you with relevant requests
            </p>
          </div>

          {/* Success/Error Messages */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
              {success}
            </div>
          )}

          {/* Profile Information */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-semibold">Profile Information</h2>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Edit Profile
                </button>
              )}
            </div>

            {editing ? (
              <form onSubmit={handleUpdateProfile}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-100 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bio
                    </label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Tell others about yourself..."
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(false)
                        setName(user.name)
                        setBio(user.bio || '')
                      }}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">Name</label>
                  <p className="text-gray-900">{user.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p className="text-gray-900">{user.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Bio</label>
                  <p className="text-gray-900">{user.bio || 'No bio added yet'}</p>
                </div>
              </div>
            )}
          </div>

          {/* Karma Section */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">⭐</span>
                <div>
                  <h2 className="text-xl font-semibold">Karma & Reputation</h2>
                  <p className="text-sm text-gray-600">
                    {showKarmaToMe ? 'Private view - only you can see this' : 'Enable to track your contribution'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleToggleKarmaDisplay}
                disabled={saving}
                className={`px-4 py-2 text-sm rounded transition-colors ${
                  showKarmaToMe
                    ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                } disabled:opacity-50`}
              >
                {saving ? 'Saving...' : showKarmaToMe ? 'Hide Karma' : 'Show My Karma'}
              </button>
            </div>

            {/* Community Selector */}
            {showKarmaToMe && communities.length > 1 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Community
                </label>
                <select
                  value={selectedCommunityId}
                  onChange={(e) => setSelectedCommunityId(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {communities.map((community) => (
                    <option key={community.id} value={community.id}>
                      {community.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {showKarmaToMe ? (
              loadingKarma ? (
                <div className="text-center py-8 text-gray-500">Loading karma data...</div>
              ) : karmaData ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <p className="text-3xl font-bold text-blue-600">{karmaData.karma || 0}</p>
                      <p className="text-sm text-gray-600 mt-1">Karma Points</p>
                      {karmaData.trend && (
                        <p className="text-xs text-gray-500 mt-1">
                          {karmaData.trend === 'growing' && '📈 Growing'}
                          {karmaData.trend === 'stable' && '➡️ Stable'}
                          {karmaData.trend === 'declining' && '📉 Declining'}
                        </p>
                      )}
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <p className="text-3xl font-bold text-green-600">{karmaData.recent_helps || 0}</p>
                      <p className="text-sm text-gray-600 mt-1">Recent Helps</p>
                      <p className="text-xs text-gray-500 mt-1">Last 30 days</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4 text-center">
                      <p className="text-3xl font-bold text-purple-600">{karmaData.recent_requests || 0}</p>
                      <p className="text-sm text-gray-600 mt-1">Recent Requests</p>
                      <p className="text-xs text-gray-500 mt-1">Last 30 days</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4 text-center">
                      <p className="text-3xl font-bold text-orange-600">-</p>
                      <p className="text-sm text-gray-600 mt-1">Trust Score</p>
                      <p className="text-xs text-gray-500 mt-1">Coming soon</p>
                    </div>
                  </div>

                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      💡 <strong>About Karma:</strong> Your karma decays over time (6-month half-life) to reflect recent contributions.
                      Keep helping others to maintain and grow your score!
                    </p>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-2">No karma data available yet</p>
                  <p className="text-sm text-gray-500">Start helping others in your communities to earn karma!</p>
                </div>
              )
            ) : (
              <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
                <p className="text-gray-700 mb-3">
                  <strong>Privacy First:</strong> Your karma is private by default.
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  Enable karma display to track your contributions and see how they decay over time.
                  This helps you understand your activity patterns and stay engaged.
                </p>
                <button
                  onClick={handleToggleKarmaDisplay}
                  className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Enable Karma Display
                </button>
              </div>
            )}
          </div>

          {/* Communities Section */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-semibold mb-1">My Communities</h2>
                <p className="text-sm text-gray-600">
                  Communities you're a member of
                </p>
              </div>
              <Link
                href="/communities"
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Discover More
              </Link>
            </div>

            {communities.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-gray-600 mb-4">You're not a member of any communities yet</p>
                <Link
                  href="/communities"
                  className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Discover Communities
                </Link>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {communities.map((community) => (
                  <Link
                    key={community.id}
                    href={`/communities/${community.id}`}
                    className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <h3 className="font-semibold text-gray-900 mb-2">{community.name}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">{community.description}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">
                        {community.current_members} members
                      </span>
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${(community.current_members / community.max_members) * 100}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Invitation Chain Section */}
          <div className="mb-6">
            <div className="mb-3">
              <h2 className="text-xl font-semibold mb-1">How You Joined</h2>
              <p className="text-sm text-gray-600">
                Your invitation chain shows how you became part of the community
              </p>
            </div>

            {loadingChain ? (
              <InvitationChainSkeleton />
            ) : (
              <InvitationChain
                chain={invitationChain}
                currentUserId={user?.id || ''}
              />
            )}

            <div className="mt-4 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm">
                <p className="font-medium text-blue-900 mb-1">Want to invite others?</p>
                <p className="text-blue-800">
                  Visit the <Link href="/invitations" className="underline font-medium">invitations page</Link> to generate invite codes and grow the network.
                </p>
              </div>
            </div>
          </div>

          {/* Skills Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-semibold mb-1">My Skills</h2>
                <p className="text-sm text-gray-600">
                  Add skills to help match you with requests you can help with
                </p>
              </div>
              {!showSkillSelector && (
                <button
                  onClick={() => setShowSkillSelector(true)}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                >
                  + Add Skill
                </button>
              )}
            </div>

            {/* Add Skill Form */}
            {showSkillSelector && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h3 className="font-medium mb-2">Add a New Skill</h3>
                <div className="flex gap-2">
                  <select
                    value={selectedSkill}
                    onChange={(e) => setSelectedSkill(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a skill...</option>
                    {availableSkillsToAdd.map((skill) => (
                      <option key={skill} value={skill}>
                        {skill.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddSkill}
                    disabled={!selectedSkill || saving}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowSkillSelector(false)
                      setSelectedSkill('')
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Skills List */}
            {skills.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="mb-2">No skills added yet</p>
                <p className="text-sm">Add skills to get matched with relevant help requests</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <div
                    key={skill.id}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-800 rounded-full"
                  >
                    <span className="font-medium">
                      {skill.skill.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                    <button
                      onClick={() => handleRemoveSkill(skill.id)}
                      className="text-blue-600 hover:text-blue-800 font-bold"
                      title="Remove skill"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Skill Impact Info */}
            {skills.length > 0 && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                <p className="text-sm text-green-800">
                  💡 <strong>Your skills help us match you</strong> with relevant help requests on your dashboard.
                  The more skills you add, the more opportunities you'll see to help others!
                </p>
              </div>
            )}
          </div>
        </div>
      </Layout>
    </>
  )
}
