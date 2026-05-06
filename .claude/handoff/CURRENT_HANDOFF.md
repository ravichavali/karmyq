# SPRINT 52 — Trust-Path Visibility | Ready to Execute

## Handoff Document

**Date**: 2026-05-06
**Current Version**: v9.18.0 (target: v9.19.0)
**Status**: Sprint 51 complete. Sprint 52 planned. Ready to execute.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-52-trust-path-visibility`
3. Open plan: `docs/superpowers/plans/2026-05-06-sprint-52-trust-path-visibility.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

---

## Sprint 52 Goal

Surface the trust-graph path with real names in the DibsPrompt modal and verify feed card compact badges — giving requesters social proof ("You → Jordan → Alice") that builds confidence to ask for help.

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 37–42 | Provider profiles, rate cards, offers, dibs infrastructure | ✅ Complete |
| Sprint 50 | Wire toggle + lift scheduled-only restriction + nav simplification | ✅ Complete |
| Sprint 51 | Trust scores + explore/exploit + trust context UI | ✅ Complete |
| **Sprint 52** | **Trust-path visibility — names, hops, full path in DibsPrompt** | 🚀 Ready |
| Sprint 53 | Code-as-story docs + new user journey + landing page catch-up | 🔮 Planned |

---

## What Was Just Completed (Sprint 51)

- Real trust scores in dibs candidate queries (correlated subquery from `reputation.trust_scores`)
- Explore/exploit two-tier selection (ADR-051)
- Trust context labels in DibsPrompt ("2 prior exchanges · direct connection")
- Memory system refactored + auto-refresh stop hook

---

## Sprint 52 — Key Context

### What's already built (DO NOT rebuild)
| Already exists | Location |
|---|---|
| `computeTrustPath()` — BFS, 3 path types, 7-day cache | `services/social-graph-service/src/services/pathComputation.ts` |
| `GET /social-graph/paths/:targetUserId` | `services/social-graph-service/src/routes/paths.ts` |
| `TrustPathBadge` + `TrustPathBadgeSkeleton` | `apps/frontend/src/components/TrustPathBadge.tsx` |
| `useTrustPath` + `useBatchTrustPaths` hooks | `apps/frontend/src/hooks/useTrustPath.ts` |
| Feed card compact badges | `FeedItem.tsx` + `BrowseFeed.tsx` |

### What's actually missing
1. `MAX_DEPTH = 4` in `computeShortestPath` — needs to be 3
2. `GET /requests/:id/dibs-candidate` doesn't call social-graph — no `trustPath` in response
3. `DibsPrompt` only shows a plain string (`trustContextSummary()`) — no `TrustPathBadge`, no names
4. Integration test with real seeded exchange data (not mocks)

---

## Critical Implementation Notes (verbatim from spec)

1. **Internal social-graph URL**: `http://social-graph-service:3010/social-graph/paths/:userId` — mounts under `/social-graph`; nginx strips `/api` but not service prefix.

2. **Forward Authorization header**: Social-graph reads `req.user?.userId` for path source. Pass `{ headers: { Authorization: req.headers.authorization || '' } }` — exactly as `requests.ts` does for reputation-service.

3. **Non-fatal only**: Wrap the trust path fetch in try/catch with a 3-second AbortController timeout. Default `trustPath: null` on any error. DibsPrompt must render correctly with `trustPath: null`.

4. **Only `computeShortestPath` changes depth**: `MAX_DEPTH` is inside `computeShortestPath`. Other path functions have separate limits.

5. **Pre-existing TDD failures**: `sprint-39-provider-ux`, `sprint-43-feed-ranking`, schema tests — do NOT fix. New test goes in `services/request-service/tests/tdd/`.

6. **TDD test placement**: `services/request-service/tests/tdd/sprint-52-trust-path.test.ts` (NOT root `tests/tdd/`). Imports are relative: `../../src/...`.

---

## Sprint 53 (Planned — Not Yet Specced)

**Theme**: Code-as-story documentation + landing page catch-up

**Goals** (discussed in planning session):
- Feature-tour documents: one per major system area (dibs/matching, trust scores, feed, provider flow) — each traces a single user action from UI click to DB write and back, with real `file:line` references. Useful for both human contributors and AI tools.
- Focus on new user journey, not just dibs internals.
- Update landing page to reflect everything shipped since last update (Sprints 42–52).

---

## Architecture Gotchas (Persistent)

- **Landing page docs source**: edit `docs/guides/*.md` + update `scripts/generate-docs.ts` arrays. Run `cd apps/landing && npm run generate-docs` to regenerate. Never hand-edit `apps/landing/src/data/docs/` directly.
- **ADR numbering**: highest is now 051. Next ADR is **052** (not needed for Sprint 52).
- **TDD test placement**: sprint TDD tests go in `services/request-service/tests/tdd/` (NOT root `tests/tdd/`). Imports are relative: `../../src/...`.
- **Router mount paths**: always mount at full path (e.g. `/communities/trust-questions`) when router uses `router.get('/')`.
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`.
- **Feed weights**: no sum constraint; normalized at query time in feed-service.
- **trust-questions route**: must be registered BEFORE the generic config route in `community-service/src/index.ts`.
- **`git add` on CLAUDE.md**: file is tracked as lowercase `claude.md` — always `git add claude.md`.
- **Pre-existing TDD failures**: `sprint-39-provider-ux` (7 tests fail), `sprint-43-feed-ranking` (crashes), schema-related tests. Do NOT fix.
- **Solo dev — no worktrees**: work directly on feature branches (`git checkout -b feature/sprint-NN`). Worktrees cause hundreds of npm install prompts, lockfile conflicts, and jest path bugs.
- **`?type=` routing in dibs-candidate**: `type === 'service'` → `getBestCandidate` (provider_profiles). Anything else → `getMutualAidBestCandidate` (auth.users).
- **Provider nav (post Sprint 50)**: `ProviderModeSwitcher` and `ProviderNotificationBell` are no longer rendered. Do not add them back. Only provider control in nav is the availability dot in `Layout.tsx`.
- **Explore tier — `sg.type = 'exchange'` only**: community-only connections do NOT qualify for explore dibs tier.
