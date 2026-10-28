# Sprint 134 PR B: Vouch from a Completed Exchange — Design Spec

**Date**: 2026-10-28
**Status**: Approved (maintainer, 2026-10-28 planning chat)
**Version**: v11.103.0 → v11.104.0 (provisional; re-derive from `origin/master` at merge time)
**Branch**: `agent/claude/sprint-134-pr-b-vouch-from-request` (cut from `origin/master` `4ee38e82`)

---

## Overview

When an exchange completes, both participants get the `match_completed` notification ("Match Completed — Leave a
Rating", CTA "Rate Helper"). It links to `/requests/:id`
(`services/notification-service/src/templates/notificationTemplates.ts:78-87`). That page then shows only "This ask is
completed." for the helper and "This is your ask. Manage it in Asks." for the requester
(`apps/frontend/src/pages/requests/[id].tsx:280-292`). It has no rating and no vouch control. Vouching (ADR-100) can
only be reached by clicking the partner's name on a Helping/Asks card to open TrustCard, or from the People tab. The
completion notification, the main way people come back to a finished exchange, leads to a page with nothing to do.

PR B turns the completed request page into the place where each participant closes out the exchange. Everyone with a
completed exchange on that ask sees their partner(s). They can rate the exchange (privately, ADR-036) and vouch for the
partner's skills with the existing controls. `GET /requests/:id` gains a viewer-scoped `viewer_partners` projection, like
`viewer_relation` and `viewer_match`. The page renders a completed-exchange panel from it. The panel reuses
`RatingPrompt`/`submitExchangeRating` and `MemberSkills`, with skills filtered to the server's own `can_endorse` flag. The
notification copy changes to match what the page now offers. No new event, queue, table or migration.

### Core Principle: The server decides who is a partner and what can be vouched for

Read permission is not partner status. A completed partner is exposed only to the two participants of that exchange. A
skill is offered only when the same server predicate that `POST /auth/skills/endorsements` evaluates says it would be
accepted. The client filters on server flags; it adds no eligibility rule of its own.

---

## Multi-Sprint Arc

- **Sprint 133 PR B** (v11.86.0): skill endorsements (ADR-100); vouching from TrustCard and the People tab.
- **Sprint 134 PR B (this PR)**: vouch and rate from the completed request page; exposure rule recorded as an ADR-100
  amendment.
- **Later, separate PRs**:
  - **BUG-074**: `DELETE /matches/:id` cancels completed and rejected matches. Logged 2026-10-28.
  - The "you were vouched for" notification, which needs its own dedicated queue (BUG-060).
  - Trust-history replay accuracy. It stays separate unless measured drift changes priority (maintainer).
  - The other IDEAS 2026-10-13 items: idempotent `match_completed` trust-edge counts, fission's `endorsement_count`
    copy, the `karma_awarded` publisher, endorsement-weighted matching.

---

## Layout Audit and Reference Products (UI research first)

### Current request page (`apps/frontend/src/pages/requests/[id].tsx`, 300 lines)

One `kq-card` article, top to bottom:
1. Directed-ask banner (line 192).
2. Pills: type, status, urgency (195-209).
3. Title `h1` (211).
4. Meta line: "Asked by X · community" (215-218).
5. Description, then the payload renderer (220-229).
6. Relationship context panel, only when `can_offer` (233-235).
7. **Action zone** below a top border (238-295). It holds "the one true next step" for the viewer's `viewer_relation`.

For a completed ask, the action zone is a dead end for both participants. It is also the natural slot: the page's own
design note (14-21) says this zone holds the viewer's next step, derived server-side.

### Reference products

| Product | Pattern after an exchange ends | What PR B takes |
|---|---|---|
| Airbnb | After checkout, host and guest each review from the trip record and the reminder that links to it | Prompt on the exchange record, for both sides, reached from the completion notification |
| Upwork | Each side leaves feedback on the contract page when the contract closes | The close-out lives on the item's own page, not a separate inbox |
| Couchsurfing | References are written from a specific stay, by either party | The vouch is grounded in a real, named exchange |
| TaskRabbit | Review the Tasker on the task after completion | Rate where the work is described |
| LinkedIn skill endorsements | "Endorse X for…" lists the person's *existing* skills; skippable | Choose from the partner's own skills; never free text; never blocking |

LinkedIn's lesson runs the other way too: endorsements detached from real work are low-signal. ADR-100 already ties
vouches to a completed match, and PR B keeps that.

### Layout decision

The completed-exchange panel goes in the **action zone**, below the existing relation line. The status line stays as
context. The panel renders only when `viewer_partners` is non-empty. It has one block per partner, most recent first:

```
┌──────────────────────────────────────────────────────────────┐
│ This ask is completed.                          (existing)   │
│ ──────────────────────────────────────────────────────────── │
│ You helped Maria with this ask.        / Maria helped with   │
│                                          this ask. (requester)│
│ Rate this exchange: ☆☆☆☆☆   Skip      (only if not yet rated) │
│ Vouch for a skill you saw Maria use:                         │
│ (Cooking · 2 vouches · Vouch) (Carpentry · Withdraw vouch)   │
└──────────────────────────────────────────────────────────────┘
```

- Inline and non-blocking; no modal, **no dismiss or snooze** (maintainer). The page is opened on purpose, and
  persisting a dismissal would need schema.
- The vouch row appears only if the partner has at least one skill with `can_endorse` or `endorsed_by_me`. Otherwise
  it renders nothing: no empty heading, no "No shared skills" text.
- After rating, the prompt is replaced by a quiet "Thanks — ratings stay private." Skip hides it for this page view;
  it returns on reload, like the dashboard's durable `rate` decision.

---

## New Concepts

- **Completed partner (of a viewer, on a request)**: the other participant of a `requests.matches` row on that request
  with `status = 'completed'`, where the viewer is that match's requester or responder. The requester's partners are the
  responders of every completed match. A responder's partner is the requester, never another responder.

---

## Data Model

**None.** No migration, no `init.sql` change. Reads only existing columns, each checked against
`infrastructure/postgres/init.sql`:
- `requests.matches(id, request_id, responder_id, status, completed_at)`: init.sql:2482-2499.
- `auth.users(id, name)`.
- `feedback.feedback(from_user_id, request_match_id)`: init.sql:1795-1804; index `idx_feedback_match`.
- `requests.request_communities(request_id, community_id)`.

---

## API Endpoints

| Method | Path | Change | Auth |
|---|---|---|---|
| GET | `/requests/:id` (request-service) | Adds `viewer_partners` (below). Read boundary, 404 behaviour, `viewer_relation` and `viewer_match` unchanged. | Unchanged: JWT required (`authMiddleware` then `dbContextMiddleware` ahead of `requestsRouter`, `services/request-service/src/index.ts:128-135`); viewer = `req.user.userId` |

`viewer_partners` is always present and defaults to `[]`:

```ts
viewer_partners: Array<{
  match_id: string;                     // the completed match (the exchange)
  user_id: string;                      // the partner
  name: string;
  completed_at: string | null;
  rated_by_me: boolean;                 // the viewer has a feedback.feedback row for this match
  rating_community_id: string | null;   // MIN(request community), the rate decision's rule; null = no rating
}>
```

Ordered `completed_at DESC NULLS LAST, match_id DESC`, capped at 20 entries. In practice a request has one completed
match. More are reachable only through the BUG-074 cancel path, and the cap bounds the client's skill fetches.

**Exposure matrix** (the real-SQL test asserts every row):

| Viewer on request Q (requester R; completed matches A, B; rejected C; preferred provider P) | `viewer_partners` |
|---|---|
| R (requester) | `[B, A]` (responders of completed matches, newest first) |
| A (completed responder) | `[R]` only, never B |
| C (rejected/cancelled responder; can still read Q) | `[]` |
| P (preferred provider; can still read Q) | `[]` |
| M (community member who can read Q) | `[]` |
| no JWT | 401 from `authMiddleware` (unchanged); the subquery still yields `[]` for a NULL viewer by construction |

`POST /auth/skills/endorsements`, `GET /auth/skills/users/:userId` and `POST /reputation/feedback` are **unchanged**. The
page calls them exactly as TrustCard and the dashboard already do.

---

## Frontend Changes

| File | Change |
|---|---|
| `apps/frontend/src/components/skills/MemberSkills.tsx` | Optional `endorsableOnly` and `heading` props. In that mode it filters to `can_endorse \|\| endorsed_by_me` (server flags only), shows the heading only when that list is non-empty, and renders `null` while loading, when empty, and on 404 or error. The default mode is byte-for-byte unchanged in behaviour (TrustCard and the People tab). |
| `apps/frontend/src/components/requests/CompletedExchangePanel.tsx` (new) | One block per entry. Partner sentence by viewer role; `RatingPrompt` only when `!rated_by_me && rating_community_id`; `MemberSkills endorsableOnly` once per distinct `user_id` (the newest entry). |
| `apps/frontend/src/pages/requests/[id].tsx` | `viewer_partners?: ViewerPartner[]` on `RequestDetail`. Renders the panel in the action zone when it is non-empty. A missing field is treated as `[]`, so existing page-test fixtures stay valid. |
| `apps/frontend/src/components/NotificationItem.tsx:89-90` | `match_completed` CTA label: "Rate Helper" → "Rate & vouch". |

---

## Notification copy (no transport change)

`services/notification-service/src/templates/notificationTemplates.ts:78-87`, `match_completed`:
- title "Match Completed — Leave a Rating" → **"Exchange completed"**
- body → **`Your exchange for "${data.request_title}" is complete. Rate it and vouch for skills you saw.`**
- `ctaLabel` "Rate Helper" → **"Rate & vouch"**; icon, priority, channels and `actionUrl` unchanged.

Both recipients (subscriber.ts:87-105) get the same template. The requester rates the helper and the helper rates the
requester, so the old "Rate Helper" was wrong for one of them anyway. Notifications already stored keep their old text.

---

## User Guide & Doc Updates

- `docs/guides/profile-guide.md` "Vouching for skills" (line 35): add the completed request page, reached from the
  completion notification, as the first place to vouch. Helping tab and People tab stay.
- `docs/guides/match-lifecycle.md` and `docs/guides/fulfilling-requests-guide.md`: after both sides mark done, the
  request page offers a private rating and a vouch.
- `docs/guides/managing-commitments-guide.md`: one line pointing completed exchanges to the request page, if it
  describes rating.
- `docs/concepts/skill-endorsements.md`: where you can vouch, and the partner-exposure rule.
- `apps/frontend/src/lib/onboarding/workflows.ts:25`: the vouching sentence names the completed request page.
- **ADR-100 amendment**, no new number (maintainer). Title "Sprint 134 PR B: vouching from a completed exchange". It
  records the exposure rule, the request page as a vouch surface, and that eligibility stays server-side. It changes no
  status, no `docs/adr/README.md` row and no `ADR_GROUPS` entry. Check whether the index row's summary needs a phrase.
- `services/request-service/CONTEXT.md` (GET /requests/:id section, line 830ff, and Recent Fixes);
  `services/registry.json` (`/requests/:id` description, line 389); `services/notification-service/CONTEXT.md` (copy).
- `docs/IDEAS.md` 2026-10-13 "Vouch from the request page": mark it done in Sprint 134 PR B.
- Landing: every page above is already published (`scripts/generate-docs.ts:255, 323-338`), so no new slug. Regenerate,
  then revert the timestamp and HEAD-sha churn.

---

## Critical Implementation Notes

1. **Partner status is per exchange, not per read.** The partner subquery filters `pm.status = 'completed'` AND
   `matchParticipantSql('r', 'pm', '$2')` (`services/request-service/src/db/directedAudience.ts:20`). Partner is
   `CASE WHEN r.requester_id = $2 THEN pm.responder_id ELSE r.requester_id END`. Never derive it from
   `requestReadableSql`. That grants reads to historical helpers and the preferred provider, who are **not** partners.
2. **Keep it inside the existing guarded statement.** Add `viewer_partners` as a scalar subquery in the SELECT list of
   the detail query (`requests.ts:1615-1650`), so it needs no GROUP BY change: it references only grouped `r.id` and
   `r.requester_id`. It reads `requests.matches`, `auth.users`, `feedback.feedback` and `requests.request_communities`,
   not `requests.help_requests`, so the directed-surface scanner sees no new read. Run its gate:
   `services/request-service/tests/regression/sprint-132-directed-audience-gate.test.ts`.
3. **`$2` stays uuid-only.** Every new use of `$2` compares it with a uuid column. A text cast or a `$2 IS NULL` test
   can raise "inconsistent types deduced for parameter $2" (the L2 CI failure, handoff *PR L2 state*). A NULL viewer
   already yields no rows through `=`.
4. **`rated_by_me` mirrors the dashboard's rate decision** (`requests.ts:1053-1056`, `NOT EXISTS feedback.feedback ...
   from_user_id = $1`). That table has `ENABLE ROW LEVEL SECURITY` without FORCE (init.sql:6697) and a
   `community_isolation` policy on `app.current_community_id` (6691); `requests.matches` is the same (6887). Both the
   rate decision and this route run behind the same `dbContextMiddleware`, and the rate decision already reads
   `feedback.feedback` from request-service in production. CI's real-SQL test is the arbiter. Whether the demo DB role
   bypasses these policies as table owner is **UNVERIFIED** here (it would need a demo-host read).
5. **No client eligibility.** The vouch row filters only on `can_endorse` and `endorsed_by_me` from
   `GET /auth/skills/users/:userId` (`services/auth-service/src/routes/skills.ts:14-40`). That route computes them from
   the same `completedPairSql` and `skillVisibleToSql` as `POST /endorsements` (`skills.ts:96-107`). A hidden partner
   (404), a load error, or no endorsable skill renders nothing.
6. **Vouch attribution is unchanged (ADR-100).** A vouch records the pair's most recent completed match, which may
   belong to another request. Do not add a `match_id` input to `POST /endorsements`.
7. **The rating write is unchanged.** `POST /reputation/feedback` already requires a completed match, the caller as a
   participant, the counterparty as `to_user_id` and a request community (`reputation.ts:347-370`). The panel passes
   `{ match_id, to_user_id: partner.user_id, community_id: rating_community_id, rating }` through
   `submitExchangeRating`. That call is best-effort and swallows errors, as on the dashboard. A null community hides the
   prompt rather than letting it fail silently.
8. **Ratings stay private (ADR-036).** Show only whether the viewer rated, never a value or the partner's rating.
9. **Several completed matches exist (BUG-074)**, possibly the same partner twice. Rate per match; vouch once per
   distinct partner. Do not fix BUG-074 in this PR.
10. **The existing page tests mock `@/lib/api` with `requestService` only**
    (`apps/frontend/tests/tdd/sprint-101-request-detail-action.test.tsx:23-33`). The panel must not render, and must
    not call `skillsService` or `reputationService`, when `viewer_partners` is absent or empty.
11. **Frontend Jest clears nothing between tests**: `mockReset` in `beforeEach` (memory
    `feedback_jest_mock_config_asymmetry`; `sprint-133-vouch.test.tsx:19-21`). The API client already unwraps the
    envelope (`res.data`, never `res.data.data`).
12. **No JWT claim reads.** Use `req.user.userId` only. `tests/regression/sprint-134-pr-k-claim-gate.test.ts` fails on
    a new claim read.
13. **Real SQL is CI-only on this Windows box.** The new root `tests/integration/` test drives request, auth and
    reputation over HTTP, following `tests/integration/sprint-133-request-detail-visibility.integration.test.ts`. A
    demo-host disposable container needs per-operation authorization.
14. **Version**: re-derive from `origin/master` at merge. Root manifest and lock edits are only the root version
    occurrences. No dependency change.
15. **`npm test` regenerates `apps/landing/src/data/docs/`**: revert the timestamp and HEAD-sha churn; a new generated
    page needs `git add -f`.
16. **Ask before**: any ADR number (none needed), any merge ("admin merge, yes/no?"), any demo-host operation, any
    CodeQL dismissal. Expect the `js/request-forgery` re-raise only if `apps/frontend/src/lib/api.ts` lines shift; PR B
    should not touch that file.
