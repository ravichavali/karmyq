/**
 * Trust Model Questionnaire
 *
 * Maps human-readable questionnaire answers to CommunityConfig values.
 * Pure logic — no React, no side effects.
 *
 * Usage:
 *   const config = answersToConfig(answers)  // merge into default config
 *   const diff = diffConfigs(current, proposed)  // show what would change
 */

import type { CommunityConfig } from '../types/community-config'

// ---------------------------------------------------------------------------
// Answer types
// ---------------------------------------------------------------------------

export type Q1Answer = 'just_us' | 'neighborhood' | 'anyone'
export type Q2Answer = 'trust_takes_time' | 'cautious' | 'open_arms'
export type Q3Answer = 'deep_bonds' | 'mix' | 'wide_web'
export type Q4Answer = 'givers_matter' | 'balanced' | 'asking_is_brave'
export type Q5Answer = 'forever' | 'seasonal' | 'present'
export type Q6Answer = 'admin_review' | 'trust_freely'

export interface QuestionnaireAnswers {
  q1: Q1Answer
  q2: Q2Answer
  q3: Q3Answer
  q4: Q4Answer
  q5: Q5Answer
  q6: Q6Answer
}

export interface QuestionChoice {
  value: string
  label: string
  description: string
}

export interface Question {
  id: keyof QuestionnaireAnswers
  text: string
  subtext?: string
  choices: QuestionChoice[]
}

// ---------------------------------------------------------------------------
// Questions array (drives the questionnaire UI)
// ---------------------------------------------------------------------------

export const QUESTIONS: Question[] = [
  {
    id: 'q1',
    text: 'Who is this community for?',
    subtext: 'This shapes who can find you, join, and participate.',
    choices: [
      {
        value: 'just_us',
        label: 'Just us — a curated circle',
        description: 'Private, invite-only. Small and intentional. Members are hand-picked.',
      },
      {
        value: 'neighborhood',
        label: 'Our neighborhood or local group',
        description: 'Semi-open. Anyone nearby can find us, but joining needs approval.',
      },
      {
        value: 'anyone',
        label: 'Anyone who finds us',
        description: 'Open doors. Public, welcoming, and easy to join.',
      },
    ],
  },
  {
    id: 'q2',
    text: 'How do you feel about new members?',
    subtext: 'This controls how quickly newcomers can earn karma and post requests.',
    choices: [
      {
        value: 'trust_takes_time',
        label: 'Trust takes time — go slow',
        description: 'New members observe before participating. Karma and requests are gated for two weeks.',
      },
      {
        value: 'cautious',
        label: 'Cautious but welcoming',
        description: 'A short waiting period, then full access. Requests are open, karma comes after a week.',
      },
      {
        value: 'open_arms',
        label: 'Open arms — jump right in',
        description: 'New members can post and earn immediately. Joining itself counts as your first act.',
      },
    ],
  },
  {
    id: 'q3',
    text: 'What kind of relationships do you want to build?',
    subtext: 'This shapes how the trust system weights repeated partners vs. new connections.',
    choices: [
      {
        value: 'deep_bonds',
        label: 'Deep bonds with the same people',
        description: 'Trust grows through repeated exchanges. The system favors familiar partners.',
      },
      {
        value: 'mix',
        label: 'A mix of close and new',
        description: 'Balance between depth and breadth. Relationships deepen, but new connections are valued too.',
      },
      {
        value: 'wide_web',
        label: 'A wide web of connections',
        description: 'Trust spreads broadly. The system values meeting new people across the network.',
      },
    ],
  },
  {
    id: 'q4',
    text: 'How do you feel about asking for help?',
    subtext: 'This sets how karma is split between helpers and those who ask.',
    choices: [
      {
        value: 'givers_matter',
        label: 'Givers matter more — asking has a cost',
        description: 'Helpers earn most of the karma. Asking is meaningful but carries weight.',
      },
      {
        value: 'balanced',
        label: 'Giving and asking are equally valued',
        description: 'Karma is shared fairly. Both roles are honored in the community.',
      },
      {
        value: 'asking_is_brave',
        label: 'Asking is brave — we celebrate vulnerability',
        description: 'Both helpers and requestors earn generously. Reaching out is an act of trust.',
      },
    ],
  },
  {
    id: 'q5',
    text: 'How long should acts of generosity be remembered?',
    subtext: 'This controls how quickly karma and trust scores fade without activity.',
    choices: [
      {
        value: 'forever',
        label: 'They echo forever — contributions compound',
        description: 'Karma and trust decay very slowly. Long-term members benefit from their history.',
      },
      {
        value: 'seasonal',
        label: 'For a season — recent months matter most',
        description: 'Contributions fade over a few months. Staying active keeps your standing.',
      },
      {
        value: 'present',
        label: 'We live in the present — freshness wins',
        description: 'Karma and trust refresh quickly. What you did last month matters more than last year.',
      },
    ],
  },
  {
    id: 'q6',
    text: 'How do you want to curate what gets asked for?',
    subtext: 'This controls whether requests are visible immediately or reviewed first.',
    choices: [
      {
        value: 'admin_review',
        label: 'Admins review every request before it\'s visible',
        description: 'Higher curation. Nothing appears until a moderator approves it.',
      },
      {
        value: 'trust_freely',
        label: 'Members post freely — we trust them',
        description: 'Requests are visible immediately. The community self-moderates.',
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// answersToConfig — the full mapping
// ---------------------------------------------------------------------------

export function answersToConfig(answers: QuestionnaireAnswers): Partial<CommunityConfig> {
  const q1Map: Record<Q1Answer, Partial<CommunityConfig>> = {
    just_us: {
      visibility_mode: 'members_only',
      join_approval_required: true,
      member_cap: 50,
      outsider_response_allowed: false,
    },
    neighborhood: {
      visibility_mode: 'hybrid',
      join_approval_required: true,
      member_cap: 100,
      outsider_response_allowed: false,
    },
    anyone: {
      visibility_mode: 'public',
      join_approval_required: false,
      member_cap: 150,
      outsider_response_allowed: true,
    },
  }

  const q2Map: Record<Q2Answer, Partial<CommunityConfig>> = {
    trust_takes_time: {
      new_member_karma_lockout_days: 14,
      request_approval_required: true,
      min_interactions_for_trust: 3,
      joining_counts_as_interaction: false,
    },
    cautious: {
      new_member_karma_lockout_days: 7,
      request_approval_required: false,
      min_interactions_for_trust: 2,
      joining_counts_as_interaction: false,
    },
    open_arms: {
      new_member_karma_lockout_days: 0,
      request_approval_required: false,
      min_interactions_for_trust: 1,
      joining_counts_as_interaction: true,
    },
  }

  const q3Map: Record<Q3Answer, Partial<CommunityConfig>> = {
    deep_bonds: { trust_depth_weight: 0.8, trust_breadth_weight: 0.2 },
    mix: { trust_depth_weight: 0.6, trust_breadth_weight: 0.4 },
    wide_web: { trust_depth_weight: 0.3, trust_breadth_weight: 0.7 },
  }

  const q4Map: Record<Q4Answer, Partial<CommunityConfig>> = {
    givers_matter: { karma_split_helper: 80, karma_split_requestor: 20 },
    balanced: { karma_split_helper: 60, karma_split_requestor: 40 },
    asking_is_brave: { karma_split_helper: 60, karma_split_requestor: 60 },
  }

  const q5Map: Record<Q5Answer, Partial<CommunityConfig>> = {
    forever: { karma_decay_half_life_days: 365, trust_decay_half_life_days: 365 },
    seasonal: { karma_decay_half_life_days: 90, trust_decay_half_life_days: 180 },
    present: { karma_decay_half_life_days: 30, trust_decay_half_life_days: 60 },
  }

  // Q6 intentionally applied last — overrides Q2's request_approval_required
  const q6Map: Record<Q6Answer, Partial<CommunityConfig>> = {
    admin_review: { request_approval_required: true },
    trust_freely: { request_approval_required: false },
  }

  return {
    ...q1Map[answers.q1],
    ...q2Map[answers.q2],
    ...q3Map[answers.q3],
    ...q4Map[answers.q4],
    ...q5Map[answers.q5],
    ...q6Map[answers.q6],
  }
}

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
