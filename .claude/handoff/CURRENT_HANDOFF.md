# Sprint 62: Platform Coherence | Ready to Execute

## Handoff Document

**Date**: 2026-05-21
**Current Version**: v9.28.0 → v9.29.0 (this sprint)
**Status**: Sprint 62 planned. Spec + plan written. Ready to execute.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-62-platform-coherence`
3. Open plan: `docs/superpowers/plans/2026-05-21-sprint-62-platform-coherence.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

---

## Sprint 62 Goal

Close 5 platform coherence gaps so community config, match guards, and community type actually drive behavior — not silently ignored.

---

## What This Sprint Fixes (in priority order)

### 1. Withdraw Offer bug — HIGH (active user-facing error)
**Symptom**: Clicking "Withdraw Offer" on the Active tab returns "Only the requester can reject this match."
**Fix**: Expand the guard in `services/request-service/src/routes/matches.ts` (~line 429) to allow `responder_id === user_id` as well as `requester_id === user_id`.
**Frontend**: No change needed — `CommitmentsTab.tsx handleDecline` already calls the right endpoint.

### 2. Provider Mode Re-entry — HIGH (broken navigation)
**Symptom**: After creating a provider profile, there's no UI to manage/edit it. The "Providers" link goes to the community browse page, not the user's own profile.
**Fix**: Investigate what provider management pages exist, then add a "Manage profile" link in `apps/frontend/src/components/Layout.tsx` when `hasProviderProfile === true`.

### 3. Karma Multipliers per Request Type — MEDIUM
**Symptom**: Communities configure per-type karma multipliers (stored in `community_configs.config->'enabled_request_types'[].karma_multiplier`) but `karmaAllocation.ts` never reads them.
**Fix**: Add `requestType` parameter to `services/reputation-service/src/services/karmaAllocation.ts`; update the `match_completed` event handler to fetch multiplier and pass adjusted pool.

### 4. Request Type Enforcement — MEDIUM
**Symptom**: `community_configs.config->'enabled_request_types'` is configured but `POST /requests` never validates against it — any request type is accepted.
**Fix**: Extend the community settings query in `services/request-service/src/routes/requests.ts` (~line 819) to also fetch `enabled_request_types`, then validate.

### 5. Community Type Differentiation — MEDIUM
**Symptom**: `community_type` (mutual_aid | group) is stored but almost no code branches on it. Group communities should feel different from mutual aid communities.
**Fix**: Add community type awareness to `apps/frontend/src/components/BrowseFeed.tsx` — show a group-context banner and different empty state when `communityType === 'group'`.

---

## Key File Paths

| Item | Files |
|------|-------|
| Withdraw Offer fix | `services/request-service/src/routes/matches.ts` |
| Provider Re-entry | `apps/frontend/src/components/Layout.tsx` |
| Karma Multipliers | `services/reputation-service/src/services/karmaAllocation.ts` + event handler |
| Request Type Enforcement | `services/request-service/src/routes/requests.ts` |
| Community Type | `apps/frontend/src/components/BrowseFeed.tsx`, `apps/frontend/src/pages/dashboard.tsx` |

---

## Critical Implementation Notes (read before any code)

1. **Withdraw Offer guard change is one line** — `requester_id !== user_id` → `requester_id !== user_id && responder_id !== user_id`. Match status after withdrawal → `'cancelled'`. Verify CommitmentsTab.tsx handles `cancelled` vs `rejected` statuses.

2. **Request type enforcement is opt-in** — if `enabled_request_types` is null, empty, or missing, ALL request types remain allowed. Never break communities without config.

3. **Karma multiplier default is 1.0** — if config is missing or has no entry for the request type, multiply by 1.0 (no-op). Never fail on missing config.

4. **Investigate before adding nav link** — check what provider profile management pages exist before adding a link in Layout.tsx. A dead link is worse than no link.

5. **`community_type` is likely already in dashboard state** — check before adding a new API call.

6. **Pre-existing TDD failures**: `sprint-39-provider-ux` (7 tests), `sprint-43-feed-ranking` (crashes). Do NOT fix. Ignore.

7. **community_configs is in `community` schema** — use `community.community_configs`, not `communities.community_configs`.

8. **`git add` on Windows**: `CLAUDE.md` tracked as `claude.md` — always `git add claude.md`.

---

## Spec + Plan Links

- Spec: `docs/superpowers/specs/2026-05-21-sprint-62-platform-coherence-design.md`
- Plan: `docs/superpowers/plans/2026-05-21-sprint-62-platform-coherence.md`

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 58 | karmyq.org rebuild | ✅ Complete + deployed |
| Sprint 59 | Dashboard UX Simplification | ✅ Complete + deployed |
| Sprint 60 | Provider Browse Fork + Communities Polish | ✅ Complete + deployed |
| Sprint 61 | On-Duty Browse Refinement (segmented control + card accents) | ✅ Complete + deployed |
| **Sprint 62** | **Platform Coherence — 5 coherence gaps** | 🔲 Ready to execute |
| Sprint 63 | Fit-for-purpose feeds redesign | 🔲 Planned |

---

## Architecture Gotchas (Persistent)

- **Landing page docs source**: edit `docs/guides/*.md` + update `scripts/generate-docs.ts` arrays. Run `cd apps/landing && npm run generate-docs` to regenerate. Never hand-edit `apps/landing/src/data/docs/` directly.
- **ADR numbering**: next ADR is **053**.
- **TDD test placement**: backend sprint tests go in `services/request-service/tests/tdd/` (NOT root `tests/tdd/`). Frontend sprint tests go in `apps/frontend/tests/tdd/`. Imports are relative to respective source dirs.
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`.
- **`git add` on CLAUDE.md**: file is tracked as lowercase `claude.md` — always `git add claude.md`.
- **Pre-existing TDD failures**: `sprint-39-provider-ux` (7 tests fail), `sprint-43-feed-ranking` (crashes), schema-related tests. Do NOT fix.
- **Solo dev — no worktrees**: work directly on feature branches. Worktrees cause hundreds of npm install prompts, lockfile conflicts, and jest path bugs.
- **BrowseModeControl (Sprint 61)**: shared component at `apps/frontend/src/components/BrowseModeControl.tsx`. `BrowseMode` type exported from there. `browseMode` state lives in `dashboard.tsx` and is passed to BrowseFeed (controlled), CommitmentsTab, MyRequestsTab.
- **ExpandableConversation scroll**: `scrollIntoView` is now gated on `expanded` — only fires when the widget is open. Do not remove this guard.
- **Tab id vs label**: Active tab has `id: 'helping'` (for URL routing) but label "Active". Do not change the id.
- **Flaky CI**: `feed-service` Docker build occasionally fails with npm install timeout. Not caused by code — retry or ignore if tests otherwise pass.
- **Sprint 54 migration still needed on demo server** (if not yet run):
  ```bash
  ssh ubuntu@karmyq.com
  psql -U postgres -d karmyq < ~/karmyq/infrastructure/postgres/migrations/20260510-refresh-tokens.sql
  ```
