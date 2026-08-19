/**
 * Community Configuration Types
 *
 * TypeScript interfaces for the Community Configuration System.
 * Used across template browsing, config editing, and community creation flows.
 *
 * @see ADR-030: Community Configuration System
 */

export interface RequestType {
  /** Request type name in lowercase_underscore format (e.g., 'meal_share') */
  name: string;
  /** Human-readable description of the request type */
  description: string;
  /** Karma multiplier for this request type (0.5-2.0) */
  karma_multiplier: number;
}

export interface CommunityConfig {
  // Identity & Boundaries
  /** Maximum number of members allowed (10-150) */
  member_cap: number;
  /** Community visibility mode */
  visibility_mode: 'public' | 'members_only' | 'hybrid';
  /** Whether non-members can respond to requests */
  outsider_response_allowed: boolean;

  // Request Types
  /** Community-defined request types with karma multipliers */
  enabled_request_types: RequestType[];

  // Karma Mechanics
  /** Percentage of karma pool awarded to helper (0-100) */
  karma_split_helper: number;
  /** Percentage of karma pool awarded to requestor (-50 to 100) */
  karma_split_requestor: number;
  /** Base karma pool per request (10-1000) */
  base_karma_pool_per_request: number;
  /** Karma decay half-life in days (0-365, 0 = no decay) */
  karma_decay_half_life_days: number;

  // Trust Mechanics
  /** Weight for trust depth (repeated interactions) (0.0-1.0) */
  trust_depth_weight: number;
  /** Weight for trust breadth (network diversity) (0.0-1.0) */
  trust_breadth_weight: number;
  /** Trust decay half-life in days (30-365) */
  trust_decay_half_life_days: number;
  /** Maximum hops for trust path calculation (1-5) */
  trust_path_max_hops: number;
  /** Minimum interactions required to establish trust (1-10) */
  min_interactions_for_trust: number;

  // Community Onboarding
  /** Whether new requests require approval */
  request_approval_required: boolean;
  /** Days new members must wait before earning karma (0-30) */
  new_member_karma_lockout_days: number;
  /** Whether joining requires founder/admin approval */
  join_approval_required: boolean;
  /** Whether joining the community counts as an interaction for trust */
  joining_counts_as_interaction: boolean;

  // Feed Scoring Weights (7 signals, Sprint 43 v2 — normalized at query time)
  feed_weight_skill_match?: number;
  feed_weight_trust_distance?: number;
  feed_weight_community_relevance?: number;
  feed_weight_urgency?: number;
  feed_weight_requester_trust?: number;
  feed_weight_prior_interaction?: number;
  feed_weight_recency?: number;

  // Provider services (Sprint 125 / ADR-095 — enforced by the reach gate in request-service)
  /** Whether this community surfaces a provider layer to its members at all. */
  provider_services_enabled?: boolean;
  /**
   * Minimum PERSONAL standing (reputation.trust_scores.score, user x community) a provider needs
   * to be surfaced here. Not the provider-profile quality score — a different table entirely.
   * A provider with no trust row in this community scores 0 and is excluded whenever this is > 0.
   */
  provider_min_personal_trust_score?: number;
  /** Allowed service types. EMPTY MEANS ALL TYPES, not none. */
  provider_services_list?: string[];

  // Metadata
  /** Name of the template this config was created from (optional) */
  template_source?: string;
  /** Timestamp when config was created */
  created_at?: string;
  /** Timestamp when config was last updated */
  updated_at?: string;
}

export interface ConfigTemplate extends CommunityConfig {
  /** Unique identifier for the template */
  id: string;
  /** Template name (e.g., 'Cohousing Default') */
  name: string;
  /** Template description explaining the philosophy */
  description: string;
  /** Number of communities using this template */
  usage_count: number;
}

/**
 * API response format for config templates endpoint
 * Backend returns: { success: boolean, data: { templates: ConfigTemplate[] } }
 */
export interface ConfigTemplateResponse {
  templates: ConfigTemplate[];
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}
