/**
 * Community Configuration Validation Utilities
 *
 * Validates community configuration objects to ensure they meet all requirements
 * before submission to the backend API.
 */

import { CommunityConfig, RequestType } from '../types/community-config'

export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

/**
 * Validates trust weights sum to 1.0 (±0.001 tolerance)
 */
export function validateTrustWeights(
  depthWeight: number,
  breadthWeight: number
): ValidationError | null {
  const sum = depthWeight + breadthWeight
  const tolerance = 0.001

  if (Math.abs(sum - 1.0) > tolerance) {
    return {
      field: 'trust_weights',
      message: `Trust weights sum to ${sum.toFixed(3)}, must equal 1.0 (±${tolerance})`
    }
  }

  return null
}

/**
 * Validates request type names are unique and follow lowercase_underscore format
 */
export function validateRequestTypes(types: RequestType[]): ValidationError[] {
  const errors: ValidationError[] = []

  // Must have at least one request type
  if (types.length === 0) {
    errors.push({
      field: 'enabled_request_types',
      message: 'At least one request type is required'
    })
    return errors
  }

  // Check for uniqueness
  const names = types.map(t => t.name)
  const uniqueNames = new Set(names)

  if (uniqueNames.size !== names.length) {
    errors.push({
      field: 'enabled_request_types',
      message: 'Request type names must be unique'
    })
  }

  // Check format (lowercase_underscore)
  const formatRegex = /^[a-z][a-z0-9_]*$/
  types.forEach((type, index) => {
    if (!formatRegex.test(type.name)) {
      errors.push({
        field: `enabled_request_types[${index}].name`,
        message: `"${type.name}" must be lowercase_underscore format (e.g., "meal_share")`
      })
    }

    // Validate karma multiplier range
    if (type.karma_multiplier < 0.5 || type.karma_multiplier > 2.0) {
      errors.push({
        field: `enabled_request_types[${index}].karma_multiplier`,
        message: `Karma multiplier must be between 0.5 and 2.0 (got ${type.karma_multiplier})`
      })
    }
  })

  return errors
}

/**
 * Validates karma split values are within acceptable ranges
 */
export function validateKarmaSplits(
  helperSplit: number,
  requestorSplit: number
): ValidationError[] {
  const errors: ValidationError[] = []

  if (helperSplit < 0 || helperSplit > 100) {
    errors.push({
      field: 'karma_split_helper',
      message: `Helper split must be between 0 and 100 (got ${helperSplit})`
    })
  }

  if (requestorSplit < -50 || requestorSplit > 100) {
    errors.push({
      field: 'karma_split_requestor',
      message: `Requestor split must be between -50 and 100 (got ${requestorSplit})`
    })
  }

  return errors
}

/**
 * Validates member cap is within Dunbar's number range
 */
export function validateMemberCap(memberCap: number): ValidationError | null {
  if (memberCap < 10 || memberCap > 150) {
    return {
      field: 'member_cap',
      message: `Member cap must be between 10 and 150 (got ${memberCap})`
    }
  }
  return null
}

/**
 * Validates numeric fields are within their respective ranges
 */
export function validateNumericFields(config: CommunityConfig): ValidationError[] {
  const errors: ValidationError[] = []

  // Base karma pool
  if (config.base_karma_pool_per_request < 10 || config.base_karma_pool_per_request > 1000) {
    errors.push({
      field: 'base_karma_pool_per_request',
      message: `Base karma pool must be between 10 and 1000 (got ${config.base_karma_pool_per_request})`
    })
  }

  // Karma decay
  if (config.karma_decay_half_life_days < 0 || config.karma_decay_half_life_days > 365) {
    errors.push({
      field: 'karma_decay_half_life_days',
      message: `Karma decay must be between 0 and 365 days (got ${config.karma_decay_half_life_days})`
    })
  }

  // Trust decay
  if (config.trust_decay_half_life_days < 30 || config.trust_decay_half_life_days > 365) {
    errors.push({
      field: 'trust_decay_half_life_days',
      message: `Trust decay must be between 30 and 365 days (got ${config.trust_decay_half_life_days})`
    })
  }

  // Trust path max hops
  if (config.trust_path_max_hops < 1 || config.trust_path_max_hops > 5) {
    errors.push({
      field: 'trust_path_max_hops',
      message: `Trust path max hops must be between 1 and 5 (got ${config.trust_path_max_hops})`
    })
  }

  // Min interactions for trust
  if (config.min_interactions_for_trust < 1 || config.min_interactions_for_trust > 10) {
    errors.push({
      field: 'min_interactions_for_trust',
      message: `Min interactions must be between 1 and 10 (got ${config.min_interactions_for_trust})`
    })
  }

  // New member karma lockout
  if (config.new_member_karma_lockout_days < 0 || config.new_member_karma_lockout_days > 30) {
    errors.push({
      field: 'new_member_karma_lockout_days',
      message: `Karma lockout must be between 0 and 30 days (got ${config.new_member_karma_lockout_days})`
    })
  }

  // Trust weight ranges
  if (config.trust_depth_weight < 0 || config.trust_depth_weight > 1.0) {
    errors.push({
      field: 'trust_depth_weight',
      message: `Trust depth weight must be between 0.0 and 1.0 (got ${config.trust_depth_weight})`
    })
  }

  if (config.trust_breadth_weight < 0 || config.trust_breadth_weight > 1.0) {
    errors.push({
      field: 'trust_breadth_weight',
      message: `Trust breadth weight must be between 0.0 and 1.0 (got ${config.trust_breadth_weight})`
    })
  }

  return errors
}

/**
 * Comprehensive validation of entire config object
 */
export function validateCommunityConfig(config: CommunityConfig): ValidationResult {
  const errors: ValidationError[] = []

  // Validate member cap
  const memberCapError = validateMemberCap(config.member_cap)
  if (memberCapError) errors.push(memberCapError)

  // Validate trust weights
  const trustWeightsError = validateTrustWeights(
    config.trust_depth_weight,
    config.trust_breadth_weight
  )
  if (trustWeightsError) errors.push(trustWeightsError)

  // Validate karma splits
  errors.push(...validateKarmaSplits(config.karma_split_helper, config.karma_split_requestor))

  // Validate request types
  errors.push(...validateRequestTypes(config.enabled_request_types))

  // Validate numeric fields
  errors.push(...validateNumericFields(config))

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Auto-adjusts trust weights to ensure they sum to 1.0
 */
export function adjustTrustWeights(
  changedField: 'depth' | 'breadth',
  value: number
): { depth: number; breadth: number } {
  const clamped = Math.max(0, Math.min(1, value))

  if (changedField === 'depth') {
    return {
      depth: clamped,
      breadth: 1.0 - clamped
    }
  } else {
    return {
      depth: 1.0 - clamped,
      breadth: clamped
    }
  }
}
