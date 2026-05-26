# Sprint 68: Interaction Half-Life — Design Spec

**Date**: 2026-05-26
**Status**: Approved
**Version**: v9.70.0 → v9.80.0
**Sprint Branch**: `feature/sprint-68-interaction-halflife`

---

## Overview

Every help request is a transaction. Once completed and rated, the transaction has served its purpose — but the relationship it created is the asset that should persist. Sprint 68 implements this principle at the data layer: completed+rated requests hard-delete after 30 days, and trust edges decay organically over time using an Ebbinghaus-inspired half-life model.

The key architectural decision is that trust decay is **intrinsic, not scheduled**. Rather than a job that periodically rewrites weights, the `trust_edges` table stores the *parameters* of the decay function (`raw_weight`, `stability`, `last_interaction_at`), and a PostgreSQL view computes `current_weight` live on every read. No job does the decaying — time does.

The visual layer surfaces this metaphor: trust graph edges fade in opacity as relationships weaken, and completed request cards dim as they approach deletion — both signaling to users that the transaction is winding down without any explicit warning copy.

### Core Principle: The transaction fades. The relationship endures.

---

## Multi-Sprint Arc — v10.0 Trust Network

| Sprint | Theme | Status |
|--------|-------|--------|
| 65 | Trust Graph Foundation | ✅ Shipped |
| 66 | Trust Graph Visualization + Governance ADR | ✅ Shipped |
| 67 | Ego-Network + Trust-Gated Governance | ✅ Shipped |
| **68** | **Interaction Half-Life** | 🔲 This sprint |
| 69 | Fission Mechanism | 🔲 Planned |
| 70 | Fusion Mechanism | 🔲 Planned |
| 71 | v10.0 Polish + karmyq.org update | 🔲 Planned |

**June 19 LinkedIn share target**: Sprints 65–68 complete.

---

## New Concepts

### `stability`
A per-edge parameter that grows with each interaction, making the relationship more durable. Inspired by the Ebbinghaus memory stability concept: each time a memory is recalled (interaction happens), its resistance to forgetting increases. Default: `1.0` (new edge). Grows multiplicatively: `stability = stability × (1 + stability_growth_rate)` on each interaction.

### `current_weight`
The live decayed trust weight, computed as:
```
current_weight = raw_weight × e^( -days_since_last_interaction / (stability × base_half_life_days) )
```
Exposed via the `social_graph.trust_edges_live` view. Never stored — always computed.

### `trust_decay_config`
A table storing the three tunable decay parameters, with per-community overrides over a global default:
- `base_half_life_days` — half-life for a brand-new relationship (default: 30)
- `stability_growth_rate` — multiplier per interaction (default: 0.20)
- `disappearance_threshold` — `current_weight` below which the edge is deleted (default: 0.5)

---

## Decay Behavior at Default Settings

| Interactions | Stability | Effective half-life | Disappears after silence of |
|---|---|---|---|
| 1 | 1.0 | 30 days | ~90 days |
| 5 | 2.07 | 62 days | ~186 days |
| 10 | 5.16 | 155 days | ~465 days |
| 20 | 31.9 | 957 days | ~8 years |

A one-off encounter fades in 3 months. A decade of community work is essentially permanent.

---

## Data Model

### Migration: `20260526-interaction-halflife.sql`

```sql
-- 1. Add stability to trust_edges
ALTER TABLE social_graph.trust_edges
  ADD COLUMN IF NOT EXISTS stability FLOAT NOT NULL DEFAULT 1.0;

-- 2. Trust decay config table (global defaults + per-community overrides)
CREATE TABLE IF NOT EXISTS social_graph.trust_decay_config (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id          UUID REFERENCES communities.communities(id) ON DELETE CASCADE,
  base_half_life_days   FLOAT NOT NULL DEFAULT 30.0,
  stability_growth_rate FLOAT NOT NULL DEFAULT 0.20,
  disappearance_threshold FLOAT NOT NULL DEFAULT 0.5,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(community_id)  -- NULL = global default
);

-- Insert global default row
INSERT INTO social_graph.trust_decay_config
  (community_id, base_half_life_days, stability_growth_rate, disappearance_threshold)
VALUES (NULL, 30.0, 0.20, 0.5)
ON CONFLICT DO NOTHING;

-- 3. Live view: current_weight computed at read time
CREATE OR REPLACE VIEW social_graph.trust_edges_live AS
SELECT
  te.*,
  te.raw_weight * EXP(
    -EXTRACT(EPOCH FROM (NOW() - te.last_interaction_at)) / 86400.0
    / (te.stability * COALESCE(
        (SELECT base_half_life_days FROM social_graph.trust_decay_config
         WHERE community_id = te.community_id LIMIT 1),
        (SELECT base_half_life_days FROM social_graph.trust_decay_config
         WHERE community_id IS NULL LIMIT 1),
        30.0
      ))
  ) AS current_weight
FROM social_graph.trust_edges te;
```

### No existing columns removed
`raw_weight` remains — it is the peak weight (weight at last interaction), used as the base of the decay formula. The only addition to the table is `stability`.

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/trust/decay-config` | Admin | Get global decay config |
| `GET` | `/trust/decay-config/:communityId` | Admin | Get community-specific config (falls back to global) |
| `PUT` | `/trust/decay-config/:communityId` | Admin | Upsert community-specific config |

These endpoints live in `social-graph-service`. The trust graph endpoints (`GET /trust/graph/:communityId`, `GET /trust/graph`) already exist — they just need to query `trust_edges_live` instead of `trust_edges` and expose `current_weight`.

---

## Cleanup Jobs (cleanup-service)

### `trustEdgeSweepJob.ts` — Daily at 4:30 AM
Deletes trust edges where `current_weight < disappearance_threshold`. Reads threshold from `trust_decay_config` per community (falls back to global). Logs count of deleted edges.

### `requestTtlSweepJob.ts` — Daily at 2:30 AM
Hard-deletes completed + fully-rated help requests older than 30 days:
```sql
DELETE FROM requests.matches
WHERE request_id IN (
  SELECT hr.id FROM requests.help_requests hr
  WHERE hr.status = 'completed'
    AND hr.updated_at < NOW() - INTERVAL '30 days'
    AND EXISTS (
      SELECT 1 FROM requests.matches m
      WHERE m.request_id = hr.id
        AND m.requester_rating IS NOT NULL
        AND m.responder_rating IS NOT NULL
    )
);
DELETE FROM requests.help_requests
WHERE status = 'completed'
  AND updated_at < NOW() - INTERVAL '30 days';
```
Fingerprints (trust edges, karma records) are already written at completion time — this job only removes the transactional shell.

---

## Frontend Changes

### `TrustGraph.tsx` — Edge opacity from `current_weight`
The API now returns `current_weight` per edge (from the view). Map relative decay to opacity:
```typescript
// decay_ratio = current_weight / raw_weight (0.0–1.0)
// Edges at full strength render opaque; near-zero edges render at 20% opacity
const opacity = 0.2 + (decayRatio * 0.8);
```
This requires the API to return both `raw_weight` and `current_weight` per edge.

### `FeedItem.tsx` + `OfferItem.tsx` — Completed request fading
Completed requests visually dim as they age toward the 30-day deletion TTL:
```typescript
const daysSinceCompletion = (Date.now() - new Date(completedAt).getTime()) / 86_400_000;
const fadeFactor = Math.min(1, daysSinceCompletion / 30); // 0 = fresh, 1 = at TTL
const opacity = 1 - fadeFactor * 0.55; // fades from 1.0 → 0.45 over 30 days
```
No backend change needed — uses existing `completed_at` / `updated_at` on the request.

---

## User Guide & Doc Updates

Every sprint ships doc updates. This sprint:

1. **New user guide**: `apps/landing/src/data/docs/guides/interaction-half-life.json`
   - What is interaction half-life? Why do completed requests fade?
   - How trust edges strengthen with repeated interactions
   - What happens at 30 days? (request deleted, but relationship lives on)
   - How to read the fading visual cues in the trust graph and feed

2. **New ADR**: `docs/adr/ADR-056-intrinsic-trust-decay.md` + landing JSON
   - Decision: intrinsic (computed view) vs. scheduled job
   - Rationale: decay is a property of the relationship, not an external maintenance event
   - Consequences: live view cost, no decay staleness, tunable per community

3. **Update existing guide**: `apps/landing/src/data/docs/guides/trust-graph.json`
   - Add section on edge opacity and what fading means
   - Note that edges disappear when relationship goes dormant

4. **Update nav.json**: Add "Interaction Half-Life" to User Guides + ADR-056 to Architecture Decisions

---

## Critical Implementation Notes

1. **`raw_weight` is the peak, never the current weight.** `upsertTrustEdge` updates `raw_weight` only when a new interaction occurs. Never decay `raw_weight`. It is the ceiling; `current_weight` is what decays below it.

2. **Stability grows on every `upsertTrustEdge` call.** After updating interaction counts: `UPDATE SET stability = stability * (1 + coalesce(cfg.stability_growth_rate, 0.20))`. Read the community's growth rate from `trust_decay_config` (fall back to global).

3. **`trust_edges_live` is a view — queries are live.** Every read recomputes. Do not attempt to cache `current_weight` in the application layer for long periods. It is intentionally always fresh.

4. **All `getTrustGraph` and `getTrustGraphAggregate` functions must query `trust_edges_live` instead of `trust_edges`.** The `effective_weight` field returned by the API should use `current_weight` from the view.

5. **Return both `raw_weight` and `current_weight` from the trust graph API.** The frontend needs both to compute `decay_ratio` for opacity.

6. **Request TTL sweep: delete matches before help_requests** (FK constraint). Delete `requests.matches` first, then `requests.help_requests`.

7. **Sweep jobs run in cleanup-service.** Register them in `index.ts` with both a `cron.schedule` entry and a manual `/jobs/sweep-trust-edges` and `/jobs/sweep-request-ttl` admin endpoint (matching existing pattern).

8. **FeedItem/OfferItem fading is client-side only.** No API change needed — `completed_at` or `updated_at` is already returned in existing responses.

9. **Migration is additive.** `ADD COLUMN stability ... DEFAULT 1.0` — no existing rows break. All existing edges start at stability = 1.0 (conservative; they'll grow from next interaction).

10. **nav.json revert bug applies here.** Add `interaction-half-life` and `adr-056-intrinsic-trust-decay` slugs to the hardcoded list in `scripts/generate-docs.ts`.

11. **Landing docs are gitignored.** Always `git add -f apps/landing/src/data/docs/`.
