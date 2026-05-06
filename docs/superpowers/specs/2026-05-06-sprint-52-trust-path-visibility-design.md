# Sprint 52: Trust-Path Visibility — Design Spec

**Date**: 2026-05-06
**Status**: Approved
**Version**: v9.18.0 → v9.19.0
**Sprint Branch**: `feature/sprint-52-trust-path-visibility`

---

## Overview

When a requester is shown a dibs candidate, or browses the feed, they see a person's name and a trust score — but nothing that explains *why* this person is trustworthy to them specifically. The social graph already knows the chain: "You exchanged with Jordan, Jordan exchanged with Alice, Alice is the candidate." Surfacing that chain in the UI gives requesters the social proof they need to actually send the ask.

This sprint wires the existing trust-path infrastructure (social-graph-service's `computeTrustPath`, `TrustPathBadge`, and `useTrustPath`) into the one place it matters most: the DibsPrompt modal. The feed card's compact path badge — already rendering via `useTrustPath(data.requester_id)` in `FeedItem.tsx` — will be verified and any gaps closed. A new integration test will seed real exchange graph data and verify the full path flows end-to-end through the dibs API.

### Core Principle: Trust Is Personal

A trust score of 82 is abstract. "You → Jordan → Alice" is concrete. The goal is to make the ask feel less like a cold transaction and more like a warm introduction.

---

## Multi-Sprint Arc

### Sprint 51 — Trust Scores + Explore/Exploit (complete)
Real trust scores in dibs candidate queries. Two-tier explore/exploit selection. Trust context labels in DibsPrompt ("2 prior exchanges · direct connection").

### Sprint 52 — Trust-Path Visibility (this sprint)
Surface the full graph path with real names. DibsPrompt shows TrustPathBadge (full). Feed cards show compact path badge. Integration test validates with seeded exchange data.

### Sprint 53+ — Code Documentation + Landing Page Catch-Up (upcoming)
New-user journey documentation, feature-tour docs, landing page updates for everything shipped.

---

## What Already Exists (Do NOT Rebuild)

| Already built | Location |
|---|---|
| `computeTrustPath()` — BFS, 3 path types | `services/social-graph-service/src/services/pathComputation.ts` |
| `GET /paths/:targetUserId` with 7-day cache | `services/social-graph-service/src/routes/paths.ts` |
| `TrustPathBadge` + `TrustPathBadgeSkeleton` | `apps/frontend/src/components/TrustPathBadge.tsx` |
| `useTrustPath` + `useBatchTrustPaths` hooks | `apps/frontend/src/hooks/useTrustPath.ts` |
| Feed card compact badge (FeedItem open_request) | `apps/frontend/src/components/Feed/FeedItem.tsx` |
| Feed card compact badge (BrowseFeed) | `apps/frontend/src/components/BrowseFeed.tsx` |

---

## Changes

### 1. Depth Cap: 4 → 3

`computeShortestPath()` currently allows paths up to 4 hops. Cap at 3 — paths beyond 3 degrees are too diluted to be meaningful social proof.

`TrustPathBadge` already hides badges for `degrees_of_separation > 3`, so the frontend is already consistent with this cap.

### 2. Dibs Candidate API: Attach Trust Path

`GET /requests/:id/dibs-candidate` currently returns a `ScoredCandidate`. After selecting the best candidate, the route must call social-graph-service to get the trust path and attach it to the response.

**Inter-service call pattern** (matches existing `requests.ts` pattern):
```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 3000);
const pathRes = await fetch(
  `${process.env.SOCIAL_GRAPH_API_URL || 'http://social-graph-service:3010'}/social-graph/paths/${candidate.providerUserId}`,
  {
    headers: { Authorization: req.headers.authorization || '' },
    signal: controller.signal,
  }
);
clearTimeout(timeout);
```

The call is **non-fatal**: if social-graph is unreachable or returns no path, `trustPath: null` is included in the response and the DibsPrompt degrades gracefully to the existing string summary.

### 3. DibsPrompt: Full Trust Path Badge

Replace the `trustContextSummary()` text line with a full `TrustPathBadge` (non-compact). If `trustPath` is null, fall back to the existing string summary.

Add `trustPath: TrustPath | null` to the `DibsCandidate` interface (import `TrustPath` from `TrustPathBadge.tsx`).

### 4. Explore-Tier Candidates

Explore-tier candidates have 0 prior interactions but a direct exchange connection (`sg.type = 'exchange'`). `computeTrustPath` will find them at 1° via the exchange path. The badge renders "Direct connection" — that IS the trust signal for explore candidates. No special case needed.

---

## API Endpoints

| Method | Path | Change |
|---|---|---|
| GET | `/requests/:id/dibs-candidate` | Response gains `trustPath: TrustPath \| null` field |
| GET | `/social-graph/paths/:targetUserId` | No change — already exists, used internally |

---

## Frontend Changes

| Component | Change |
|---|---|
| `DibsPrompt.tsx` | Add `trustPath: TrustPath \| null` to `DibsCandidate`; render `TrustPathBadge` (full) below candidate header; fallback to string summary if null |
| `BrowseFeed.tsx` | Verify compact badge is rendered on request cards; fix if not |
| `Feed/FeedItem.tsx` | Verify compact badge renders on `open_request` items; fix if not |

---

## User Guide & Doc Updates

- `docs/guides/provider-dibs-guide.md` — add "Trust path" section explaining what the path means and how to read it ("You → Jordan → Alice means Jordan has exchanged with both of you")
- `scripts/generate-docs.ts` — no new entries needed; guide already referenced
- Run `cd apps/landing && npm run generate-docs` to regenerate landing site data

---

## Critical Implementation Notes

1. **`social-graph/paths` route prefix**: The social-graph-service mounts its routes under `/social-graph`. The nginx proxy strips `/api` but NOT `/social-graph`. Internal calls from request-service should use `http://social-graph-service:3010/social-graph/paths/:userId`.

2. **Forward the Authorization header**: `computeTrustPath` reads `req.user?.userId` for the source. The request-service must forward `req.headers.authorization` in the inter-service call — exactly as the existing `requests.ts` fetch does for reputation-service.

3. **Non-fatal only**: The trust path fetch should never block the dibs candidate response. Wrap in try/catch, default `trustPath` to `null` on any error. The DibsPrompt must render correctly with `trustPath: null`.

4. **`MAX_DEPTH` is in `computeShortestPath` only**: The `computeCommunityPath` and `computeInvitationPath` functions have their own depth limits and don't need to change. Only `computeShortestPath` (exchange BFS) goes from 4 → 3.

5. **Integration test uses real DB**: The test seeds `auth.users`, `requests.help_requests`, and `requests.matches` with completed status to build the exchange graph. It then calls the dibs-candidate route and asserts `trustPath.path` contains the correct names. Use the existing pattern in `services/social-graph-service/tests/integration/paths.test.ts` as reference.

6. **Pre-existing TDD test failures**: `sprint-39-provider-ux` (7 tests), `sprint-43-feed-ranking` (crashes), and schema-related tests are pre-existing failures. Do NOT attempt to fix them. New sprint test goes in `services/request-service/tests/tdd/`.
