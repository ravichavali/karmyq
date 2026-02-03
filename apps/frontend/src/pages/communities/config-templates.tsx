/**
 * Configuration Templates Browser
 *
 * Allows users to browse available community configuration templates
 * when creating a new community. Templates provide pre-configured
 * starting points for different community types.
 */

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { communityService } from '../../lib/api'
import { ConfigTemplate } from '../../types/community-config'

export default function ConfigTemplates() {
  const router = useRouter()
  const [templates, setTemplates] = useState<ConfigTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'usage' | 'name' | 'created_at'>('usage')

  useEffect(() => {
    fetchTemplates()
  }, [sortBy])

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const response = await communityService.getConfigTemplates({
        sort_by: sortBy,
        public_only: true,
      })
      setTemplates(response.data || [])
      setError(null)
    } catch (err: any) {
      console.error('Error fetching templates:', err)
      setError(err.response?.data?.error || 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  const handleUseTemplate = (templateId: string) => {
    router.push(`/communities/new?template=${templateId}`)
  }

  const getTemplateHighlights = (template: ConfigTemplate) => [
    {
      label: 'Members',
      value: `Up to ${template.member_cap}`,
    },
    {
      label: 'Visibility',
      value: template.visibility_mode.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    },
    {
      label: 'Karma Split',
      value: `${template.karma_split_helper}% helper / ${template.karma_split_requestor}% requestor`,
    },
    {
      label: 'Request Types',
      value: `${template.enabled_request_types.length} types`,
    },
    {
      label: 'Trust Model',
      value: `${(template.trust_depth_weight * 100).toFixed(0)}% depth / ${(template.trust_breadth_weight * 100).toFixed(0)}% breadth`,
    },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading templates...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Community Configuration Templates</h1>
          <p className="text-lg text-gray-600">
            Choose a starting point for your community's configuration
          </p>
        </div>

        {/* Sort Controls */}
        <div className="flex justify-between items-center mb-6">
          <p className="text-sm text-gray-600">
            {templates.length} {templates.length === 1 ? 'template' : 'templates'} available
          </p>
          <div className="flex items-center space-x-2">
            <label htmlFor="sort" className="text-sm font-medium text-gray-700">
              Sort by:
            </label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="usage">Most Used</option>
              <option value="name">Name (A-Z)</option>
              <option value="created_at">Recently Added</option>
            </select>
          </div>
        </div>

        {/* Templates Grid */}
        {templates.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No templates available</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <div
                key={template.id}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden"
              >
                {/* Card Header */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 text-white">
                  <div className="flex justify-between items-start">
                    <h2 className="text-xl font-bold">{template.name}</h2>
                    <span className="bg-white/20 px-2 py-1 rounded-full text-xs font-semibold">
                      Used {template.usage_count}x
                    </span>
                  </div>
                  <p className="text-blue-100 text-sm mt-2">{template.description}</p>
                </div>

                {/* Card Body */}
                <div className="px-6 py-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Key Highlights</h3>
                  <div className="space-y-2">
                    {getTemplateHighlights(template).map((highlight, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-gray-600">{highlight.label}:</span>
                        <span className="font-medium text-gray-900">{highlight.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Request Types Preview */}
                  {template.enabled_request_types.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-xs font-semibold text-gray-600 mb-2">Request Types:</h4>
                      <div className="flex flex-wrap gap-2">
                        {template.enabled_request_types.slice(0, 3).map((type, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                          >
                            {type.name.replace(/_/g, ' ')}
                          </span>
                        ))}
                        {template.enabled_request_types.length > 3 && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                            +{template.enabled_request_types.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                  <button
                    onClick={() => handleUseTemplate(template.id)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition-colors duration-200"
                  >
                    Use This Template
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Back Button */}
        <div className="mt-8 text-center">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  )
}
