/**
 * Unit Tests: Community Configuration Validation
 *
 * Tests validation logic for community configuration objects.
 * These tests MUST pass - they validate core business logic.
 */

import {
  validateTrustWeights,
  validateRequestTypes,
  validateKarmaSplits,
  validateMemberCap,
  validateNumericFields,
  validateCommunityConfig,
  adjustTrustWeights
} from '../../src/lib/config-validation'
import { CommunityConfig, RequestType } from '../../src/types/community-config'

describe('Trust Weights Validation', () => {
  it('should pass when weights sum to exactly 1.0', () => {
    const error = validateTrustWeights(0.6, 0.4)
    expect(error).toBeNull()
  })

  it('should pass when weights sum to 1.0 within tolerance (0.001)', () => {
    const error = validateTrustWeights(0.6005, 0.3995)
    expect(error).toBeNull()
  })

  it('should fail when weights sum is outside tolerance', () => {
    const error = validateTrustWeights(0.6, 0.5)
    expect(error).not.toBeNull()
    expect(error?.field).toBe('trust_weights')
    expect(error?.message).toContain('1.1')
  })

  it('should fail when weights sum is too low', () => {
    const error = validateTrustWeights(0.4, 0.5)
    expect(error).not.toBeNull()
    expect(error?.message).toContain('0.9')
  })

  it('should handle edge case: both weights 0', () => {
    const error = validateTrustWeights(0, 0)
    expect(error).not.toBeNull()
  })

  it('should handle edge case: both weights 0.5', () => {
    const error = validateTrustWeights(0.5, 0.5)
    expect(error).toBeNull()
  })
})

describe('Request Types Validation', () => {
  it('should pass with valid request types', () => {
    const types: RequestType[] = [
      { name: 'meal_share', description: 'Share meals', karma_multiplier: 1.0 },
      { name: 'tool_borrow', description: 'Borrow tools', karma_multiplier: 0.8 }
    ]
    const errors = validateRequestTypes(types)
    expect(errors).toHaveLength(0)
  })

  it('should fail when no request types provided', () => {
    const errors = validateRequestTypes([])
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain('At least one')
  })

  it('should fail when request type names are not unique', () => {
    const types: RequestType[] = [
      { name: 'meal_share', description: 'Share meals', karma_multiplier: 1.0 },
      { name: 'meal_share', description: 'Different description', karma_multiplier: 0.9 }
    ]
    const errors = validateRequestTypes(types)
    expect(errors.some(e => e.message.includes('unique'))).toBe(true)
  })

  it('should fail when name is not lowercase_underscore format', () => {
    const types: RequestType[] = [
      { name: 'MealShare', description: 'Invalid format', karma_multiplier: 1.0 }
    ]
    const errors = validateRequestTypes(types)
    expect(errors.some(e => e.message.includes('lowercase_underscore'))).toBe(true)
  })

  it('should fail when name contains spaces', () => {
    const types: RequestType[] = [
      { name: 'meal share', description: 'Invalid format', karma_multiplier: 1.0 }
    ]
    const errors = validateRequestTypes(types)
    expect(errors.length).toBeGreaterThan(0)
  })

  it('should fail when name starts with number', () => {
    const types: RequestType[] = [
      { name: '1meal_share', description: 'Invalid format', karma_multiplier: 1.0 }
    ]
    const errors = validateRequestTypes(types)
    expect(errors.length).toBeGreaterThan(0)
  })

  it('should pass when name starts with lowercase letter', () => {
    const types: RequestType[] = [
      { name: 'meal_share_2', description: 'Valid format', karma_multiplier: 1.0 }
    ]
    const errors = validateRequestTypes(types)
    expect(errors).toHaveLength(0)
  })

  it('should fail when karma multiplier is too low', () => {
    const types: RequestType[] = [
      { name: 'meal_share', description: 'Share meals', karma_multiplier: 0.3 }
    ]
    const errors = validateRequestTypes(types)
    expect(errors.some(e => e.message.includes('0.5 and 2.0'))).toBe(true)
  })

  it('should fail when karma multiplier is too high', () => {
    const types: RequestType[] = [
      { name: 'meal_share', description: 'Share meals', karma_multiplier: 2.5 }
    ]
    const errors = validateRequestTypes(types)
    expect(errors.some(e => e.message.includes('0.5 and 2.0'))).toBe(true)
  })

  it('should pass with karma multiplier at boundaries', () => {
    const types: RequestType[] = [
      { name: 'low_priority', description: 'Low priority', karma_multiplier: 0.5 },
      { name: 'high_priority', description: 'High priority', karma_multiplier: 2.0 }
    ]
    const errors = validateRequestTypes(types)
    expect(errors).toHaveLength(0)
  })
})

describe('Karma Splits Validation', () => {
  it('should pass with valid karma splits', () => {
    const errors = validateKarmaSplits(60, 40)
    expect(errors).toHaveLength(0)
  })

  it('should fail when helper split is negative', () => {
    const errors = validateKarmaSplits(-10, 40)
    expect(errors.some(e => e.field === 'karma_split_helper')).toBe(true)
  })

  it('should fail when helper split exceeds 100', () => {
    const errors = validateKarmaSplits(110, 40)
    expect(errors.some(e => e.field === 'karma_split_helper')).toBe(true)
  })

  it('should pass when requestor split is negative (within range)', () => {
    const errors = validateKarmaSplits(60, -20)
    expect(errors).toHaveLength(0)
  })

  it('should fail when requestor split is below -50', () => {
    const errors = validateKarmaSplits(60, -60)
    expect(errors.some(e => e.field === 'karma_split_requestor')).toBe(true)
  })

  it('should fail when requestor split exceeds 100', () => {
    const errors = validateKarmaSplits(60, 110)
    expect(errors.some(e => e.field === 'karma_split_requestor')).toBe(true)
  })

  it('should allow splits that sum to more than 100 (generous system)', () => {
    const errors = validateKarmaSplits(70, 60)
    expect(errors).toHaveLength(0)
  })

  it('should allow splits that sum to less than 100 (conservative system)', () => {
    const errors = validateKarmaSplits(40, 30)
    expect(errors).toHaveLength(0)
  })

  it('should pass at boundary values', () => {
    const errors1 = validateKarmaSplits(0, -50)
    const errors2 = validateKarmaSplits(100, 100)
    expect(errors1).toHaveLength(0)
    expect(errors2).toHaveLength(0)
  })
})

describe('Member Cap Validation', () => {
  it('should pass with valid member cap', () => {
    const error = validateMemberCap(100)
    expect(error).toBeNull()
  })

  it('should fail when member cap is below 10', () => {
    const error = validateMemberCap(5)
    expect(error).not.toBeNull()
    expect(error?.field).toBe('member_cap')
  })

  it('should fail when member cap exceeds 150 (Dunbar\'s number)', () => {
    const error = validateMemberCap(200)
    expect(error).not.toBeNull()
    expect(error?.message).toContain('150')
  })

  it('should pass at boundaries (10 and 150)', () => {
    expect(validateMemberCap(10)).toBeNull()
    expect(validateMemberCap(150)).toBeNull()
  })
})

describe('Numeric Fields Validation', () => {
  const validConfig: CommunityConfig = {
    member_cap: 100,
    visibility_mode: 'public',
    outsider_response_allowed: false,
    enabled_request_types: [
      { name: 'meal_share', description: 'Share meals', karma_multiplier: 1.0 }
    ],
    karma_split_helper: 60,
    karma_split_requestor: 40,
    base_karma_pool_per_request: 100,
    karma_decay_half_life_days: 0,
    trust_depth_weight: 0.6,
    trust_breadth_weight: 0.4,
    trust_decay_half_life_days: 90,
    trust_path_max_hops: 3,
    min_interactions_for_trust: 1,
    request_approval_required: false,
    new_member_karma_lockout_days: 0,
    join_approval_required: true,
    joining_counts_as_interaction: true
  }

  it('should pass with all valid numeric fields', () => {
    const errors = validateNumericFields(validConfig)
    expect(errors).toHaveLength(0)
  })

  it('should fail when base karma pool is too low', () => {
    const config = { ...validConfig, base_karma_pool_per_request: 5 }
    const errors = validateNumericFields(config)
    expect(errors.some(e => e.field === 'base_karma_pool_per_request')).toBe(true)
  })

  it('should fail when base karma pool is too high', () => {
    const config = { ...validConfig, base_karma_pool_per_request: 1500 }
    const errors = validateNumericFields(config)
    expect(errors.some(e => e.field === 'base_karma_pool_per_request')).toBe(true)
  })

  it('should fail when karma decay exceeds 365 days', () => {
    const config = { ...validConfig, karma_decay_half_life_days: 400 }
    const errors = validateNumericFields(config)
    expect(errors.some(e => e.field === 'karma_decay_half_life_days')).toBe(true)
  })

  it('should fail when trust decay is below 30 days', () => {
    const config = { ...validConfig, trust_decay_half_life_days: 20 }
    const errors = validateNumericFields(config)
    expect(errors.some(e => e.field === 'trust_decay_half_life_days')).toBe(true)
  })

  it('should fail when trust path max hops is 0', () => {
    const config = { ...validConfig, trust_path_max_hops: 0 }
    const errors = validateNumericFields(config)
    expect(errors.some(e => e.field === 'trust_path_max_hops')).toBe(true)
  })

  it('should fail when trust path max hops exceeds 5', () => {
    const config = { ...validConfig, trust_path_max_hops: 6 }
    const errors = validateNumericFields(config)
    expect(errors.some(e => e.field === 'trust_path_max_hops')).toBe(true)
  })

  it('should fail when min interactions is 0', () => {
    const config = { ...validConfig, min_interactions_for_trust: 0 }
    const errors = validateNumericFields(config)
    expect(errors.some(e => e.field === 'min_interactions_for_trust')).toBe(true)
  })

  it('should fail when new member lockout exceeds 30 days', () => {
    const config = { ...validConfig, new_member_karma_lockout_days: 35 }
    const errors = validateNumericFields(config)
    expect(errors.some(e => e.field === 'new_member_karma_lockout_days')).toBe(true)
  })
})

describe('Comprehensive Config Validation', () => {
  const validConfig: CommunityConfig = {
    member_cap: 100,
    visibility_mode: 'public',
    outsider_response_allowed: false,
    enabled_request_types: [
      { name: 'meal_share', description: 'Share meals', karma_multiplier: 1.0 },
      { name: 'tool_borrow', description: 'Borrow tools', karma_multiplier: 0.8 }
    ],
    karma_split_helper: 60,
    karma_split_requestor: 40,
    base_karma_pool_per_request: 100,
    karma_decay_half_life_days: 0,
    trust_depth_weight: 0.6,
    trust_breadth_weight: 0.4,
    trust_decay_half_life_days: 90,
    trust_path_max_hops: 3,
    min_interactions_for_trust: 1,
    request_approval_required: false,
    new_member_karma_lockout_days: 0,
    join_approval_required: true,
    joining_counts_as_interaction: true
  }

  it('should pass with fully valid config', () => {
    const result = validateCommunityConfig(validConfig)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should fail with multiple validation errors', () => {
    const invalidConfig: CommunityConfig = {
      ...validConfig,
      member_cap: 200, // Too high
      trust_depth_weight: 0.7,
      trust_breadth_weight: 0.5, // Sum > 1.0
      enabled_request_types: [
        { name: 'Invalid Name', description: 'Bad format', karma_multiplier: 1.0 }
      ]
    }

    const result = validateCommunityConfig(invalidConfig)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(2)
  })

  it('should identify all error fields', () => {
    const invalidConfig: CommunityConfig = {
      ...validConfig,
      member_cap: 5,
      karma_split_helper: 110,
      enabled_request_types: []
    }

    const result = validateCommunityConfig(invalidConfig)
    expect(result.valid).toBe(false)

    const errorFields = result.errors.map(e => e.field)
    expect(errorFields).toContain('member_cap')
    expect(errorFields).toContain('karma_split_helper')
    expect(errorFields).toContain('enabled_request_types')
  })
})

describe('Trust Weights Auto-Adjustment', () => {
  it('should adjust breadth when depth changes', () => {
    const result = adjustTrustWeights('depth', 0.7)
    expect(result.depth).toBe(0.7)
    expect(result.breadth).toBeCloseTo(0.3, 10) // Use toBeCloseTo for floating point
  })

  it('should adjust depth when breadth changes', () => {
    const result = adjustTrustWeights('breadth', 0.3)
    expect(result.depth).toBe(0.7)
    expect(result.breadth).toBe(0.3)
  })

  it('should clamp values to [0, 1] range', () => {
    const result1 = adjustTrustWeights('depth', 1.5)
    expect(result1.depth).toBe(1.0)
    expect(result1.breadth).toBe(0.0)

    const result2 = adjustTrustWeights('breadth', -0.2)
    expect(result2.breadth).toBe(0.0)
    expect(result2.depth).toBe(1.0)
  })

  it('should handle edge case: 0.5/0.5 split', () => {
    const result = adjustTrustWeights('depth', 0.5)
    expect(result.depth).toBe(0.5)
    expect(result.breadth).toBe(0.5)
  })

  it('should always sum to 1.0', () => {
    const testValues = [0, 0.1, 0.33, 0.5, 0.67, 0.9, 1.0]

    testValues.forEach(value => {
      const result1 = adjustTrustWeights('depth', value)
      expect(result1.depth + result1.breadth).toBeCloseTo(1.0)

      const result2 = adjustTrustWeights('breadth', value)
      expect(result2.depth + result2.breadth).toBeCloseTo(1.0)
    })
  })
})
