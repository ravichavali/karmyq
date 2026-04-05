/**
 * Trust Model Utilities
 *
 * Pure utilities for diffing and formatting community configs.
 * The questionnaire questions and answersToConfig logic are now data-driven —
 * see `answersToConfig.ts` (logic) and `hooks/useTrustQuestions.ts` (data fetch).
 */

import type { CommunityConfig } from '../types/community-config'

// ---------------------------------------------------------------------------
// Questionnaire answer type — question UUID → choice value
// ---------------------------------------------------------------------------

export type TrustQuestionnaireAnswers = Record<string, string>

// ---------------------------------------------------------------------------
// Human-readable labels for config fields
// ---------------------------------------------------------------------------

export const FIELD_LABELS: Partial<Record<keyof CommunityConfig, string>> = {
  member_cap: 'Member Cap',
  visibility_mode: 'Visibility',
  outsider_response_allowed: 'Outsiders Can Respond',
  karma_split_helper: 'Karma for Helpers (%)',
  karma_split_requestor: 'Karma for Requestors (%)',
  base_karma_pool_per_request: 'Base Karma Pool',
  karma_decay_half_life_days: 'Karma Decay (days)',
  trust_depth_weight: 'Trust Depth Weight',
  trust_breadth_weight: 'Trust Breadth Weight',
  trust_decay_half_life_days: 'Trust Decay (days)',
  trust_path_max_hops: 'Trust Path Hops',
  min_interactions_for_trust: 'Min Interactions for Trust',
  request_approval_required: 'Request Approval Required',
  new_member_karma_lockout_days: 'New Member Karma Lockout (days)',
  join_approval_required: 'Join Approval Required',
  joining_counts_as_interaction: 'Joining Counts as Interaction',
}

// ---------------------------------------------------------------------------
// diffConfigs — compare current config to proposed changes
// ---------------------------------------------------------------------------

export interface ConfigDiffEntry {
  field: keyof CommunityConfig
  label: string
  currentValue: unknown
  proposedValue: unknown
}

export function diffConfigs(
  current: CommunityConfig,
  proposed: Partial<CommunityConfig>
): ConfigDiffEntry[] {
  return (Object.keys(proposed) as Array<keyof CommunityConfig>)
    .filter(field => {
      const cur = current[field]
      const prop = proposed[field]
      return cur !== prop
    })
    .map(field => ({
      field,
      label: FIELD_LABELS[field] ?? String(field),
      currentValue: current[field],
      proposedValue: proposed[field],
    }))
}

// ---------------------------------------------------------------------------
// formatConfigValue — render a config value as human-readable text
// ---------------------------------------------------------------------------

export function formatConfigValue(field: keyof CommunityConfig, value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (field === 'visibility_mode') {
    const labels: Record<string, string> = {
      public: 'Public',
      members_only: 'Members Only',
      hybrid: 'Hybrid',
    }
    return labels[value as string] ?? String(value)
  }
  return String(value)
}
