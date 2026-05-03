# SPRINT 50 — Provider Mode + Dibs (Ready to Execute)

## Handoff Document

**Date**: 2026-05-03
**Current Version**: v9.15.0 → v9.16.0
**Status**: Spec + plan written. Ready to execute.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-50-provider-dibs`
3. Open plan: `docs/superpowers/plans/2026-05-03-sprint-50-provider-dibs.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

---

## Sprint 50 Goal

Wire the provider availability toggle to the API and lift the scheduled-only restriction from dibs — making both features work end-to-end for all request types. This is a loop-closing sprint, not a greenfield build.

---

## What Was Already Built (Don't Rebuild These)

Sprints 27–42 built the full provider/dibs infrastructure. All of this exists and is production-ready:

- `requests.dibs` table — fully provisioned
- All dibs backend routes: candidate suggestion, submit, accept, decline, expire (`services/request-service/src/routes/dibs.ts`)
- `dibsScoringService.ts` — trust score + prior interactions + trust graph scoring
- `cleanup-service` `expireDibs` job — runs on schedule, publishes events
- `PATCH /providers/:id/availability` endpoint — exists in `services/request-service/src/routes/providers.ts`
- `providerService.updateAvailability()` — exists in `apps/frontend/src/lib/api.ts` (line 852)
- `ProviderModeSwitcher.tsx` — member/provider toggle UI
- `ProviderContext.tsx` — loads profiles, `updateProviderAvailability` updates local state
- `DibsPrompt.tsx` — post-creation dibs suggestion UI
- `CommitmentsTab.tsx` — shows pending dibs to providers with Accept/Decline
- `RequestWizard.tsx` — post-creation dibs flow exists, just restricted to scheduled requests

---

## The 5 Gaps Sprint 50 Closes

1. **`setProviderMode` doesn't call the API** — writes localStorage only; `PATCH /providers/:id/availability` is never called
2. **Dibs locked to scheduled requests** — two backend guards in `dibs.ts` (lines 41–45 and 107–113); one frontend check in `RequestWizard.tsx` (line 166 checks `scheduled_for`)
3. **Dibs candidate query excludes non-providers** — `getEligibleCandidates` joins `provider_profiles`; mutual aid requests need a separate query against `auth.users`
4. **No off-duty confirmation** — no UI tells providers their commitments survive the toggle
5. **Expiry for non-scheduled** — currently `leadTime * 0.20` only; needs `NOW() + 24h` fallback

---

## Off-Duty Commitment Model (Confirmed)

- Turning off provider mode → stops new requests/dibs from routing to you
- Existing **accepted commitments** persist (like Uber going offline mid-trip)
- Existing **pending dibs** remain actionable (provider can still accept/decline)
- UI shows inline confirmation banner: "Active commitments won't be affected"

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 37–42 | Provider profiles, rate cards, offers, dibs infrastructure | ✅ Complete |
| **Sprint 50** | **Wire the toggle + lift the scheduled-only restriction** | 🔵 This sprint |
| Sprint 51 | Trust-score-integrated matching | ⬜ Upcoming |

---

## Spec + Plan

- **Design spec**: `docs/superpowers/specs/2026-05-03-sprint-50-provider-dibs-design.md`
- **Implementation plan**: `docs/superpowers/plans/2026-05-03-sprint-50-provider-dibs.md`

---

## ⚠️ Critical Implementation Notes

1. **`setProviderMode` → async**: Safe to make async — call sites use `onClick={() => setProviderMode(…)}` (fire-and-forget). `setProviderModeState` still runs synchronously first.

2. **`getMutualAidCandidates` must return `RawCandidate[]`** with `isAvailable: true` for all rows (no provider availability field for non-providers). Keeps scoring service unchanged.

3. **Keep `scheduled_for` in the DB SELECT** in the candidate route — remove only the eligibility guard, not the column fetch.

4. **`?type=` routing in `/dibs-candidate`**: `type === 'service'` → `getBestCandidate` (provider_profiles). Anything else → `getMutualAidBestCandidate` (auth.users).

5. **No DB migrations needed** — all schema already exists.

6. **Docs location**: `docs/guides/provider-mode-guide.md` and `docs/guides/using-service-providers-guide.md` both exist — append sections, don't rewrite. Check `scripts/generate-docs.ts` arrays before adding new guide.

---

## Architecture Gotchas (Persistent)

- **Landing page docs source**: edit `docs/guides/*.md` + update `scripts/generate-docs.ts` arrays. Run `cd apps/landing && npm run generate-docs` to regenerate. Never hand-edit `apps/landing/src/data/docs/` directly.
- **ADR numbering**: highest existing ADR is 050. Next is **051**.
- **Router mount paths**: always mount at full path (e.g. `/communities/trust-questions`) when router uses `router.get('/')`.
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`.
- **Feed weights**: no sum constraint; normalized at query time in feed-service.
- **trust-questions route**: must be registered BEFORE the generic config route in `community-service/src/index.ts`.
- **`git add` on CLAUDE.md**: file is tracked as lowercase `claude.md` — always `git add claude.md`.
- **Pre-existing TDD failures**: `sprint-39-provider-ux` (7 tests fail) and `sprint-43-feed-ranking` (crashes). These are NOT regressions — do not attempt to fix them.
- **Solo dev — no worktrees**: work directly on feature branches (`git checkout -b feature/sprint-NN`). Worktrees cause hundreds of npm install prompts, lockfile conflicts, and jest path bugs.
