# ADR-064: Authorize Mutations from Authenticated Identity, Not Client-Supplied IDs

**Status**: Implemented
**Date**: 2026-06-02
**Deciders**: Engineering

## Context

A mutation's authorization decision must answer "is *this actor* allowed to do
this?" The actor is whoever the verified JWT says it is — `req.user.userId`,
populated by `authMiddleware` after signature + expiry validation. A `user_id`
field arriving in a request body or query string is, by contrast, attacker-
controlled: it is whatever the client chose to send.

Karmyq drifted into trusting the latter in several places:

1. **Match-action endpoints (the bug that prompted this ADR).** The
   request-service handlers `PUT /matches/:id/accept`, `/reject`, and `/complete`
   sit behind `authMiddleware`, so `req.user.userId` was always available — yet
   they authorized against `req.body.user_id`:

   | Handler | Guard (before) | Risk |
   |---------|----------------|------|
   | `accept` | `responder_id !== body.user_id` (admin-proposed) / `requester_id !== body.user_id` | Forge an accept as another participant |
   | `reject` | `requester_id !== body.user_id && responder_id !== body.user_id` | Forge a reject/withdraw on someone else's match |
   | `complete` | `requester_id !== body.user_id && responder_id !== body.user_id` | Forge a completion confirmation |

   Any logged-in user could act on another user's match by supplying a
   participant's id in the body — a broken-access-control / IDOR flaw.
   `complete` is the most damaging: a forged completion confirmation publishes the
   `match_completed` event, which **awards karma**.

2. **SSE stream authentication (Sprint 81, the prior instance).** The notification
   stream once trusted a `userId` path/query value; Sprint 81 closed that by
   verifying the JWT (passed as `access_token` because browser `EventSource`
   cannot set headers) and rejecting any request whose token identity does not
   match. Same principle, applied to a read stream.

These are the same class of mistake: **authorizing from input we received rather
than from identity we verified.**

## Decision

**Mutation authorization reads the actor's identity from the authenticated JWT
(`req.user.userId`), never from a client-supplied id.**

Concretely, for Sprint 83:

- `accept`/`reject`/`complete` are typed `AuthenticatedRequest` and derive the
  acting `user_id` from `req.user!.userId`. The guard *comparison* logic is
  unchanged — only the *source* of the identity moved from body to token. A
  leftover `body.user_id` from an un-deployed client is tolerated (ignored), not
  trusted. Legitimate body input that is **not** identity (e.g. `accept`'s
  `travel_time_minutes`) still comes from the body.
- The frontend (`api.ts` `acceptMatch`/`rejectMatch`/`completeMatch`,
  `CommitmentsTab.tsx`, `MyRequestsTab.tsx`) stops sending `user_id` entirely.
- A regression test (`request-service/tests/regression/sprint-83-match-action-auth.test.ts`)
  locks the contract: a forged `body.user_id` never grants access, and a missing
  `body.user_id` never blocks a legitimate participant.

### SSE JWT-in-URL log hardening (carry-forward)

Because the SSE token rides in the URL as `access_token`, it would land in nginx
access logs in cleartext. An http-scope `map` rewrites the `access_token` value to
`***` in a sanitized request line, and the `/api/notifications` location logs with
a `log_format` that uses the sanitized line. This removes the cleartext-in-logs
exposure without changing the auth flow.

### Token TTL decision

Access tokens are retained at **1 hour** with rotation. This balances stream/UX
continuity against blast radius. Shortening the TTL is **not** adopted here: a
shorter TTL degrades long-lived SSE streams unless paired with a refresh-on-SSE
story, which is out of scope. Documented as a deliberate decision, not an
oversight.

## Consequences

**Positive**
- The match-action IDOR is closed; karma can no longer be awarded via a forged
  completion.
- A single, stated rule ("authorize from verified identity") now covers both the
  SSE stream (Sprint 81) and match mutations (Sprint 83), and is the standing
  expectation for every future mutation.
- The SSE token no longer appears in access logs.

**Negative / trade-offs**
- Clients must be authenticated for these actions (already true behind
  `authMiddleware`); there is no "act on behalf of" path via body id (intended).
- The 1h token TTL remains a known, accepted exposure window for a leaked token.

## Follow-ups

- `DELETE /matches/:id` (cancel) reads `body.user_id` with the same pattern and
  should be migrated to `req.user.userId` in a future pass; it was outside this
  sprint's confirmed scope. Until then it carries the same IDOR class as the three
  endpoints fixed here.
- Audit remaining services for any mutation still authorizing from a body/query id.
