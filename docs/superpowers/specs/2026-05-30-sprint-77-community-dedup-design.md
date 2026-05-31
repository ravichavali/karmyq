# Sprint 77: Simulation Data Hygiene — Community De-duplication — Design Spec

**Date**: 2026-05-30
**Status**: Approved
**Version**: v10.5.0 → v10.6.0
**Sprint Branch**: `feature/sprint-77-community-dedup`

---

## Overview

The live demo DB (`karmyq_prod`) looks sparse and "dead" when you browse communities, and the team first read this as "the simulation isn't exercising all users." Diagnosis proved otherwise: test-user coverage is **healthy** — 500 sim users, **0** without an active community, **499/500** have created requests. The real problem is **duplication**. There are **707 communities but only 23 distinct names** (697 duplicates; "PDX Service Providers Network" appears **78 times**). The 3,047 memberships and 1,410 request-links are scattered across those 707 rows, so every individual community looks nearly empty even though aggregate activity is high.

There are two root causes, both in code:

1. **`POST /communities` is non-idempotent.** [`services/community-service/src/routes/communities.ts:446`](../../../services/community-service/src/routes/communities.ts) blindly `INSERT`s a new row regardless of whether a same-name/location community already exists. The simulation draws community names from a fixed pool of ~23 templates, so every "create community" action mints another duplicate of an existing community.
2. **The simulation's create-community cap is dead code.** [`services/simulation-service/src/workflows/create-community-workflow.ts:23-32`](../../../services/simulation-service/src/workflows/create-community-workflow.ts) fetches existing communities with `limit: 11` and then checks `existing.length >= 15` — a condition that can never be true, so the cap never fires and the workflow keeps creating.

This sprint fixes both root causes, then ships a one-time **FK/RLS-aware de-dup data migration** to repair the existing demo DB (707 → ~23), and removes the 5 leftover `@karmyq.test` e2e accounts from the simulation actor pool so e2e fixtures stay clean.

### Core Principle: Idempotent by identity, repair by re-parenting

A community's identity is its **name + location**. Creating a community that already exists by that identity should *join* it, not duplicate it. Repairing the historical mess means **re-parenting activity onto the canonical (oldest) row first, then deleting the now-empty duplicates** — never the reverse, because nearly every `community_id` foreign key is `ON DELETE CASCADE` and a naive delete would cascade away the very memberships, requests, and trust edges we are trying to consolidate.

---

## Multi-Sprint Arc

| Sprint | Focus | Status |
|--------|-------|--------|
| **75** | Dependency Vuln Remediation + CI security gate (ADR-059) | ✅ Complete + deployed (v10.4.0) |
| **76** | Code Scanning Remediation (ADR-060) + Supply-Chain Hardening (ADR-061) | ✅ Complete + deployed (v10.5.0) |
| **77** | Simulation Data Hygiene: Community De-duplication (this sprint) | ▶ Executing |
| **78** | Trust Graph Viz Polish + Depth | Upcoming (scope preserved in handoff) |

This is a standalone data-hygiene sprint slotted ahead of the deferred Trust Graph Viz work — the dedup makes the graph views (Sprint 78's subject) legible, since a 78×-duplicated community renders as 78 disconnected sparse nodes today.

---

## New Concepts

- **Community identity key**: `(LOWER(TRIM(name)), LOWER(TRIM(COALESCE(location, ''))))`. Two communities are "the same" iff their identity keys match. This is the idempotency key for `createCommunity` and the grouping key for the dedup migration.
- **Canonical community**: within an identity group, the survivor is the row with the **lowest `created_at`** (tie-break on lowest `id`). All duplicates re-parent onto it.
- **Re-parenting**: rewriting every `community_id` foreign key that points at a duplicate to point at its group's canonical id, with conflict handling for unique-constrained child tables (e.g. a user already a member of both the duplicate and the canonical).

---

## Data Model

**No schema changes.** This sprint changes endpoint *behavior* and ships a one-time data migration. The only new persistent artifact is a partial unique index that makes the idempotency guarantee durable at the DB layer:

```sql
-- Prevent future same-identity duplicates among active communities.
-- Partial (status='active') so archived/split/fused communities don't block re-creation.
CREATE UNIQUE INDEX IF NOT EXISTS idx_communities_identity_active
  ON communities.communities (LOWER(TRIM(name)), LOWER(TRIM(COALESCE(location, ''))))
  WHERE status = 'active';
```

> The unique index can only be created **after** the dedup migration has collapsed existing duplicates — otherwise index creation fails on the existing 697 dupes. Order: dedup data migration → create unique index (same migration file, after the DELETE).

### Tables that carry `community_id` (re-parent targets)

The migration must re-parent **every** table with a `community_id` referencing `communities.communities(id)`. Rather than hard-code the list (28+ migration files touch it), the migration **discovers them dynamically** from `information_schema` / `pg_constraint`. Known high-value targets, with their conflict behavior:

| Table | Unique constraint to respect | Strategy |
|-------|------------------------------|----------|
| `communities.members` | `(community_id, user_id)` unique | re-parent with `ON CONFLICT DO NOTHING`, then delete orphaned dup rows |
| `communities.community_configs` | `community_id` unique (1:1) | keep canonical's config; delete duplicates' configs |
| `requests.request_communities` | `(request_id, community_id)` | re-parent `ON CONFLICT DO NOTHING` |
| `requests.help_requests` | `community_id` (nullable) | re-parent (no unique) |
| `social_graph.trust_edges` | `(from_user, to_user, community_id)` (verify) | re-parent `ON CONFLICT DO NOTHING` |
| `reputation.community_trust_scores` | `community_id` PK | keep canonical; delete dup rows |
| `reputation.badges` | none (`ON DELETE SET NULL`) | re-parent |
| `communities.governance_*` | per-table | re-parent `ON CONFLICT DO NOTHING` |
| `communities.community_links`, fusion/fission tables | per-table | re-parent; drop self-referential links that collapse to canonical=canonical |

> **`trust_edges_live` is a VIEW** — never write it. Write `trust_edges`, read `trust_edges_live`.

After re-parenting, recompute denormalized counters on canonical rows:
```sql
UPDATE communities.communities c
SET current_members = (SELECT COUNT(*) FROM communities.members m WHERE m.community_id = c.id);
```

---

## API Endpoints

| Method | Path | Change |
|--------|------|--------|
| `POST` | `/communities` | **Behavior change → idempotent.** Before INSERT, look up an active community by identity key. If found: ensure the caller is a member (idempotent join), return the **existing** community with `200` and `data.existing: true`. If not found: create as today, return `201` with `data.existing: false`. |

Response envelope unchanged (`{ success, data, message }`). `data.existing` is the only additive field. No other endpoint changes.

**Membership-on-join behavior:** when joining an existing community, upsert a `communities.members` row for the caller (`ON CONFLICT (community_id, user_id) DO NOTHING`) and bump `current_members` only if a row was actually inserted. Respect `access_type` — for a `private` community matched by identity, do **not** auto-join; return the existing community with `existing: true` but a `message` indicating join approval is required (the sim only creates `public` communities, so this path is defensive).

---

## Frontend Changes

**None required.** The frontend already calls `POST /communities` and handles the returned community object; an idempotent response with the same shape is transparent. If the create-community UI shows a success toast, it will now correctly surface "Joined existing community" vs "Created" based on `data.existing` — a one-line optional copy tweak in the create flow, not a structural change. (List as optional polish, not a gate.)

---

## User Guide & Doc Updates

Every sprint ships docs. For this sprint:

- **Concept page — Communities / "One community per identity"**: document that community names+locations are unique among active communities and that creating an existing one joins it. Add to `apps/landing/src/data/docs/concepts/` + nav.json "Concepts".
- **Service doc — community-service**: update `apps/landing/src/data/docs/services/community-service.json` `POST /communities` description to note idempotency + the `existing` flag.
- **CONTEXT.md (community-service)**: update "API Endpoints" for `POST /communities` idempotency; add the dedup migration + unique index to "Database Schema"; add the cap-bug fix to "Recent Fixes".
- **Simulation service `.claude/README.md` / CONTEXT.md**: document the actor-pool filter (`@karmyq.test` excluded) and the corrected create-community cap.
- **ADR-062 (Community Identity & Idempotent Creation)**: architectural decision — community identity key, idempotent create, partial unique index, and the dedup repair strategy. Create ADR markdown + landing JSON + nav.json "Architecture Decisions". (This is a genuine cross-cutting decision touching the data model and an external-facing endpoint, so it warrants an ADR.)

---

## Critical Implementation Notes

1. **Re-parent BEFORE delete.** Almost every `community_id` FK is `ON DELETE CASCADE`. Deleting a duplicate before re-parenting its children cascades away memberships/requests/trust edges. Order is non-negotiable: build canonical map → re-parent all children → recount → delete empty dupes → create unique index.
2. **The migration must be FK-discovery-driven, not a hard-coded table list.** 28+ migration files add `community_id` columns; new ones will appear. Enumerate FK tables from `pg_constraint`/`information_schema` at migration time, and re-parent each generically, with explicit `ON CONFLICT DO NOTHING` for tables that have a unique constraint involving `community_id`.
3. **Dry-run first.** The migration must support a dry-run that reports: # identity groups, # communities before/after, # rows re-parented per table, # dup rows skipped on conflict — without committing. Run dry-run on the demo DB, eyeball the numbers (expect ~707 → ~23), then run for real inside a transaction.
4. **Idempotency index is partial on `status='active'`.** Archived/split/fused communities legitimately retain old names; the unique constraint must not block re-creating a name whose prior community was archived. Create the index only AFTER the dedup DELETE (it fails on existing dupes otherwise).
5. **The sim cap bug**: `discoverCommunities({ limit: 11 })` then `>= 15` is unreachable. Fix both: request enough to actually count (or use a count endpoint), and pick a coherent cap. Once `createCommunity` is idempotent the cap matters far less, but leaving dead code is a Fix-Forward violation — repair it.
6. **`@karmyq.test` actor filter** belongs in the simulation's session/actor selection, not in a workflow. Find where the actor pool is loaded and exclude `email LIKE '%@karmyq.test'` so the 5 e2e fixture accounts never receive sim workflows.
7. **JWT field is `communities`**, not `communityMemberships`. Idempotent-join membership checks read `user.communities ?? []`.
8. **`community.communities` vs `communities.communities`**: the actual schema is `communities.communities` (plural schema). Some older comments say `community.*` — trust the live DDL.
9. **This migration runs on the demo server**, against `karmyq_prod`. It is a one-time data repair — the deploy step must SSH and execute it (dry-run, verify, then real run), not just rely on `deploy.sh` auto-migrations. `git push` ships the code fixes; the data repair is a deliberate manual run.
10. **Version bump 10.5.0 → 10.6.0** in root `package.json` (minor — behavioral endpoint change + data migration). Watch the `v10-polish` version invariant test that broke on the 10.5.0 bump — update it if it pins the version.
