/**
 * TDD Tests for Community Configuration Validation
 *
 * These tests define the validation rules for community configurations.
 * Once passing, these will be moved to tests/regression/
 */

import { validateCommunityConfig, ValidationError } from '../../src/services/config-validator';

describe('Community Configuration Validation', () => {
  describe('Trust Weight Validation', () => {
    it('should accept trust_depth_weight + trust_breadth_weight = 1.0', () => {
      const config = {
        trust_depth_weight: 0.6,
        trust_breadth_weight: 0.4,
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject when trust weights do not sum to 1.0', () => {
      const config = {
        trust_depth_weight: 0.6,
        trust_breadth_weight: 0.5, // Sum = 1.1
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'trust_weights',
          message: expect.stringContaining('must sum to 1.0'),
        })
      );
    });

    it('should allow floating point tolerance of ±0.001', () => {
      const config = {
        trust_depth_weight: 0.601,
        trust_breadth_weight: 0.399, // Sum = 1.000 (within tolerance)
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(true);
    });

    it('should reject trust_depth_weight outside 0.0-1.0 range', () => {
      const config = {
        trust_depth_weight: 1.5,
        trust_breadth_weight: -0.5,
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Karma Split Validation', () => {
    it('should accept karma_split_helper between 0 and 100', () => {
      const config = {
        karma_split_helper: 60,
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(true);
    });

    it('should reject karma_split_helper outside 0-100 range', () => {
      const config = {
        karma_split_helper: 150,
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'karma_split_helper',
          message: expect.stringContaining('0 and 100'),
        })
      );
    });

    it('should accept karma_split_requestor between -50 and 100', () => {
      const config = {
        karma_split_requestor: -20, // Can be negative to discourage asking
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(true);
    });

    it('should reject karma_split_requestor below -50', () => {
      const config = {
        karma_split_requestor: -60,
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(false);
    });

    it('should allow karma splits that sum to more than 100', () => {
      const config = {
        karma_split_helper: 70,
        karma_split_requestor: 50, // Sum = 120, explicitly allowed
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(true);
    });

    it('should allow karma splits that sum to less than 100', () => {
      const config = {
        karma_split_helper: 40,
        karma_split_requestor: 40, // Sum = 80, explicitly allowed
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Member Cap Validation', () => {
    it('should accept member_cap between 10 and 150', () => {
      const config = {
        member_cap: 100,
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(true);
    });

    it('should reject member_cap below 10', () => {
      const config = {
        member_cap: 5,
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'member_cap',
          message: expect.stringContaining('10 and 150'),
        })
      );
    });

    it('should reject member_cap above 150', () => {
      const config = {
        member_cap: 200,
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(false);
    });
  });

  describe('Request Types Validation', () => {
    it('should accept valid request types with karma multipliers', () => {
      const config = {
        enabled_request_types: [
          { name: 'meal_share', description: 'Share meals', karma_multiplier: 1.0 },
          { name: 'tool_borrow', description: 'Borrow tools', karma_multiplier: 0.8 },
        ],
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(true);
    });

    it('should reject when enabled_request_types is empty', () => {
      const config = {
        enabled_request_types: [],
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'enabled_request_types',
          message: expect.stringContaining('at least 1'),
        })
      );
    });

    it('should reject karma_multiplier below 0.5', () => {
      const config = {
        enabled_request_types: [
          { name: 'test', description: 'Test', karma_multiplier: 0.3 },
        ],
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'enabled_request_types[0].karma_multiplier',
          message: expect.stringContaining('0.5 and 2.0'),
        })
      );
    });

    it('should reject karma_multiplier above 2.0', () => {
      const config = {
        enabled_request_types: [
          { name: 'test', description: 'Test', karma_multiplier: 2.5 },
        ],
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(false);
    });

    it('should reject request type names not in lowercase_underscore format', () => {
      const config = {
        enabled_request_types: [
          { name: 'MealShare', description: 'Test', karma_multiplier: 1.0 }, // Should be meal_share
        ],
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'enabled_request_types[0].name',
          message: expect.stringContaining('lowercase_underscore'),
        })
      );
    });

    it('should require name, description, and karma_multiplier for each request type', () => {
      const config = {
        enabled_request_types: [
          { name: 'test' } as any, // Missing description and karma_multiplier
        ],
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Visibility Mode Validation', () => {
    it('should accept valid visibility modes', () => {
      const validModes = ['public', 'members_only', 'hybrid'];

      validModes.forEach(mode => {
        const config = {
          visibility_mode: mode,
        };

        const result = validateCommunityConfig(config);
        expect(result.isValid).toBe(true);
      });
    });

    it('should reject invalid visibility mode', () => {
      const config = {
        visibility_mode: 'invalid_mode',
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'visibility_mode',
          message: expect.stringContaining('public, members_only, or hybrid'),
        })
      );
    });
  });

  describe('Base Karma Pool Validation', () => {
    it('should accept base_karma_pool_per_request between 10 and 1000', () => {
      const config = {
        base_karma_pool_per_request: 100,
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(true);
    });

    it('should reject base_karma_pool_per_request below 10', () => {
      const config = {
        base_karma_pool_per_request: 5,
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(false);
    });

    it('should reject base_karma_pool_per_request above 1000', () => {
      const config = {
        base_karma_pool_per_request: 1500,
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(false);
    });
  });

  describe('Decay Half-Life Validation', () => {
    it('should accept karma_decay_half_life_days = 0 (no decay)', () => {
      const config = {
        karma_decay_half_life_days: 0,
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(true);
    });

    it('should accept karma_decay_half_life_days between 0 and 365', () => {
      const config = {
        karma_decay_half_life_days: 180,
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(true);
    });

    it('should reject negative karma_decay_half_life_days', () => {
      const config = {
        karma_decay_half_life_days: -30,
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(false);
    });

    it('should accept trust_decay_half_life_days between 30 and 365', () => {
      const config = {
        trust_decay_half_life_days: 90,
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(true);
    });

    it('should reject trust_decay_half_life_days below 30', () => {
      const config = {
        trust_decay_half_life_days: 15,
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(false);
    });
  });

  describe('Trust Path Max Hops Validation', () => {
    it('should accept trust_path_max_hops between 1 and 5', () => {
      const config = {
        trust_path_max_hops: 3,
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(true);
    });

    it('should reject trust_path_max_hops below 1', () => {
      const config = {
        trust_path_max_hops: 0,
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(false);
    });

    it('should reject trust_path_max_hops above 5', () => {
      const config = {
        trust_path_max_hops: 10,
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(false);
    });
  });

  describe('New Member Lockout Validation', () => {
    it('should accept new_member_karma_lockout_days between 0 and 30', () => {
      const config = {
        new_member_karma_lockout_days: 7,
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(true);
    });

    it('should reject new_member_karma_lockout_days above 30', () => {
      const config = {
        new_member_karma_lockout_days: 45,
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(false);
    });
  });

  describe('Minimum Interactions for Trust Validation', () => {
    it('should accept min_interactions_for_trust between 1 and 10', () => {
      const config = {
        min_interactions_for_trust: 3,
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(true);
    });

    it('should reject min_interactions_for_trust below 1', () => {
      const config = {
        min_interactions_for_trust: 0,
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(false);
    });

    it('should reject min_interactions_for_trust above 10', () => {
      const config = {
        min_interactions_for_trust: 15,
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(false);
    });
  });

  describe('Full Configuration Validation', () => {
    it('should validate all fields in a complete configuration', () => {
      const config = {
        member_cap: 150,
        visibility_mode: 'public',
        outsider_response_allowed: true,
        enabled_request_types: [
          { name: 'meal_share', description: 'Share meals', karma_multiplier: 1.0 },
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
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return all validation errors for an invalid configuration', () => {
      const config = {
        member_cap: 200, // Too high
        visibility_mode: 'invalid',
        enabled_request_types: [], // Empty
        karma_split_helper: 150, // Too high
        trust_depth_weight: 0.8,
        trust_breadth_weight: 0.8, // Sum > 1.0
        trust_path_max_hops: 0, // Too low
      };

      const result = validateCommunityConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(5); // Multiple errors
    });
  });
});
