# Sprint 90: Designed to Forget — Design Spec

**Date**: 2026-06-07
**Status**: Approved
**Version**: v10.13.0 → v10.14.0
**Sprint Branch**: `feature/sprint-90-designed-to-forget`

---

## Overview

Karmyq's manifesto (§7) and ADR-066 promise a platform that is **"designed to forget"** — relationships
that fade when they go quiet, a system that lets go of what it no longer needs. As of Sprint 89 that
promise is *partially* real but **entirely invisible**. The decay machinery exists server-side:
`trust_edges_live.current_weight` decays exponentially (ADR-056), `trustEdgeSweepJob` literally `DELETE`s
trust edges once their decayed weight drops below a `disappearance_threshold`, reputation decays
(ADR-011/039), and requests expire and get TTL-swept. But a member can't *see* any of it, and the
content of past exchanges (request free-text, conversation messages) is retained
forever. The forgetting is ranking math, not a trustworthy, perceptible promise.

Sprint 90 makes "designed to forget" **real for content and visible for members**. Two halves:

1. **A real retention policy** — a new `memoryRetentionJob` (joining the existing cleanup-service job
   family) that forgets the *content* of past exchanges on configurable windows: completed-request
   free-text (`title`, `description`, `payload`, `requirements`) is **anonymized to a sentinel** (the
   karma/match aggregate survives untouched so reputation math stays correct), expired/unmatched requests
   are **hard-deleted**, and conversation messages forget **with their parent exchange**.

   > **Karma is deliberately out of scope (review correction, 2026-06-07).** `reputation.karma_records`
   > holds no free-text PII — `reason` is a load-bearing enum (`'Provided help'` / `'Received help'` /
   > milestone strings) that trust-metrics, community-trust, and the karma breakdown all filter on
   > (`reason IN ('Provided help','Received help')` across `trustMetricsDb`, `communityTrustService`,
   > `reputation.ts`). Anonymizing it would silently corrupt trust scores. There is nothing safe to
   > forget there, so `karma_records` is left fully intact — which *strengthens* the keep-aggregates
   > principle rather than weakening it.
2. **Visible decay** — relationships that perceptibly fade through a `decayTier` (strong → warm → fading
   → nearly-forgotten) derived from `current_weight` vs `disappearance_threshold`, a re-warming nudge at
   the nearly-forgotten tier, a plain-language transparency page ("What Karmyq remembers — and what it
   lets go"), and a warm-restyled member profile with a **memory** section showing what's held and what's
   fading.

Member controls this sprint are **transparency only** — members can *see* what's remembered and fading;
forgetting runs automatically on policy windows. Per-item "forget this now" / export are deferred.

### Core Principle: Forgetting you can feel, on aggregates you can trust

The platform forgets the *details* (request free-text, messages) while keeping the *aggregates*
(that you helped, your karma, your trust score). Members can perceive bonds fading and read exactly what
the platform holds versus lets go. Nothing about reputation math breaks, because only anonymizable
free-text is forgotten — never the numbers downstream systems depend on.

---

## Multi-Sprint Arc

- **Sprint 87** — Product Truth & UX Reset; warm-commons direction approved. ✅ v10.11.0.
- **Sprint 88** — Core help-loop redesign: shared shell + Dashboard Home + Community feed. ✅ v10.12.0.
- **Sprint 89** — Community sovereignty redesign: the whole community page (four warm tabs). ✅ v10.13.0.
- **Sprint 90 (THIS)** — Designed to forget: real content retention + visible decay + profile memory. → v10.14.0.
- **Sprint 91** — Mobile parity from the polished web model.
- **Sprint 92** — Architecture & service pruning.

---

## New Concepts

### Exchange Unit (the cascade rule)

An **Exchange Unit** is the spine of forgetting: a `help_request` + its `match` + the `conversation`
linked to that match (`messaging.conversations.request_match_id`) + that conversation's `messages`.
**Forgetting cascades along the Exchange Unit.** When a completed request's content is forgotten, its
conversation's messages are forgotten *in the same pass and transaction* — they are the same exchange.
The `match` and `karma_records` rows are **never touched** (they are the aggregate). Expired/unmatched
requests have no match and therefore no conversation, so they hard-delete cleanly with nothing to
cascade. (A standalone age-based message backstop also forgets any messages older than the message
window that somehow escaped the exchange cascade, e.g. very long-lived conversations.)

### Retention windows

Configurable per-community (with a global default row), mirroring the existing `trust_decay_config`
pattern. Three windows:

| Window | Default | Governs |
|--------|---------|---------|
| `completed_request_window_days` | 180 | Anonymize completed-request free-text (`title`/`description`/`payload`/`requirements`) + cascade messages |
| `expired_request_window_days` | 30 | Hard-delete expired (`expired = TRUE`) / unmatched requests |
| `message_window_days` | 180 | Standalone backstop for old messages not caught by the cascade |

### Decay tier (the visible-decay model — ADR-070)

A qualitative tier derived from a relationship edge's decayed weight relative to its disappearance
threshold. Let `r = current_weight / disappearance_threshold`:

| Tier | Condition | Meaning |
|------|-----------|---------|
| `strong` | `r ≥ 3` | Active, well-tended bond |
| `warm` | `2 ≤ r < 3` | Healthy |
| `fading` | `1.3 ≤ r < 2` | Going quiet; visibly faded |
| `nearly_forgotten` | `1 ≤ r < 1.3` | About to be swept — **triggers the re-warming nudge** |
| (swept) | `r < 1` | Edge deleted by `trustEdgeSweepJob`; no longer returned |

Tier is computed server-side from values the live view already exposes — no new decay math, only a
classification over `current_weight` and the resolved `disappearance_threshold`.

---

## Data Model

All schema changes ship as ONE migration: `infrastructure/postgres/migrations/20260607-designed-to-forget.sql`.
Every statement is idempotent (`IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`). Mirror the
`trust_decay_config` precedent exactly for the config table.

```sql
-- 1. Retention config (mirrors social_graph.trust_decay_config: cross-schema FK to communities is the
--    established pattern; NULL = global default). NOTE: a bare UNIQUE(community_id) does NOT prevent
--    duplicate NULL global rows in Postgres (NULLs are distinct), so ON CONFLICT won't fire on re-run.
--    A partial unique index on the NULL row + a guarded insert make the migration truly idempotent.
CREATE TABLE IF NOT EXISTS requests.retention_config (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id                  UUID REFERENCES communities.communities(id) ON DELETE CASCADE,
  completed_request_window_days INT NOT NULL DEFAULT 180,
  expired_request_window_days   INT NOT NULL DEFAULT 30,
  message_window_days           INT NOT NULL DEFAULT 180,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(community_id)  -- guards per-community rows (non-null)
);

-- Enforce a single global (NULL) row — bare UNIQUE can't
CREATE UNIQUE INDEX IF NOT EXISTS uq_retention_config_global
  ON requests.retention_config ((community_id IS NULL)) WHERE community_id IS NULL;

-- Seed the global default row, idempotently (ON CONFLICT can't target the NULL row)
INSERT INTO requests.retention_config (community_id)
SELECT NULL
WHERE NOT EXISTS (SELECT 1 FROM requests.retention_config WHERE community_id IS NULL);

-- 2. Forgetting markers (anonymization stamps — content is sentinelled, stamp records WHEN).
--    Karma is intentionally NOT included: karma_records has no PII and its reason is a load-bearing enum.
ALTER TABLE requests.help_requests ADD COLUMN IF NOT EXISTS content_forgotten_at TIMESTAMPTZ NULL;
ALTER TABLE messaging.messages     ADD COLUMN IF NOT EXISTS forgotten_at         TIMESTAMPTZ NULL;

-- 3. Partial indexes so each sweep only scans not-yet-forgotten rows
CREATE INDEX IF NOT EXISTS idx_help_requests_not_forgotten
  ON requests.help_requests (updated_at) WHERE content_forgotten_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_not_forgotten
  ON messaging.messages (created_at) WHERE forgotten_at IS NULL;
```

**Anonymization semantics (what the job writes — all target columns are `NOT NULL`, so use sentinels, never `NULL`):**
- `help_requests`: `title = '[forgotten]'`, `description = '[forgotten]'`, `payload = '{}'::jsonb`, `requirements = '{}'::jsonb`, stamp `content_forgotten_at = NOW()`. Keep status, category, `request_type`, timestamps, match linkage.
- `messages`: `content = '[forgotten]'`, stamp `forgotten_at = NOW()`. Keep sender/conversation/timestamps for thread integrity.
- `karma_records`: **untouched.** No PII; `reason` enum is consumed by trust math.
- Expired/unmatched requests: `DELETE FROM requests.help_requests WHERE expired = TRUE AND NOT EXISTS (match on this request) AND updated_at < now() - expired_request_window_days`. **Age from `updated_at`, NOT `created_at`** — the expiration job stamps `updated_at = CURRENT_TIMESTAMP` when it sets `expired = TRUE`, so a long-lived request that only just expired must not be deleted immediately. Hard delete; ON DELETE CASCADE handles any stray child rows.
- Completed-request trigger (no `completed_at` column exists): `status = 'completed' AND updated_at < now() - completed_window AND content_forgotten_at IS NULL`.

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/trust/graph/:communityId/full` (**extend**) | member | The endpoint that actually powers `TrustGraphTab` (`getFullCommunityGraph()`). Each edge gains `currentWeight`, `disappearanceThreshold`, `decayTier`. |
| GET | `/trust/graph/:communityId` (**extend**) | member | Ego-network graph (`getTrustGraph()`). Same per-edge `decayTier` fields. |
| GET | `/trust/me/memory?communityId=` (new) | member | Profile memory section: `activeCount`, `fading[]`, `nearlyForgotten[]` (peers w/ decayTier), derived from `trust_edges_live`. |
| GET | `/trust/relationships/fading?communityId=` (new) | member | Nearly-forgotten edges for the re-warming nudge (decayTier === 'nearly_forgotten'). May be folded into `/trust/me/memory`. |
| GET | `/api/requests/retention-policy?communityId=` (new) | member | Resolved retention windows + counts of what's currently forgotten/held for the member — backs the transparency page. Read-only; no PII. |

> **Endpoint reality (review correction, 2026-06-07):** there is NO `/api/social-graph/connections`
> endpoint. The "How we're connected" surface is served by `services/social-graph-service/src/routes/trustGraph.ts`
> (`/trust/graph/:communityId` + `/trust/graph/:communityId/full`), consumed via `socialGraphService.getTrustGraph()` /
> `getFullCommunityGraph()` (`apps/frontend/src/lib/api.ts`) in `TrustGraphTab.tsx`. **decayTier must be
> added to those two routes** (and any feed/card trust-badge data path that renders a relationship face),
> not to a new `/connections` endpoint, or the fade won't reach the UI. New `/trust/me/memory` and
> `/trust/relationships/fading` routes are added to the same `trustGraph.ts` router.

All responses follow the standard `{ success, data, message }` envelope. `decayTier` classification lives
in a shared helper so backend and any TDD test compute it identically.

---

## Frontend Changes

| Page / Component | Change |
|------------------|--------|
| `TrustGraphTab` / "How we're connected" | Trust faces + edges visibly fade by `decayTier` (opacity/desaturation ramp + tier label on hover). New `decayTier` styling tokens in `karmyq-shell.css`. |
| `TrustPathBadge` (`apps/frontend/src/components/TrustPathBadge.tsx`, shared) | Accept `decayTier`; render the fade consistently wherever the trust badge appears (feed cards + graph). **There is no `RelationshipFace` component** — `TrustPathBadge` is the shared relationship-face element. |
| `ReWarmingNudge` (new) | Gentle card shown when a once-strong bond is `nearly_forgotten`: "You and {name} used to help each other often — reconnect before it fades." Links to message/relationship. |
| `TransparencyPage` (new, `/about/memory` or community-scoped section) | Plain-language "What Karmyq remembers — and what it lets go": the three windows, what anonymizes vs hard-deletes, the Exchange Unit cascade, what's kept (aggregates). Pulls live windows from `/retention-policy`. |
| Member profile (`profile/[id]` or `/profile`) | **Warm restyle** to S87–89 commons look (serif hero, `.kq-*` shell) **+ a Memory section**: active relationships, which are fading, karma trend, and a one-line "what we'll let go if a bond stays quiet." |

---

## User Guide & Doc Updates

Mandatory this sprint (not optional):

- **New concept page** `apps/landing/src/data/docs/concepts/designed-to-forget.json` — the forgetting
  philosophy + the retention policy in plain language + the decay-tier model. Add to nav.json "Concepts".
- **New ADR pages** (landing): `adr-069-data-retention-and-forgetting.json`,
  `adr-070-visible-decay-model.json`. Add both to nav.json "Architecture Decisions".
- **User guide** `apps/landing/src/data/docs/guides/your-memory-and-relationships.json` — how to read the
  profile memory section, the fading visuals, and the re-warming nudge. Add to nav.json "User Guides".
- **Service docs** updates: `cleanup-service.json` (new `memoryRetentionJob`), `social-graph.json`
  (decay-tier endpoints), `request.json` (retention-policy endpoint).
- **Onboarding**: update `apps/frontend/src/lib/onboarding/workflows.ts` for any workflow that now
  references the memory/transparency surfaces.
- **`docs/adr/ADR-069-*.md` + `docs/adr/ADR-070-*.md`** in-repo + `docs/adr/README.md` index.

---

## Critical Implementation Notes

1. **`karma_records` is OFF LIMITS — never write to it.** Its `reason` is a load-bearing enum
   (`'Provided help'` / `'Received help'` / milestones) filtered across `trustMetricsDb`,
   `trustEvolutionDb`, `communityTrustService`, and the `reputation.ts` karma breakdown. There is no
   free-text PII to forget. Touching `reason` or `points` silently corrupts trust scores. Forgetting
   only ever writes `help_requests` and `messages`.
2. **Target columns are `NOT NULL` — sentinel, never `NULL`.** `help_requests.title`/`description` and
   `messages.content` are all `NOT NULL`; setting `NULL` throws. Write `'[forgotten]'` (and `'{}'::jsonb`
   for `payload`/`requirements`). **`messages.content` is the column, NOT `body`.** Conversations link to
   an exchange via `messaging.conversations.request_match_id` — the cascade join (request → match →
   conversation → messages).
3. **Forget ALL request free-text, not just `description`.** `title`, `description`, `payload`, and
   `requirements` all carry member content. Anonymizing only `description` leaves PII in `title`/`payload`.
4. **Exchange Unit cascade runs in one transaction per exchange.** Anonymize the request and its
   conversation's messages together, or none — partial forgetting is a bug. (Karma is not part of the cascade.)
5. **Expired model is the `expired` boolean, NOT `status='expired'`.** `help_requests.status` is
   `open`/`dibs_pending`/`matched`/`completed`/`cancelled` (CHECK in migration `20260603-feed-vocab-reconciliation.sql`)
   — **never `expired`**; the expiration job sets the separate `expired = TRUE` flag. Hard-delete only
   `expired = TRUE` rows with **no match**, and **age from `updated_at`** (the expiration job stamps
   `updated_at` when it flips the flag) — aging from `created_at` would delete a just-expired old request
   immediately. A request that was matched then expired keeps the anonymize path (it has an aggregate).
6. **`retention_config` mirrors `trust_decay_config` — but a bare `UNIQUE(community_id)` does NOT make
   the NULL global row unique** (Postgres treats NULLs as distinct, so `ON CONFLICT DO NOTHING` won't
   fire on re-run → duplicate global rows). Add a partial unique index `WHERE community_id IS NULL` and
   seed with a `WHERE NOT EXISTS` guard. Resolution order: community row → global row → hardcoded default.
   Cross-schema FK to `communities.communities` is the established precedent (run the migration-validator agent anyway).
7. **decayTier is a shared pure helper.** One function `classifyDecayTier(currentWeight, threshold)`
   consumed by the `/trust/graph/:communityId(/full)` routes, `/trust/me/memory`, and TDD tests — never inline the band math in two
   places (it will drift). The nudge fires only on `nearly_forgotten`.
8. **The job lives in cleanup-service** alongside `trustEdgeSweepJob` / `reputationDecayJob` /
   `expirationJob` / `requestTtlSweepJob`, wired into the same scheduler in `src/index.ts`. It writes
   to `requests` and `messaging` schemas — cleanup-service already does cross-schema work.
9. **JWT field is `communities`** (not `communityMemberships`) for the membership gate on the new
   member-facing endpoints. `user.communities ?? []`.
10. **API unwrap rule:** `createApiClient` already unwraps the envelope — frontend consumes `res.data`,
   not `res.data.data`.
11. **`trust_edges_live` is a VIEW** — read `current_weight` from it; never INSERT/UPDATE the view. The
    sweep deletes from `trust_edges` (base table); the tier classification only reads.
12. **No empty profile tiles.** The memory section suppresses rows with no data (no fading bonds → hide
    that block); never render a "0 fading relationships" placeholder that reads as broken.
12. **Landing docs are gitignored** — `apps/landing/src/data/docs/` needs `git add -f`. **nav.json
    reverts** after `generate-docs` — grep-verify and re-apply.
13. **ADR numbering:** ADR-069 + ADR-070 created this sprint. Next free after = **071**.
14. **Idempotent migration + seed the global config row** so dev/demo/CI all have a default window set
    on first run; the job no-ops safely if the config table is empty (falls back to hardcoded defaults).
