# Sprint 88: Core Help-Loop Redesign — Design Spec

**Date**: 2026-06-05
**Status**: Approved
**Version**: v10.11.0 -> v10.12.0
**Sprint Branch**: `feature/sprint-88-core-help-loop-redesign`

---

## Overview

Sprint 87 approved Karmyq's presentation direction: **warm commons, calm behavior**. Sprint 88 turns that approved direction into production UI on the help loop, the place where members decide whether Karmyq feels like a trusted neighborhood tool or a generic engagement feed.

The sprint ships a shared frontend shell and re-skins both Home feed surfaces on top of it: Dashboard Home (`view=home`) and Community Home (`view=community`). The work makes the request card relationship-led, removes per-person score display from help cards, demotes match percentages into quiet qualitative language, adds finite queue states, and keeps open-request discovery calm by defaulting to curated results with an explicit "show more open requests" affordance.

The backend scope is deliberately narrow: fix the carried-forward impression logging gap so the `view=home` and `view=community` union responses log request impressions just like the legacy array path, and fix `minScore=0` parsing so "show more open requests" can actually widen the feed. No schema changes are expected. The frontend scope includes production polish fixes found in Sprint 87's audit where they touch the same surfaces: mobile FAB overlap, em-dash mojibake in names, cumulative fission/fusion names, and empty KPI tiles.

### Core Principle: Relationship before relevance

A member should first understand **why this ask belongs near them** ("through Raj", "in your community", "close by"), then what help is needed, then the one next action.

---

## Multi-Sprint Arc

- **Sprint 84** — Unified feed research & direction. Complete (`no-deploy`).
- **Sprint 85** — Unified feed, Dashboard Home first. Shipped v10.9.0.
- **Sprint 86** — Community Feed view + texture + legacy retirement + payload seam fix. Shipped v10.10.0.
- **Sprint 87** — Product Truth & UX Reset. Executed v10.11.0; approved warm-commons/calm direction.
- **Sprint 88 — Core Help-Loop Redesign** (this sprint) — shared shell + Dashboard Home + Community Home.
- **Sprint 89** — Community sovereignty redesign beyond the feed: member/admin altitude, fission/fusion language.
- **Sprint 90** — Trust, forgetting, and profile polish.
- **Sprint 91** — Mobile parity from the polished web model.
- **Sprint 92** — Architecture and service pruning.

Reference sources:
- `docs/design/sprint-87/presentation-rules.md`
- `docs/design/sprint-87/sprint-88-recommendation.md`
- `docs/superpowers/specs/2026-06-05-sprint-87-90-polish-reset-review-and-roadmap.md`

---

## New Concepts

### Karmyq Shell

The reusable production version of the approved Sprint 87 mockup system: warm color tokens, Fraunces + Hanken Grotesk type, one-column page measure, quiet cards, relationship/path badges, action bands, finite queue states, and a single quiet notification affordance.

### Curated Default + Show More Open

Both `view=home` and `view=community` default to `minScore >= 30`. A member can intentionally relax the threshold using "show more open requests"; the default never becomes an infinite firehose. Admin all-status lists remain separate and unchanged.

### Qualitative Match Signal

Raw match percentages no longer lead on help cards. The UI maps score/reason into quiet language such as "strong fit", "good match", "close by", or "may still help" and places it after the primary action.

### Seeded Forgetting Affordance

This sprint does not build the full Sprint 90 forgetting surface. It seeds the promise where the help loop already reads decayed relationships: the card may use relationship language like "warm connection" or "fading connection" when backend data supports it, and docs explain that the complete visible forgetting surface is Sprint 90.

---

## Data Model

No schema changes are planned.

Existing table touched by behavior:

```sql
-- Existing table; no DDL change.
requests.feed_events (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  request_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('impression', 'offer_made', 'match_completed')),
  feed_score NUMERIC(5,2),
  feed_rank INTEGER,
  source_tier TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

Implementation requirement: union feed responses (`view=home`, `view=community`) must insert `impression` rows for request items only. Decision, activity, and story items are not request impressions.

---

## API Endpoints

| Method | Path | Change | Auth | Response |
|---|---|---|---|---|
| `GET` | `/requests/curated?view=home` | Preserve union shape; add request impression logging on the union path; honor `minScore` default 30. | JWT | `{ success, data: { items, count } }` |
| `GET` | `/requests/curated?view=community&community_id=:id` | Preserve union shape; add request impression logging on the union path; honor `minScore` default 30. | JWT + community membership | `{ success, data: { items, count } }` |

No new endpoint is required for "show more open requests"; the frontend re-requests the same endpoint with a lower `minScore` value. The backend must treat `minScore=0` as a valid threshold, not as missing input.

---

## Frontend Changes

| File | Change |
|---|---|
| `apps/frontend/src/styles/karmyq-shell.css` | New shared shell CSS layer: tokens, type, cards, badges, finite states, action bands. |
| `apps/frontend/src/pages/_app.tsx` | Import the shell CSS and font definitions if not already centralized in `globals.css`. |
| `apps/frontend/src/components/Layout.tsx` | Align top chrome with approved shell: one quiet notification affordance, no count pressure. |
| `apps/frontend/src/pages/dashboard.tsx` | Dashboard Home header and browse layout use the warm shell; pass default curated state to `UnifiedFeed`. |
| `apps/frontend/src/components/Feed/UnifiedFeed.tsx` | Add curated default + "show more open requests"; finite caught-up states; pass shell variants to child cards; keep Home and Community behaviors distinct. |
| `apps/frontend/src/components/Feed/RequestCard.tsx` | Relationship-led reading order; remove `KarmaBadge`; demote match percent; humanize request labels; ensure one primary action. |
| `apps/frontend/src/components/Feed/DecisionBand.tsx` | Warm decision-band presentation; wrapping titles on mobile; no truncation of critical action text. |
| `apps/frontend/src/components/Feed/ActivityCard.tsx` | Align community texture card styling with shell. |
| `apps/frontend/src/components/Feed/StoryCard.tsx` | Align story styling with shell. |
| `apps/frontend/src/components/community/tabs/BrowseTab.tsx` | Community Home uses the same shell; member feed is warm/calm; admin management remains separate altitude; empty KPI tiles are suppressed or made meaningful. |
| `apps/frontend/src/components/SpeedDialFab.tsx` | Mobile FAB clears card CTAs and bottom nav. |
| `apps/frontend/src/components/RequestWizard.tsx` | Copy polish only; preserve the warm emoji-led type picker. |
| `apps/frontend/src/lib/onboarding/workflows.ts` | Update dashboard/community help-loop onboarding language for finite queue + relationship-led cards. |
| `apps/frontend/src/types/unified-feed.ts` | Add frontend-only helper types if needed for qualitative match labels; do not change API contract unless necessary. |

---

## User Guide & Doc Updates

Required doc updates:

- `apps/frontend/CONTEXT.md` — document the S88 shell, Dashboard Home, Community Home, card hierarchy, curated default, and show-more affordance.
- `services/request-service/CONTEXT.md` — document impression logging on union feed views as a recent fix.
- `services/registry.json` — refresh the `/requests/curated` description if needed to mention impression logging on `view=home`/`view=community`.
- `apps/landing/src/data/docs/guides/` — update the relevant member help-loop/user guide with the new reading order, finite queue state, and show-more behavior.
- `apps/landing/src/data/docs/services/request-service.json` — update the request-service docs if endpoint behavior text changes.
- `apps/landing/src/data/docs/concepts/` — update the unified-feed / warm-commons concept page if it exists; otherwise add a concise concept page for the approved help-loop presentation model and register it in `nav.json`.
- `docs/design/sprint-87/sprint-88-recommendation.md` — append implementation notes or a completion link after Sprint 88 executes.

No ADR is expected unless implementation introduces a new architectural contract beyond the already accepted ADR-066/ADR-067 model.

---

## Critical Implementation Notes

1. **PR #69 must merge/deploy first.** Sprint 88 builds from the approved Sprint 87 artifacts and version `10.11.0`; do not start production edits on the Sprint 87 branch.
2. **Branch:** use `feature/sprint-88-core-help-loop-redesign`; agents do not commit to `master` directly.
3. **Dashboard Home and Community Home are both in scope.** Community Home is not deferred to Sprint 89; Sprint 89 handles broader community sovereignty beyond the feed.
4. **No schema change expected.** Fix impression logging by reusing existing scored request rows before the union return paths; log request items only, never decisions/activity/story texture.
5. **`minScore` default stays 30, but `0` is valid.** "Show more open requests" intentionally lowers/removes the threshold after user action; parse `minScore` with an explicit finite check, not `parseInt(...) || 30`.
6. **Remove `KarmaBadge` from `RequestCard`.** Per-person score display is banned on help cards; do not replace it with another numeric person score.
7. **Keep `TrustPathBadge` and promote it.** Relationship/path reason leads the card above title and match signal.
8. **Match % becomes qualitative copy.** Do not render `68% Match` as a leading card element; map it to quiet labels and keep raw values out of the primary hierarchy.
9. **Use global JWT truth:** membership is `user.communities`, not `communityMemberships`; the request-service local README is stale here.
10. **API unwrap rule:** frontend `createApiClient` already unwraps response envelopes; consume `res.data`, not `res.data.data`.
11. **Payload seam:** keep using `payload_type` derived via ADR-067 normalization; never render raw `generic` or mixed `category` tokens as user-facing labels.
12. **Mobile is part of done.** The FAB must not overlap card CTAs; decision-band text wraps rather than truncates; tap targets stay at least 40px.
13. **Do not rewrite admin management.** Community admin all-status tools remain separate altitude; only remove empty/noisy KPI presentation and align styling where it shares the surface.
14. **Docs are in scope.** This sprint ships real behavior changes, so user guides, frontend context, request-service context, and landing docs must be updated.
