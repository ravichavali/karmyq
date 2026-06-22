# Sprint 108: Responder Home Actionability & Decision Truth — Design Spec

**Date**: 2026-06-22
**Status**: Approved
**Version**: v11.15.0 → v11.16.0
**Sprint Branch**: `feature/sprint-108-responder-home-actionability`

---

## Overview

An active helper's Dashboard Home can read empty even when they have real, owed work. The Sprint 99
release audit captured this against `maria.reyes@test.karmyq.com`: a rich account (15 communities,
hundreds of matches) whose Home shows "You're caught up" while ~335 `proposed` responder matches and
100+ browsable open asks sit just out of view. Sprint 107 closed one slice of this — the
**offered-awaiting** truth (BUG-023): asks Maria offered on that are now waiting on the requester are
surfaced in Helping and previewed on Home. But three actionability gaps remain, and this sprint
closes them.

The core defect is in the Home **decision band**. `fetchDecisions`
([requests.ts:924-928](../../../services/request-service/src/routes/requests.ts)) unconditionally
drops **every** responder-side `proposed` match with a comment assuming a responder's proposed match
is always "their own offer awaiting the requester." That assumption is wrong for
**admin/matchmaker-proposed** matches (`admin_proposed = TRUE`): there, the matchmaker proposed the
member as helper and **the member owes the accept/decline** — exactly the rule
[matches.ts:306](../../../services/request-service/src/routes/matches.ts) enforces. These owed
decisions never reach Home: the decision band drops them and offered-awaiting explicitly excludes
them (`admin_proposed = FALSE`). They appear only as cards in the Helping tab, so an active helper's
Home understates the work they actually owe.

This sprint makes admin-proposed responder matches **canonical decisions** (surfaced in the Helping
tab's `DecisionBand`, where BUG-015 deliberately placed commitment work), and gives Home a **calm
preview band** — "N neighbours suggested you as a helper" — that links to Helping, mirroring the
existing `OfferedAwaitingPanel` pattern. It also makes the "caught up" terminal copy honest about
residual browsable asks, enriches the Home offered-awaiting preview into something an active helper
can act on, and adds a simulation workflow that actually generates admin-proposed matches so the demo
exercises the fixed path. It reproduces-and-verifies two stale bugs (BUG-009 pulse-vs-trust-graph,
BUG-010 community split failure) whose status labels predate their fixes.

**Design decision (maintainer-confirmed):** BUG-015 moved the actionable `DecisionBand` off Home into
Helping on purpose ("decisions you owe are commitment work, not new asks to browse" —
[UnifiedFeed.tsx:226](../../../apps/frontend/src/components/Feed/UnifiedFeed.tsx)). We keep that
intact. The actionable accept/decline rows for admin-proposed matches live in the **Helping
`DecisionBand`**; Home only gets a non-actionable **preview band that links to Helping**.

### Core Principle: Home owes the truth, both directions

If a member owes a decision, Home must reflect it (a preview that links to where it's actionable). If
a member is genuinely caught up on *direct*
matches but their communities still hold open asks, Home must say exactly that — never "that's
everyone" when there is more to do. Home is the single honest answer to "what's mine to act on?"

---

## Multi-Sprint Arc

### Sprint 100 — Pulse Truth & Actionability (complete)
Distinct-responder pulse counts + connection reconciliation (ADR-078); first offered-awaiting count.

### Sprint 101 — Actionability & State Truth (complete)
Viewer-relation server-derivation; OfferedAwaitingPanel preview links.

### Sprint 107 — App Shell Clarity & Commitment Truth (complete)
BUG-023 offered-awaiting canonical read (`GET /requests/offered-awaiting`); Home/Helping share the
predicate; single dibs surface (BUG-022).

### Sprint 108 — Responder Home Actionability & Decision Truth (this sprint)
Admin-proposed responder decisions — preview on Home, decide in Helping; honest caught-up copy;
richer Home offered-awaiting; sim generates admin-proposed; verify BUG-009/010.

### Sprint 109+ — Deferred
Visible forgetting / "platform forgets" decay arc; Dibs server-side relationship routing
(IDEAS 2026-06-09); member forget/export; Service Consolidation Phase 2; mobile parity.

---

## New Concepts

**Admin-proposed responder decision.** A `requests.matches` row with `admin_proposed = TRUE` where
the JWT identity is the `responder_id`. Semantics: the matchmaker/admin proposed this member as the
helper; the member owes an **accept** (→ becomes `matched`) or **decline**. Distinct from a member's
own self-offer (`admin_proposed = FALSE`), where the *requester* owes the response and the row is
offered-awaiting, not a decision.

---

## Data Model

No schema changes. `requests.matches.admin_proposed` (boolean) already exists and is the sole
discriminator. The decisions SELECT must additionally project `m.admin_proposed`.

---

## API Endpoints

| Method | Path | Change | Notes |
|--------|------|--------|-------|
| GET | `/requests/curated?view=home` | Modified | (a) the `items` `decisions` now include admin-proposed responder matches as `member_role:'responder'` items with `accept_offer`/`decline_offer` actions (these render in the **Helping** DecisionBand, not Home — BUG-015); (b) the payload gains a new `suggestedAsHelper: { count, items }` field (distinct open admin-proposed responder matches) so Home can render its preview band. Additive only. |
| PUT | `/matches/:id/accept` | Unchanged (verify) | Already authorizes the responder to accept an `admin_proposed` match (matches.ts:306). The Helping DecisionBand action wires to this for responder-role match decisions. |
| PUT | `/matches/:id/reject` | Unchanged (verify) | Decline path for the responder on an admin-proposed match. Confirm a responder is authorized to reject; if only the requester is authorized, fixing it is in scope. |
| POST | `/requests/:id/propose-match` | Unchanged | Admin-proposed creation; the sim will call this. |

---

## Frontend Changes

| File | Change |
|------|--------|
| `apps/frontend/src/components/Feed/DecisionBand.tsx` | Render admin-proposed responder decisions (member_role 'responder', accept/decline on a `match` subject). The action handler must branch on `subject_kind` + `member_role` and route a responder-role `match` accept → `PUT /matches/:id/accept` and decline → reject (the dibs path already handles responder accept; mirror for matches). Copy: "{requester} suggested you as a helper — accept?" **This band renders in Helping (`CommitmentsTab`), not Home.** |
| `apps/frontend/src/components/Feed/SuggestedAsHelperPanel.tsx` (new) | Home-only calm preview band: "N neighbours suggested you as a helper" with a per-item link and a "Respond in Helping →" link. Modeled on `OfferedAwaitingPanel`. Non-actionable (no inline accept/decline) — actionability lives in the Helping DecisionBand. Rendered in `UnifiedFeed` (Home) when `suggestedAsHelper.count > 0`. |
| `apps/frontend/src/components/Feed/UnifiedFeed.tsx` | (a) Render `SuggestedAsHelperPanel` on Home (non-community) when `suggestedAsHelper.count > 0`, near `OfferedAwaitingPanel`. (b) Audit residual "That's everyone for now" / "You're caught up" copy paths so the claim is scoped to *direct matches* and always points to browsable community asks when they exist. **Do not render the actionable DecisionBand on Home — BUG-015 keeps it in Helping.** |
| `apps/frontend/src/components/Feed/OfferedAwaitingPanel.tsx` | Enrich from a passive preview into an actionable band: each previewed ask gets an inline path to act (open the ask / withdraw), not only a "View all in Helping" link. Keep it visually calm (not a decision) but useful. |
| `apps/frontend/src/components/CommitmentsTab.tsx` | Ensure admin-proposed responder matches now render canonically via the Helping `DecisionBand`; if a separate card path also renders them, dedupe so they appear once (the BUG-022 lesson). |
| `apps/frontend/src/types/unified-feed.ts` | Add the `suggestedAsHelper` payload field type. |

---

## Simulation Changes

| File | Change |
|------|--------|
| `services/simulation-service/src/api-client.ts` | Add `proposeMatch(requestId, proposedUserId)` → `POST /requests/:id/propose-match`. |
| `services/simulation-service/src/workflows/admin-propose-helper-workflow.ts` (new) | A community admin/steward picks an open request in their community and proposes an eligible member as helper, generating `admin_proposed = TRUE` matches so the demo exercises the responder-decision path. |
| `services/simulation-service/src/workflows/index.ts` | Export/register the new workflow. |
| `services/simulation-service/src/types.ts` | Add `adminProposeHelper?: ActionWeight` to `UserProfile.actions` (otherwise the workflow is never dispatched). |
| `services/simulation-service/src/profiles/index.ts` | Add `adminProposeHelper` weight to the relevant admin/steward-capable profile(s) **and** add the import + a `candidates` entry in `selectWorkflow` (cf. how `joinCommunity` is wired). A workflow with no profile weight and no candidate entry compiles but never runs. |

---

## User Guide & Doc Updates

- **`apps/landing/src/data/docs/guides/`** — update the Dashboard Home / "Managing Commitments"
  guide: Home now shows decisions where *someone suggested you as a helper*, in addition to offers
  you made and requests you posted. Clarify the difference between "caught up on direct matches" and
  "your communities still have open asks."
- **`apps/landing/src/data/docs/services/request-service.json`** — note the curated-home `decisions`
  now include admin-proposed responder matches.
- **`apps/frontend/CONTEXT.md`** — Helping DecisionBand now renders responder-role admin-proposed
  decisions; Home gains the `SuggestedAsHelperPanel` preview band; OfferedAwaitingPanel is actionable.
- **`services/request-service/CONTEXT.md`** — `fetchDecisions` admin-proposed branch documented.
- **`apps/frontend/src/lib/onboarding/workflows.ts`** — update the helping/commitments workflow copy
  if it describes what appears on Home.
- **`docs/BUGS.md`** — update BUG-009 / BUG-010 status after reproduce-first verification.

No ADR required (no new architectural decision; this is correctness within the established
decisions/offered-awaiting model). If verification of BUG-009 surfaces a genuine ADR-078 gap, log it
but do not expand scope.

---

## Critical Implementation Notes

1. **`admin_proposed` is the only discriminator.** In `fetchDecisions`, a `proposed` responder match
   is a decision **iff** `admin_proposed = TRUE`. A self-offer (`FALSE`) stays out of the decision
   band — it is offered-awaiting (requester owes). Do not surface self-offers as decisions; that
   would re-create the BUG-022/023 duplication.
2. **Add `m.admin_proposed` to the decisions SELECT** ([requests.ts:900-917](../../../services/request-service/src/routes/requests.ts)) — it is not currently projected.
3. **Responder accept/decline already has a backend contract.** `PUT /matches/:id/accept` authorizes
   the responder for `admin_proposed` matches (matches.ts:306). Verify the **reject/decline** path
   authorizes the responder too before wiring the UI; if it only authorizes the requester, that is
   part of this sprint's fix.
4. **The DecisionBand action handler must branch on `subject_kind` + `member_role`.** A responder-role
   `match` accept routes to `PUT /matches/:id/accept`; a responder-role `dibs` accept already routes
   to the dibs endpoint. Do not send a responder match-accept down the requester path.
   **Reminder:** the DecisionBand renders in **Helping** (`CommitmentsTab`), not Home — BUG-015
   ([UnifiedFeed.tsx:226](../../../apps/frontend/src/components/Feed/UnifiedFeed.tsx)) deliberately
   keeps decisions off the browse surface.
4a. **Home gets a preview band, not the DecisionBand.** `respondHomeFeed` already includes decision
   items in the payload but `UnifiedFeed` ignores `kind === 'decision'`. Add a new
   `suggestedAsHelper: { count, items }` payload field and render `SuggestedAsHelperPanel` on Home;
   do **not** start rendering `kind === 'decision'` items in `UnifiedFeed`.
5. **Honest caught-up copy is scoped to direct matches.** The non-community Home branch copy is
   already honest ("No direct matches… your communities may still have open asks"); the residual risk
   is the community-view branch's "That's everyone for now." Audit every terminal-copy path; never
   claim "everyone" when browsable open asks exist outside the current filter/community.
6. **OfferedAwaitingPanel stays a calm band, not a decision.** Enriching it with an action must not
   visually promote it into the DecisionBand — the requester still owes the next move on those asks.
7. **Sim admin-propose needs an admin/steward session.** Reuse the governance/admin session pattern
   (cf. governance-nominate-workflow, create-activity admin-only). Propose only members who are in
   the request's community and have no existing live match on that request (the endpoint 409s
   otherwise — handle gracefully).
8. **BUG-009 / BUG-010 are reproduce-first.** Their `planned (Sprint 100)` labels predate the S100
   fixes; verify against live demo data before writing any fix. If already fixed, update the status
   to `fixed` with the verifying evidence; only write code if a live defect reproduces.
9. **Decision-count derivations must use freshly mapped rows**, not stale React state (the S107
   lesson) — any Home badge/count that now includes admin-proposed decisions must derive from the
   mapped decision array.
10. **Test the dedupe invariant:** an admin-proposed responder match appears in the DecisionBand and
    **not** in offered-awaiting; a self-offer appears in offered-awaiting and **not** in the
    DecisionBand. Prove both directions.
