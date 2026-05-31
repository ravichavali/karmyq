# ADR-062: Community Identity & Idempotent Creation

**Status**: Implemented
**Date**: 2026-05-30
**Sprint**: 77

---

## Context

The demo database accumulated **707 communities across only ~23 distinct names** (697 duplicates; "PDX Service Providers Network" appeared 78 times). 3,047 memberships and 1,410 request-links were scattered across these duplicates, so every community looked nearly empty even though aggregate coverage was healthy (500 sim users, 0 without a community, 499/500 created requests). The demo *looked* dead purely because of fragmentation.

Two code-level root causes:

1. **`POST /communities` was non-idempotent.** The route blindly `INSERT`ed a new row on every call. The simulation draws community names from ~23 fixed templates, so every sim "create community" action minted another duplicate of a template.
2. **The simulation's create-community cap was dead code.** The workflow fetched `discoverCommunities({ limit: 11 })` and then checked `existing.length >= 15` — unreachable, so the cap never fired.

A third, smaller issue: the e2e/integration fixture accounts (`@karmyq.test`) could in principle be drawn into the sim actor pool and have workflows run against them, corrupting their state.

## Decision

### 1. Community identity = case-insensitive (name, location)

A community's **identity** is the pair `(LOWER(TRIM(name)), LOWER(TRIM(COALESCE(location, ''))))`. Location is part of the key because two genuinely different communities may share a name in different cities; a null/absent location coalesces to `''`. The fixed sim templates have constant name+location, so their duplicates collapse to one identity.

### 2. Idempotent `POST /communities` (join-if-exists)

Before inserting, the route looks up an **active** community by identity key (ordered `created_at ASC, id ASC` so it resolves to the canonical/oldest row):

- **Found (public):** upsert the caller into `communities.members` (`ON CONFLICT DO NOTHING`), bump `current_members` only if a row was inserted, refresh the JWT, and return the existing community with `existing: true`, HTTP `200`.
- **Found (private):** do not auto-join; return the existing community with `existing: true`, `joined: false`, and an approval-required message.
- **Not found:** fall through to the normal create path; return `existing: false`, HTTP `201`.

### 3. Partial unique index enforces one active community per identity

```sql
CREATE UNIQUE INDEX idx_communities_identity_active
  ON communities.communities (LOWER(TRIM(name)), LOWER(TRIM(COALESCE(location, ''))))
  WHERE status = 'active';
```

The index is **partial on `status = 'active'`** so archived / split / fused communities keep their (now-inactive) names and identities remain re-creatable.

### 4. One-time de-duplication repair (re-parent before delete)

A one-time migration (`infrastructure/postgres/migrations/20260530-community-dedup.sql`) collapses existing duplicates:

1. Build a `canonical_map(dup_id → canonical_id)` per identity group; the **oldest** row (lowest `created_at`, tie lowest `id`) survives.
2. **Re-parent before delete.** Nearly every `community_id` FK is `ON DELETE CASCADE`, so deleting a duplicate first would cascade away its members/requests/trust edges. Children are re-parented onto the canonical id first.
3. **FK discovery is catalog-driven** (`pg_constraint`), not a hard-coded table list. For single-FK child tables, rows are re-parented with collision-safe handling: where a UNIQUE index involves the FK column, colliding rows are deleted before the `UPDATE` (this also correctly handles the 1:1 tables `community_configs` / `community_trust_scores` — keep canonical, drop duplicates).
4. **Relationship tables with ≥2 FKs to communities** (`community_links`, `community_trust_edges`, `fusion_proposals`, `split_proposals`) couple their community columns with CHECK (`a <> b`), ordering, or composite-unique constraints. Re-parenting their columns independently would create self-references and violate those constraints, and the rows are themselves inter-duplicate sim artifacts — so any row referencing a duplicate in *any* community column is deleted (`community_trust_edges` is a recomputable aggregate).
5. Recompute `current_members` on survivors, delete the now-empty duplicates, create the partial unique index.

The script runs in one transaction with a `\if :dryrun` ROLLBACK/COMMIT guard so it can be dry-run (printing per-table re-parent/delete counts) before being committed for real.

### 5. Exclude e2e fixtures from the sim actor pool

The actor-pool query selects only `@test.karmyq.com` sim users and **explicitly excludes `@karmyq.test`** fixtures (`SIM_ACTOR_POOL_FILTER` in `db-user-loader.ts`). The positive domain filter already excluded them; the explicit `NOT LIKE` is defense-in-depth.

### 6. Fix the simulation cap

The unreachable `limit:11`/`>=15` check is replaced with a coherent `MAX_COMMUNITIES = 50` bound (fetch `limit: MAX_COMMUNITIES + 1`, skip when `>= MAX_COMMUNITIES`). With idempotent creation, runaway duplication is impossible regardless; the cap just bounds churn.

## Consequences

- **Positive:** Communities consolidate — membership and activity concentrate on one row per identity, so the demo reflects real coverage. Creation is safe to retry; the unique index prevents regression.
- **Behavioral change:** `POST /communities` may now return `200` + `existing: true` (joined an existing community) instead of always `201`. Clients should read the `existing` flag rather than assuming a new row was created.
- **Trade-off:** Two communities can no longer share a name in the same location while both active. This is intended (it is the identity definition); different locations remain distinct.
- **Data note:** Inter-duplicate relationship rows (sister links, community-trust aggregates, fusion/fission proposals among duplicates) are dropped rather than re-parented. `community_trust_edges` is recomputed by the trust pipeline; the others were sim artifacts.

## Related

- [ADR-001](ADR-001-postgresql-schemas.md): PostgreSQL Schemas
- [ADR-004](ADR-004-microservices-event-driven.md): Microservices + Event-Driven
