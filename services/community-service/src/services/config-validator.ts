/**
 * Community Configuration Validator
 *
 * Validates community configuration objects against the defined rules.
 * Used by API endpoints before persisting configs to the database.
 */

import { PROVIDER_SERVICE_TYPES } from '@karmyq/shared/schemas/providers';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface RequestType {
  name: string;
  description: string;
  karma_multiplier: number;
}

export interface CommunityConfig {
  // Identity & Boundaries
  member_cap?: number;
  visibility_mode?: string;
  outsider_response_allowed?: boolean;

  // Request Types
  enabled_request_types?: RequestType[];

  // Karma Mechanics
  karma_split_helper?: number;
  karma_split_requestor?: number;
  base_karma_pool_per_request?: number;
  karma_decay_half_life_days?: number;

  // Trust Mechanics
  trust_depth_weight?: number;
  trust_breadth_weight?: number;
  trust_decay_half_life_days?: number;
  trust_path_max_hops?: number;
  min_interactions_for_trust?: number;

  // Community Onboarding
  request_approval_required?: boolean;
  new_member_karma_lockout_days?: number;
  join_approval_required?: boolean;
  joining_counts_as_interaction?: boolean;

  // Feed Scoring Weights (7 signals, Sprint 43 v2)
  feed_weight_skill_match?: number;
  feed_weight_trust_distance?: number;
  feed_weight_community_relevance?: number;
  feed_weight_urgency?: number;
  feed_weight_requester_trust?: number;
  feed_weight_prior_interaction?: number;
  feed_weight_recency?: number;

  // Provider Services (Sprint 125 / ADR-095 — enforced by request-service's reach gate)
  provider_services_enabled?: boolean;
  provider_min_personal_trust_score?: number;
  /** Allowed service types. An EMPTY array means ALL types, not none. */
  provider_services_list?: string[];

  // Metadata
  template_source?: string;
}

/**
 * Validates a community configuration object
 * @param config - Partial or full community configuration
 * @returns ValidationResult with isValid flag and array of errors
 */
export function validateCommunityConfig(config: Partial<CommunityConfig>): ValidationResult {
  const errors: ValidationError[] = [];

  // Member Cap Validation
  if (config.member_cap !== undefined) {
    if (typeof config.member_cap !== 'number' || config.member_cap < 10 || config.member_cap > 150) {
      errors.push({
        field: 'member_cap',
        message: 'member_cap must be between 10 and 150',
      });
    }
  }

  // Provider Services List Validation (Sprint 125 / ADR-095)
  //
  // This column was inert until Sprint 125, so an unrecognised value was harmless. It is now the
  // service-type allowlist the provider reach gate filters on, matched against
  // `requests.provider_profiles.service_type`. A typo like "trades" would otherwise be accepted
  // with a 200 and silently reduce the community's provider layer to nobody — the steward would
  // see an empty tab and no reason for it.
  //
  // NOTE: an EMPTY array is valid and means "all service types", not "none".
  if (config.provider_services_list !== undefined) {
    if (!Array.isArray(config.provider_services_list)) {
      errors.push({
        field: 'provider_services_list',
        message: 'provider_services_list must be an array (an empty array means all service types)',
      });
    } else {
      const unknown = config.provider_services_list.filter(
        (type) => !PROVIDER_SERVICE_TYPES.includes(type as never)
      );
      if (unknown.length > 0) {
        errors.push({
          field: 'provider_services_list',
          message: `provider_services_list contains unknown service type(s): ${unknown.join(', ')}. Valid types: ${PROVIDER_SERVICE_TYPES.join(', ')}`,
        });
      }
    }
  }

  // Visibility Mode Validation
  if (config.visibility_mode !== undefined) {
    const validModes = ['public', 'members_only', 'hybrid'];
    if (!validModes.includes(config.visibility_mode)) {
      errors.push({
        field: 'visibility_mode',
        message: 'visibility_mode must be public, members_only, or hybrid',
      });
    }
  }

  // Request Types Validation
  if (config.enabled_request_types !== undefined) {
    if (!Array.isArray(config.enabled_request_types)) {
      errors.push({
        field: 'enabled_request_types',
        message: 'enabled_request_types must be an array',
      });
    } else if (config.enabled_request_types.length === 0) {
      errors.push({
        field: 'enabled_request_types',
        message: 'enabled_request_types must have at least 1 type',
      });
    } else {
      config.enabled_request_types.forEach((type, index) => {
        // Validate name
        if (!type.name || typeof type.name !== 'string') {
          errors.push({
            field: `enabled_request_types[${index}].name`,
            message: 'name is required and must be a string',
          });
        } else if (!/^[a-z_]+$/.test(type.name)) {
          errors.push({
            field: `enabled_request_types[${index}].name`,
            message: 'name must be in lowercase_underscore format',
          });
        }

        // Validate description
        if (!type.description || typeof type.description !== 'string') {
          errors.push({
            field: `enabled_request_types[${index}].description`,
            message: 'description is required and must be a string',
          });
        }

        // Validate karma_multiplier
        if (type.karma_multiplier === undefined || typeof type.karma_multiplier !== 'number') {
          errors.push({
            field: `enabled_request_types[${index}].karma_multiplier`,
            message: 'karma_multiplier is required and must be a number',
          });
        } else if (type.karma_multiplier < 0.5 || type.karma_multiplier > 2.0) {
          errors.push({
            field: `enabled_request_types[${index}].karma_multiplier`,
            message: 'karma_multiplier must be between 0.5 and 2.0',
          });
        }
      });
    }
  }

  // Karma Split Helper Validation
  if (config.karma_split_helper !== undefined) {
    if (typeof config.karma_split_helper !== 'number' || config.karma_split_helper < 0 || config.karma_split_helper > 100) {
      errors.push({
        field: 'karma_split_helper',
        message: 'karma_split_helper must be between 0 and 100',
      });
    }
  }

  // Karma Split Requestor Validation
  if (config.karma_split_requestor !== undefined) {
    if (typeof config.karma_split_requestor !== 'number' || config.karma_split_requestor < -50 || config.karma_split_requestor > 100) {
      errors.push({
        field: 'karma_split_requestor',
        message: 'karma_split_requestor must be between -50 and 100',
      });
    }
  }

  // Base Karma Pool Validation
  if (config.base_karma_pool_per_request !== undefined) {
    if (typeof config.base_karma_pool_per_request !== 'number' || config.base_karma_pool_per_request < 10 || config.base_karma_pool_per_request > 1000) {
      errors.push({
        field: 'base_karma_pool_per_request',
        message: 'base_karma_pool_per_request must be between 10 and 1000',
      });
    }
  }

  // Karma Decay Half-Life Validation
  if (config.karma_decay_half_life_days !== undefined) {
    if (typeof config.karma_decay_half_life_days !== 'number' || config.karma_decay_half_life_days < 0 || config.karma_decay_half_life_days > 365) {
      errors.push({
        field: 'karma_decay_half_life_days',
        message: 'karma_decay_half_life_days must be between 0 and 365',
      });
    }
  }

  // Trust Depth Weight Validation
  if (config.trust_depth_weight !== undefined) {
    if (typeof config.trust_depth_weight !== 'number' || config.trust_depth_weight < 0.0 || config.trust_depth_weight > 1.0) {
      errors.push({
        field: 'trust_depth_weight',
        message: 'trust_depth_weight must be between 0.0 and 1.0',
      });
    }
  }

  // Trust Breadth Weight Validation
  if (config.trust_breadth_weight !== undefined) {
    if (typeof config.trust_breadth_weight !== 'number' || config.trust_breadth_weight < 0.0 || config.trust_breadth_weight > 1.0) {
      errors.push({
        field: 'trust_breadth_weight',
        message: 'trust_breadth_weight must be between 0.0 and 1.0',
      });
    }
  }

  // Trust Weights Sum Validation
  if (config.trust_depth_weight !== undefined && config.trust_breadth_weight !== undefined) {
    const sum = config.trust_depth_weight + config.trust_breadth_weight;
    const tolerance = 0.001;
    if (Math.abs(sum - 1.0) >= tolerance) {
      errors.push({
        field: 'trust_weights',
        message: 'trust_depth_weight + trust_breadth_weight must sum to 1.0 (±0.001 tolerance)',
      });
    }
  }

  // Trust Decay Half-Life Validation
  if (config.trust_decay_half_life_days !== undefined) {
    if (typeof config.trust_decay_half_life_days !== 'number' || config.trust_decay_half_life_days < 30 || config.trust_decay_half_life_days > 365) {
      errors.push({
        field: 'trust_decay_half_life_days',
        message: 'trust_decay_half_life_days must be between 30 and 365',
      });
    }
  }

  // Trust Path Max Hops Validation
  if (config.trust_path_max_hops !== undefined) {
    if (typeof config.trust_path_max_hops !== 'number' || config.trust_path_max_hops < 1 || config.trust_path_max_hops > 5) {
      errors.push({
        field: 'trust_path_max_hops',
        message: 'trust_path_max_hops must be between 1 and 5',
      });
    }
  }

  // Min Interactions for Trust Validation
  if (config.min_interactions_for_trust !== undefined) {
    if (typeof config.min_interactions_for_trust !== 'number' || config.min_interactions_for_trust < 1 || config.min_interactions_for_trust > 10) {
      errors.push({
        field: 'min_interactions_for_trust',
        message: 'min_interactions_for_trust must be between 1 and 10',
      });
    }
  }

  // New Member Karma Lockout Validation
  if (config.new_member_karma_lockout_days !== undefined) {
    if (typeof config.new_member_karma_lockout_days !== 'number' || config.new_member_karma_lockout_days < 0 || config.new_member_karma_lockout_days > 30) {
      errors.push({
        field: 'new_member_karma_lockout_days',
        message: 'new_member_karma_lockout_days must be between 0 and 30',
      });
    }
  }

  // Feed Weight Validations (7 signals — no sum constraint, normalized at query time)
  const feedWeightFields = [
    'feed_weight_skill_match',
    'feed_weight_trust_distance',
    'feed_weight_community_relevance',
    'feed_weight_urgency',
    'feed_weight_requester_trust',
    'feed_weight_prior_interaction',
    'feed_weight_recency',
  ] as const;

  for (const field of feedWeightFields) {
    if (config[field] !== undefined) {
      if (typeof config[field] !== 'number' || config[field]! < 0.0 || config[field]! > 1.0) {
        errors.push({
          field,
          message: `${field} must be between 0.0 and 1.0`,
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Gets the default configuration (matches "Cohousing Default" template)
 */
export function getDefaultConfig(): CommunityConfig {
  return {
    member_cap: 150,
    visibility_mode: 'public',
    outsider_response_allowed: true,
    enabled_request_types: [
      { name: 'meal_share', description: 'Share meals or cooking', karma_multiplier: 1.0 },
      { name: 'tool_borrow', description: 'Borrow tools or equipment', karma_multiplier: 0.8 },
      { name: 'ride_share', description: 'Share rides or transportation', karma_multiplier: 1.2 },
      { name: 'childcare', description: 'Help with childcare or babysitting', karma_multiplier: 1.5 },
    ],
    karma_split_helper: 60,
    karma_split_requestor: 40,
    base_karma_pool_per_request: 100,
    karma_decay_half_life_days: 0,
    trust_depth_weight: 0.6,
    trust_breadth_weight: 0.4,
    trust_decay_half_life_days: 180,
    trust_path_max_hops: 3,
    min_interactions_for_trust: 1,
    request_approval_required: false,
    new_member_karma_lockout_days: 0,
    join_approval_required: true,
    joining_counts_as_interaction: true,
    feed_weight_skill_match: 0.40,
    feed_weight_trust_distance: 0.25,
    feed_weight_community_relevance: 0.20,
    feed_weight_urgency: 0.15,
  };
}

/**
 * Merges partial config updates with existing config, validating the result
 * @param existingConfig - Current configuration
 * @param updates - Partial configuration updates
 * @returns ValidationResult with merged config or errors
 */
export function mergeAndValidateConfig(
  existingConfig: CommunityConfig,
  updates: Partial<CommunityConfig>
): ValidationResult & { config?: CommunityConfig } {
  // Sprint 112 (ADR-082): feed_weight_requester_trust is NOT founder-configurable. Allowing it lets a
  // founder ISOLATE reputation in feed ranking (set it to 1, others to 0 → feedScore = requesterTrust),
  // turning the feed's order and the default inclusion threshold into a reputation oracle — and
  // repeated weight changes can recover finer values. There is no founder exception (ADR-082). The
  // feed always uses the fixed server-default requester-trust weight regardless of stored config.
  if (updates.feed_weight_requester_trust !== undefined) {
    return {
      isValid: false,
      errors: [{
        field: 'feed_weight_requester_trust',
        message: 'feed_weight_requester_trust is not configurable — reputation cannot be isolated in feed ranking (ADR-082)',
      }],
    };
  }

  const merged = { ...existingConfig, ...updates };

  // If trust weights are updated, recalculate the other weight
  if (updates.trust_depth_weight !== undefined && updates.trust_breadth_weight === undefined) {
    merged.trust_breadth_weight = 1.0 - updates.trust_depth_weight;
  } else if (updates.trust_breadth_weight !== undefined && updates.trust_depth_weight === undefined) {
    merged.trust_depth_weight = 1.0 - updates.trust_breadth_weight;
  }

  const validation = validateCommunityConfig(merged);

  if (validation.isValid) {
    return {
      ...validation,
      config: merged,
    };
  }

  return validation;
}
