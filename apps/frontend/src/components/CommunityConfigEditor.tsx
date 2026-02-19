/**
 * CommunityConfigEditor - Comprehensive configuration editor for community settings
 *
 * @component
 * @param {Object} props
 * @param {CommunityConfig} props.config - Current configuration
 * @param {Function} props.onChange - Callback when config changes
 * @param {boolean} props.readOnly - If true, disable editing (default: false)
 * @param {Record<string, string>} props.errors - Validation error messages by field
 *
 * @example
 * <CommunityConfigEditor
 *   config={communityConfig}
 *   onChange={setConfig}
 *   readOnly={!isFounder}
 *   errors={validationErrors}
 * />
 */

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { CommunityConfig, RequestType } from '../types/community-config'
import { REQUEST_TYPES } from './requests/RequestTypeSelector'
import { requestService } from '../lib/api'

interface CommunityConfigEditorProps {
  config: CommunityConfig
  onChange: (config: CommunityConfig) => void
  readOnly?: boolean
  errors?: Record<string, string>
}

export default function CommunityConfigEditor({
  config,
  onChange,
  readOnly = false,
  errors = {},
}: CommunityConfigEditorProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('identity')
  const [allRequestTypes, setAllRequestTypes] = useState(REQUEST_TYPES)

  // Normalize enabled_request_types: filter to only known built-in names.
  // If none match (e.g. seed data has legacy names like meal_share/tool_borrow),
  // default all 5 built-in types as enabled.
  const normalizedConfig = useMemo(() => {
    const validNames = new Set<string>(REQUEST_TYPES.map((t) => t.value as string))
    const validTypes = (config.enabled_request_types ?? []).filter((rt) => validNames.has(rt.name as string))
    if (validTypes.length === 0) {
      return {
        ...config,
        enabled_request_types: REQUEST_TYPES.map((t) => ({
          name: t.value,
          description: t.description,
          karma_multiplier: 1.0,
        })),
      }
    }
    return { ...config, enabled_request_types: validTypes }
  }, [config])

  useEffect(() => {
    requestService.getSchemas().then((res) => {
      const published = res.data?.schemas ?? []
      const builtinValues = new Set(REQUEST_TYPES.map((t) => t.value))
      const custom = published
        .filter((s: any) => !builtinValues.has(s.type))
        .map((s: any) => ({
          value: s.type,
          label: s.label,
          description: s.description || '',
          example: '',
          icon: s.icon || '📋',
          color: s.color || 'bg-surface border-border',
        }))
      if (custom.length > 0) {
        setAllRequestTypes([...REQUEST_TYPES, ...custom])
      }
    }).catch(() => {
      // Silently fall back to built-in types if schema fetch fails
    })
  }, [])

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  const handleFieldChange = (field: keyof CommunityConfig, value: any) => {
    const updated = { ...config, [field]: value }

    // Auto-adjust trust weights to sum to 1.0
    if (field === 'trust_depth_weight') {
      updated.trust_breadth_weight = 1.0 - Number(value)
    } else if (field === 'trust_breadth_weight') {
      updated.trust_depth_weight = 1.0 - Number(value)
    }

    onChange(updated)
  }

  const handleRequestTypeChange = (index: number, field: keyof RequestType, value: any) => {
    const updatedTypes = [...normalizedConfig.enabled_request_types]
    updatedTypes[index] = { ...updatedTypes[index], [field]: value }
    onChange({ ...normalizedConfig, enabled_request_types: updatedTypes })
  }

  const addRequestType = () => {
    const newType: RequestType = {
      name: '',
      description: '',
      karma_multiplier: 1.0,
    }
    onChange({
      ...normalizedConfig,
      enabled_request_types: [...normalizedConfig.enabled_request_types, newType],
    })
  }

  const removeRequestType = (index: number) => {
    const updatedTypes = normalizedConfig.enabled_request_types.filter((_, i) => i !== index)
    onChange({ ...normalizedConfig, enabled_request_types: updatedTypes })
  }

  const SectionHeader = ({ title, section }: { title: string; section: string }) => (
    <button
      type="button"
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between p-4 bg-surface hover:bg-border-light rounded-lg transition-colors"
    >
      <h3 className="text-lg font-semibold text-text">{title}</h3>
      <svg
        className={`w-5 h-5 transform transition-transform ${
          expandedSection === section ? 'rotate-180' : ''
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  )

  const InputField = ({
    label,
    field,
    type = 'number',
    min,
    max,
    step,
    helpText,
  }: {
    label: string
    field: keyof CommunityConfig
    type?: string
    min?: number
    max?: number
    step?: number
    helpText?: string
  }) => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-text-muted mb-1">{label}</label>
      <input
        type={type}
        value={config[field] as any}
        onChange={(e) => handleFieldChange(field, type === 'number' ? Number(e.target.value) : e.target.value)}
        disabled={readOnly}
        min={min}
        max={max}
        step={step}
        className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary ${
          errors[field] ? 'border-red-500' : 'border-border'
        } disabled:bg-border-light disabled:cursor-not-allowed`}
      />
      {helpText && <p className="text-xs text-text-subtle mt-1">{helpText}</p>}
      {errors[field] && <p className="text-xs text-red-500 mt-1">{errors[field]}</p>}
    </div>
  )

  const SelectField = ({
    label,
    field,
    options,
    helpText,
  }: {
    label: string
    field: keyof CommunityConfig
    options: { value: string; label: string }[]
    helpText?: string
  }) => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-text-muted mb-1">{label}</label>
      <select
        value={config[field] as any}
        onChange={(e) => handleFieldChange(field, e.target.value)}
        disabled={readOnly}
        className="w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-border-light disabled:cursor-not-allowed"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {helpText && <p className="text-xs text-text-subtle mt-1">{helpText}</p>}
    </div>
  )

  const CheckboxField = ({
    label,
    field,
    helpText,
  }: {
    label: string
    field: keyof CommunityConfig
    helpText?: string
  }) => (
    <div className="mb-4 flex items-start">
      <input
        type="checkbox"
        checked={config[field] as any}
        onChange={(e) => handleFieldChange(field, e.target.checked)}
        disabled={readOnly}
        className="mt-1 h-4 w-4 text-primary focus:ring-primary border-border rounded disabled:cursor-not-allowed"
      />
      <div className="ml-3">
        <label className="text-sm font-medium text-text-muted">{label}</label>
        {helpText && <p className="text-xs text-text-subtle mt-1">{helpText}</p>}
      </div>
    </div>
  )

  const SliderField = ({
    label,
    field,
    min,
    max,
    step,
    helpText,
  }: {
    label: string
    field: keyof CommunityConfig
    min: number
    max: number
    step: number
    helpText?: string
  }) => {
    const value = Number(config[field])
    return (
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <label className="text-sm font-medium text-text-muted">{label}</label>
          <span className="text-sm font-semibold text-primary">{value}</span>
        </div>
        <input
          type="range"
          value={value}
          onChange={(e) => handleFieldChange(field, Number(e.target.value))}
          disabled={readOnly}
          min={min}
          max={max}
          step={step}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed"
        />
        <div className="flex justify-between text-xs text-text-subtle mt-1">
          <span>{min}</span>
          <span>{max}</span>
        </div>
        {helpText && <p className="text-xs text-text-subtle mt-1">{helpText}</p>}
        {errors[field] && <p className="text-xs text-red-500 mt-1">{errors[field]}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Section 1: Identity & Boundaries */}
      <div className="border border-border rounded-lg">
        <SectionHeader title="Identity & Boundaries" section="identity" />
        {expandedSection === 'identity' && (
          <div className="p-4 space-y-4">
            <InputField
              label="Member Cap"
              field="member_cap"
              min={10}
              max={150}
              helpText="Maximum community size (10-150). Based on Dunbar's number."
            />
            <SelectField
              label="Visibility Mode"
              field="visibility_mode"
              options={[
                { value: 'public', label: 'Public - Anyone can see requests' },
                { value: 'members_only', label: 'Members Only - Private community' },
                { value: 'hybrid', label: 'Hybrid - Public listings, member details' },
              ]}
              helpText="Controls who can see community activity"
            />
            <CheckboxField
              label="Allow Outsider Responses"
              field="outsider_response_allowed"
              helpText="Allow non-members to respond to public requests"
            />
          </div>
        )}
      </div>

      {/* Section 2: Request Types */}
      <div className="border border-border rounded-lg">
        <SectionHeader title="Request Types" section="request_types" />
        {expandedSection === 'request_types' && (
          <div className="p-4 space-y-4">
            <p className="text-sm text-text-muted mb-4">
              Choose which types of requests your community supports. You can adjust the karma
              multiplier for each type to reflect its impact.
            </p>

            {/* Visual type selector grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {allRequestTypes.map((type) => {
                const enabledIndex = normalizedConfig.enabled_request_types.findIndex(
                  (rt) => rt.name === type.value
                )
                const isEnabled = enabledIndex >= 0
                const currentMultiplier = isEnabled
                  ? normalizedConfig.enabled_request_types[enabledIndex].karma_multiplier
                  : 1.0

                return (
                  <div
                    key={type.value}
                    className={`relative border-2 rounded-lg p-4 transition-all ${
                      isEnabled
                        ? 'border-primary bg-primary-light shadow-sm'
                        : 'border-border bg-surface-raised hover:border-border'
                    } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
                    onClick={() => {
                      if (readOnly) return
                      if (isEnabled) {
                        // Don't remove if it's the last type
                        if (normalizedConfig.enabled_request_types.length > 1) {
                          removeRequestType(enabledIndex)
                        }
                      } else {
                        onChange({
                          ...normalizedConfig,
                          enabled_request_types: [
                            ...normalizedConfig.enabled_request_types,
                            { name: type.value, description: type.description, karma_multiplier: 1.0 },
                          ],
                        })
                      }
                    }}
                  >
                    {/* Checkbox indicator */}
                    <div className="absolute top-3 right-3">
                      <div
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                          isEnabled
                            ? 'bg-primary border-primary'
                            : 'border-border bg-surface-raised'
                        }`}
                      >
                        {isEnabled && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-3 pr-6">
                      <span className="text-2xl flex-shrink-0">{type.icon}</span>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-text text-sm">{type.label}</h4>
                        <p className="text-xs text-text-subtle mt-0.5">{type.description}</p>
                      </div>
                    </div>

                    {/* Karma multiplier slider (only when enabled) */}
                    {isEnabled && (
                      <div
                        className="mt-3 pt-3 border-t border-primary-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-xs font-medium text-text-muted">
                            Karma Multiplier
                          </label>
                          <span className="text-xs font-semibold text-primary">
                            {currentMultiplier}x
                          </span>
                        </div>
                        <input
                          type="range"
                          value={currentMultiplier}
                          onChange={(e) =>
                            handleRequestTypeChange(enabledIndex, 'karma_multiplier', Number(e.target.value))
                          }
                          disabled={readOnly}
                          min={0.5}
                          max={2.0}
                          step={0.1}
                          className="w-full h-1 bg-primary-light rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed"
                        />
                        <div className="flex justify-between text-xs text-text-subtle mt-0.5">
                          <span>0.5x</span>
                          <span>2.0x</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="bg-surface border border-border rounded-md p-3">
              <p className="text-xs text-text-muted">
                <strong>{normalizedConfig.enabled_request_types.length}</strong> type{normalizedConfig.enabled_request_types.length !== 1 ? 's' : ''} enabled.
                Members will only be able to create requests of the types you select.
              </p>
            </div>

            {!readOnly && (
              <p className="text-xs text-text-muted">
                Want a custom type?{' '}
                <Link href="/admin/schemas" className="text-primary underline hover:text-primary-dark">
                  Open Schema Manager →
                </Link>
              </p>
            )}

            {errors.request_types && (
              <p className="text-xs text-red-500 mt-2">{errors.request_types}</p>
            )}
          </div>
        )}
      </div>

      {/* Section 3: Karma Mechanics */}
      <div className="border border-border rounded-lg">
        <SectionHeader title="Karma Mechanics" section="karma" />
        {expandedSection === 'karma' && (
          <div className="p-4 space-y-4">
            <SliderField
              label="Karma Split - Helper"
              field="karma_split_helper"
              min={0}
              max={100}
              step={5}
              helpText="Percentage of karma pool awarded to helper (0-100)"
            />
            <SliderField
              label="Karma Split - Requestor"
              field="karma_split_requestor"
              min={-50}
              max={100}
              step={5}
              helpText="Percentage awarded to requestor (-50 to 100). Negative discourages asking."
            />
            <div className="bg-primary-light border border-primary-medium rounded-md p-3">
              <p className="text-xs text-primary-dark">
                <strong>Total: {config.karma_split_helper + config.karma_split_requestor}%</strong>
                {config.karma_split_helper + config.karma_split_requestor > 100 && (
                  <span> - Generous system (creates karma)</span>
                )}
                {config.karma_split_helper + config.karma_split_requestor === 100 && (
                  <span> - Balanced system</span>
                )}
                {config.karma_split_helper + config.karma_split_requestor < 100 && (
                  <span> - Conservative system (destroys karma)</span>
                )}
              </p>
            </div>
            <InputField
              label="Base Karma Pool Per Request"
              field="base_karma_pool_per_request"
              min={10}
              max={1000}
              step={10}
              helpText="Base karma available per request (before type multiplier)"
            />
            <InputField
              label="Karma Decay Half-Life (Days)"
              field="karma_decay_half_life_days"
              min={0}
              max={365}
              helpText="Days for karma to decay to 50% (0 = no decay)"
            />
          </div>
        )}
      </div>

      {/* Section 4: Trust Mechanics */}
      <div className="border border-border rounded-lg">
        <SectionHeader title="Trust Mechanics" section="trust" />
        {expandedSection === 'trust' && (
          <div className="p-4 space-y-4">
            <div>
              <SliderField
                label="Trust Depth Weight"
                field="trust_depth_weight"
                min={0}
                max={1}
                step={0.1}
                helpText="Weight for repeated interactions with same people (0.0-1.0)"
              />
              <SliderField
                label="Trust Breadth Weight"
                field="trust_breadth_weight"
                min={0}
                max={1}
                step={0.1}
                helpText="Weight for network diversity (0.0-1.0)"
              />
              {errors.trust_weights && (
                <p className="text-xs text-red-500 mt-2">{errors.trust_weights}</p>
              )}
              <div className="bg-primary-light border border-primary-medium rounded-md p-3 mt-2">
                <p className="text-xs text-primary-dark">
                  <strong>
                    Sum: {(config.trust_depth_weight + config.trust_breadth_weight).toFixed(2)}
                  </strong>
                  {Math.abs(config.trust_depth_weight + config.trust_breadth_weight - 1.0) < 0.01 ? (
                    <span> ✓ Valid</span>
                  ) : (
                    <span> ⚠️ Must equal 1.0</span>
                  )}
                </p>
              </div>
            </div>
            <InputField
              label="Trust Decay Half-Life (Days)"
              field="trust_decay_half_life_days"
              min={30}
              max={365}
              helpText="Days for trust to decay to 50% without interaction"
            />
            <InputField
              label="Trust Path Max Hops"
              field="trust_path_max_hops"
              min={1}
              max={5}
              helpText="Maximum degrees of separation for trust paths (1-5)"
            />
            <InputField
              label="Min Interactions for Trust"
              field="min_interactions_for_trust"
              min={1}
              max={10}
              helpText="Minimum completed interactions to establish trust (1-10)"
            />
          </div>
        )}
      </div>

      {/* Section 5: Community Onboarding */}
      <div className="border border-border rounded-lg">
        <SectionHeader title="Community Onboarding" section="onboarding" />
        {expandedSection === 'onboarding' && (
          <div className="p-4 space-y-4">
            <CheckboxField
              label="Request Approval Required"
              field="request_approval_required"
              helpText="New requests must be approved before visible"
            />
            <InputField
              label="New Member Karma Lockout (Days)"
              field="new_member_karma_lockout_days"
              min={0}
              max={30}
              helpText="Days new members wait before earning karma (0-30)"
            />
            <CheckboxField
              label="Join Approval Required"
              field="join_approval_required"
              helpText="Founder must approve new member join requests"
            />
            <CheckboxField
              label="Joining Counts as Interaction"
              field="joining_counts_as_interaction"
              helpText="Count joining as first interaction for trust building"
            />
          </div>
        )}
      </div>
    </div>
  )
}
