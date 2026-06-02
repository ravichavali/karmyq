# Sprint 83: Consolidation — Match-Action Auth, SSE Log Hardening, Graph Cleanup, Demo Hygiene — Design Spec

**Date**: 2026-06-02
**Status**: Approved
**Version**: v10.7.0 → v10.8.0
**Sprint Branch**: `feature/sprint-83-consolidation`

---

## Overview

The Trust Graph / Community Evolution arc (Sprints 74→77→78→79) closed cleanly at v10.7.0. Sprints 80–82 were standalone Codex follow-ups (reliability hardening, SSE auth, taxonomy). With no arc obligation pulling forward, Sprint 83 is a deliberate **consolidation sprint**: pay down four accumulated debt items — one real security bug, one carry-forward security gap, one dead-code deletion, and demo-server data hygiene — each shipped with tests and docs.

The headline item is a **broken-access-control fix**. The request-service match-action endpoints (`accept`, `reject`, `complete`) sit behind `authMiddleware` but authorize against a `user_id` field taken from the **request body** rather than the authenticated JWT identity. Any logged-in user can act on another user's match by supplying the right participant id. This is the same client-trust class Sprint 81 closed for the notification SSE stream; we close it here for match mutations.

The remaining three items are lower-risk: scrub the JWT that rides in the SSE stream URL out of nginx access logs (Sprint 81 carry-forward), delete the orphaned `getTrustGraphAggregateForCenter` / `center?` code path left behind when Sprint 79 dropped click-to-recenter, and add a dry-run-first cleanup script for stale simulation data on the demo server.

### Core Principle: Authorize from identity you verified, never from input you received

A mutation's actor is whoever the JWT says it is — `req.user.userId`. Client-supplied identity fields (`user_id` in a body) are advisory at best and forgeable at worst; they must never be the basis of an authorization decision.

---

## Multi-Sprint Arc

This sprint is **not** part of an arc — it follows the closed Trust Graph arc and clears debt before the next theme begins.

| Sprint | Focus | Status |
|--------|-------|--------|
| 79 | Trust Graph Viz Polish + Depth (ADR-063) | ✅ deployed (v10.7.0) |
| 80 | Frontend reliability/UX hardening | ✅ merged |
| 81 | SSE auth hardening (PR #42) | ✅ merged |
| 82 | Product taxonomy consistency (PR #43) | ✅ merged |
| **83** | **Consolidation (this sprint)** | 📋 Ready to execute (v10.8.0) |
| TBD | Feed/dashboard fit-for-purpose UX arc | Backlog (IDEAS 2026-05-20) |
| TBD | Express 4 → 5 migration (all 11 services) | Backlog — deliberate sprint, NOT a Dependabot auto-merge |
| TBD | Supply-chain hardening remainder (ADR-061 items 4–5) | Backlog |

---

## Work Items

### Item 1 — Match-action authorization hardening (security, ADR-064)

**Problem.** `services/request-service/src/routes/matches.ts` mounts behind `authMiddleware` (index.ts), so `req.user.userId` is always available. But three handlers authorize against `req.body.user_id`:

| Handler | Line | Current guard | Risk |
|---------|------|---------------|------|
| `PUT /matches/:id/accept` | ~260 | `match.responder_id !== user_id` (admin-proposed) / `match.requester_id !== user_id` | Forge accept as another participant |
| `PUT /matches/:id/reject` | ~377 | `requester_id !== user_id && responder_id !== user_id` | Forge reject/withdraw |
| `PUT /matches/:id/complete` | ~454 | `requester_id !== user_id && responder_id !== user_id` | Forge a completion confirmation → triggers karma award |

`complete` is the most damaging: a forged completion confirmation publishes `match_completed`, which awards karma.

**Fix.** Type the three handlers as `AuthenticatedRequest`; derive the acting identity from `req.user!.userId` and ignore `req.body.user_id` entirely. The guard comparisons stay identical — only the *source* of the identity changes. Frontend (`api.ts` `rejectMatch`/`acceptMatch`/`completeMatch` + `CommitmentsTab.tsx`) stops sending `user_id`; backend tolerates a stale body field (ignored) so an un-deployed client doesn't break.

This is an architectural decision → **ADR-064: Authorize mutations from authenticated identity, not client-supplied IDs.** The principle generalizes; the ADR documents it as the standing rule and notes Sprint 81 (SSE) as the prior instance.

### Item 2 — SSE JWT-in-URL log hardening (Sprint 81 carry-forward)

**Problem.** Browser `EventSource` can't set headers, so `/notifications/stream` accepts the JWT as an `access_token` query param (Sprint 81). That token therefore lands in **nginx access logs** for the notification location, plus proxy logs and `Referer` headers.

**Fix.**
1. **nginx log scrub.** In the `location ~ ^/api/notifications(/.*)?$` block ([nginx.conf:205](../../infrastructure/nginx/nginx.conf#L205)), mask the `access_token` query arg before it is written to the access log. Use a `map` on `$request_uri` (or `$args`) → a sanitized variable, and a location-scoped `access_log` with a custom `log_format` that logs the sanitized URI. Changes take effect only on deploy (`deploy.sh` copies + reloads nginx).
2. **Test promotion.** Move `services/notification-service/tests/tdd/sprint-81-sse-auth.test.ts` → `tests/regression/` (it has ridden green runs since Sprint 81; it locks a security contract and belongs in a blocking tier).
3. **Token TTL decision (documented, no code change).** Access tokens are already `1h` ([auth.ts:72](../../services/auth-service/src/routes/auth.ts#L72)) with rotation. 1h balances UX against blast radius; we **retain 1h** and document the rationale rather than shortening (shorter TTL without a refresh-on-SSE story degrades long-lived stream UX). Recorded in ADR-064's security-notes section / CONTEXT.

### Item 3 — Sprint-79 orphaned graph code deletion (dead code)

**Problem.** Sprint 79 removed click-to-recenter/expand from the trust graph but left `getTrustGraphAggregateForCenter` and the `center?` param chain in place (named as the metric-fix target, with a passing test). `TrustGraph.tsx` is now a thin pass-through dispatcher to HEB.

**Fix.** Delete `getTrustGraphAggregateForCenter` and the `center?` param threading in `trustEdgeDb.ts`, `trustEdgeService.ts`, `trustGraph.ts`. Update/remove the sprint-79 test assertion that references it (do **not** delete unrelated sprint-79 coverage). Inline the `TrustGraph.tsx` dispatcher at its callers if it's a clean pass-through; if callers are many, leave the inline for a later pass and just delete the dead backend path. Verify nothing else imports the removed symbols (grep before deleting).

### Item 4 — Demo-data hygiene (operational)

**Problem.** Stale simulation data, orphaned records, and accumulated test state on the demo server make the platform harder to evaluate (IDEAS 2026-05-24).

**Fix.** Add `scripts/cleanup-demo-data.ts` (or `.js`) that identifies and removes orphaned/stale records — **dry-run by default**. Per the FK-dedup lesson ([feedback_fk_dedup_migration_dryrun]), the script prints what it *would* delete (counts per table, sample rows) and only mutates with an explicit `--apply` flag. Target classes: matches/requests/offers referencing deleted users or communities; expired-and-closed records past TTL; simulation-tagged rows from retired sim runs. Run the dry-run against the demo DB during the deploy step; apply only after human review of the dry-run output.

---

## New Concepts

- **Authenticated-identity authorization** — the standing rule (ADR-064) that mutation authorization reads `req.user.userId`, never a client-supplied id.

---

## Data Model

**No schema changes.** Item 4's cleanup script only deletes rows; it adds no tables or columns. All other items are code/config/test/docs.

---

## API Endpoints

No new endpoints. **Behavior change** on three existing request-service endpoints (auth source only; request/response shape unchanged):

| Method | Path | Change |
|--------|------|--------|
| PUT | `/matches/:id/accept` | Authorizes from JWT `req.user.userId`; `body.user_id` ignored |
| PUT | `/matches/:id/reject` | Authorizes from JWT `req.user.userId`; `body.user_id` ignored |
| PUT | `/matches/:id/complete` | Authorizes from JWT `req.user.userId`; `body.user_id` ignored |

---

## Frontend Changes

- `apps/frontend/src/lib/api.ts` — `rejectMatch`/`acceptMatch`/`completeMatch` signatures drop the `user_id` argument (no longer sent in body).
- `apps/frontend/src/components/CommitmentsTab.tsx` — callers (`handleDecline`, accept/complete handlers) stop reading `currentUser.id` purely to pass it to these calls; identity now comes from the token server-side.
- No visible UI change — withdraw/accept/complete behave identically for legitimate users.

---

## User Guide & Doc Updates

- **ADR-064** (new) → `docs/adr/ADR-064-authorize-from-authenticated-identity.md` + index in `docs/adr/README.md`; landing JSON `apps/landing/src/data/docs/concepts/adr-064-authorize-from-authenticated-identity.json` + nav.json "Architecture Decisions".
- **Security concept / guide touch** → update the existing trust/safety or "How matching works" user guide where it describes accepting/declining/completing a match, to note that these actions are tied to your signed-in identity (no behavior change for users, but the security posture is now documented).
- **CONTEXT.md** updates: `services/request-service/CONTEXT.md` (match-action auth source + "Recent Fixes"), `services/notification-service/CONTEXT.md` (SSE log-scrub + token-TTL decision), `services/social-graph-service/CONTEXT.md` (removed `getTrustGraphAggregateForCenter`).
- **registry.json** — no endpoint/event additions; confirm no stale references to removed graph fn.

---

## Critical Implementation Notes

1. **Identity from JWT, never the body.** All three match-action handlers must read `req.user!.userId`. Type them `AuthenticatedRequest`. Leave the guard comparison logic identical — only swap the identity source. Backend tolerates (ignores) a leftover `body.user_id` for un-deployed clients.
2. **`complete` is the highest-impact endpoint** — a forged completion publishes `match_completed` → awards karma. Make sure its test covers the cross-user-forbidden case.
3. **The original "Withdraw Offer" symptom is already fixed** (Sprint 62 widened the reject guard to both participants; frontend wiring is correct). This sprint does NOT re-fix that — it fixes the *auth source*, and adds the regression test that locks responder-can-withdraw.
4. **nginx changes only take effect on deploy** — `deploy.sh` copies nginx.conf and reloads. The log-scrub `map` must live at `http{}` scope (maps can't be inside `location`); the sanitized `access_log`/`log_format` usage is location-scoped.
5. **Token TTL is retained at 1h** — documented decision, not a code change. Do not shorten without a refresh-on-SSE story.
6. **Promote, don't duplicate** the SSE auth test — move the file from `tdd/` to `regression/`, update any path-relative imports, confirm it still passes in the blocking tier.
7. **Grep before deleting graph code** — confirm no importer of `getTrustGraphAggregateForCenter` / the `center?` param outside the known three files + the sprint-79 test. Update the test assertion; don't delete unrelated sprint-79 coverage.
8. **Cleanup script is dry-run by default** — mutate only under `--apply`, after printing per-table counts + sample rows. Never loop deletes blindly. Rank orphan detection against real FK targets (FK-dedup lesson).
9. **JWT field is `communities`**, never `communityMemberships`.
10. **Version 10.7.0 → 10.8.0** — update the `v10-polish` version-invariant test if it pins the number (it has broken on version bumps before).
11. **Landing docs are gitignored** — `git add -f`; run `generate-docs` from `apps/landing/`; nav.json reverts — grep-verify + re-apply.
12. **No worktrees** — solo dev, work directly on `feature/sprint-83-consolidation`.

---

## Pre-Existing TDD Failures (do NOT fix — not this sprint's regressions)

Carried from the Sprint 79 handoff; a NEW failure during this sprint is a real regression:
`sprint-39-provider-ux`, `sprint-43-feed-ranking`, `admin-schemas-api.test.ts` (request-service), `sprint-68-halflife`, `sprint-67-governance`, `social-graph-service` sprint-66/67/68 tdd tests.
