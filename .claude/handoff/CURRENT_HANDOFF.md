# Sprint 73: Request Service Simplification — COMPLETE ✅

## Handoff Document

**Date**: 2026-05-29
**Current Version**: v10.2.0 (just shipped)
**Status**: Sprint 73 complete + deployed. Ready to plan Sprint 74.

---

## Quick Start

Sprint 73 is done. The next conversation should plan Sprint 74 (Community / Governance service polish).

```bash
# Confirm deployment went through
# Check GitHub Actions at github.com/ravichavali/karmyq/actions
# Verify karmyq.com is running v10.2.0

# Start Sprint 74 planning
cat .claude/handoff/CURRENT_HANDOFF.md
# Then: /sprint-planning
```

---

## Public Launch Polish Arc

| Sprint | Service | Status |
|--------|---------|--------|
| **72** | Simulation Engine | ✅ Complete + deployed |
| **73** | Request Service | ✅ Complete + deployed |
| **74** | Community / Governance | ⬅ Next sprint |
| **75** | Feed + Discovery | TBD |
| **76+** | Final pass + launch prep | TBD |

---

## What Sprint 73 Shipped

**Commit**: `28ad730` — `feat(request-service): Sprint 73 — simplify routes, delete dead code, UX polish v10.2.0`

### Dead code deleted
- `services/request-service/src/services/matchService.ts` — dead service class, never called by routes
- `services/request-service/tests/regression/matchingLogic.test.ts` — regression tests for deleted class
- `services/request-service/tests/tdd/dynamic-schemas-api.test.ts` — placeholder, pool uninitialized
- `services/request-service/tests/tdd/schema-caching.test.ts` — placeholder, pool+Redis uninitialized
- `services/request-service/tests/tdd/schema-fallback.test.ts` — placeholder, pool uninitialized

### Route simplification
- **matches.ts**: Removed commented-out `find-candidates` endpoint + dead import block; removed debug `console.log`; standardized GET /:id and POST / success/error responses to `sendSuccess`/`sendInternalError`
- **requests.ts**: Extracted 562-line GET /curated handler into `handleCuratedFeed()` named function; standardized all catch-block 500 responses to `sendInternalError`

### Bug fixes
- **providers.ts**: POST / now returns 409 on pg duplicate key error (code 23505) — was always returning 500
- **Withdraw Offer bug** (deployed fix): Local code was already correct (matches both requester_id and responder_id). Was failing on karmyq.com with old code. Sprint 73 deploy pushed the fix live.

### TDD tests fixed
- `two-phase-completion.test.ts` — added missing 5th mock for fire-and-forget feed_events INSERT
- `providers-api.test.ts` — added missing rate_cards query mock for GET /:providerId; added 2nd mock for provider-by-id test

### Frontend UX
- **CommitmentsTab.tsx**: Replaced 8 `alert()` calls with inline dismissible error banner (`actionError` state); updated error message reading to handle both old (`data.message`) and new (`data.error.message`) response formats
- **RequestWizard.tsx**: Updated error message reading to handle both formats

### Docs
- **docs/guides/managing-commitments-guide.md**: Updated "When a Commitment Completes" → "Completing an Exchange (Two-Phase Confirmation)"; added "Withdrawing an Offer" section
- **docs/guides/match-lifecycle.md**: New guide covering the full match lifecycle (Proposed → Accepted → Both Mark Done → Completed), Withdraw Offer, karma transfer, waiting states
- Landing JSON regenerated and force-added

### Version
- Root `package.json`: 10.1.0 → 10.2.0
- Version invariant test updated to assert 10.2.0

---

## Sprint 73 Test Results (on master)

- **Unit + regression**: 9 suites, 163 tests — all pass ✅
- **TDD two-phase-completion**: 4/4 pass ✅
- **TDD providers-api**: 10/10 pass ✅
- **Pre-existing TDD failures** (unchanged, do NOT fix):
  - `sprint-39-provider-ux` (7 fail)
  - `sprint-43-feed-ranking` (crashes)
  - `admin-schemas-api.test.ts` (request-service)
  - `sprint-68-halflife` (6 DB connection tests)
  - `sprint-67-governance` (DB connection tests)
  - `social-graph-service/tests/tdd/sprint-66-trust-graph-visualization.test.ts`
  - `social-graph-service/tests/tdd/sprint-67-ego-network.test.ts`
  - `social-graph-service/tests/tdd/sprint-68-halflife.test.ts`

---

## Key Decisions Made This Sprint

1. **matchingLogic.test.ts deleted** — The plan listed only the 3 placeholder TDD files for deletion, but `matchingLogic.test.ts` imported `matchService.ts` and was a regression test for dead code. Deleted alongside the source.

2. **Response format gotcha**: `sendInternalError` uses `{ error: { code, message } }` nested format vs old raw `{ message }`. CommitmentsTab now reads `data.error?.message || data.message` to handle both. Frontend still works with 403/404/400 errors because those still use raw format.

3. **providers.ts 409 fix** — The test was testing correct expected behavior (409 for duplicate), not wrong test. Route was missing the `error.code === '23505'` check. Fixed the route.

4. **fire-and-forget gotcha**: `void query(...).catch(...)` pattern fails in tests when mock is exhausted — `query()` returns `undefined`, `.catch(undefined)` throws TypeError caught by outer try/catch → 500. Fix: always mock the fire-and-forget query in tests.

---

## Architecture Gotchas (Persistent)

- **Landing page docs**: `apps/landing/src/data/docs/` is in `.gitignore` — always `git add -f`
- **ADR numbering**: Next ADR is **059**
- **ADR-057 and ADR-058**: Already `implemented` in both source `.md` and landing `.json`
- **TDD test placement**: Request service tests in `services/request-service/tests/tdd/`
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`
- **`git add` on CLAUDE.md**: Tracked as lowercase `claude.md` — always `git add claude.md`
- **Solo dev — no worktrees**: Work directly on feature branches
- **nav.json revert bug**: `generate-docs.ts` regenerates nav.json — always add new slugs to GUIDE_ORDER + GUIDE_LABELS + GUIDE_SLUGS in `scripts/generate-docs.ts`; run generate-docs from `apps/landing/` (`npm run generate-docs`), not root
- **trust_edges_live is a VIEW**: Never INSERT/UPDATE it. Use `trust_edges` for writes, `trust_edges_live` for reads
- **API response unwrap**: `createApiClient` interceptor already unwraps envelope — use `res.data`, not `res.data.data`
- **trust_edges normalized constraint**: `social_graph.trust_edges` requires `user_id_a::text < user_id_b::text` — always sort
- **community_links UNIQUE**: fusion_origin links must be (merged↔A) and (merged↔B), NOT (A↔B)
- **Root package.json version**: 10.2.0

---

## Sprint 74 Candidates (Community / Governance)

Not yet spec'd. Candidates to discuss:
- Community governance UI cleanup (nomination/ratification flows)
- Community admin panel polish
- Trust graph polish (ego-network display)
- Governance ratification quorum design (see open question in memory)
