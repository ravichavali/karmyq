/**
 * Community trust-model questionnaire → config, and config diffs.
 *
 * Sprint 140 repair: 52db2fc9 moved the questionnaire into the database. `answersToConfig` is now the generic
 * merge in src/lib/answersToConfig.ts — `(questions, answers)`, each selected choice's `config_delta` merged in
 * question display_order — and the q1..q6 mapping these cases pin is the SEED in
 * infrastructure/postgres/migrations/20260404-trust-questions.sql. The cases below therefore run the real merge
 * over the real seeded questions; every expected value is still written by hand.
 */
import fs from 'fs'
import path from 'path'
import { answersToConfig, TrustQuestion } from '../../src/lib/answersToConfig'
import { diffConfigs } from '../../src/lib/trust-model'
import { CommunityConfig } from '../../src/types/community-config'

const SEED_SQL = fs.readFileSync(
  path.join(__dirname, '../../../../infrastructure/postgres/migrations/20260404-trust-questions.sql'),
  'utf8',
)
// A quoted SQL string, '' escapes included. Rows look like:
//   question: ('who_is_this_for', 'Who is this community for?', 'This shapes…', 10),
//   choice:   ('who_is_this_for', 'just_us', 'Just us…', 'Private…', '{"visibility_mode":"members_only",…}', 10),
const SQL_TEXT = "'(?:[^']|'')*'"

/** The seeded questions (id = slug) with their choices, parsed from the migration's two VALUES lists. */
function seededQuestions(): TrustQuestion[] {
  const questionRow = new RegExp(`^\\s*\\('([a-z_]+)',\\s*${SQL_TEXT},\\s*${SQL_TEXT},\\s*(\\d+)\\)`, 'gm')
  const choiceRow = new RegExp(
    `^\\s*\\('([a-z_]+)',\\s*'([a-z_]+)',\\s*${SQL_TEXT},\\s*${SQL_TEXT},\\s*'(\\{[^']*\\})',\\s*(\\d+)\\)`, 'gm')
  const questions = new Map<string, TrustQuestion>()
  for (const [, slug, order] of SEED_SQL.matchAll(questionRow)) {
    questions.set(slug, { id: slug, slug, question_text: slug, display_order: Number(order), choices: [] })
  }
  for (const [, slug, value, delta, order] of SEED_SQL.matchAll(choiceRow)) {
    questions.get(slug)!.choices.push({ value, label: value, config_delta: JSON.parse(delta), display_order: Number(order) })
  }
  return [...questions.values()]
}
const QUESTIONS = seededQuestions()

const SLUG = {
  q1: 'who_is_this_for',
  q2: 'new_member_warmth',
  q3: 'relationship_style',
  q4: 'asking_for_help',
  q5: 'generosity_memory',
  q6: 'request_curation',
} as const
type QuestionnaireAnswers = Record<keyof typeof SLUG, string>

/** The config a full questionnaire produces from the seeded questions. */
const cfgFor = (answers: QuestionnaireAnswers): Partial<CommunityConfig> =>
  answersToConfig(QUESTIONS, Object.fromEntries(Object.entries(answers).map(([q, v]) => [SLUG[q as keyof typeof SLUG], v])))

const BASE_ANSWERS: QuestionnaireAnswers = {
  q1: 'neighborhood',
  q2: 'cautious',
  q3: 'mix',
  q4: 'balanced',
  q5: 'seasonal',
  q6: 'trust_freely',
}

describe('the seeded questionnaire (non-vacuous parse)', () => {
  it('has the six questions with 3/3/3/3/3/2 choices, and request_curation merges last', () => {
    expect(QUESTIONS.map((q) => [q.slug, q.choices.length])).toEqual([
      ['who_is_this_for', 3], ['new_member_warmth', 3], ['relationship_style', 3],
      ['asking_for_help', 3], ['generosity_memory', 3], ['request_curation', 2],
    ])
    const last = [...QUESTIONS].sort((a, b) => a.display_order - b.display_order).at(-1)!
    expect(last.slug).toBe('request_curation')
  })
})

describe('answersToConfig', () => {
  // Q1
  it('q1=just_us → members_only, join_approval, cap=50, no outsider', () => {
    const cfg = cfgFor({ ...BASE_ANSWERS, q1: 'just_us' })
    expect(cfg.visibility_mode).toBe('members_only')
    expect(cfg.join_approval_required).toBe(true)
    expect(cfg.member_cap).toBe(50)
    expect(cfg.outsider_response_allowed).toBe(false)
  })

  it('q1=neighborhood → hybrid, join_approval, cap=100', () => {
    const cfg = cfgFor({ ...BASE_ANSWERS, q1: 'neighborhood' })
    expect(cfg.visibility_mode).toBe('hybrid')
    expect(cfg.join_approval_required).toBe(true)
    expect(cfg.member_cap).toBe(100)
  })

  it('q1=anyone → public, no join_approval, cap=150, outsider=true', () => {
    const cfg = cfgFor({ ...BASE_ANSWERS, q1: 'anyone' })
    expect(cfg.visibility_mode).toBe('public')
    expect(cfg.join_approval_required).toBe(false)
    expect(cfg.member_cap).toBe(150)
    expect(cfg.outsider_response_allowed).toBe(true)
  })

  // Q2
  it('q2=trust_takes_time → lockout=14, request_approval=true, min_interactions=3', () => {
    const cfg = cfgFor({ ...BASE_ANSWERS, q2: 'trust_takes_time', q6: 'admin_review' })
    expect(cfg.new_member_karma_lockout_days).toBe(14)
    expect(cfg.min_interactions_for_trust).toBe(3)
    expect(cfg.joining_counts_as_interaction).toBe(false)
    // q6 decides request approval in a full questionnaire, so prove q2's own delta with q2 alone.
    expect(answersToConfig(QUESTIONS, { new_member_warmth: 'trust_takes_time' }).request_approval_required).toBe(true)
  })

  it('q2=cautious → lockout=7, min_interactions=2', () => {
    const cfg = cfgFor({ ...BASE_ANSWERS, q2: 'cautious' })
    expect(cfg.new_member_karma_lockout_days).toBe(7)
    expect(cfg.min_interactions_for_trust).toBe(2)
  })

  it('q2=open_arms → lockout=0, min_interactions=1, joining_counts=true', () => {
    const cfg = cfgFor({ ...BASE_ANSWERS, q2: 'open_arms' })
    expect(cfg.new_member_karma_lockout_days).toBe(0)
    expect(cfg.min_interactions_for_trust).toBe(1)
    expect(cfg.joining_counts_as_interaction).toBe(true)
  })

  // Q3
  it('q3=deep_bonds → trust_depth=0.8, trust_breadth=0.2', () => {
    const cfg = cfgFor({ ...BASE_ANSWERS, q3: 'deep_bonds' })
    expect(cfg.trust_depth_weight).toBe(0.8)
    expect(cfg.trust_breadth_weight).toBe(0.2)
  })

  it('q3=mix → trust_depth=0.6, trust_breadth=0.4', () => {
    const cfg = cfgFor({ ...BASE_ANSWERS, q3: 'mix' })
    expect(cfg.trust_depth_weight).toBe(0.6)
    expect(cfg.trust_breadth_weight).toBe(0.4)
  })

  it('q3=wide_web → trust_depth=0.3, trust_breadth=0.7', () => {
    const cfg = cfgFor({ ...BASE_ANSWERS, q3: 'wide_web' })
    expect(cfg.trust_depth_weight).toBe(0.3)
    expect(cfg.trust_breadth_weight).toBe(0.7)
  })

  // Q3 trust weights always sum to 1.0
  it.each(['deep_bonds', 'mix', 'wide_web'] as const)(
    'q3=%s trust weights sum to 1.0',
    (q3) => {
      const cfg = cfgFor({ ...BASE_ANSWERS, q3 })
      expect((cfg.trust_depth_weight ?? 0) + (cfg.trust_breadth_weight ?? 0)).toBeCloseTo(1.0)
    }
  )

  // Q4
  it('q4=givers_matter → karma_split_helper=80, karma_split_requestor=20', () => {
    const cfg = cfgFor({ ...BASE_ANSWERS, q4: 'givers_matter' })
    expect(cfg.karma_split_helper).toBe(80)
    expect(cfg.karma_split_requestor).toBe(20)
  })

  it('q4=balanced → karma_split_helper=60, karma_split_requestor=40', () => {
    const cfg = cfgFor({ ...BASE_ANSWERS, q4: 'balanced' })
    expect(cfg.karma_split_helper).toBe(60)
    expect(cfg.karma_split_requestor).toBe(40)
  })

  it('q4=asking_is_brave → karma_split_helper=60, karma_split_requestor=60', () => {
    const cfg = cfgFor({ ...BASE_ANSWERS, q4: 'asking_is_brave' })
    expect(cfg.karma_split_helper).toBe(60)
    expect(cfg.karma_split_requestor).toBe(60)
  })

  // Q5
  it('q5=forever → karma_decay=365, trust_decay=365', () => {
    const cfg = cfgFor({ ...BASE_ANSWERS, q5: 'forever' })
    expect(cfg.karma_decay_half_life_days).toBe(365)
    expect(cfg.trust_decay_half_life_days).toBe(365)
  })

  it('q5=seasonal → karma_decay=90, trust_decay=180', () => {
    const cfg = cfgFor({ ...BASE_ANSWERS, q5: 'seasonal' })
    expect(cfg.karma_decay_half_life_days).toBe(90)
    expect(cfg.trust_decay_half_life_days).toBe(180)
  })

  it('q5=present → karma_decay=30, trust_decay=60', () => {
    const cfg = cfgFor({ ...BASE_ANSWERS, q5: 'present' })
    expect(cfg.karma_decay_half_life_days).toBe(30)
    expect(cfg.trust_decay_half_life_days).toBe(60)
  })

  // Q6
  it('q6=admin_review → request_approval_required=true (overrides q2)', () => {
    // q2=open_arms sets request_approval=false; q6 must override to true
    const cfg = cfgFor({ ...BASE_ANSWERS, q2: 'open_arms', q6: 'admin_review' })
    expect(cfg.request_approval_required).toBe(true)
  })

  it('q6=trust_freely → request_approval_required=false (overrides q2)', () => {
    // q2=trust_takes_time sets request_approval=true; q6 must override to false
    const cfg = cfgFor({ ...BASE_ANSWERS, q2: 'trust_takes_time', q6: 'trust_freely' })
    expect(cfg.request_approval_required).toBe(false)
  })
})

describe('diffConfigs', () => {
  const current: CommunityConfig = {
    member_cap: 100,
    visibility_mode: 'hybrid',
    outsider_response_allowed: false,
    enabled_request_types: [],
    karma_split_helper: 60,
    karma_split_requestor: 40,
    base_karma_pool_per_request: 100,
    karma_decay_half_life_days: 90,
    trust_depth_weight: 0.6,
    trust_breadth_weight: 0.4,
    trust_decay_half_life_days: 180,
    trust_path_max_hops: 3,
    min_interactions_for_trust: 2,
    request_approval_required: false,
    new_member_karma_lockout_days: 7,
    join_approval_required: true,
    joining_counts_as_interaction: false,
  }

  it('returns only changed fields', () => {
    const proposed = { member_cap: 50, visibility_mode: 'members_only' as const }
    const diffs = diffConfigs(current, proposed)
    expect(diffs).toHaveLength(2)
    expect(diffs.map(d => d.field)).toEqual(expect.arrayContaining(['member_cap', 'visibility_mode']))
  })

  it('returns empty array when no changes', () => {
    const diffs = diffConfigs(current, { member_cap: 100 })
    expect(diffs).toHaveLength(0)
  })

  it('diff entry has label, currentValue, proposedValue', () => {
    const diffs = diffConfigs(current, { member_cap: 50 })
    expect(diffs[0].label).toBeTruthy()
    expect(diffs[0].currentValue).toBe(100)
    expect(diffs[0].proposedValue).toBe(50)
  })
})
