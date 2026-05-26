# Sprint 68: Interaction Half-Life | READY TO EXECUTE 🔲

## Handoff Document

**Date**: 2026-05-26
**Current Version**: v9.70.0 → v9.80.0 (Sprint 68 target)
**Status**: Sprint 67 shipped. Sprint 68 planned and ready to execute.

---

## Quick Start

1. Read this handoff (especially the Critical Notes below)
2. Check out branch: `git checkout -b feature/sprint-68-interaction-halflife`
3. Open plan: `docs/superpowers/plans/2026-05-26-sprint-68-interaction-halflife.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

---

## Sprint 68 Goal

**Interaction Half-Life** — Replace stored trust weight snapshots with intrinsic Ebbinghaus decay (computed live via a DB view), hard-delete completed+rated requests after 30 days (fingerprints preserved), and surface the half-life metaphor visually: fading edges in the trust graph and fading completed request cards in the feed.

---

## Core Design Philosophy

> **The transaction fades. The relationship endures.**

Once a request is completed and rated, the transaction has served its purpose. The relationship it created — encoded as a trust edge with `stability` and `raw_weight` — persists and decays on its own biological clock. Decay is **intrinsic**: a PostgreSQL view computes `current_weight` live from stored parameters. No job does the decaying; time does.

---

## What Gets Built

### 1. DB schema changes (social-graph-service)
- `stability FLOAT DEFAULT 1.0` added to `social_graph.trust_edges`
- `social_graph.trust_decay_config` table — tunable per community: `base_half_life_days` (30), `stability_growth_rate` (0.20), `disappearance_threshold` (0.5)
- `social_graph.trust_edges_live` VIEW — computes `current_weight = raw_weight × e^(-days/(stability × half_life))` on every read

### 2. Service layer (social-graph-service)
- `upsertTrustEdge` grows `stability` on each interaction: `stability = stability × (1 + growth_rate)`
- `getTrustGraph*` functions query `trust_edges_live`, return both `raw_weight` and `current_weight` per edge
- Three admin endpoints: `GET/PUT /trust/decay-config`, `GET /trust/decay-config/:communityId`

### 3. Sweep jobs (cleanup-service)
- `trustEdgeSweepJob.ts` — daily 4:30 AM: deletes edges where `current_weight < disappearance_threshold`
- `requestTtlSweepJob.ts` — daily 2:30 AM: hard-deletes completed+rated requests older than 30 days

### 4. Frontend
- `TrustGraph.tsx` — edge opacity from `decay_ratio = current_weight / raw_weight` (0.2 → 1.0)
- `FeedItem.tsx` + `OfferItem.tsx` — completed items fade toward 0.45 opacity as they approach 30-day deletion

### 5. Docs
- ADR-056: Intrinsic Trust Decay
- User guide: Interaction Half-Life
- Updated: trust-graph user guide (add fading section)

---

## Design Reference

- **Spec**: `docs/superpowers/specs/2026-05-26-sprint-68-interaction-halflife-design.md`
- **Plan**: `docs/superpowers/plans/2026-05-26-sprint-68-interaction-halflife.md`

---

## ⚠️ Critical Implementation Notes

1. **`raw_weight` is peak weight, never decayed.** Only update it when a new interaction occurs. It is the ceiling; `current_weight` decays below it.

2. **Stability grows on every `upsertTrustEdge` call.** Read community's `stability_growth_rate` from `trust_decay_config` (fall back to NULL = global row). Formula: `stability = stability * (1 + rate)`.

3. **All `getTrustGraph*` functions must query `trust_edges_live`, not `trust_edges`.** The view adds `current_weight` to every row.

4. **Return both `raw_weight` and `current_weight` from the API.** Frontend needs both to compute `decay_ratio` for opacity.

5. **Request TTL sweep: delete `requests.matches` before `requests.help_requests`** (FK constraint).

6. **Sweep jobs follow existing cleanup-service pattern**: job function + `cron.schedule` + admin POST endpoint.

7. **FeedItem/OfferItem fading is client-side only** — no API change needed. Use existing `completed_at` / `updated_at`.

8. **Migration is additive**: `ADD COLUMN stability FLOAT NOT NULL DEFAULT 1.0` — zero rows break.

9. **nav.json revert bug**: add `interaction-half-life` + `adr-056-intrinsic-trust-decay` to hardcoded slug list in `scripts/generate-docs.ts`.

10. **Landing docs are gitignored**: always `git add -f apps/landing/src/data/docs/`.

11. **`trust_edges_live` is a view — never a table.** Do not attempt to `INSERT` or `UPDATE` it.

12. **Migration must be applied manually on demo server** during deploy (deploy.sh doesn't auto-apply):
    ```bash
    docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod \
      -f ~/karmyq/infrastructure/postgres/migrations/20260526-interaction-halflife.sql
    ```

---

## Decay Behavior (default config)

| Interactions | Effective half-life | Disappears after silence |
|---|---|---|
| 1 | 30 days | ~90 days |
| 5 | 62 days | ~186 days |
| 10 | 155 days | ~465 days |
| 20 | 957 days | ~8 years |

---

## v10.0 Trust Network Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| **65** | Trust Graph Foundation | ✅ Shipped v9.50.0 |
| **66** | Trust Graph Visualization + Governance ADR | ✅ Shipped v9.60.0 |
| **67** | Ego-Network + Governance | ✅ Shipped v9.70.0 |
| **68** | Interaction Half-Life | 🔲 Ready to execute |
| 69 | Fission Mechanism | 🔲 Planned |
| 70 | Fusion Mechanism | 🔲 Planned |
| 71 | v10.0 Polish + karmyq.org update | 🔲 Planned |

**June 19th LinkedIn share target**: Sprints 65–68 complete.

---

## Architecture Gotchas (Persistent)

- **Landing page docs**: `apps/landing/src/data/docs/` is in `.gitignore` — always `git add -f`.
- **ADR numbering**: Next ADR after Sprint 68 is **057**.
- **TDD test placement**: Social-graph sprint tests go in `services/social-graph-service/tests/tdd/`. Community tests in `services/community-service/tests/tdd/`.
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`.
- **`git add` on CLAUDE.md**: Tracked as lowercase `claude.md` — always `git add claude.md`.
- **Pre-existing TDD failures**: `sprint-39-provider-ux` (7 fail), `sprint-43-feed-ranking` (crashes). Do NOT fix.
- **Solo dev — no worktrees**: Work directly on feature branches.
- **nav.json revert bug**: `generate-docs.ts` regenerates nav.json on every build. Always add new slugs to the hardcoded list in `scripts/generate-docs.ts`.
- **Demo DB credentials**: `docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod` — postgres not running as local socket.
- **Sprint 65 migration applied**: 670 trust_edges rows, 4 interaction_weights backfilled on demo server.
