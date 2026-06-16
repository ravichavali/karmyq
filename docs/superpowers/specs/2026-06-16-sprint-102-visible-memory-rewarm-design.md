# Sprint 102: Visible Memory + Re-warm First Step - Design Spec

**Date**: 2026-06-16
**Status**: Approved
**Version**: v11.10.0 -> v11.11.0
**Sprint Branch**: `feature/sprint-102-visible-memory-rewarm`

---

## Overview

Sprint 90 made Karmyq's "designed to forget" promise real in the system: content retention is enforced
by cleanup-service, trust edges decay through `trust_edges_live`, social-graph endpoints return
`decayTier`, the profile has a memory section, and `/about/memory` explains what is kept versus let go.
But the promise is still too easy to miss. The member experience can still read as accounting first:
numbers, scores, and weekly counts are present, while relationship memory and humane forgetting are
buried or under-explained.

Sprint 102 productizes the existing memory surfaces without changing the decay math or retention
schema. The work makes memory visible where members already are: Profile and the community "How we're
connected" tab. It also reframes the community pulse count from a KPI-like banner into evidence of
care: the platform keeps the fact that people showed up, not every private detail.

The re-warm path stays deliberately modest. When the backend says a relationship is
`nearly_forgotten`, the UI offers one gentle reconnect step and explains that the bond is close to
being let go. This is not a growth nudge sprint and not a notification sprint; it is a trust and
retention clarity sprint.

### Core Principle: Memory, Not Scorekeeping

Counts can appear only when they help a member understand care, relationships, and what the platform
keeps; they must not lead as a productivity ledger.

---

## Multi-Sprint Arc

### Sprint 100 - Pulse Truth + Feed Actionability (complete)

Made community pulse counts truthful and inspectable, including distinct helper semantics and reachable
open asks.

### Sprint 101 - Actionability + State Truth (complete)

Made request surfaces state lifecycle truth and offer the next real action, including canonical request
detail and server-derived offer eligibility.

### Sprint 102 - Visible Memory + Re-warm First Step

Makes the "designed to forget" promise visible and humane in Profile, community trust, and weekly pulse
copy.

### Sprint 103+ - Candidate Directions

Community/provider link-up clarity, founding-circle review/notify surface, research-first UI facelift,
or member-controlled forget/export if the retention path becomes the next priority.

---

## New Concepts

### Memory Surface

A UI surface that explains what Karmyq currently holds as relational memory: active relationships,
fading bonds, nearly-forgotten bonds, and the retention policy that lets private exchange details go.

### Re-warm First Step

A small action affordance for `nearly_forgotten` relationships. It helps a member reconnect before the
bond fades out of active memory, without adding notifications, automation, or pressure loops.

### Contribution Evidence

The community pulse's helper count is treated as evidence that people showed up for one another, not a
scoreboard. Copy should connect the count to memory and care.

---

## Data Model

No schema changes.

Sprint 102 reuses existing Sprint 90 data:

- `social_graph.trust_edges_live.current_weight`
- `social_graph.trust_decay_config.disappearance_threshold`
- `decayTier` from `@karmyq/shared/trust/decayTier`
- `GET /trust/me/memory?communityId=`
- `GET /trust/relationships/fading?communityId=`
- `GET /requests/retention-policy?communityId=`

Critical constraint: `social_graph.trust_edges_live` is a VIEW. Sprint 102 must not insert/update it or
introduce a job that changes trust weights.

---

## API Endpoints

No new endpoints.

| Method | Path | Change | Auth |
|--------|------|--------|------|
| GET | `/trust/me/memory?communityId=` | Existing endpoint used more directly by Profile memory UI. Returns `{ activeCount, fading[], nearlyForgotten[] }`. | Member |
| GET | `/trust/relationships/fading?communityId=` | Existing endpoint used by `ReWarmingNudge`; no contract change. | Member |
| GET | `/trust/graph/:communityId/full` | Existing `decayTier` data remains the trust-graph source. UI adds explanation only. | Member |
| GET | `/requests/retention-policy?communityId=` | Existing endpoint remains the live source for `/about/memory`. Optional community scoping may be linked from Profile copy. | Member if scoped |
| GET | `/requests/community/:communityId/pulse` | No contract change. UI copy reframes `helpedThisWeek`. | Member |

---

## Frontend Changes

### Profile

- `apps/frontend/src/pages/profile.tsx`
  - Decouple the memory section from the karma/accounting block.
  - Keep the selected community source explicit and safe when karma display is off.
  - Place memory before or near trust/community context so it reads as a first-class profile surface.
  - Avoid unsafe `JSON.parse(localStorage.user)` patterns when touching the file.

- `apps/frontend/src/components/profile/MemorySection.tsx`
  - Add plain tier language for active, fading, and nearly-forgotten bonds.
  - Show the memory section for relationship memory even when karma display is off.
  - Keep rows self-suppressing when empty, but never hide the whole surface merely because karma data is absent if relationship data exists.
  - Link to `/about/memory` with copy that explains aggregates are kept while private details are let go.

### Community Trust

- `apps/frontend/src/components/community/tabs/TrustGraphTab.tsx`
  - Add a compact memory legend/explanation above the graph.
  - Explain that fainter bonds are older/quieter relationships and that a nearly-forgotten bond can be re-warmed.
  - Keep `ReWarmingNudge` self-suppressing when empty.

- `apps/frontend/src/components/relationships/ReWarmingNudge.tsx`
  - Reframe copy from generic reconnect to explicit memory language: "close to being let go" or "about to fade from active memory."
  - Keep exactly one `Reconnect` action; do not create new reminders or notifications.

### Community Pulse

- `apps/frontend/src/components/community/CommunityPulse.tsx`
  - Reframe `helpedThisWeek` copy from accounting/KPI language toward care:
    - Preferred lead: `N neighbours showed up for one another`
    - Preferred subcopy when helpers are named: `with care from A, B, C`
  - Keep zero-row suppression.
  - Keep count semantics unchanged: distinct responders from the existing server predicate.
  - Keep open-asks row inspectable and linked.

### Styles

- `apps/frontend/src/styles/karmyq-shell.css`
  - Add only small reusable classes if needed for memory legend rows.
  - Do not create a new visual system.

---

## User Guide & Doc Updates

Mandatory docs for Sprint 102:

- `docs/guides/your-memory-and-relationships-guide.md`
  - Update from Sprint 90 "made visible" language to Sprint 102 placement: Profile memory, community graph legend, and re-warm first step.
  - Explain that reconnect is optional and that letting a bond fade is allowed.

- `docs/concepts/designed-to-forget.md`
  - Clarify the difference between content retention and relationship fading.
  - Add the "memory, not scorekeeping" framing.

- `docs/concepts/community-home.md`
  - Update community pulse wording from "neighbours helped each other" to "showed up for one another" or final chosen copy.
  - Preserve the truth that counts are distinct helpers and inspectable.

- `docs/concepts/reading-the-trust-graph.md`
  - Add how to read fading/nearly-forgotten labels and graph opacity.

- `apps/frontend/src/lib/onboarding/workflows.ts`
  - Update memory/onboarding copy to match the new placement and avoid overpromising controls.

- `apps/frontend/CONTEXT.md`
  - Add a Sprint 102 section documenting Profile memory placement, community graph memory legend, re-warm copy, and pulse copy change.

- `apps/landing/src/data/docs/`
  - Regenerate generated docs after source docs change.
  - Verify `nav.json` still contains `Designed to Forget`, `The Community Home`, `Reading the Trust Graph`, and `Your Memory & Relationships`.

No new ADR is planned. ADR-069 and ADR-070 already cover the architectural decisions. Create a new ADR
only if implementation adds member-controlled retention, changes endpoint contracts, or changes decay
semantics.

---

## Testing Strategy

TDD first, focused on user-visible behavior:

- `apps/frontend/tests/tdd/sprint-102-visible-memory.test.tsx`
  - `MemorySection` renders relationship memory without requiring a karma trend.
  - `MemorySection` labels fading and nearly-forgotten states in text, not only by opacity/title.
  - `ReWarmingNudge` says a nearly-forgotten bond is close to being let go and keeps one reconnect action.
  - Empty relationship data suppresses hollow rows.

- `apps/frontend/tests/tdd/sprint-102-community-memory-copy.test.tsx`
  - `TrustGraphTab` renders a memory legend/explanation.
  - `CommunityPulse` renders "showed up for one another" for positive helped counts.
  - `CommunityPulse` still suppresses zero helped rows.
  - `CommunityPulse` open asks remain linked when `communityId` is provided.

Regression:

- Existing Sprint 89 community page IA tests must remain green.
- Existing Sprint 90 memory-surface tests must remain green.
- Frontend type checking must stay clean.

---

## Critical Implementation Notes

1. **No new decay math.** Use existing `decayTier` values and `decayPresentation`; do not duplicate or
   reinterpret `classifyDecayTier` thresholds in frontend code.
2. **`trust_edges_live` is read-only.** It is a VIEW. Sprint 102 must not write to it or add a decay job.
3. **Memory must not depend on karma visibility.** The profile memory section should render relationship
   memory for a selected community even when the member has not enabled "Show My Karma."
4. **Counts are evidence, not scoreboards.** Keep truthful counts, but phrase them as signs of care and
   community memory. Do not add leaderboard, streak, productivity, or engagement language.
5. **Re-warm is optional and gentle.** A nearly-forgotten bond may be let go. Copy must not imply failure,
   penalty, or urgency manipulation.
6. **No notification or messaging expansion.** Keep the existing `/messages?to=` reconnect action unless
   implementation discovers it is broken; do not add automated reminders.
7. **Fading must be text-legible.** Opacity alone is not enough. Add readable labels/explanations for
   fading and nearly-forgotten states.
8. **Do not scatter router mocks.** Preserve the global `apps/frontend/jest.setup.js` `next/router` mock;
   use per-test mocks only when a custom query or spy is needed.
9. **Avoid unsafe localStorage parsing.** If touching profile localStorage reads, wrap JSON parsing or use
   existing guarded patterns.
10. **Docs are part of done.** User guides, concept pages, onboarding, frontend context, and generated
    landing docs ship with the sprint.
11. **Generated landing docs are gitignored.** After regeneration, use `git add -f` for changed
    `apps/landing/src/data/docs/*` files that must be committed.
12. **Known CodeQL false positive.** Editing `apps/frontend/src/lib/api.ts` can re-trigger the recurring
    `js/request-forgery` false positive on trusted `NEXT_PUBLIC_API_URL` base URLs. Avoid api.ts edits
    unless necessary; if it recurs, dismiss with the documented false-positive rationale and re-run.

