# Sprint 100: Pulse Truth + Feed Actionability — Design Spec

**Date**: 2026-06-15
**Status**: Approved
**Version**: v11.8.0 → v11.9.0
**Sprint Branch**: `feature/sprint-100-pulse-truth-actionability`

---

## Overview

A member opened a real demo community and the platform made three claims it could not back up. The
community Home pulse said **"3 neighbours helped each other"** — but the connections view showed
nobody. It said **"1 open ask waiting for a hand"** — but the feed below it was empty and the member's
own tasks were done. And when a member has no top matches, the dashboard feed shows an engagement-y
two-step ("No top matches right now" → "Show more open requests" → "Look further, or browse your
communities") that reads like a platform trying to keep people scrolling rather than telling them the
plain truth.

Sprint 100 continues the Sprint 97–99 release-readiness arc with the same discipline: **the platform
must never claim what it cannot back up, and what it shows must be actionable.** This sprint fixes the
three truth gaps at their source (not in client copy band-aids), collapses the empty state to one
honest message the user dictated, and makes request cards both clickable and legible.

It also folds in three open items from the bug log and idea backlog that share the same theme:
**BUG-009** (the identical pulse-vs-connections gap on another community — confirming F1 is systemic),
**proposed-match surfacing** (established members' Home reads empty because hundreds of `proposed`
responder matches never surface as actionable items — the real reason "my tasks are all done" yet the
platform feels dead), **BUG-010** (a community split that errors out), and **simulation pace /
liveliness** (so multiple demo accounts — not just Maria — fill out with good data).

### Core Principle: Every claim is reachable and true

If the pulse names a number, the member must be able to see the thing it counts. "Neighbours helped"
must mean distinct neighbours, and those exchanges must show up as connections. "Open asks" must be
reachable, not a dead-end count. "You're caught up" must be said once, plainly, without a nudge to
look harder.

---

## Multi-Sprint Arc

- **S97 (done):** Release Readiness Data Quality + Functional Bug Bash (v11.6.0).
- **S98 (done):** Trust Truth Audit + Functional Repairs (v11.7.0).
- **S99 (done):** Release Experience Audit + Fine Tune (v11.8.0).
- **S100 (this sprint):** Pulse Truth + Feed Actionability Fine-Tune + functional fold-ins (BUG-009,
  BUG-010, proposed-match surfacing, sim liveliness) (v11.9.0).
- **S101+ candidates:** founding-circle review/notify surface, community/provider link-up clarity
  (IDEAS 2026-06-08), research-first UI facelift, "platform forgets" visible-decay delivery.

---

## The Five Findings (root-caused)

| # | Symptom | Root cause | Layer |
|---|---------|-----------|-------|
| F1 / **BUG-009** | "3 (BUG-009: 4) neighbours helped each other thanks to [fewer named]" but connections empty | `helpedThisWeek` counts completed `matches` **rows**, not distinct responders ([requests.ts:1070-1077](../../../services/request-service/src/routes/requests.ts#L1070-L1077)). Separately, a community trust edge is only created when the `match_completed` event payload carries `community_id` ([subscriber.ts:45-50](../../../services/social-graph-service/src/events/subscriber.ts#L45-L50)) — so counted exchanges may produce no visible connection. BUG-009 (community `eb32c151…`) is the same gap → confirms it's systemic, not a one-off | DB/API + event |
| F2 | "1 open ask waiting for a hand" but feed empty / my tasks done | `openAsks` counts **every** open, unexpired request in the community incl. the member's own + already-offered ([requests.ts:1081-1083](../../../services/request-service/src/routes/requests.ts#L1081-L1083)); the member feed shows only fillable asks → contradiction, and the count is a dead-end | API/UI scope |
| F3 | Engagement-y empty state | Dashboard feed shows a two-step "No top matches" + "Show more open requests" nudge ([UnifiedFeed.tsx:251-271](../../../apps/frontend/src/components/Feed/UnifiedFeed.tsx#L251-L271)) | UI copy |
| F4 | Community request cards not clickable | The canonical `RequestCard` body links nowhere; only the "Offer to Help" button acts ([RequestCard.tsx](../../../apps/frontend/src/components/Feed/RequestCard.tsx)). A `/requests/[id]` detail page already exists | UI |
| F5 | Leading icon unexplained | The colored-initial circle is the **asker's avatar** but reads as ambiguous ([RequestCard.tsx:89-91](../../../apps/frontend/src/components/Feed/RequestCard.tsx#L89-L91)) | UI |

---

## Decisions (from planning Q&A)

- **F1 — both, at the source:** count **distinct responders** in the pulse, AND reconcile connections so
  every completed community exchange produces a visible community connection/trust edge. The "neighbours
  helped" number and the connections view must agree.
- **F2 — keep community-wide, make it reachable:** keep the true community-wide open-ask count, soften the
  copy to "across the community," and make the open-asks pulse row navigate to a community-wide open-asks
  view (read-only for the member's own / already-offered asks).
- **F3 — collapse to one message** (verbatim user copy):
  > **You're caught up**
  > No direct matches for you right now — but your communities may still have open asks waiting. Browse to lend a hand.
  > **[Browse communities]**

  Remove the "Show more open requests" button from this empty state.
- **F4 — clickable cards:** wire the `RequestCard` body to `/requests/[id]`; the Offer action and any inner
  links must `stopPropagation`.
- **F5 — clarify the avatar:** make the colored-initial circle legibly read as "the person asking"
  (accessible label + tooltip), without redesigning it.

---

## Folded-in scope (bug log + idea backlog)

Approved during planning. Each is investigation-first (audit before patching), same as the findings.

### G1 — Proposed-match surfacing on responder Home (IDEAS 2026-06-15)

Established members (e.g. Maria) carry hundreds of `proposed` responder matches that never appear as
actionable items on Dashboard Home, so Home reads empty even when the member is deeply involved — the
real reason behind "my tasks are all done" while the platform feels dead. **Investigate** where
`proposed` responder matches should surface (Home "Needs your response" band and/or Helping), confirm
the gap against the live data, then **surface them** so a responder's outstanding proposals are
visible and actionable. Right-size in Task 1: if the fix is larger than a feed/band query change,
ship the contained part and document the remainder. Trace **all** feed/query surfaces before patching.

### G2 — BUG-010: community split fails

`Failed to execute split on this page` on community `446c2c65-64e1-4e8e-9d87-54671939a4da`
(Stewardship fission). **Reproduce first** (systematic-debugging) against the live community + logs,
fix the root cause at the correct layer, and add a regression test. If it cannot be reproduced,
document why rather than blind-editing the split path.

### G3 — Simulation pace / liveliness (IDEAS 2026-06-15 thread 1)

The sim is active platform-wide but its activity concentrates on a few early users, so most demo
accounts look empty. **Raise the simulation pace and spread fresh requests across more test users** so
multiple demo accounts (not just Maria) fill out with good, lively data. Tuning + seed-distribution
work in the simulation service; verify on the demo by sampling several test accounts post-deploy. No
schema change; keep it bounded to sim config + request/offer distribution.

---

## New Concepts

- **Distinct-helper pulse semantics.** "N neighbours helped each other" counts distinct active-member
  responders with a completed exchange in the last 7 days — never raw match rows.
- **Community connection reconciliation (ADR-078).** A community trust edge / connection for a completed
  exchange is derived from the request's `request_communities` at completion time, not from whatever the
  `match_completed` event payload happened to carry. Counted exchanges and shown connections cannot diverge.
- **Community-wide open-asks view.** A read-only listing reachable from the pulse open-asks row that shows
  all open, unexpired asks in the community — including the member's own and already-offered ones — so the
  pulse count is always reachable even when nothing is fillable.

---

## Data Model

No new tables. Reconciliation reuses existing `social_graph.connections` and the weighted trust-edge
store. A one-off, idempotent **backfill script** (NOT a migration) repairs historical completed matches
that are missing their community trust edge, with before/after counts.

`scripts/backfill-community-connections.sql` (manual post-deploy, repeatable):
- For every `requests.matches` row with `status='completed'`, ensure a `social_graph.connections` row
  and a community trust edge exist for each community in the request's `request_communities`.
- Idempotent (`ON CONFLICT … DO NOTHING` / upsert); prints BEFORE and AFTER counts.

---

## API Endpoints

| Method | Path | Change | Auth |
|--------|------|--------|------|
| GET | `/requests/feed?community_id&minScore` | Existing community feed; gains an `includeAll=1` (or equivalent) mode that returns **all** open community asks read-only (own + already-offered included) for the open-asks reachability view | Member (403 non-member) |
| GET | `/requests/community/:communityId/pulse` | No contract change; `helpedThisWeek` now reflects distinct responders. (Note: the route doc-comment in `requests.ts` reads `/community/:id/pulse`, but it is mounted under `/requests` — the real client path is `/requests/community/:communityId/pulse`, per `apps/frontend/src/lib/api.ts:498` and `sprint-89-community-pulse.test.ts`) | Member |

> The exact reachability mechanism (a feed mode vs. a dedicated community-open-asks listing) is **frozen
> in Task 1** against the live community before coding. The default is a read-only `includeAll` feed mode
> reusing the existing curated query path so the open-asks count is always reachable.

---

## Frontend Changes

| File | Change |
|------|--------|
| `apps/frontend/src/components/community/CommunityPulse.tsx` | Open-asks row becomes a link to the community-wide open-asks view; copy → "N open asks across the community" |
| `apps/frontend/src/components/Feed/UnifiedFeed.tsx` | Collapse the dashboard empty state to the single "You're caught up" message; remove the "Show more open requests" button from that empty state; add the read-only community-open-asks rendering path (own/offered shown without an Offer button) |
| `apps/frontend/src/components/Feed/RequestCard.tsx` | Card body links to `/requests/[id]`; Offer button + inner links `stopPropagation`; clarify the asker avatar with an accessible label + tooltip (e.g. "Asked by {name}") |
| `apps/frontend/src/lib/onboarding/workflows.ts` | Update the feed-walkthrough copy (L31) — it currently describes the now-removed "Show more open requests" two-step |

---

> **Landing docs are generated.** `apps/landing/src/data/docs/` (incl. `nav.json`) is wiped + rebuilt by
> `scripts/generate-docs.ts`. Edit the **sources** below and the generator's registries, then regenerate
> and `git add -f` the output — never hand-edit the JSON or nav.json.

- **`docs/guides/*.md`** (source) — update the community / feed guide(s) to describe: the pulse numbers
  (distinct helpers, open asks across the community), the reachable open-asks view, the calm caught-up
  state, and clickable request cards. Remove any "show more open requests" language. Register a new guide
  page in `scripts/generate-docs.ts` (`GUIDE_ORDER`/`GUIDE_LABELS`/`GUIDE_SLUGS`) if one is added.
- **`docs/adr/ADR-078-community-connection-reconciliation.md`** (source) + **`docs/adr/README.md`** index
  entry + register `adr-078-community-connection-reconciliation` in `ADR_GROUPS` (Trust & Reputation) in
  `scripts/generate-docs.ts`. Regenerate, then grep-verify ADR-078 appears in the generated `nav.json`.
- **Onboarding** — `apps/frontend/src/lib/onboarding/workflows.ts` feed-walkthrough copy updated (mandatory
  per workflow-UI-change rule).
- **CONTEXT.md** — request-service (pulse semantics + open-asks feed mode) and social-graph-service
  (connection reconciliation) CONTEXT.md sections updated.
- **`services/registry.json`** — any new/changed endpoint or feed mode recorded.

---

## Critical Implementation Notes

1. **Audit first, freeze second.** Task 1 confirms the live state on community
   `308f7192-5c60-4c52-b7e8-56ead255ba52`: actual `helpedThisWeek` rows vs distinct responders, whether
   completed matches have community trust edges, and what the "1 open ask" actually is (likely the
   member's own or an already-offered ask). Do not patch before this is logged.
2. **Fix at the source, not the client.** F1 and F2 are data/API truth bugs — fix the pulse query and the
   connection-derivation event path; never mask with a client-side filter.
3. **Distinct, not raw.** `helpedThisWeek` must `COUNT(DISTINCT responder_id)` over the same member-scoped,
   completed-in-7-days subset already used for `recentHelpers`, so the headline number can never exceed the
   named helpers.
4. **Connection reconciliation derives from `request_communities`** at completion time — do not depend on
   the `match_completed` payload carrying `community_id` (it sometimes doesn't, which is the whole bug).
5. **Backfill is a script, not a migration.** Historical repair runs as a repeatable, idempotent SQL script
   with before/after counts (`feedback_no docs/migrations` discipline) — never a one-off manual edit.
6. **`trust_edges_live` is a VIEW** — never INSERT/UPDATE it; write through the trust-edge service/store.
7. **Open-asks reachability must include own + offered.** The whole point is that a community-wide count is
   reachable; the read-only view shows the member's own and already-offered asks **without** an Offer
   button (you can't offer on your own ask).
8. **Empty-state copy is verbatim** — use the user's exact three lines; remove the "Show more open requests"
   button from that empty state. Update the onboarding walkthrough copy in the same change.
9. **Clickable card must not hijack the Offer action.** Card-body navigation to `/requests/[id]` must
   `stopPropagation` on the Offer button and any inner link/badge so existing actions still work.
10. **Feed query lives in multiple surfaces.** If the open-asks/feed query is touched, search all request/
    feed query paths (incl. `services/request-service/src/utils/queryBuilder.ts`) before patching — prior
    sprints (S92 BUG-002) missed a surface.
11. **Pulse is the single source of truth** for both the in-feed `ActivityCard` and `GET /pulse`; keep them
    fed by the one `fetchCommunityPulse` aggregation so they can never diverge.
12. **Every repair gets a test.** Pulse semantics → unit/TDD tests asserting distinct-responder counts and
    open-ask reachability; card clickability → frontend test (navigates, Offer still fires).
13. **Version bump:** root `package.json` + `package-lock.json` `11.8.0` → `11.9.0`.
14. **ADR numbering:** next free ADR = **078** (ADR-077 shipped in S98).
15. **G1 proposed-surfacing: confirm the gap, then right-size.** Verify against live data that `proposed`
    responder matches are missing from Home; the contained fix is a Home band / feed query change. If
    surfacing them properly needs more than that, ship the contained part and document the rest as a
    follow-up — do not let it balloon the sprint. Trace every feed/query surface first.
16. **G2 split: reproduce before fixing.** Use systematic-debugging on community `446c2c65…` + server
    logs to get the actual error. Fix at the correct layer; if not reproducible, document rather than
    blind-edit the fission path.
17. **G3 sim: bounded tuning only.** Raise pace + spread requests across more test users via simulation
    config / distribution; no schema changes. Verify by sampling several demo accounts post-deploy.
18. **Withdraw-Offer is NOT in scope — already fixed.** Verified during planning: the reject/withdraw
    guard permits either match participant; the old requester-only error is gone. The IDEAS 2026-05-20
    entry was annotated as resolved. Do not re-open it.
