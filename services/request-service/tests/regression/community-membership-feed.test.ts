/**
 * Regression Tests: Community Membership & Feed Schema Contract
 *
 * These tests verify the contract between:
 * - Request-service SQL queries (expect certain columns to exist)
 * - Database schema (must define those columns in init.sql)
 * - Migrations (must add the columns that routes depend on)
 * - Shared matching utilities (must export tier resolution, scoring)
 *
 * CONTEXT: After ADR-031 deployment, the curated feed broke because
 * migrations 013/014 (adding visibility_scope, feed_weight_*,
 * user_feed_preferences columns) were not applied to the live database.
 * Every request-service query failed because they referenced columns
 * that didn't exist. These tests lock in the schema expectations so
 * any mismatch is caught in regression testing.
 *
 * IMPORTANT: These tests MUST always pass.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  resolveSourceTier,
  calculateFeedScore,
  DEFAULT_FEED_WEIGHTS,
  DEFAULT_FEED_PREFERENCES,
  VALID_VISIBILITY_SCOPES,
} from '@karmyq/shared/matching';
import type { UserFeedPreferences } from '@karmyq/shared/matching';

// File paths relative to this test file
const ROUTES_FILE = path.join(__dirname, '..', '..', 'src', 'routes', 'requests.ts');
const INIT_SQL = path.join(__dirname, '..', '..', '..', '..', 'infrastructure', 'postgres', 'init.sql');
const MIGRATION_013 = path.join(__dirname, '..', '..', '..', '..', 'infrastructure', 'postgres', 'migrations', '013_feed_scoring_weights.sql');
const MIGRATION_014 = path.join(__dirname, '..', '..', '..', '..', 'infrastructure', 'postgres', 'migrations', '014_multi_tier_visibility.sql');

describe('Community Membership & Feed Schema Contract (ADR-031)', () => {
  let routesSource: string;
  let initSql: string;

  beforeAll(() => {
    routesSource = fs.readFileSync(ROUTES_FILE, 'utf-8');
    initSql = fs.readFileSync(INIT_SQL, 'utf-8');
  });

  describe('Route SQL column requirements', () => {
    it('GET /requests query must reference visibility_scope', () => {
      // The SELECT in GET /requests must include visibility columns
      // so that frontend can display tier badges
      expect(routesSource).toContain('r.visibility_scope');
    });

    it('GET /requests query must reference visibility_max_degrees', () => {
      expect(routesSource).toContain('r.visibility_max_degrees');
    });

    it('POST /requests must query default_request_scope from communities', () => {
      // When creating a request, the route fetches the community's default
      // visibility scope to use as fallback
      expect(routesSource).toContain('default_request_scope');
    });

    it('POST /requests INSERT must include visibility_scope parameter', () => {
      // The INSERT statement must store visibility_scope
      expect(routesSource).toContain('visibility_scope');
    });

    it('curated feed must query user_feed_preferences', () => {
      // The curated feed route reads user preferences for multi-tier visibility
      expect(routesSource).toContain('user_feed_preferences');
    });

    it('curated feed must query community_configs for feed weights', () => {
      // Feed scoring uses community-specific weights from community_configs
      expect(routesSource).toContain('feed_weight_skill_match');
      expect(routesSource).toContain('feed_weight_trust_distance');
      expect(routesSource).toContain('feed_weight_community_relevance');
      expect(routesSource).toContain('feed_weight_urgency');
    });

    it('curated feed must use LEFT JOIN for multi-tier support', () => {
      // Multi-tier feed shows requests outside user's communities,
      // so membership check must be LEFT JOIN (not INNER JOIN)
      expect(routesSource).toContain('LEFT JOIN communities.members');
    });

    it('curated feed must detect user community membership', () => {
      // The query must compute whether the user is in the request's community
      expect(routesSource).toContain('in_user_community');
    });
  });

  describe('Database schema defines required columns', () => {
    it('init.sql must define visibility_scope_enum type', () => {
      // init.sql is generated from the migration seed path (ADR-087); the
      // generator emits schema-qualified DDL (public.visibility_scope_enum),
      // so assert the enum's presence without pinning the qualification form.
      expect(initSql).toMatch(/CREATE TYPE (?:public\.)?visibility_scope_enum/);
      expect(initSql).toContain("'community'");
      expect(initSql).toContain("'trust_network'");
      expect(initSql).toContain("'platform'");
    });

    it('init.sql must define visibility_scope column on help_requests', () => {
      expect(initSql).toMatch(/visibility_scope (?:public\.)?visibility_scope_enum/);
    });

    it('init.sql must define visibility_max_degrees column on help_requests', () => {
      expect(initSql).toContain('visibility_max_degrees');
    });

    it('init.sql must define default_request_scope on communities', () => {
      expect(initSql).toMatch(/default_request_scope (?:public\.)?visibility_scope_enum/);
    });

    it('init.sql must define user_feed_preferences table', () => {
      expect(initSql).toContain('user_feed_preferences');
      expect(initSql).toContain('feed_show_trust_network');
      expect(initSql).toContain('feed_show_platform');
      expect(initSql).toContain('feed_trust_network_max_degrees');
    });

    it('init.sql must define feed_weight columns on community_configs', () => {
      expect(initSql).toContain('feed_weight_skill_match');
      expect(initSql).toContain('feed_weight_trust_distance');
      expect(initSql).toContain('feed_weight_community_relevance');
      expect(initSql).toContain('feed_weight_urgency');
    });

    it('visibility_scope_enum must be defined BEFORE communities table', () => {
      // This was a real bug: the enum was defined in the requests section
      // but referenced in the communities table (communities comes first in init.sql).
      // PostgreSQL processes sequentially, so the enum must come first.
      const enumPos = initSql.search(/CREATE TYPE (?:public\.)?visibility_scope_enum/);
      const communitiesPos = initSql.indexOf('CREATE TABLE communities.communities');
      expect(enumPos).toBeGreaterThan(-1);
      expect(communitiesPos).toBeGreaterThan(-1);
      expect(enumPos).toBeLessThan(communitiesPos);
    });
  });

  describe('Migration files exist and define expected changes', () => {
    it('migration 013 exists and adds feed_weight columns', () => {
      const migration = fs.readFileSync(MIGRATION_013, 'utf-8');
      expect(migration).toContain('feed_weight_skill_match');
      expect(migration).toContain('feed_weight_trust_distance');
      expect(migration).toContain('feed_weight_community_relevance');
      expect(migration).toContain('feed_weight_urgency');
      expect(migration).toContain('community_configs');
    });

    it('migration 014 exists and adds visibility columns', () => {
      const migration = fs.readFileSync(MIGRATION_014, 'utf-8');
      expect(migration).toContain('visibility_scope_enum');
      expect(migration).toContain('visibility_scope');
      expect(migration).toContain('visibility_max_degrees');
      expect(migration).toContain('user_feed_preferences');
      expect(migration).toContain('default_request_scope');
    });
  });

  describe('Shared matching utilities export required functions', () => {
    it('exports resolveSourceTier for multi-tier feed', () => {
      expect(typeof resolveSourceTier).toBe('function');
    });

    it('exports calculateFeedScore for weighted scoring', () => {
      expect(typeof calculateFeedScore).toBe('function');
    });

    it('exports DEFAULT_FEED_WEIGHTS that sum to 1.0 (ADR-048: 7 signals)', () => {
      const sum =
        DEFAULT_FEED_WEIGHTS.feed_weight_skill_match +
        DEFAULT_FEED_WEIGHTS.feed_weight_trust_distance +
        DEFAULT_FEED_WEIGHTS.feed_weight_community_relevance +
        DEFAULT_FEED_WEIGHTS.feed_weight_urgency +
        DEFAULT_FEED_WEIGHTS.feed_weight_requester_trust +
        DEFAULT_FEED_WEIGHTS.feed_weight_prior_interaction +
        DEFAULT_FEED_WEIGHTS.feed_weight_recency;
      expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);
    });

    it('exports DEFAULT_FEED_PREFERENCES with safe defaults', () => {
      // Default: show trust network, hide platform (safe progressive disclosure)
      expect(DEFAULT_FEED_PREFERENCES.feed_show_trust_network).toBe(true);
      expect(DEFAULT_FEED_PREFERENCES.feed_show_platform).toBe(false);
      expect(DEFAULT_FEED_PREFERENCES.feed_trust_network_max_degrees).toBeGreaterThanOrEqual(1);
      expect(DEFAULT_FEED_PREFERENCES.feed_trust_network_max_degrees).toBeLessThanOrEqual(6);
    });

    it('exports VALID_VISIBILITY_SCOPES matching the database enum', () => {
      expect(VALID_VISIBILITY_SCOPES).toContain('community');
      expect(VALID_VISIBILITY_SCOPES).toContain('trust_network');
      expect(VALID_VISIBILITY_SCOPES).toContain('platform');
      expect(VALID_VISIBILITY_SCOPES).toHaveLength(3);
    });
  });

  describe('Tier resolution contract', () => {
    const defaultPrefs: UserFeedPreferences = {
      feed_show_trust_network: true,
      feed_trust_network_max_degrees: 3,
      feed_show_platform: false,
      feed_platform_categories: ['digital', 'questions'],
    };

    it('community members always see community-scoped requests', () => {
      expect(resolveSourceTier({
        inUserCommunity: true,
        visibilityScope: 'community',
        visibilityMaxDegrees: 3,
        trustDegrees: null,
        feedPrefs: defaultPrefs,
      })).toBe('community');
    });

    it('non-members do NOT see community-scoped requests', () => {
      // This was the core bug: community membership was broken,
      // so users couldn't see their own community's requests
      expect(resolveSourceTier({
        inUserCommunity: false,
        visibilityScope: 'community',
        visibilityMaxDegrees: 3,
        trustDegrees: 1,
        feedPrefs: defaultPrefs,
      })).toBeNull();
    });

    it('trust_network tier requires trust path within degree limit', () => {
      expect(resolveSourceTier({
        inUserCommunity: false,
        visibilityScope: 'trust_network',
        visibilityMaxDegrees: 3,
        trustDegrees: 2,
        feedPrefs: defaultPrefs,
      })).toBe('trust_network');

      // Beyond limit → filtered
      expect(resolveSourceTier({
        inUserCommunity: false,
        visibilityScope: 'trust_network',
        visibilityMaxDegrees: 2,
        trustDegrees: 3,
        feedPrefs: defaultPrefs,
      })).toBeNull();
    });

    it('platform tier is opt-in only', () => {
      // Default prefs have feed_show_platform: false
      expect(resolveSourceTier({
        inUserCommunity: false,
        visibilityScope: 'platform',
        visibilityMaxDegrees: 3,
        trustDegrees: null,
        feedPrefs: defaultPrefs,
      })).toBeNull();

      // Opted in → visible
      expect(resolveSourceTier({
        inUserCommunity: false,
        visibilityScope: 'platform',
        visibilityMaxDegrees: 3,
        trustDegrees: null,
        feedPrefs: { ...defaultPrefs, feed_show_platform: true },
      })).toBe('platform');
    });
  });
});
