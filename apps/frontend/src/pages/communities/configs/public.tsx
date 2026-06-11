/**
 * Thriving Communities - Browse and Copy Configurations
 *
 * Allows users to browse configurations from successful communities
 * and copy them to their own founded communities.
 */

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { communityService } from '../../../lib/api'
import Layout from '../../../components/Layout'
import { CommunityConfig } from '../../../types/community-config'
import { getErrorMessage } from '../../../lib/errors'

interface ThrivingCommunity {
  id: string
  name: string
  description: string
  member_count: number
  config: CommunityConfig
}

interface MyFoundedCommunity {
  id: string
  name: string
}

export default function ThrivingCommunitiesPage() {
  const router = useRouter()
  const [communities, setCommunities] = useState<ThrivingCommunity[]>([])
  const [myFoundedCommunities, setMyFoundedCommunities] = useState<MyFoundedCommunity[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [minMembers, setMinMembers] = useState(5)
  const [expandedCommunity, setExpandedCommunity] = useState<string | null>(null)
  const [copyModalOpen, setCopyModalOpen] = useState(false)
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [selectedTargetId, setSelectedTargetId] = useState('')
  const [includeRequestTypes, setIncludeRequestTypes] = useState(true)
  const [copying, setCopying] = useState(false)

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
    if (currentUser) {
      fetchThrivingCommunities()
      fetchMyFoundedCommunities()
    }
  }, [currentUser, minMembers])

  const fetchThrivingCommunities = async () => {
    try {
      setLoading(true)
      const response = await communityService.getThrivingCommunities(minMembers)
      // Backend returns community_id, but frontend expects id
      const communities = (response.data.communities || []).map((c: any) => ({
        ...c,
        id: c.community_id || c.id,
      }))
      setCommunities(communities)
      setError(null)
    } catch (err: any) {
      console.error('Error fetching thriving communities', { error: err instanceof Error ? err.message : String(err) })
      setError(getErrorMessage(err, 'Failed to load communities'))
    } finally {
      setLoading(false)
    }
  }

  const fetchMyFoundedCommunities = async () => {
    try {
      const response = await communityService.getMyCommunities(currentUser.id)
      // Filter only founded communities (where user is creator)
      const founded = (response.data.communities || [])
        .filter((c: any) => c.creator_id === currentUser.id)
        .map((c: any) => ({ id: c.id, name: c.name }))
      setMyFoundedCommunities(founded)
    } catch (err: any) {
      console.error('Error fetching my communities', { error: err instanceof Error ? err.message : String(err) })
    }
  }

  const handleOpenCopyModal = (communityId: string) => {
    if (myFoundedCommunities.length === 0) {
      alert('You must be a founder of at least one community to copy configurations.')
      return
    }
    setSelectedSourceId(communityId)
    setSelectedTargetId(myFoundedCommunities[0]?.id || '')
    setCopyModalOpen(true)
  }

  const handleCopyConfig = async () => {
    if (!selectedSourceId || !selectedTargetId) return

    setCopying(true)
    try {
      await communityService.copyConfigFrom(selectedTargetId, selectedSourceId, includeRequestTypes)
      alert('Configuration copied successfully!')
      setCopyModalOpen(false)
      setSelectedSourceId(null)
      setSelectedTargetId('')
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to copy configuration')
    } finally {
      setCopying(false)
    }
  }

  const getConfigHighlights = (config: CommunityConfig) => [
    {
      label: 'Member Cap',
      value: config.member_cap?.toString() || 'N/A',
    },
    {
      label: 'Visibility',
      value: config.visibility_mode?.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Public',
    },
    {
      label: 'Karma Split',
      value: `${config.karma_split_helper || 0}% / ${config.karma_split_requestor || 0}%`,
    },
    {
      label: 'Trust Model',
      value: `${((config.trust_depth_weight || 0) * 100).toFixed(0)}% depth / ${((config.trust_breadth_weight || 0) * 100).toFixed(0)}% breadth`,
    },
  ]

  if (loading && communities.length === 0) {
    return (
      <Layout title="Thriving Communities">
        <div className="min-h-screen bg-surface py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-text-muted">Loading communities...</p>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <>
      <Head>
        <title>Thriving Communities - Karmyq</title>
      </Head>
      <Layout title="Thriving Communities">
        <div className="min-h-screen bg-surface py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-text mb-2">Thriving Communities</h1>
              <p className="text-lg text-text-muted">
                Browse configurations from successful communities and copy them to yours
              </p>
            </div>

            {/* Filters */}
            <div className="flex justify-between items-center mb-6 bg-surface-raised rounded-lg shadow p-4">
              <div>
                <p className="text-sm text-text-muted">
                  Showing <span className="font-semibold">{communities.length}</span>{' '}
                  {communities.length === 1 ? 'community' : 'communities'} with {minMembers}+ members
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <label htmlFor="minMembers" className="text-sm font-medium text-text-muted">
                  Minimum members:
                </label>
                <select
                  id="minMembers"
                  value={minMembers}
                  onChange={(e) => setMinMembers(Number(e.target.value))}
                  className="px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value={5}>5+</option>
                  <option value={10}>10+</option>
                  <option value={25}>25+</option>
                  <option value={50}>50+</option>
                  <option value={100}>100+</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
                <p className="text-red-800">{error}</p>
              </div>
            )}

            {/* Communities Grid */}
            {communities.length === 0 ? (
              <div className="bg-surface-raised rounded-lg shadow p-12 text-center">
                <p className="text-text-muted text-lg">
                  No communities found with {minMembers}+ members. Try lowering the minimum member count.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {communities.map((community) => (
                  <div
                    key={community.id}
                    className="bg-surface-raised rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200"
                  >
                    {/* Community Header */}
                    <div className="px-6 py-4 border-b border-border">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h2 className="text-xl font-bold text-text">{community.name}</h2>
                          <p className="text-text-muted mt-1">{community.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-text-subtle">
                            <span className="flex items-center gap-1">
                              👥 <strong>{community.member_count}</strong> members
                            </span>
                            {community.config.template_source && (
                              <span className="flex items-center gap-1">
                                📋 Template: <strong>{community.config.template_source}</strong>
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setExpandedCommunity(expandedCommunity === community.id ? null : community.id)
                            }
                            className="px-4 py-2 bg-border-light text-text-muted rounded hover:bg-gray-200 text-sm font-medium"
                          >
                            {expandedCommunity === community.id ? 'Hide Details' : 'View Details'}
                          </button>
                          {myFoundedCommunities.length > 0 && (
                            <button
                              onClick={() => handleOpenCopyModal(community.id)}
                              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark text-sm font-medium"
                            >
                              Copy Configuration
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Configuration Preview */}
                    <div className="px-6 py-4">
                      <h3 className="text-sm font-semibold text-text-muted mb-3">Configuration Highlights</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {getConfigHighlights(community.config).map((highlight, idx) => (
                          <div key={idx} className="bg-surface rounded-lg p-3">
                            <div className="text-xs text-text-muted mb-1">{highlight.label}</div>
                            <div className="font-semibold text-text">{highlight.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Request Types Preview */}
                      {community.config.enabled_request_types?.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-xs font-semibold text-text-muted mb-2">Request Types:</h4>
                          <div className="flex flex-wrap gap-2">
                            {community.config.enabled_request_types.map((type, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary-light text-primary-dark"
                              >
                                {type.name?.replace(/_/g, ' ') || type.name}
                                <span className="ml-2 text-xs text-primary">
                                  ({type.karma_multiplier}x)
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Expanded Details */}
                    {expandedCommunity === community.id && (
                      <div className="px-6 py-4 bg-surface border-t border-border">
                        <h3 className="text-sm font-semibold text-text-muted mb-3">Full Configuration</h3>
                        <div className="grid md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <h4 className="font-semibold text-text mb-2">Identity & Boundaries</h4>
                            <ul className="space-y-1 text-text-muted">
                              <li>• Member Cap: {community.config.member_cap}</li>
                              <li>• Visibility: {community.config.visibility_mode}</li>
                              <li>
                                • Outsider Response:{' '}
                                {community.config.outsider_response_allowed ? 'Allowed' : 'Not Allowed'}
                              </li>
                            </ul>
                          </div>
                          <div>
                            <h4 className="font-semibold text-text mb-2">Karma Mechanics</h4>
                            <ul className="space-y-1 text-text-muted">
                              <li>• Helper Split: {community.config.karma_split_helper}%</li>
                              <li>• Requestor Split: {community.config.karma_split_requestor}%</li>
                              <li>• Base Pool: {community.config.base_karma_pool_per_request}</li>
                              <li>• Decay Half-Life: {community.config.karma_decay_half_life_days} days</li>
                            </ul>
                          </div>
                          <div>
                            <h4 className="font-semibold text-text mb-2">Trust Mechanics</h4>
                            <ul className="space-y-1 text-text-muted">
                              <li>• Depth Weight: {(community.config.trust_depth_weight * 100).toFixed(0)}%</li>
                              <li>
                                • Breadth Weight: {(community.config.trust_breadth_weight * 100).toFixed(0)}%
                              </li>
                              <li>• Max Hops: {community.config.trust_path_max_hops}</li>
                              <li>• Min Interactions: {community.config.min_interactions_for_trust}</li>
                            </ul>
                          </div>
                          <div>
                            <h4 className="font-semibold text-text mb-2">Onboarding</h4>
                            <ul className="space-y-1 text-text-muted">
                              <li>
                                • Request Approval:{' '}
                                {community.config.request_approval_required ? 'Required' : 'Not Required'}
                              </li>
                              <li>• Karma Lockout: {community.config.new_member_karma_lockout_days} days</li>
                              <li>
                                • Join Approval:{' '}
                                {community.config.join_approval_required ? 'Required' : 'Not Required'}
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Info Banner */}
            {myFoundedCommunities.length === 0 && (
              <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h3 className="font-semibold text-yellow-900 mb-2">Founder Access Required</h3>
                <p className="text-yellow-800">
                  Only community founders can copy configurations. Create a community to start copying
                  configurations from thriving communities.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Copy Configuration Modal */}
        {copyModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
            <div className="bg-surface-raised rounded-lg p-8 max-w-md w-full">
              <h3 className="text-2xl font-bold mb-4">Copy Configuration</h3>
              <p className="text-text-muted mb-6">
                Select which community you want to copy this configuration to. This will override your
                current configuration.
              </p>

              <div className="space-y-4">
                <div>
                  <label htmlFor="targetCommunity" className="block text-sm font-medium text-text-muted mb-2">
                    Target Community
                  </label>
                  <select
                    id="targetCommunity"
                    value={selectedTargetId}
                    onChange={(e) => setSelectedTargetId(e.target.value)}
                    className="w-full px-4 py-2 border border-border rounded focus:ring-2 focus:ring-primary"
                  >
                    {myFoundedCommunities.map((community) => (
                      <option key={community.id} value={community.id}>
                        {community.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-start">
                  <input
                    type="checkbox"
                    id="includeRequestTypes"
                    checked={includeRequestTypes}
                    onChange={(e) => setIncludeRequestTypes(e.target.checked)}
                    className="mt-1 h-4 w-4 text-primary focus:ring-primary border-border rounded"
                  />
                  <label htmlFor="includeRequestTypes" className="ml-3">
                    <span className="text-sm font-medium text-text-muted">Include request types</span>
                    <p className="text-xs text-text-subtle mt-1">
                      Copy the request types along with other configuration settings
                    </p>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleCopyConfig}
                  disabled={copying}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark disabled:bg-primary-medium"
                >
                  {copying ? 'Copying...' : 'Copy Configuration'}
                </button>
                <button
                  onClick={() => {
                    setCopyModalOpen(false)
                    setSelectedSourceId(null)
                  }}
                  className="px-4 py-2 bg-gray-200 text-text-muted rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>

              <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded p-3">
                <p className="text-xs text-yellow-800">
                  <strong>Warning:</strong> This will replace your current configuration. This action cannot be
                  undone.
                </p>
              </div>
            </div>
          </div>
        )}
      </Layout>
    </>
  )
}
