import type { CommunityConfig } from '../types/community-config'

export interface TrustChoice {
  value: string
  label: string
  description?: string
  config_delta: Partial<CommunityConfig>
  display_order: number
}

export interface TrustQuestion {
  id: string
  slug: string
  question_text: string
  subtext?: string
  display_order: number
  choices: TrustChoice[]
}

/**
 * Merges config_deltas from selected choices in display_order (ascending).
 * Questions with higher display_order override earlier ones — this preserves
 * the Q6 (request_curation) override of Q2 (new_member_warmth) for request_approval_required.
 */
export function answersToConfig(
  questions: TrustQuestion[],
  answers: Record<string, string>   // question.id → choice.value
): Partial<CommunityConfig> {
  const sorted = [...questions].sort((a, b) => a.display_order - b.display_order)
  let result: Partial<CommunityConfig> = {}
  for (const question of sorted) {
    const selectedValue = answers[question.id]
    if (!selectedValue) continue
    const choice = question.choices.find(c => c.value === selectedValue)
    if (choice) {
      result = { ...result, ...choice.config_delta }
    }
  }
  return result
}
