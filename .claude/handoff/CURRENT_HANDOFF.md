# SPRINT 54 — UI Simplification Arc | Design Brief Phase

## Handoff Document

**Date**: 2026-05-06
**Current Version**: v9.20.0 (Sprint 53 complete + deployed)
**Status**: Audit complete. Waiting for Claude Design tool feedback before writing spec.

---

## Quick Start (next session)

1. Read this handoff
2. Paste the Claude Design tool feedback into the conversation
3. Run `/sprint-planning` — the feedback + audit findings below become the design brief
4. Sprint 54 spec → implementation plan → execute

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 51 | Trust scores + explore/exploit | ✅ Complete |
| Sprint 52 | Trust-path visibility in DibsPrompt | ✅ Complete |
| Sprint 53 | Test coverage: critical paths + CI enforcement | ✅ Complete + deployed |
| **Sprint 54** | **UI Simplification — design brief + first pass** | 🔵 In progress (audit done, awaiting Claude Design feedback) |
| Sprint 55+ | UI Simplification — subsequent passes | ⬜ Upcoming |

**Arc goal**: Make the UI intuitive. Simplify. Most common users should have their core flows handled cleanly with minimal friction.

---

## Sprint 54 — Agreed Direction

### Goal
The whole UI feels non-intuitive. Simplify it. The most common user flows should be obvious and frictionless. This is a multi-sprint simplification arc, not a cosmetic polish pass.

### Core user mental model (confirmed)
Both roles are the **same person** in different contexts:
- **Community member facet**: Post a request for help → see responses → accept help → track commitment
- **Provider facet**: Browse requests matching skills → offer to help → get matched → fulfill

Large component refactors are **in scope** (CommitmentsTab 616 lines, communities/[id].tsx 2,257 lines — these are symptoms of UX complexity, not just code smell).

### Design input
- Claude Design tool feedback (pending — user waiting on limits to reset)
- Audit findings below

---

## Audit Findings (completed 2026-05-06)

### What exists
- **33 pages**, 99 components, ~26k lines of frontend
- **Styling**: Tailwind CSS + CSS custom properties. Semantic tokens exist but are used inconsistently.
- **Typography**: Fraunces serif (display) + Inter (body) — solid pairing, keep
- **Layout shell**: Three-column desktop (left sidebar / main / right sidebar), mobile bottom tab bar
- **Design tokens**: Warm earthy palette — Karmyq Green (#2d6e28), Accent Teal (#268882), Cream (#faf8f3), Brown text (#5c3e30)

### Inconsistencies found
- Status badges use hardcoded Tailwind colors (`red-100`, `amber-100`) instead of semantic tokens — inconsistent throughout `CommitmentsTab`, `FeedItem`, `BrowseFeed`
- Direct palette references mixed with semantic tokens (`from-karmyq-green-500`) vs `primary`
- Provider availability toggle appears in two nav locations (duplication)
- Right sidebar loads leaderboard/milestone data even when not in view

### Complexity hotspots
| File | Lines | Problem |
|------|-------|---------|
| `apps/frontend/src/pages/communities/[id].tsx` | 2,257 | Everything in one file |
| `apps/frontend/src/components/CommitmentsTab.tsx` | 616 | Filtering + status + offers inline |
| `apps/frontend/src/components/CommunityConfigEditor.tsx` | 592 | WYSIWYG schema editor monolith |
| `apps/frontend/src/components/Feed/FeedItem.tsx` | 358 | Renders all request type variations inline |
| `apps/frontend/src/components/ProviderProfileTab.tsx` | 414 | Profile display + edit combined |

### Navigation pain points
- Mobile: Communities and Providers only in hamburger — missing from bottom tab bar
- No pre-auth nav on mobile
- Dashboard has 4 tabs (Browse / Commitments / My Requests / Profile) — may be too many

### Ideas from IDEAS.md (relevant)
- Provider and community are 2 facets of the same user — no mode toggle needed
- Different color patterns per facet — visual language that signals context
- UI simplification is a **continuous lens**, not a one-time sprint — apply to every sprint going forward
- CommitmentsTab density flagged as a priority area to watch

---

## What To Do When Claude Design Feedback Arrives

1. Paste feedback into a new conversation
2. Run `/sprint-planning`
3. The spec should address:
   - What pages/flows to simplify first (prioritize by user frequency)
   - Navigation restructure (especially mobile)
   - Dashboard tab reduction (4 → 2 or 3?)
   - Token consistency fix (semantic tokens everywhere)
   - Facet color system design (community green vs provider teal?)
   - Which large components to break up in Sprint 54 vs defer

---

## Architecture Gotchas (Persistent)

- **Landing page docs source**: edit `docs/guides/*.md` + update `scripts/generate-docs.ts` arrays. Run `cd apps/landing && npm run generate-docs` to regenerate. Never hand-edit `apps/landing/src/data/docs/` directly.
- **ADR numbering**: highest is now 051. Next ADR is **052**.
- **TDD test placement**: sprint TDD tests go in `services/request-service/tests/tdd/` (NOT root `tests/tdd/`). Imports are relative: `../../src/...`.
- **Router mount paths**: always mount at full path (e.g. `/communities/trust-questions`) when router uses `router.get('/')`.
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`.
- **Feed weights**: no sum constraint; normalized at query time in feed-service.
- **`git add` on CLAUDE.md**: file is tracked as lowercase `claude.md` — always `git add claude.md`.
- **Pre-existing TDD failures**: `sprint-39-provider-ux` (7 tests fail), `sprint-43-feed-ranking` (crashes), schema-related tests. Do NOT fix.
- **Solo dev — no worktrees**: work directly on feature branches (`git checkout -b feature/sprint-NN`). Worktrees cause hundreds of npm install prompts, lockfile conflicts, and jest path bugs.
- **`?type=` routing in dibs-candidate**: `type === 'service'` → `getBestCandidate` (provider_profiles). Anything else → `getMutualAidBestCandidate` (auth.users).
- **Provider nav (post Sprint 50)**: `ProviderModeSwitcher` and `ProviderNotificationBell` are no longer rendered. Do not add them back. Only provider control in nav is the availability dot in `Layout.tsx`.
- **Explore tier — `sg.type = 'exchange'` only**: community-only connections do NOT qualify for explore dibs tier.
- **Trust path URL pattern**: `http://social-graph-service:3010/social-graph/paths/:userId` — nginx strips `/api` prefix but NOT the service prefix (`/social-graph`). Always use the full path when calling from request-service.
- **Provider offer acceptance**: `offersDb.acceptOffer` now correctly closes the request and rejects proposed matches. Mirrors `dibs.ts` and `matches.ts` accept paths — keep consistent if any new acceptance path is added.
- **Offer validation**: `providerOffersDb.validateRequestForOffer` uses live DB JOIN — no JWT community array. If touching this function, do not reintroduce JWT-based auth.
- **community-service coverage**: scoped to `src/services/**/*.ts` (NOT all src files) because DB-dependent routes can't reach 60% without a live DB. coverageProvider set to 'v8' to fix babel instrumentation bug.
