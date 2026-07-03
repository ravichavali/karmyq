/**
 * Sprint 117 — Curated Demo Fixtures: transactional baseline writer.
 *
 * Runs inside one `pg.PoolClient` transaction owned by the reset coordinator. It first clears
 * the classified reset/reseed tables, then writes the compiled baseline in dependency order via
 * parameterized queries only. It never disables constraints, never reads a secret (the credential
 * hash is passed in), and never touches Bull subscribers or another service's runtime code.
 *
 * Reset uses DELETE (not TRUNCATE CASCADE) so `ON DELETE SET NULL` audit columns on preserved
 * catalogs (e.g. `requests.ui_schemas.created_by`) keep their seed rows while user-owned data
 * cascades away. Deletion order is discovered by a savepoint fixpoint rather than hand-ranked, so
 * any future FK edge is handled without editing an ordering list.
 *
 * NOTE: source-entity inserts and the global reseed live here; the completed-exchange projection
 * inserts are added in Task 6, and remaining per-community config/lifecycle tables plus the
 * DB-backed assertions are completed in Task 10 against the migrated PostgreSQL database.
 */

import type { PoolClient } from 'pg';
import {
  projectCompletedExchanges,
  type CommunityProjectionConfig,
  type CompletedExchangeEvent,
} from '@karmyq/shared';
import { exchangeMatchId } from './compiler';
import type { ClassifiedTableSet } from './tablePolicy';
import type { CompiledDemoBaseline, RequestLifecycle } from './types';

/**
 * Map the rich fixture lifecycle to the DB-allowed `requests.help_requests.status` set
 * (`chk_help_requests_status`: open | dibs_pending | matched | completed | cancelled). Lifecycle
 * nuance not representable in `status` is carried by other columns — expiry by the `expired`
 * boolean, forgetting by the `[forgotten]` redaction — so those lanes map to a valid status while
 * keeping their real behaviour. Exhaustive over RequestLifecycle so a new value is a compile error.
 */
export const DB_REQUEST_STATUS: Record<RequestLifecycle, string> = {
  open: 'open',
  proposed: 'matched',
  matched: 'matched',
  completed: 'completed',
  rejected: 'cancelled',
  declined: 'cancelled',
  cancelled: 'cancelled',
  expired: 'open', // expiry is carried by the `expired` boolean column
  forgotten: 'cancelled',
};

export function toDbRequestStatus(lifecycle: RequestLifecycle): string {
  return DB_REQUEST_STATUS[lifecycle];
}

// Platform defaults (config_templates seed + trust_decay_config default). The demo baseline uses
// the same values the live platform seeds, so projected trust/karma are truthful, not tuned.
const DEFAULT_MATCH_COMPLETED_WEIGHT = 10.0;
const DEFAULT_KARMA_SPLIT_HELPER = 60;
const DEFAULT_KARMA_SPLIT_REQUESTER = 40;
const DEFAULT_BASE_KARMA_POOL = 100;
const DEFAULT_STABILITY_GROWTH_RATE = 0.2;

const IDENT = /^[a-z_]+\.[a-z_]+$/;

function assertIdent(table: string): string {
  if (!IDENT.test(table)) throw new Error(`Refusing reset: unsafe table identifier ${table}`);
  return table;
}

/**
 * Clear every reset/reseed table with a savepoint fixpoint: attempt each DELETE, roll back the
 * ones an FK still blocks, and repeat until the set stops shrinking. This discovers a valid
 * child→parent order without a hand-ranked list and without relying on cascades — many FKs into
 * `auth.users` (e.g. `requests.help_requests.requester_id`) are the default `NO ACTION`, so a
 * naive `DELETE FROM auth.users` first would be FK-blocked and abort the whole transaction.
 * `ON DELETE SET NULL` audit columns on preserved catalogs keep their rows (only nulled) because
 * those catalog tables are never in the managed set.
 */
export async function resetData(client: PoolClient, tables: ClassifiedTableSet): Promise<void> {
  const managed = [...tables.reset, ...tables.reseed].map(assertIdent);

  let remaining = [...managed];
  let previousCount = remaining.length + 1;
  while (remaining.length > 0 && remaining.length < previousCount) {
    previousCount = remaining.length;
    const stillBlocked: string[] = [];
    for (const table of remaining) {
      await client.query('SAVEPOINT reset_sp');
      try {
        await client.query(`DELETE FROM ${table}`);
        await client.query('RELEASE SAVEPOINT reset_sp');
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT reset_sp');
        if (isForeignKeyViolation(err)) {
          stillBlocked.push(table);
        } else {
          throw err;
        }
      }
    }
    remaining = stillBlocked;
  }
  if (remaining.length > 0) {
    throw new Error(`Refusing reset: could not clear tables (FK cycle?): ${remaining.join(', ')}`);
  }
}

function isForeignKeyViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23503';
}

/** Write the compiled baseline. Reset first, then source rows in FK-dependency order. */
export async function writeBaseline(
  client: PoolClient,
  baseline: CompiledDemoBaseline,
  tables: ClassifiedTableSet,
  credentialHash: string,
): Promise<void> {
  await resetData(client, tables);

  const nameByUserId = new Map(baseline.people.map(p => [p.id, p.name]));

  // 1. Users
  for (const person of baseline.people) {
    await client.query(
      `INSERT INTO auth.users (id, email, name, password_hash, bio, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)`,
      [person.id, person.email, person.name, credentialHash, person.bio, baseline.anchor],
    );
  }

  // 2. Communities
  for (const community of baseline.communities) {
    await client.query(
      `INSERT INTO communities.communities
         (id, name, description, category, community_type, creator_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $7)`,
      [community.id, community.name, community.name, community.category, community.communityType, community.creatorId, baseline.anchor],
    );
    // Reseed per-community settings (TTLs/half-life) using platform defaults.
    await client.query(
      `INSERT INTO communities.settings (community_id, created_at, updated_at) VALUES ($1, $2, $2)`,
      [community.id, baseline.anchor],
    );
  }

  // 3. Memberships
  for (const membership of baseline.memberships) {
    await client.query(
      `INSERT INTO communities.members (id, community_id, user_id, role, status, joined_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [membership.id, membership.communityId, membership.userId, membership.role, membership.status, membership.joinedAt],
    );
  }

  // 4. Activities (community events)
  for (const activity of baseline.activities) {
    await client.query(
      `INSERT INTO communities.activities
         (id, community_id, created_by, title, description, activity_type, scheduled_at, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'social', $6, 'open', $7, $7)`,
      [activity.id, activity.communityId, activity.organizerId, activity.title, activity.description, activity.scheduledAt, activity.createdAt],
    );
  }

  // 5. Help requests + community junctions + matches
  for (const request of baseline.requests) {
    await client.query(
      `INSERT INTO requests.help_requests
         (id, requester_id, title, description, category, status, expired, expires_at,
          request_type, visibility_scope, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::request_type_enum, $10::visibility_scope_enum, $11, $11)`,
      [
        request.id, request.requesterId, request.title, request.description, request.category,
        toDbRequestStatus(request.status), request.expired, request.expiresAt, request.requestType, request.visibility,
        request.createdAt,
      ],
    );
    for (const communityId of request.communityIds) {
      await client.query(
        `INSERT INTO requests.request_communities (request_id, community_id, created_at)
         VALUES ($1, $2, $3)`,
        [request.id, communityId, request.createdAt],
      );
    }
    if (request.match) {
      await client.query(
        `INSERT INTO requests.matches (id, request_id, responder_id, status, completed_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6)`,
        [request.match.id, request.match.requestId, request.match.responderId, request.match.status, request.match.completedAt, request.match.createdAt],
      );
    }
  }

  // 6. Provider profiles
  for (const provider of baseline.providers) {
    await client.query(
      `INSERT INTO requests.provider_profiles (id, user_id, service_type, display_name, bio, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, TRUE, $6, $6)`,
      [provider.id, provider.userId, provider.serviceType, nameByUserId.get(provider.userId) ?? 'Provider', provider.description, baseline.anchor],
    );
  }

  // 7. Governance proposals
  for (const proposal of baseline.governance) {
    await client.query(
      `INSERT INTO governance.proposals (id, community_id, proposed_by, type, title, description, status, proposed_at)
       VALUES ($1, $2, $3, 'norm', $4, $5, $6, $7)`,
      [proposal.id, proposal.communityId, proposal.proposerId, proposal.title, proposal.description, proposal.status, proposal.createdAt],
    );
  }

  // 8. Global reseed: default interaction weights and trust-decay config (community-agnostic).
  await client.query(
    `INSERT INTO social_graph.interaction_weights (community_id, interaction_type, weight) VALUES
       (NULL, 'match_completed', 10.0),
       (NULL, 'endorsement', 5.0),
       (NULL, 'karma_given', 3.0),
       (NULL, 'event', 2.0)
     ON CONFLICT DO NOTHING`,
  );
  await client.query(
    `INSERT INTO social_graph.trust_decay_config (community_id, base_half_life_days, stability_growth_rate, disappearance_threshold)
     VALUES (NULL, 30.0, 0.20, 0.5)
     ON CONFLICT DO NOTHING`,
  );

  // 9. Completed-exchange projection inserts (connections, trust edges, karma) — added in Task 6.
  await insertProjections(client, baseline);
}

/**
 * Insert the derived trust/karma projection using the fixture-only, equivalence-locked
 * `projectCompletedExchanges`. Events are grouped by community and each group is projected with
 * that community's config, so an exchange's karma stays in the community where the help happened
 * (demo exchanges are single-community and no pair spans communities). Connections are deduped by
 * the normalized-pair unique index. This never calls or mutates a live Bull subscriber.
 */
async function insertProjections(client: PoolClient, baseline: CompiledDemoBaseline): Promise<void> {
  const eventsByCommunity = new Map<string, CompletedExchangeEvent[]>();
  for (const exchange of baseline.projectionEvents) {
    const event: CompletedExchangeEvent = {
      key: exchange.key,
      requesterId: exchange.requesterId,
      helperId: exchange.helperId,
      communityId: exchange.communityId,
      completedAt: exchange.completedAt,
      requestType: 'generic',
    };
    const bucket = eventsByCommunity.get(exchange.communityId);
    if (bucket) bucket.push(event);
    else eventsByCommunity.set(exchange.communityId, [event]);
  }

  for (const [communityId, events] of eventsByCommunity) {
    const communityConfigs: CommunityProjectionConfig[] = [{
      community_id: communityId,
      matchCompletedWeight: DEFAULT_MATCH_COMPLETED_WEIGHT,
      karma_split_helper: DEFAULT_KARMA_SPLIT_HELPER,
      karma_split_requestor: DEFAULT_KARMA_SPLIT_REQUESTER,
    }];
    const projection = projectCompletedExchanges(events, {
      stabilityGrowthRate: DEFAULT_STABILITY_GROWTH_RATE,
      basePool: DEFAULT_BASE_KARMA_POOL,
      communityConfigs,
    });

    for (const conn of projection.connections) {
      await client.query(
        `INSERT INTO social_graph.connections (user_a_id, user_b_id, type, first_connected_at, last_interaction_at)
         VALUES ($1, $2, 'exchange', $3, $4)
         ON CONFLICT DO NOTHING`,
        [conn.userAId, conn.userBId, conn.firstConnectedAt, conn.lastInteractionAt],
      );
    }

    for (const edge of projection.trustEdges) {
      await client.query(
        `INSERT INTO social_graph.trust_edges
           (user_id_a, user_id_b, community_id, match_completed_count, raw_weight, stability, last_interaction_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $7)
         ON CONFLICT (user_id_a, user_id_b, community_id) DO UPDATE SET
           match_completed_count = EXCLUDED.match_completed_count,
           raw_weight = EXCLUDED.raw_weight,
           stability = EXCLUDED.stability,
           last_interaction_at = EXCLUDED.last_interaction_at`,
        [edge.userIdA, edge.userIdB, edge.communityId, edge.matchCompletedCount, edge.rawWeight, edge.stability, edge.lastInteractionAt, edge.firstInteractionAt],
      );
    }

    for (const record of projection.karmaRecords) {
      // The projection carries the exchange's semantic key in relatedEntityId; map it back to the
      // completed match's UUID so the value is valid for the UUID column.
      await client.query(
        `INSERT INTO reputation.karma_records (user_id, community_id, points, reason, related_entity_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [record.userId, record.communityId, record.points, record.reason, exchangeMatchId(record.relatedEntityId), record.createdAt],
      );
    }
  }
}
