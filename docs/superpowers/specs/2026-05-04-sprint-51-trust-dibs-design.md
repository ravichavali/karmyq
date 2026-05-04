# Sprint 51: Trust-Score-Integrated Dibs Matching — Design Spec

**Date**: 2026-05-04
**Status**: Approved
**Version**: v9.17.0 → v9.18.0
**Sprint Branch**: `feature/sprint-51-trust-dibs`

---

## Overview

Sprint 50 completed the provider on/off duty API, dibs for all request types, and a simplified nav. The dibs candidate selection system now works end-to-end — but it runs on incomplete data. For mutual aid requests (non-service), every candidate receives a hardcoded trust score of 50 regardless of their actual reputation. The trust formula (ADR-037, ADR-042) exists and is persisted to `reputation.trust_scores`, but the query that selects mutual aid candidates never reads it.

This sprint fixes that gap and extends the candidate selection model with an explore/exploit two-tier design. Currently, a candidate must have at least one prior completed interaction with the requester to qualify for dibs. This pure-exploitation gate means a requester with no interaction history — or a highly-trusted person they've never worked with — can never be selected. Sprint 51 adds a fallback explore tier: when no exploitation candidates exist, direct trust-graph connections (zero prior interactions) become eligible.

On the frontend, the `DibsPrompt` modal already receives `trustGraphConnection` from the API but ignores it. A one-line trust context summary makes the selection legible to requesters — they see why this person was chosen, not just a number.

### Core Principle: Trust-Informed First Contact

The dibs system's job is to make the requester's first outreach go to the most trustworthy person available. "Trustworthy" should mean real signal — prior exchanges, trust graph position, and community reputation — not a hardcoded default that neutralizes half the scoring formula.

---

## Multi-Sprint Arc

### Sprint 42 — Dibs infrastructure (complete)
Built the dibs table, scoring formula, and API. Providers already had real trust scores via `reputation.provider_trust_scores`.

### Sprint 50 — Wire the toggle + lift restrictions (complete)
Dibs now works for all request types. Availability toggle calls the API. Provider nav simplified.

### Sprint 51 — Trust score integration + explore/exploit (this sprint)
Wire real trust scores for mutual aid candidates. Add explore fallback tier. Surface trust context in DibsPrompt.

### Sprint 52+ — Trust-path visibility, platform-scoped service requests (future)
IDEAS.md [2026-03-31] raised whether service requests should be platform-scoped rather than community-scoped. That's a larger architectural decision and is deferred.

---

## New Concepts

### Exploit tier
Dibs candidates who have at least one prior completed interaction with the requester. These are preferred — the requester already knows them.

### Explore tier
Dibs candidates with zero prior interactions but a direct trust-graph connection to the requester (`social_graph.connections.type = 'exchange'`). Only eligible as a fallback when the exploit tier is empty. Indirect connections (`type = 'community'`) do NOT qualify for explore — the signal is too weak for a cold-start first contact.

---

## Data Model

No schema changes. All required tables already exist:

| Table | Use |
|-------|-----|
| `reputation.trust_scores` | Per-user, per-community trust scores (ADR-037 formula) |
| `reputation.provider_trust_scores` | Provider-specific trust scores (ADR-042) — unchanged |
| `social_graph.connections` | Trust graph edges (`type`: exchange/community) — already joined |

The `reputation.trust_scores` schema:
```sql
CREATE TABLE reputation.trust_scores (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    community_id UUID NOT NULL,
    score INTEGER DEFAULT 50,
    requests_completed INTEGER DEFAULT 0,
    offers_accepted INTEGER DEFAULT 0,
    average_feedback NUMERIC(3,2) DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, community_id)
);
```

---

## API Endpoints

No new or modified endpoints. The existing `GET /requests/:id/dibs-candidate` already returns `trustGraphConnection` and `priorInteractions` in its response. The frontend change consumes data already in the response.

---

## Backend Changes

### `getMutualAidCandidates` (dibsDb.ts)

**Current problem**: Uses `INNER JOIN` on the prior-interactions subquery (excludes zero-interaction users entirely) and hardcodes `50 AS "trustScore"`.

**Fix 1 — Real trust scores:**
```sql
COALESCE(
  (SELECT MAX(score) FROM reputation.trust_scores
   WHERE user_id = u.id AND community_id = ANY($2)),
  50
) AS "trustScore"
```
Takes the max score across all of the requester's communities. Defaults to 50 if no score exists (cold start protection).

**Fix 2 — Explore candidates via LEFT JOIN:**
Change `INNER JOIN prior` → `LEFT JOIN prior`, then update `SELECT` and `WHERE`:
- `COALESCE(prior.interaction_count, 0) AS "priorInteractions"`
- `WHERE`: add explore path alongside exploit path

```sql
WHERE u.id != $1
  AND u.id IN (
    SELECT DISTINCT cm.user_id FROM communities.members cm
    WHERE cm.community_id = ANY($2)
  )
  AND (
    COALESCE(prior.interaction_count, 0) >= 1            -- exploit tier
    OR (sg.type = 'exchange'                             -- explore tier
        AND COALESCE(prior.interaction_count, 0) = 0)
  )
```

The explore path requires `sg.type = 'exchange'` specifically — community-only connections do not qualify.

### `filterEligibleCandidates` (dibsScoringService.ts)

**Current**: Single filter — `priorInteractions >= 1 && isAvailable`.

**New**: Two-tier with fallback:

```typescript
export function filterEligibleCandidates(candidates: RawCandidate[]): RawCandidate[] {
  const exploit = candidates.filter(c => c.priorInteractions >= 1 && c.isAvailable);
  if (exploit.length > 0) return exploit;
  return candidates.filter(
    c => c.priorInteractions === 0 && c.trustGraphConnection === 'direct' && c.isAvailable
  );
}
```

The scoring formula (trustScore × 0.50 + interactions × 11.67 + trustGraphBonus) already assigns 15 points for a direct trust connection, so explore candidates are naturally scored lower than exploit candidates who have the same trust score. The tier separation just ensures exploit is always preferred when available.

---

## Frontend Changes

### `DibsPrompt.tsx`

Add a trust context line above the existing trust score display. Data is already present in the component — `trustGraphConnection` is just unused today.

**Trust context helper:**
- `priorInteractions > 0` → `"N prior exchange(s)"`
- `trustGraphConnection === 'direct'` → `"direct connection"`
- `trustGraphConnection === 'indirect'` → `"indirect connection"`
- Both: `"2 prior exchanges · direct connection"`
- Neither (explore fallback, 0 interactions + direct connection): `"New connection · direct trust link"`
- Truly unknown: `"New connection"`

Display style: small muted line above the trust score badge. No new components needed — implement inline or as a small helper function in the same file.

---

## User Guide & Doc Updates

Every sprint ships doc updates.

| Document | Change |
|----------|--------|
| `docs/guides/provider-dibs-guide.md` | Add section explaining explore/exploit behavior: when a direct-trust-graph connection with no prior history may be selected as a first-dibs candidate |
| `apps/landing/src/data/docs/` | Regenerate via `npm run generate-docs` after guide update |
| Landing page ADR entry | New `adr-051-explore-exploit-dibs.json` + nav.json entry |
| `scripts/generate-docs.ts` | Add ADR-051 to ADR arrays; update guide slug/label if needed |

---

## Critical Implementation Notes

1. **`reputation.trust_scores` is per-community** — the subquery takes `MAX(score)` across the requester's communities. This handles requesters who belong to multiple communities.

2. **LEFT JOIN adds null rows** — `priorInteractions` must become `COALESCE(prior.interaction_count, 0)` in both the SELECT and WHERE. Do not leave `prior.interaction_count` unguarded or you'll get null comparison bugs.

3. **Explore tier: `exchange` only, not `community`** — `social_graph.connections.type = 'exchange'` means both users completed a real transaction. `type = 'community'` means they share a community membership. Only exchange connections qualify for explore. This is the intent of the ADR-051 design.

4. **`filterEligibleCandidates` applies to BOTH provider and mutual aid paths** — the function is shared. The new two-tier logic applies correctly to both, since providers with zero interactions and a direct trust connection will also be considered if no exploitation candidates exist. This is correct behavior.

5. **No DB migration needed** — `reputation.trust_scores` already exists and is populated by the karma/match completion events.

6. **ADR numbering** — highest existing ADR is 050. This sprint creates ADR-051.
