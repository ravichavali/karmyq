# Sprint 51: Trust-Score-Integrated Dibs Matching — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire real trust scores into mutual aid dibs candidate selection, add an explore/exploit two-tier fallback for first-connection candidates, and surface trust context in the DibsPrompt modal.

**Architecture:** No new tables or API endpoints. Three targeted code changes close the gaps: (1) `getMutualAidCandidates` reads `reputation.trust_scores` instead of hardcoding 50 and includes zero-interaction explore candidates via LEFT JOIN; (2) `filterEligibleCandidates` gains a two-tier exploit→explore fallback; (3) `DibsPrompt` adds a trust context summary line using already-returned data.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `docs/adr/ADR-051-explore-exploit-dibs.md` | ADR documenting explore/exploit two-tier design |
| `tests/tdd/sprint-51-trust-dibs.test.ts` | Unit tests for two-tier filtering + trust score wiring |
| `apps/landing/src/data/docs/concepts/adr-051-explore-exploit-dibs.json` | Landing page ADR entry |

### Existing files to modify
| File | Change |
|------|--------|
| `services/request-service/src/db/dibsDb.ts` | `getMutualAidCandidates`: real trust scores + LEFT JOIN for explore candidates |
| `services/request-service/src/services/dibsScoringService.ts` | Two-tier `filterEligibleCandidates` |
| `apps/frontend/src/components/requests/DibsPrompt.tsx` | Add `trustGraphConnection` to interface + trust context summary |
| `docs/guides/provider-dibs-guide.md` | Document explore/exploit behavior + trust context in modal |
| `scripts/generate-docs.ts` | Add ADR-051 to ADR arrays |
| `apps/landing/src/data/docs/nav.json` | Add ADR-051 to Architecture Decisions section |
| `services/request-service/CONTEXT.md` | Document behavior change in dibs candidate selection |
| `services/registry.json` | Version bump to v9.18.0 |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **LEFT JOIN requires COALESCE on `priorInteractions`** — after changing `INNER JOIN prior` to `LEFT JOIN prior` in `getMutualAidCandidates`, ALL uses of `prior.interaction_count` in SELECT and WHERE must be wrapped with `COALESCE(prior.interaction_count, 0)`. A bare `prior.interaction_count >= 1` will silently fail for null rows.

2. **Explore path: `sg.type = 'exchange'` only** — community-only connections (`sg.type = 'community'`) do NOT qualify for the explore tier. A vouched exchange relationship is the minimum trust bar for a cold-start first contact. Indirect connections are too weak.

3. **`reputation.trust_scores` is per-community** — the subquery uses `MAX(score)` across all of the requester's communities (`community_id = ANY($2)`). This handles multi-community requesters gracefully and defaults to 50 if no score exists.

4. **`filterEligibleCandidates` is shared** — it applies to both provider and mutual aid candidate lists. The new two-tier logic is correct for both paths: a provider with 0 prior interactions but a direct trust connection would also become an explore-tier candidate. This is intentional.

5. **`DibsCandidate` interface in `DibsPrompt.tsx`** — add `trustGraphConnection: 'direct' | 'indirect' | 'none'` to the interface. Check `apps/frontend/src/lib/api.ts` to confirm `getDibsCandidate` already returns this field (it does — it's part of `ScoredCandidate` which extends `RawCandidate`). No API changes needed.

6. **No DB migration** — `reputation.trust_scores` already exists. Do not create a migration file.

7. **ADR numbering** — highest existing ADR is 050. This sprint creates ADR-051.

---

## Task 1: Feature Branch

**Files:**
- No file changes

- [ ] **Create the sprint branch**

```bash
git checkout -b feature/sprint-51-trust-dibs
```

---

## Task 2: Fix `getMutualAidCandidates` SQL

**Files:**
- Modify: `services/request-service/src/db/dibsDb.ts`

- [ ] **Replace hardcoded `50 AS "trustScore"` with a correlated subquery**

In the `getMutualAidCandidates` function, change:
```sql
50 AS "trustScore",
```
To:
```sql
COALESCE(
  (SELECT MAX(score) FROM reputation.trust_scores
   WHERE user_id = u.id AND community_id = ANY($2)),
  50
) AS "trustScore",
```

- [ ] **Change INNER JOIN on `prior` to LEFT JOIN**

Change:
```sql
JOIN (
  SELECT ...
) prior ON prior.provider_user_id = u.id
```
To:
```sql
LEFT JOIN (
  SELECT ...
) prior ON prior.provider_user_id = u.id
```

- [ ] **Update SELECT: wrap `prior.interaction_count` in COALESCE**

Change:
```sql
prior.interaction_count AS "priorInteractions",
```
To:
```sql
COALESCE(prior.interaction_count, 0) AS "priorInteractions",
```

- [ ] **Update WHERE: replace the `prior.interaction_count >= 1` gate with explore/exploit paths**

The current WHERE has (among other conditions):
```sql
WHERE prior.interaction_count >= 1
  AND u.id != $1
  AND ...
```

Replace with:
```sql
WHERE u.id != $1
  AND u.id IN (
    SELECT DISTINCT cm.user_id
    FROM communities.members cm
    WHERE cm.community_id = ANY($2)
  )
  AND (
    COALESCE(prior.interaction_count, 0) >= 1
    OR (sg.type = 'exchange' AND COALESCE(prior.interaction_count, 0) = 0)
  )
```

- [ ] **Update the `.map()` at the bottom: use `COALESCE` result correctly**

The `priorInteractions: Number(row.priorInteractions)` line is fine — `COALESCE` ensures no nulls reach TypeScript. Verify it still reads correctly.

- [ ] **Verification: TypeScript compiles cleanly**

```bash
cd services/request-service && npx tsc --noEmit
```

---

## Task 3: Two-Tier `filterEligibleCandidates`

**Files:**
- Modify: `services/request-service/src/services/dibsScoringService.ts`

- [ ] **Replace the single-gate filter with exploit→explore two-tier logic**

Current implementation:
```typescript
export function filterEligibleCandidates(candidates: RawCandidate[]): RawCandidate[] {
  return candidates.filter(
    (c) => c.priorInteractions >= 1 && c.isAvailable === true
  );
}
```

New implementation:
```typescript
export function filterEligibleCandidates(candidates: RawCandidate[]): RawCandidate[] {
  const exploit = candidates.filter(c => c.priorInteractions >= 1 && c.isAvailable);
  if (exploit.length > 0) return exploit;
  return candidates.filter(
    c => c.priorInteractions === 0 && c.trustGraphConnection === 'direct' && c.isAvailable
  );
}
```

- [ ] **Verification: TypeScript compiles cleanly**

```bash
cd services/request-service && npx tsc --noEmit
```

---

## Task 4: TDD Unit Tests

**Files:**
- Create: `tests/tdd/sprint-51-trust-dibs.test.ts`

- [ ] **Write unit tests for `filterEligibleCandidates` and trust score wiring**

```typescript
import { filterEligibleCandidates, scoreCandidate } from '../../services/request-service/src/services/dibsScoringService';
import type { RawCandidate } from '../../services/request-service/src/db/dibsDb';

const base: RawCandidate = {
  providerId: 'p1',
  providerUserId: 'u1',
  displayName: 'Alice',
  trustScore: 75,
  priorInteractions: 2,
  trustGraphConnection: 'direct',
  isAvailable: true,
};

describe('filterEligibleCandidates — explore/exploit two-tier', () => {
  it('returns exploit tier when prior interactions >= 1', () => {
    const candidates = [
      { ...base, priorInteractions: 2 },
      { ...base, providerId: 'p2', providerUserId: 'u2', priorInteractions: 0, trustGraphConnection: 'direct' as const },
    ];
    const result = filterEligibleCandidates(candidates);
    expect(result).toHaveLength(1);
    expect(result[0].priorInteractions).toBe(2);
  });

  it('falls back to explore tier when no exploit candidates exist', () => {
    const candidates = [
      { ...base, priorInteractions: 0, trustGraphConnection: 'direct' as const },
    ];
    const result = filterEligibleCandidates(candidates);
    expect(result).toHaveLength(1);
    expect(result[0].trustGraphConnection).toBe('direct');
  });

  it('excludes indirect-only zero-interaction candidates from explore tier', () => {
    const candidates = [
      { ...base, priorInteractions: 0, trustGraphConnection: 'indirect' as const },
    ];
    const result = filterEligibleCandidates(candidates);
    expect(result).toHaveLength(0);
  });

  it('excludes unavailable candidates from both tiers', () => {
    const candidates = [
      { ...base, priorInteractions: 0, trustGraphConnection: 'direct' as const, isAvailable: false },
    ];
    const result = filterEligibleCandidates(candidates);
    expect(result).toHaveLength(0);
  });
});

describe('scoreCandidate — trust score flows through formula', () => {
  it('uses real trust score (not hardcoded 50) in the formula', () => {
    const high = scoreCandidate({ ...base, trustScore: 80, priorInteractions: 1, trustGraphConnection: 'none' });
    const low = scoreCandidate({ ...base, trustScore: 20, priorInteractions: 1, trustGraphConnection: 'none' });
    expect(high).toBeGreaterThan(low);
  });

  it('explore candidate scores lower than exploit candidate with same trust score', () => {
    const exploit = scoreCandidate({ ...base, priorInteractions: 1, trustGraphConnection: 'direct' });
    const explore = scoreCandidate({ ...base, priorInteractions: 0, trustGraphConnection: 'direct' });
    expect(exploit).toBeGreaterThan(explore);
  });
});
```

- [ ] **Run TDD tests to confirm they pass**

```bash
npm run test:tdd -- --testPathPattern="sprint-51-trust-dibs"
```

---

## Task 5: DibsPrompt Trust Context Summary

**Files:**
- Modify: `apps/frontend/src/components/requests/DibsPrompt.tsx`

- [ ] **Add `trustGraphConnection` to the `DibsCandidate` interface**

Current interface:
```typescript
export interface DibsCandidate {
  providerUserId: string
  displayName: string
  score: number
  trustScore: number
  priorInteractions: number
}
```

Add:
```typescript
export interface DibsCandidate {
  providerUserId: string
  displayName: string
  score: number
  trustScore: number
  priorInteractions: number
  trustGraphConnection: 'direct' | 'indirect' | 'none'
}
```

- [ ] **Add `trustContextSummary` helper function** (place after `formatWindow`, before the component)

```typescript
function trustContextSummary(
  priorInteractions: number,
  trustGraphConnection: 'direct' | 'indirect' | 'none'
): string {
  const parts: string[] = []
  if (priorInteractions > 0) {
    parts.push(`${priorInteractions} prior exchange${priorInteractions === 1 ? '' : 's'}`)
  }
  if (trustGraphConnection === 'direct') {
    parts.push('direct connection')
  } else if (trustGraphConnection === 'indirect') {
    parts.push('indirect connection')
  }
  if (parts.length === 0) return 'New connection'
  return parts.join(' · ')
}
```

- [ ] **Render the trust context line in the candidate card**

In the candidate card section, find the subtitle `<p className="text-xs text-text-muted">Trusted provider</p>` and replace it with the trust context summary:

```tsx
<p className="text-xs text-text-muted">
  {trustContextSummary(candidate.priorInteractions, candidate.trustGraphConnection)}
</p>
```

- [ ] **Verify TypeScript compiles cleanly in frontend**

```bash
cd apps/frontend && npx tsc --noEmit
```

- [ ] **Check `apps/frontend/src/lib/api.ts` to confirm `getDibsCandidate` response includes `trustGraphConnection`**

The API response type for dibs candidates should already include `trustGraphConnection` (it comes from `ScoredCandidate extends RawCandidate`). If the response type in `api.ts` is narrower than `ScoredCandidate`, add `trustGraphConnection` to the type there too.

---

## Task 6: ADR-051 + Guide Update + Landing Page Docs

**Files:**
- Create: `docs/adr/ADR-051-explore-exploit-dibs.md`
- Modify: `docs/guides/provider-dibs-guide.md`
- Create: `apps/landing/src/data/docs/concepts/adr-051-explore-exploit-dibs.json`
- Modify: `apps/landing/src/data/docs/nav.json`
- Modify: `scripts/generate-docs.ts`

- [ ] **Create `docs/adr/ADR-051-explore-exploit-dibs.md`**

```markdown
# ADR-051: Explore/Exploit Two-Tier Dibs Candidate Selection

**Status**: Implemented
**Date**: 2026-05-04

## Context

The dibs candidate selection system (`filterEligibleCandidates` in `dibsScoringService.ts`) previously required `priorInteractions >= 1` as a hard gate. This is pure exploitation — it only considers people the requester has worked with before. A new user, or a requester whose trusted contacts have no prior interaction history, can never have a dibs candidate selected.

## Decision

Implement a two-tier explore/exploit fallback:

**Tier 1 (exploit):** Candidates with `priorInteractions >= 1 && isAvailable`. Preferred. These are known relationships.

**Tier 2 (explore):** Candidates with `priorInteractions === 0 && trustGraphConnection === 'direct' && isAvailable`. Fallback only when Tier 1 is empty. A direct exchange connection (`social_graph.connections.type = 'exchange'`) is required — indirect (community-only) connections do not qualify.

## Rationale

- The explore tier enables first-contact dibs for requesters with no prior interaction history, using trust-graph position as the qualifying signal.
- Requiring `type = 'exchange'` (not `type = 'community'`) ensures the explore candidate has an actual completed transaction relationship with someone in the requester's trust graph — not just shared community membership.
- The scoring formula already assigns 15 points for a direct connection and 10 for indirect, so explore candidates are naturally ranked lower than exploit candidates with equivalent trust scores. The tier system is a gate, not a score override.

## Consequences

- Requesters with no prior interaction history can now receive dibs candidate suggestions.
- The explore fallback is intentionally conservative: only one degree of trust-graph separation (direct exchange connection) qualifies.
- Future work (Sprint 52+) may relax this further if the explore tier proves useful in practice.
```

- [ ] **Update `docs/guides/provider-dibs-guide.md`**

Add a section (or update an existing section) explaining:
- Dibs candidates are selected in two tiers: prior-interaction candidates first (exploit), then trusted-but-new connections as fallback (explore)
- The trust context summary in the DibsPrompt modal (e.g., "2 prior exchanges · direct connection")
- Mutual aid requests now use real trust scores, not a default value

- [ ] **Create `apps/landing/src/data/docs/concepts/adr-051-explore-exploit-dibs.json`**

```json
{
  "slug": "adr-051-explore-exploit-dibs",
  "number": "051",
  "title": "ADR-051: Explore/Exploit Two-Tier Dibs Candidate Selection",
  "status": "implemented",
  "description": "**Status**: Implemented",
  "content": "# ADR-051: Explore/Exploit Two-Tier Dibs Candidate Selection\n\n**Status**: Implemented  \n**Date**: 2026-05-04\n\n## Context\n\nThe dibs candidate selection system previously required `priorInteractions >= 1` as a hard gate — pure exploitation. A new user, or a requester whose trusted contacts have no prior interaction history, can never have a dibs candidate selected.\n\n## Decision\n\nImplement a two-tier explore/exploit fallback:\n\n**Tier 1 (exploit):** Candidates with prior interactions ≥ 1 and available. Preferred — these are known relationships.\n\n**Tier 2 (explore):** Candidates with zero prior interactions but a direct exchange connection in the trust graph. Fallback only when Tier 1 is empty. Community-only connections do not qualify.\n\n## Rationale\n\n- Enables first-contact dibs for requesters with no prior interaction history, using trust-graph position as the qualifying signal.\n- Requiring an exchange connection (not just community membership) ensures the explore candidate has a real transactional trust relationship.\n- The scoring formula already ranks explore candidates lower than exploit candidates with equivalent trust scores.\n\n## Consequences\n\n- Requesters with no prior history can now receive dibs candidate suggestions.\n- Conservative fallback: only direct exchange connections qualify for explore.\n- Future work may relax further based on observed usage.",
  "filename": "ADR-051-explore-exploit-dibs.md"
}
```

- [ ] **Add ADR-051 to `apps/landing/src/data/docs/nav.json` Architecture Decisions section**

Find the "Architecture Decisions" section and add:
```json
{ "title": "ADR-051: Explore/Exploit Dibs", "slug": "adr-051-explore-exploit-dibs" }
```

- [ ] **Update `scripts/generate-docs.ts`** to include ADR-051 in the ADR arrays (look for the ADR_NUMBERS or ADR_SLUGS array pattern and add `'051'` / the slug)

- [ ] **Regenerate landing docs**

```bash
cd apps/landing && npm run generate-docs
```

---

## Task 7: CONTEXT.md + Registry Version Bump

**Files:**
- Modify: `services/request-service/CONTEXT.md`
- Modify: `services/registry.json`

- [ ] **Update `services/request-service/CONTEXT.md`**

In the dibs candidate selection section, document:
- `getMutualAidCandidates` now reads real trust scores from `reputation.trust_scores` (MAX score across requester's communities, default 50)
- Candidate gate changed from `priorInteractions >= 1` to two-tier: exploit (prior ≥ 1) → explore fallback (0 prior + direct trust-graph connection)

- [ ] **Bump version to v9.18.0 in `services/registry.json`**

Find the version field and update from `9.17.0` to `9.18.0`.

- [ ] **Run feedback check**

```bash
npm run feedback:check
```

---

## Task 8: Type Check + Tests + Merge + Deploy

**Files:**
- No new files

- [ ] **Run full type check across both modified services**

```bash
cd services/request-service && npx tsc --noEmit
cd ../../apps/frontend && npx tsc --noEmit
```

- [ ] **Run unit + regression tests**

```bash
npm test
```

- [ ] **Run TDD tests**

```bash
npm run test:tdd
```

- [ ] **Merge to master and deploy**

```bash
git add -A
git commit -m "feat(dibs): Sprint 51 — explore/exploit candidate selection + real trust scores"
git checkout master
git merge feature/sprint-51-trust-dibs
git push origin master
```

Monitor GitHub Actions for deploy success. Use `/deploy` skill if manual deploy is needed.
