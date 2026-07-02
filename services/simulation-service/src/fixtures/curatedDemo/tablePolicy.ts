/**
 * Sprint 117 — Curated Demo Fixtures: table coverage policy.
 *
 * PostgreSQL catalogs — not the legacy `truncate-database.sql` list — define what the reset
 * touches. Every base table in a managed application schema MUST be classified `reset`,
 * `reseed`, or `preserve`; an unclassified base table is a hard failure so a newly-added table
 * can never be silently wiped or silently skipped. Views (e.g. `social_graph.trust_edges_live`)
 * are never classified and never truncated.
 */

export const MANAGED_SCHEMAS = [
  'auth', 'communities', 'requests', 'provider', 'reputation', 'messaging',
  'notifications', 'feedback', 'governance', 'events', 'feed', 'social_graph', 'federation',
] as const;

export type TablePolicy = 'reset' | 'reseed' | 'preserve';

export interface CatalogTable {
  schema: string;
  table: string;
  /** `BASE TABLE` or `VIEW` from `information_schema.tables`. Only base tables are classified. */
  tableType: string;
}

export interface ClassifiedTableSet {
  reset: string[];
  reseed: string[];
  preserve: string[];
}

/**
 * Explicit classification for every base table in the managed schemas plus the public
 * geocoding cache. `reset` = user/runtime data truncated; `reseed` = per-demo config truncated
 * and repopulated by the baseline; `preserve` = infra identity or immutable global seed/catalog.
 */
export const TABLE_POLICY: Record<string, TablePolicy> = {
  // --- auth: all user identity/runtime data ---
  'auth.users': 'reset',
  'auth.sessions': 'reset',
  'auth.refresh_tokens': 'reset',
  'auth.user_skills': 'reset',
  'auth.user_invitations': 'reset',
  'auth.social_distances': 'reset',
  'auth.inviter_stats': 'reset',
  'auth.user_privacy_settings': 'reset',
  'auth.user_feed_preferences': 'reset',
  'auth.user_request_preferences': 'reset',
  'auth.user_interests': 'reset',
  'auth.user_tags': 'reset',
  'auth.device_push_tokens': 'reset',
  'auth.founding_circle_submissions': 'reset',

  // --- communities: entities/runtime reset; per-demo config reseeded; global templates preserved ---
  'communities.communities': 'reset',
  'communities.members': 'reset',
  'communities.norms': 'reset',
  'communities.norm_approvals': 'reset',
  'communities.settings': 'reseed',
  'communities.community_configs': 'reseed',
  'communities.activities': 'reset',
  'communities.activity_participants': 'reset',
  'communities.community_links': 'reset',
  'communities.fusion_proposals': 'reset',
  'communities.fusion_votes': 'reset',
  'communities.governance_nominations': 'reset',
  'communities.governance_ratifications': 'reset',
  'communities.health_summary': 'reset',
  'communities.split_member_assignments': 'reset',
  'communities.split_proposals': 'reset',
  'communities.split_votes': 'reset',
  'communities.trust_questions': 'reset',
  'communities.trust_question_choices': 'reset',
  'communities.config_templates': 'preserve',

  // --- requests: runtime reset; retention config reseeded; UI catalogs preserved ---
  'requests.help_requests': 'reset',
  'requests.request_communities': 'reset',
  'requests.help_offers': 'reset',
  'requests.matches': 'reset',
  'requests.dibs': 'reset',
  'requests.request_admin_notes': 'reset',
  'requests.provider_profiles': 'reset',
  'requests.provider_ride_details': 'reset',
  'requests.provider_rate_cards': 'reset',
  'requests.feed_events': 'reset',
  'requests.interaction_feedback': 'reset',
  'requests.collective_community_links': 'reset',
  'requests.provider_collective_members': 'reset',
  'requests.provider_collectives': 'reset',
  'requests.retention_config': 'reseed',
  'requests.ui_schemas': 'preserve',
  'requests.ui_schema_versions': 'preserve',
  'requests.validation_rules': 'preserve',

  // --- provider ---
  'provider.offers': 'reset',

  // --- reputation: all derived/runtime data reset ---
  'reputation.karma_records': 'reset',
  'reputation.trust_scores': 'reset',
  'reputation.badges': 'reset',
  'reputation.provider_reviews': 'reset',
  'reputation.provider_trust_scores': 'reset',
  'reputation.community_trust_scores': 'reset',
  'reputation.user_trust_configs': 'reset',
  'reputation.user_trust_evolution_log': 'reset',
  'reputation.community_evolution_log': 'reset',
  'reputation.user_trust_preferences': 'reset',
  'reputation.activity_log': 'reset',
  'reputation.community_health_metrics': 'reset',
  'reputation.milestone_events': 'reset',

  // --- messaging ---
  'messaging.conversations': 'reset',
  'messaging.conversation_participants': 'reset',
  'messaging.messages': 'reset',

  // --- notifications ---
  'notifications.notifications': 'reset',
  'notifications.preferences': 'reset',
  'notifications.global_preferences': 'reset',

  // --- feedback: entries + their category rows reset (categories are a child of feedback) ---
  'feedback.feedback': 'reset',
  'feedback.feedback_categories': 'reset',

  // --- governance ---
  'governance.proposals': 'reset',
  'governance.votes': 'reset',
  'governance.conflict_cases': 'reset',
  'governance.conflict_mediators': 'reset',

  // --- events ---
  'events.event_log': 'reset',

  // --- feed ---
  'feed.preferences': 'reset',
  'feed.dismissed_items': 'reset',
  'feed.featured_stories': 'reset',

  // --- social_graph: derived edges reset; per-demo decay config reseeded; global weights preserved ---
  'social_graph.connections': 'reset',
  'social_graph.trust_edges': 'reset',
  'social_graph.community_trust_edges': 'reset',
  'social_graph.trust_decay_config': 'reseed',
  // interaction_weights.community_id → communities: a community-scoped child, so it is reset and
  // its global (NULL-community) defaults are reinserted by the baseline.
  'social_graph.interaction_weights': 'reseed',

  // --- federation: only the local instance identity survives ---
  'federation.local_instance': 'preserve',
  'federation.instances': 'reset',
  'federation.federation_links': 'reset',
  'federation.blocked_instances': 'reset',
  'federation.federated_users': 'reset',
  'federation.federated_user_mappings': 'reset',
  'federation.federated_requests': 'reset',
  'federation.federated_communities': 'reset',
  'federation.inbox': 'reset',
  'federation.outbox': 'reset',
  'federation.reputation_attestations': 'reset',
  'federation.user_migrations': 'reset',

  // --- public: geocoding cache is outside the managed schemas but must be reset explicitly ---
  'public.geocoding_cache': 'reset',
};

/**
 * Classify catalog base tables into reset/reseed/preserve. Views are skipped entirely. Any
 * base table absent from {@link TABLE_POLICY} throws — the reset fails closed on schema drift.
 */
export function classifyTables(catalog: CatalogTable[]): ClassifiedTableSet {
  const result: ClassifiedTableSet = { reset: [], reseed: [], preserve: [] };
  for (const entry of catalog) {
    if (entry.tableType !== 'BASE TABLE') continue; // never classify or truncate views
    const key = `${entry.schema}.${entry.table}`;
    const policy = TABLE_POLICY[key];
    if (!policy) {
      throw new Error(`Refusing reset: unclassified table ${key}. Add it to TABLE_POLICY before running.`);
    }
    result[policy].push(key);
  }
  return result;
}

/** SQL to enumerate managed base tables plus the public geocoding cache. */
export const CATALOG_QUERY = `
  SELECT table_schema AS schema, table_name AS "table", table_type AS "tableType"
  FROM information_schema.tables
  WHERE (table_schema = ANY($1::text[]) OR (table_schema = 'public' AND table_name = 'geocoding_cache'))
    AND table_type = 'BASE TABLE'
  ORDER BY table_schema, table_name
`;

/** SQL to enumerate managed views separately, for diagnostics only. Never truncated. */
export const VIEW_QUERY = `
  SELECT table_schema AS schema, table_name AS "table", table_type AS "tableType"
  FROM information_schema.tables
  WHERE table_schema = ANY($1::text[])
    AND table_type = 'VIEW'
  ORDER BY table_schema, table_name
`;
