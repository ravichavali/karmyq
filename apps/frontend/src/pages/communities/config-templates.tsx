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
import { getErrorMessage } from '../../lib/errors'

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
      // Backend returns { success: true, data: { templates: [...] } }
      setTemplates(response.data.templates || [])
      setError(null)
    } catch (err: any) {
      console.error('Error fetching templates', { error: err instanceof Error ? err.message : String(err) })
      setError(getErrorMessage(err, 'Failed to load templates'))
    } finally {
      setLoading(false)
    }
  }

  const handleUseTemplate = (templateId: string) => {
    router.push(`/communities/new?template=${templateId}`)
  }

  const getTemplateHighlights = (template: ConfigTemplate) => {
    // Backend returns templates with nested full_config
    const config = (template as any).full_config || template
    return [
      {
        label: 'Members',
        value: `Up to ${config.member_cap}`,
      },
      {
        label: 'Visibility',
        value: config.visibility_mode?.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Public',
      },
      {
        label: 'Karma Split',
        value: `${config.karma_split_helper}% helper / ${config.karma_split_requestor}% requestor`,
      },
      {
        label: 'Request Types',
        value: `${config.enabled_request_types?.length || 0} types`,
      },
      {
        label: 'Trust Model',
        value: `${(config.trust_depth_weight * 100).toFixed(0)}% depth / ${(config.trust_breadth_weight * 100).toFixed(0)}% breadth`,
      },
    ]
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-text-muted">Loading templates...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-text mb-2">Community Configuration Templates</h1>
          <p className="text-lg text-text-muted">
            Choose a starting point for your community's configuration
          </p>
        </div>

        {/* Sort Controls */}
        <div className="flex justify-between items-center mb-6">
          <p className="text-sm text-text-muted">
            {templates.length} {templates.length === 1 ? 'template' : 'templates'} available
          </p>
          <div className="flex items-center space-x-2">
            <label htmlFor="sort" className="text-sm font-medium text-text-muted">
              Sort by:
            </label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-border rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-primary"
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
            <p className="text-text-muted">No templates available</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <div
                key={template.id}
                className="bg-surface-raised rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden"
              >
                {/* Card Header */}
                <div className="bg-gradient-to-r from-primary to-primary px-6 py-4 text-white">
                  <div className="flex justify-between items-start">
                    <h2 className="text-xl font-bold">{template.name}</h2>
                    <span className="bg-surface-raised/20 px-2 py-1 rounded-full text-xs font-semibold">
                      Used {template.usage_count}x
                    </span>
                  </div>
                  <p className="text-primary-light text-sm mt-2">{template.description}</p>
                </div>

                {/* Card Body */}
                <div className="px-6 py-4">
                  <h3 className="text-sm font-semibold text-text-muted mb-3">Key Highlights</h3>
                  <div className="space-y-2">
                    {getTemplateHighlights(template).map((highlight, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-text-muted">{highlight.label}:</span>
                        <span className="font-medium text-text">{highlight.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Request Types Preview */}
                  {(() => {
                    const config = (template as any).full_config || template
                    const requestTypes = config.enabled_request_types || []
                    return requestTypes.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-xs font-semibold text-text-muted mb-2">Request Types:</h4>
                        <div className="flex flex-wrap gap-2">
                          {requestTypes.slice(0, 3).map((type: any, idx: number) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-border-light text-text-muted"
                            >
                              {type.name?.replace(/_/g, ' ') || type.name}
                            </span>
                          ))}
                          {requestTypes.length > 3 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-border-light text-text-muted">
                              +{requestTypes.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* Card Footer */}
                <div className="px-6 py-4 bg-surface border-t border-border">
                  <button
                    onClick={() => handleUseTemplate(template.id)}
                    className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-2 px-4 rounded-md transition-colors duration-200"
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
            className="text-primary hover:text-primary-dark font-medium"
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  )
}
