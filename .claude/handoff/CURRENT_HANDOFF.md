# SPRINT 51 — Trust-Score-Integrated Dibs Matching | ✅ Complete

## Handoff Document

**Date**: 2026-05-05
**Current Version**: v9.18.0 (deployed at commit `5fc53e0`)
**Status**: Sprint 51 complete. Memory system refactored. Ready for Sprint 52 planning.

---

## What Was Just Completed (Sprint 51)

Sprint 51 deployed at commit `5fc53e0` on 2026-05-04.

### Changes Made

**Backend (`services/request-service`)**
- `src/db/dibsDb.ts` — `getMutualAidCandidates`: replaced hardcoded `trustScore: 50` with a correlated subquery (`MAX(score)` from `reputation.trust_scores` across requester's communities, COALESCE default 50). Changed INNER JOIN → LEFT JOIN on `prior` CTE. Wrapped all `prior.interaction_count` uses in `COALESCE(..., 0)`. Updated WHERE to allow zero-interaction explore candidates: `(COALESCE(prior.interaction_count,0) >= 1 OR (sg.type = 'exchange' AND COALESCE(prior.interaction_count,0) = 0))`.
- `src/services/dibsScoringService.ts` — `filterEligibleCandidates` now uses two-tier explore/exploit: Tier 1 (prior ≥ 1 + available), Tier 2 fallback (0 prior + direct + available).
- `tests/tdd/sprint-51-trust-dibs.test.ts` — 6 new unit tests, all passing.

**Frontend (`apps/frontend`)**
- `src/components/requests/DibsPrompt.tsx` — `DibsCandidate` interface gains `trustGraphConnection`. Added `trustContextSummary()` helper. "Trusted provider" subtitle replaced with live context (e.g. "2 prior exchanges · direct connection").

**Docs / ADR**
- `docs/adr/ADR-051-explore-exploit-dibs.md` — New, status Implemented.
- `docs/guides/provider-dibs-guide.md` — Updated with two-tier explanation + trust context label examples.
- `scripts/generate-docs.ts` — ADR-051 added to "— Requests & Matching —" group.
- `apps/landing/src/data/docs/` — Regenerated (49 ADRs, includes ADR-051 JSON + nav entry).
- `services/request-service/CONTEXT.md` — Dibs candidate section updated with two-tier behavior.
- `services/registry.json` — `updated` date bumped to 2026-05-04.

---

## Also Completed This Session (Memory Refactor)

- **Memory restructured**: All inline MEMORY.md content extracted into 12 individual files with proper frontmatter (`feedback_*`, `reference_*`, `project_*`)
- **Stale file removed**: `project_group_communities_arc.md` deleted; `community_type` insight migrated to `feedback_community_type.md`
- **Auto-refresh wired**: `scripts/update-memory-state.js` reads live git state and rewrites `project_current_state.md`
- **Stop hook added**: `.claude/settings.json` now fires `update-memory-state.js` at the end of every session automatically

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 37–42 | Provider profiles, rate cards, offers, dibs infrastructure | ✅ Complete |
| Sprint 50 | Wire toggle + lift scheduled-only restriction + nav simplification | ✅ Complete |
| **Sprint 51** | **Trust scores + explore/exploit + trust context UI** | ✅ Complete |
| Sprint 52+ | Platform-scoped service requests, trust-path visibility | 🔮 Future |

---

## Quick Start for Next Session

1. Read this handoff
2. Decide Sprint 52 direction (see candidates below)
3. Run `/sprint-planning` to produce spec + plan

---

## Sprint 52 Candidates

No formal spec yet. Likely themes based on the arc:

1. **Trust-path visibility** — Show requesters _why_ a dibs candidate was selected. Surface the trust-graph path in the DibsPrompt ("Alice → Bob → You via 2 exchanges"). Data already exists in `social_graph.connections`.

2. **Platform-scoped service requests** — Allow requests to be visible beyond community boundaries, routed by trust distance. Feed service already supports `visibility_scope = 'platform'`; the request creation form doesn't expose it yet.

3. **UI facelift** — Redesign using Claude Design as reference (was Sprint 51 candidate B, deferred). Research-first sprint per feedback memory: must start with layout audit + reference product review before any implementation plan.

---

## Architecture Gotchas (Persistent)

- **Landing page docs source**: edit `docs/guides/*.md` + update `scripts/generate-docs.ts` arrays. Run `cd apps/landing && npm run generate-docs` to regenerate. Never hand-edit `apps/landing/src/data/docs/` directly.
- **ADR numbering**: highest is now 051. Next ADR is **052**.
- **TDD test placement**: sprint TDD tests go in `services/request-service/tests/tdd/` (NOT root `tests/tdd/`). Imports are relative: `../../src/...`.
- **Router mount paths**: always mount at full path (e.g. `/communities/trust-questions`) when router uses `router.get('/')`.
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`.
- **Feed weights**: no sum constraint; normalized at query time in feed-service.
- **trust-questions route**: must be registered BEFORE the generic config route in `community-service/src/index.ts`.
- **`git add` on CLAUDE.md**: file is tracked as lowercase `claude.md` — always `git add claude.md`.
- **Pre-existing TDD failures**: `sprint-39-provider-ux` (7 tests fail), `sprint-43-feed-ranking` (crashes), schema-related tests (dynamic-schemas-api, schema-caching, schema-fallback, admin-schemas-api). These are NOT regressions — do not attempt to fix them.
- **Solo dev — no worktrees**: work directly on feature branches (`git checkout -b feature/sprint-NN`). Worktrees cause hundreds of npm install prompts, lockfile conflicts, and jest path bugs.
- **`?type=` routing in dibs-candidate**: `type === 'service'` → `getBestCandidate` (provider_profiles). Anything else → `getMutualAidBestCandidate` (auth.users).
- **Provider nav (post Sprint 50)**: `ProviderModeSwitcher` and `ProviderNotificationBell` are no longer rendered anywhere. Do not add them back. The only provider control in the nav is the availability dot in `Layout.tsx`.
- **Explore tier — `sg.type = 'exchange'` only**: community-only connections do NOT qualify for the explore dibs tier. Only direct exchange connections (Sprint 51 ADR-051).
