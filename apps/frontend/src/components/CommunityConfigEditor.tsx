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

import React, { useState } from 'react'
import { CommunityConfig, RequestType } from '../types/community-config'

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
    const updatedTypes = [...config.enabled_request_types]
    updatedTypes[index] = { ...updatedTypes[index], [field]: value }
    onChange({ ...config, enabled_request_types: updatedTypes })
  }

  const addRequestType = () => {
    const newType: RequestType = {
      name: '',
      description: '',
      karma_multiplier: 1.0,
    }
    onChange({
      ...config,
      enabled_request_types: [...config.enabled_request_types, newType],
    })
  }

  const removeRequestType = (index: number) => {
    const updatedTypes = config.enabled_request_types.filter((_, i) => i !== index)
    onChange({ ...config, enabled_request_types: updatedTypes })
  }

  const SectionHeader = ({ title, section }: { title: string; section: string }) => (
    <button
      type="button"
      onClick={() => toggleSection(section)}
      disabled={readOnly}
      className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors disabled:cursor-not-allowed"
    >
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
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
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={config[field] as any}
        onChange={(e) => handleFieldChange(field, type === 'number' ? Number(e.target.value) : e.target.value)}
        disabled={readOnly}
        min={min}
        max={max}
        step={step}
        className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          errors[field] ? 'border-red-500' : 'border-gray-300'
        } disabled:bg-gray-100 disabled:cursor-not-allowed`}
      />
      {helpText && <p className="text-xs text-gray-500 mt-1">{helpText}</p>}
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
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select
        value={config[field] as any}
        onChange={(e) => handleFieldChange(field, e.target.value)}
        disabled={readOnly}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {helpText && <p className="text-xs text-gray-500 mt-1">{helpText}</p>}
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
        className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:cursor-not-allowed"
      />
      <div className="ml-3">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        {helpText && <p className="text-xs text-gray-500 mt-1">{helpText}</p>}
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
          <label className="text-sm font-medium text-gray-700">{label}</label>
          <span className="text-sm font-semibold text-blue-600">{value}</span>
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
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{min}</span>
          <span>{max}</span>
        </div>
        {helpText && <p className="text-xs text-gray-500 mt-1">{helpText}</p>}
        {errors[field] && <p className="text-xs text-red-500 mt-1">{errors[field]}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Section 1: Identity & Boundaries */}
      <div className="border border-gray-200 rounded-lg">
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
      <div className="border border-gray-200 rounded-lg">
        <SectionHeader title="Request Types" section="request_types" />
        {expandedSection === 'request_types' && (
          <div className="p-4 space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              Define the types of requests your community supports. Each type has a karma multiplier
              to adjust reward based on impact.
            </p>
            {config.enabled_request_types.map((reqType, index) => (
              <div key={index} className="border border-gray-200 rounded-md p-3 bg-gray-50">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-sm font-semibold text-gray-700">Request Type {index + 1}</h4>
                  {!readOnly && config.enabled_request_types.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRequestType(index)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={reqType.name}
                      onChange={(e) => handleRequestTypeChange(index, 'name', e.target.value)}
                      disabled={readOnly}
                      placeholder="e.g., meal_share"
                      className={`w-full px-2 py-1 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors[`enabled_request_types[${index}].name`]
                          ? 'border-red-500'
                          : 'border-gray-300'
                      } disabled:bg-gray-100`}
                    />
                    {errors[`enabled_request_types[${index}].name`] && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors[`enabled_request_types[${index}].name`]}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">Use lowercase_underscore format</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={reqType.description}
                      onChange={(e) => handleRequestTypeChange(index, 'description', e.target.value)}
                      disabled={readOnly}
                      placeholder="e.g., Share meals or cooking"
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Karma Multiplier ({reqType.karma_multiplier}x)
                    </label>
                    <input
                      type="range"
                      value={reqType.karma_multiplier}
                      onChange={(e) =>
                        handleRequestTypeChange(index, 'karma_multiplier', Number(e.target.value))
                      }
                      disabled={readOnly}
                      min={0.5}
                      max={2.0}
                      step={0.1}
                      className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0.5x (Low impact)</span>
                      <span>2.0x (High impact)</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {!readOnly && (
              <button
                type="button"
                onClick={addRequestType}
                className="w-full py-2 px-4 border-2 border-dashed border-gray-300 rounded-md text-sm font-medium text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
              >
                + Add Request Type
              </button>
            )}
            {errors.request_types && (
              <p className="text-xs text-red-500 mt-2">{errors.request_types}</p>
            )}
          </div>
        )}
      </div>

      {/* Section 3: Karma Mechanics */}
      <div className="border border-gray-200 rounded-lg">
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
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-xs text-blue-800">
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
      <div className="border border-gray-200 rounded-lg">
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
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mt-2">
                <p className="text-xs text-blue-800">
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
      <div className="border border-gray-200 rounded-lg">
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
