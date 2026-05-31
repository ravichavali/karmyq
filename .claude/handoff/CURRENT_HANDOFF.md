# Sprint 77: Simulation Data Hygiene — Community De-duplication — 📋 READY TO EXECUTE

## Handoff Document

**Date**: 2026-05-30
**Current Version**: v10.5.0 → **v10.6.0** (this sprint)
**Status**: 📋 Spec + plan written, ready to execute. Sprint 76 (v10.5.0) shipped + deployed.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-77-community-dedup`
3. Open plan: `docs/superpowers/plans/2026-05-30-sprint-77-community-dedup.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

---

## Sprint Goal

Stop the simulation from minting duplicate communities (idempotent `POST /communities` matched on **name + location, case-insensitive** + fix the dead workflow cap), repair the existing **707 → ~23** duplicated demo DB with an **FK/RLS-aware de-dup migration** (keep the **oldest** per identity, re-parent all children, dry-run + verify), and **filter `@karmyq.test` e2e accounts out of the sim actor pool** — shipping **v10.6.0**.

---

## Spec + Plan

- **Design spec**: `docs/superpowers/specs/2026-05-30-sprint-77-community-dedup-design.md`
- **Implementation plan**: `docs/superpowers/plans/2026-05-30-sprint-77-community-dedup.md`

---

## The diagnosis (why this sprint exists)

The demo DB looks "dead" not because the sim misses users — coverage is **healthy** (500 sim users, **0** without an active community, **499/500** created requests). The problem is **duplication**: **707 communities, only 23 distinct names** (697 dupes; "PDX Service Providers Network" ×78). 3,047 memberships + 1,410 request-links are scattered across the dupes, so every community looks empty.

Two root causes, both in code:
1. **`POST /communities` is non-idempotent** — [`communities.ts:446`](../../services/community-service/src/routes/communities.ts) blindly INSERTs. Sim draws from ~23 fixed templates → every create is a dupe.
2. **Sim cap is dead code** — [`create-community-workflow.ts:23-32`](../../services/simulation-service/src/workflows/create-community-workflow.ts) fetches `limit:11` then checks `>= 15` (unreachable) → cap never fires.

---

## Decisions made this planning session

1. **Idempotency key**: `(LOWER(TRIM(name)), LOWER(TRIM(COALESCE(location,''))))` — **name + location, case-insensitive**. Two real communities can share a name in different cities; templates have fixed name+location so sim dupes still collapse.
2. **Canonical survivor**: **oldest** (lowest `created_at`, tie lowest `id`). Re-parent all children onto it.
3. **e2e accounts**: **filter `@karmyq.test` out of the sim actor pool**.
4. **Version**: 10.5.0 → **10.6.0** (minor — behavioral endpoint change + data migration).

---

## ⚠️ Critical Implementation Notes (copied from spec)

1. **Re-parent BEFORE delete.** Nearly every `community_id` FK is `ON DELETE CASCADE`; deleting a dupe first cascades away its members/requests/trust edges. Order: canonical map → re-parent children → recount → delete dupes → create unique index.
2. **Migration is FK-discovery-driven**, not a hard-coded table list — enumerate FK tables from `pg_constraint`, re-parent each generically with `ON CONFLICT DO NOTHING` where a unique constraint involves `community_id`. (28+ migration files carry `community_id`.)
3. **Dry-run first** — report group count, before/after, per-table re-parent counts, skipped-on-conflict; expect ~707→~23; then run for real in a transaction.
4. **Partial unique index on `status='active'`** — create only AFTER the dedup DELETE (fails on existing dupes); archived/split/fused names must stay re-creatable.
5. **Sim cap bug**: `limit:11` vs `>=15` is unreachable — fix it (Fix-Forward), don't leave dead code.
6. **`@karmyq.test` filter** goes in actor/session selection, not a workflow.
7. **JWT field is `communities`** (`user.communities ?? []`), never `communityMemberships`.
8. **Schema is `communities.communities`** (plural) — ignore stale `community.*` comments.
9. **Migration runs on the demo server** against `karmyq_prod` — the **executing agent** runs it directly in Task 11 (backup → dry-run → verify → real run). `git push` ships only the code; the data repair is a deliberate agent-run step, fresh backup first. **Verified access (2026-05-31):** `ssh ubuntu@karmyq.com`; container `karmyq-postgres`; **user/DB `karmyq_prod`** (NOT `karmyq_user`); baseline 707/707/23 confirmed; backup tested → `~/backups/karmyq_prod-20260531-044657.dump`.
10. **Version 10.5.0 → 10.6.0**; update the `v10-polish` version invariant test if it pins the number (broke on the 10.5.0 bump — commit `d8342be`).

---

## Multi-Sprint Arc

| Sprint | Focus | Status |
|--------|-------|--------|
| **74** | Trust Graph Foundation (HEB + radial) | ✅ Complete + deployed |
| **75** | Dependency Vuln Remediation + CI security gate (ADR-059) | ✅ Complete + deployed (v10.4.0) |
| **76** | Code Scanning (ADR-060) + Supply-Chain Hardening (ADR-061) | ✅ Complete + deployed (v10.5.0) |
| **77** | Simulation Data Hygiene: Community De-duplication | 📋 Ready to execute (v10.6.0) |
| **78** | Trust Graph Viz Polish + Depth | Upcoming (scope preserved below) |
| **TBD** | Supply-Chain Hardening remainder (ADR-061 items 4–5; Socket App; log-injection logger sanitization) | Backlog |

---

## Deferred — Trust Graph Viz Polish + Depth (Sprint 78)

User feedback after Sprint 74 deployed (preserve verbatim):
- **Community + Split (HEB) views land well** — keep the graphical, structure-first approach.
- **Both ego/relationship views need rework** — My Network radial (concentric) AND dashboard "Your Network" (force-directed aggregate). Unify onto the same graphical, clustered, structure-revealing style as Community/Split. Radial fails to "tell the story of connectivity" — it double-encodes trust score (ring distance + dot size) while hiding who-connects-to-whom.
- **Dot size**: default **uniform** — size shouldn't carry meaning by default. Emphasize only the current user. Color for categorical signal (cluster/community), amber for your edges. Encode importance via position/centrality, not size.
- **Fix sizing/scoring inconsistency**: Community view trust_score = `SUM(current_weight)` (decayed) in `getFullCommunityGraph`, but ego `getTrustGraph` uses `SUM(raw_weight)` (undecayed). Make the metric consistent across views.
- Then original Depth scope: inter-community zoom view (communities as nodes) + fission edge differentiation.
- Follow UI-research-first: layout audit + reference products before implementation.

---

## Pre-Existing TDD Failures (do NOT fix)

Untouched, pre-date this sprint:
- `sprint-39-provider-ux` (7 fail)
- `sprint-43-feed-ranking` (crashes)
- `admin-schemas-api.test.ts` (request-service)
- `sprint-68-halflife` (6 DB connection tests)
- `sprint-67-governance` (DB connection tests)
- `social-graph-service/tests/tdd/sprint-66-trust-graph-visualization.test.ts`
- `social-graph-service/tests/tdd/sprint-67-ego-network.test.ts`
- `social-graph-service/tests/tdd/sprint-68-halflife.test.ts`

A NEW failure during this sprint is a real regression — resolve it, don't wave it off as pre-existing.

---

## Architecture Gotchas (Persistent)

- **Landing page docs**: `apps/landing/src/data/docs/` is in `.gitignore` — always `git add -f`
- **nav.json revert bug**: `generate-docs.ts` regenerates nav.json — run from `apps/landing/` (`npm run generate-docs`), not root; grep-verify after; re-apply if reverted
- **ADR numbering**: 059 = dependency gate, 060 = code-scanning gate, 061 = supply-chain hardening. **062 = community identity + idempotent creation (this sprint).**
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`
- **Schema is `communities.communities`** (plural schema name) — older comments saying `community.*` are stale
- **`git add` on CLAUDE.md**: tracked as lowercase `claude.md` — always `git add claude.md`
- **Solo dev — no worktrees**: work directly on feature branches
- **API response unwrap**: `createApiClient` interceptor already unwraps envelope — use `res.data`, not `res.data.data`
- **trust_edges_live is a VIEW**: never INSERT/UPDATE it. Write `trust_edges`, read `trust_edges_live`
- **Root package.json version**: 10.5.0 (→ 10.6.0 this sprint)
- **Migration-validator agent** exists — run it on new migration files (cross-schema FK, `IF NOT EXISTS` guards, schema ownership)
- **CI security gates**: dependency audit (ADR-059, blocking `--audit-level=high`) + CodeQL code-scanning gate (ADR-060) run automatically on push
