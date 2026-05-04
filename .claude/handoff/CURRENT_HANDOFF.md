# SPRINT 51 — Trust-Score-Integrated Dibs Matching | Ready to Execute

## Handoff Document

**Date**: 2026-05-04
**Current Version**: v9.17.0 (deploying to v9.18.0)
**Status**: Sprint 51 fully planned. Sprint 50 deployed at commit `997c730`.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-51-trust-dibs`
3. Open plan: `docs/superpowers/plans/2026-05-04-sprint-51-trust-dibs.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

---

## Sprint 51 Goal

Wire real trust scores into mutual aid dibs candidate selection, add explore/exploit two-tier fallback for first-connection candidates, and surface trust context in the DibsPrompt modal. No new API endpoints or DB migrations — three targeted code changes.

---

## What Sprint 51 Delivers

### 1. Real trust scores for mutual aid candidates (`dibsDb.ts`)
`getMutualAidCandidates()` currently hardcodes `trustScore: 50` for every candidate. The `reputation.trust_scores` table exists and is populated — the query just never reads it. Fix: correlated subquery takes `MAX(score)` across the requester's communities, defaulting to 50.

### 2. Explore/exploit two-tier candidate selection (`dibsScoringService.ts`)
The current `priorInteractions >= 1` gate is pure exploitation. New design (ADR-051):
- **Tier 1 (exploit):** prior interactions ≥ 1 + available — preferred
- **Tier 2 (explore):** 0 prior interactions + `trustGraphConnection === 'direct'` + available — fallback only when Tier 1 is empty

Community-only connections (`type = 'community'`) do NOT qualify for the explore tier — only direct exchange connections do.

### 3. DibsPrompt trust context (`DibsPrompt.tsx`)
`DibsCandidate` interface adds `trustGraphConnection`. A helper `trustContextSummary()` replaces the hardcoded "Trusted provider" subtitle with live context: "2 prior exchanges · direct connection" or "New connection · direct trust link".

---

## Spec and Plan

| Artifact | Path |
|----------|------|
| Design spec | `docs/superpowers/specs/2026-05-04-sprint-51-trust-dibs-design.md` |
| Implementation plan | `docs/superpowers/plans/2026-05-04-sprint-51-trust-dibs.md` |

---

## Critical Implementation Notes (copied verbatim from spec)

1. **LEFT JOIN requires COALESCE on `priorInteractions`** — after changing `INNER JOIN prior` to `LEFT JOIN prior`, ALL uses of `prior.interaction_count` in SELECT and WHERE must be wrapped with `COALESCE(prior.interaction_count, 0)`. A bare `prior.interaction_count >= 1` will silently fail for null rows.

2. **Explore path: `sg.type = 'exchange'` only** — community-only connections (`sg.type = 'community'`) do NOT qualify for the explore tier.

3. **`reputation.trust_scores` is per-community** — use `MAX(score)` across `community_id = ANY($2)`. Defaults to 50 if no score exists.

4. **`filterEligibleCandidates` is shared** — applies to both provider and mutual aid candidate lists. Two-tier logic is correct for both.

5. **`DibsCandidate` interface in `DibsPrompt.tsx`** — add `trustGraphConnection: 'direct' | 'indirect' | 'none'`. The API already returns this field from `ScoredCandidate`. No API changes needed.

6. **No DB migration** — `reputation.trust_scores` already exists.

7. **ADR numbering** — next ADR is 051.

---

## Files to Change

### Backend
| File | Change |
|------|--------|
| `services/request-service/src/db/dibsDb.ts` | `getMutualAidCandidates`: real trust scores + LEFT JOIN + explore WHERE |
| `services/request-service/src/services/dibsScoringService.ts` | Two-tier `filterEligibleCandidates` |

### Frontend
| File | Change |
|------|--------|
| `apps/frontend/src/components/requests/DibsPrompt.tsx` | Add `trustGraphConnection` to interface + trust context summary |

### Docs / ADR / Tests
| File | Change |
|------|--------|
| `docs/adr/ADR-051-explore-exploit-dibs.md` | New |
| `docs/guides/provider-dibs-guide.md` | Update explore/exploit section |
| `tests/tdd/sprint-51-trust-dibs.test.ts` | New — 6 unit tests |
| `scripts/generate-docs.ts` | Add ADR-051 |
| `apps/landing/src/data/docs/concepts/adr-051-explore-exploit-dibs.json` | New |
| `apps/landing/src/data/docs/nav.json` | Add ADR-051 entry |
| `services/request-service/CONTEXT.md` | Document behavior change |
| `services/registry.json` | Version bump v9.17.0 → v9.18.0 |

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 37–42 | Provider profiles, rate cards, offers, dibs infrastructure | ✅ Complete |
| Sprint 50 | Wire toggle + lift scheduled-only restriction + nav simplification | ✅ Complete |
| **Sprint 51** | **Trust scores + explore/exploit + trust context UI** | ⬜ Ready to execute |
| Sprint 52+ | Platform-scoped service requests, trust-path visibility | 🔮 Future |

---

## Architecture Gotchas (Persistent)

- **Landing page docs source**: edit `docs/guides/*.md` + update `scripts/generate-docs.ts` arrays. Run `cd apps/landing && npm run generate-docs` to regenerate. Never hand-edit `apps/landing/src/data/docs/` directly.
- **ADR numbering**: highest existing ADR is 050. This sprint creates ADR-051. Next after will be 052.
- **Router mount paths**: always mount at full path (e.g. `/communities/trust-questions`) when router uses `router.get('/')`.
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`.
- **Feed weights**: no sum constraint; normalized at query time in feed-service.
- **trust-questions route**: must be registered BEFORE the generic config route in `community-service/src/index.ts`.
- **`git add` on CLAUDE.md**: file is tracked as lowercase `claude.md` — always `git add claude.md`.
- **Pre-existing TDD failures**: `sprint-39-provider-ux` (7 tests fail) and `sprint-43-feed-ranking` (crashes). These are NOT regressions — do not attempt to fix them.
- **Solo dev — no worktrees**: work directly on feature branches (`git checkout -b feature/sprint-NN`). Worktrees cause hundreds of npm install prompts, lockfile conflicts, and jest path bugs.
- **`?type=` routing in dibs-candidate**: `type === 'service'` → `getBestCandidate` (provider_profiles). Anything else → `getMutualAidBestCandidate` (auth.users).
- **Provider nav (post Sprint 50)**: `ProviderModeSwitcher` and `ProviderNotificationBell` are no longer rendered anywhere. Do not add them back. The only provider control in the nav is the availability dot in `Layout.tsx`.
