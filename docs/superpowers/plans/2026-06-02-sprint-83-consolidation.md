# Sprint 83: Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Pay down four debt items — fix a match-action broken-access-control bug (authorize from JWT), scrub the SSE JWT out of nginx access logs, delete Sprint-79 orphaned graph code, and add a dry-run-first demo-data cleanup script — each with tests and docs, shipping v10.8.0.

**Architecture:** No new services, endpoints, or schema. Item 1 changes the *identity source* of three request-service handlers (body → JWT). Item 2 is nginx config + a test promotion. Item 3 is dead-code deletion. Item 4 is a standalone ops script. ADR-064 codifies the authorize-from-identity rule.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue, nginx.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `services/request-service/tests/tdd/sprint-83-match-action-auth.test.ts` | TDD → regression: JWT-identity authorization for accept/reject/complete; cross-user forbidden; responder-can-withdraw |
| `scripts/cleanup-demo-data.ts` | Dry-run-first orphaned/stale record cleanup (`--apply` to mutate) |
| `docs/adr/ADR-064-authorize-from-authenticated-identity.md` | ADR: authorize mutations from `req.user.userId`, never client-supplied ids |
| `apps/landing/src/data/docs/concepts/adr-064-authorize-from-authenticated-identity.json` | Landing ADR JSON |

### Existing files to modify
| File | Change |
|------|--------|
| `services/request-service/src/routes/matches.ts` | accept/reject/complete → `AuthenticatedRequest`, identity from `req.user!.userId`; ignore `body.user_id` |
| `apps/frontend/src/lib/api.ts` | `rejectMatch`/`acceptMatch`/`completeMatch` drop `user_id` arg |
| `apps/frontend/src/components/CommitmentsTab.tsx` | callers stop passing `currentUser.id` to those calls |
| `infrastructure/nginx/nginx.conf` | `map` to mask `access_token`; location-scoped sanitized `access_log` for `/api/notifications` |
| `services/notification-service/tests/tdd/sprint-81-sse-auth.test.ts` | **move** → `services/notification-service/tests/regression/` |
| `services/social-graph-service/src/database/trustEdgeDb.ts` | delete `getTrustGraphAggregateForCenter` + `center?` param |
| `services/social-graph-service/src/services/trustEdgeService.ts` | delete `center?` threading |
| `services/social-graph-service/src/routes/trustGraph.ts` | delete `center?` route param usage |
| `services/social-graph-service/tests/tdd/sprint-79-trust-metric-and-depth.test.ts` | remove the `getTrustGraphAggregateForCenter` assertion only |
| `apps/frontend/src/components/TrustGraph.tsx` | inline pass-through dispatcher if clean |
| `docs/adr/README.md` | index ADR-064 |
| `apps/landing/src/data/docs/nav.json` | add ADR-064 under "Architecture Decisions" (grep-verify after) |
| `services/request-service/CONTEXT.md` | match-action auth source + Recent Fixes |
| `services/notification-service/CONTEXT.md` | SSE log scrub + token-TTL decision |
| `services/social-graph-service/CONTEXT.md` | removed graph fn |
| `package.json` (root) | version 10.7.0 → 10.8.0 |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Identity from JWT, never the body.** accept/reject/complete read `req.user!.userId`. Type handlers `AuthenticatedRequest`. Guard comparison logic stays identical — only the identity *source* changes. Tolerate a leftover `body.user_id` (ignore it) for un-deployed clients.
2. **`complete` is highest-impact** — forged completion publishes `match_completed` → awards karma. Its test MUST cover cross-user-forbidden.
3. **Original "Withdraw Offer" symptom already fixed** (Sprint 62). This sprint fixes the *auth source* and adds the regression test locking responder-can-withdraw — it does not re-fix the old guard.
4. **nginx maps live at `http{}` scope** (not inside `location`). The sanitized `access_log` + custom `log_format` are location-scoped. Changes take effect only on deploy (`deploy.sh` copies + reloads nginx).
5. **Token TTL retained at 1h** — documented decision, no code change.
6. **Promote, don't duplicate** the SSE test — move file `tdd/` → `regression/`, fix relative imports, confirm green.
7. **Grep before deleting graph code** — confirm no other importer of `getTrustGraphAggregateForCenter` / `center?`. Update the sprint-79 assertion; keep unrelated sprint-79 coverage.
8. **Cleanup script dry-run by default** — mutate only under `--apply`, after printing per-table counts + sample rows. Rank orphan detection against real FK targets.
9. **JWT field is `communities`**, never `communityMemberships`.
10. **Version bump 10.7.0 → 10.8.0** — update `v10-polish` version-invariant test if it pins the number.
11. **Landing docs gitignored** — `git add -f`; run `generate-docs` from `apps/landing/`; nav.json reverts — grep-verify + re-apply.
12. **No worktrees** — work directly on `feature/sprint-83-consolidation`.

---

## Task 1: Feature branch + failing auth test (TDD)

**Files:**
- Create: `services/request-service/tests/tdd/sprint-83-match-action-auth.test.ts`

- [ ] Create branch

```bash
git checkout -b feature/sprint-83-consolidation
```

- [ ] **Write the failing test FIRST** — assert JWT-identity authorization for all three match-action endpoints:
  - `reject`: responder (helper) on their own match → 200 (locks "responder-can-withdraw")
  - `reject`: a third user whose JWT is neither requester nor responder → 403, even if they pass a participant's id in `body.user_id` (proves body is ignored)
  - `accept`: non-requester (non-suggested-helper) JWT → 403
  - `complete`: cross-user JWT → 403; legitimate participant → records done_at
  - Each authorized call sets `Authorization: Bearer <jwt for the acting participant>` and sends **no** `user_id` in the body

- [ ] **Verify it fails** (handlers still read body)

```bash
cd services/request-service && npm run test:tdd -- sprint-83-match-action-auth
```

---

## Task 2: Harden match-action authorization (backend)

**Files:**
- Modify: `services/request-service/src/routes/matches.ts`

- [ ] Type accept/reject/complete handlers as `AuthenticatedRequest`; replace `const { user_id } = req.body` with `const user_id = req.user!.userId` (keep the variable name so guard comparisons are untouched). For `accept`, keep `travel_time_minutes` from the body.

- [ ] Confirm the matches router is mounted behind `authMiddleware` (it is, in `index.ts`) so `req.user` is populated. Do NOT add a second authMiddleware.

- [ ] **Verify the Task 1 test now passes**

```bash
cd services/request-service && npm run test:tdd -- sprint-83-match-action-auth
```

- [ ] **`/simplify`** on the matches.ts diff

---

## Task 3: Frontend — stop sending user_id

**Files:**
- Modify: `apps/frontend/src/lib/api.ts`, `apps/frontend/src/components/CommitmentsTab.tsx`

- [ ] In `api.ts`, drop the `user_id` argument from `rejectMatch`/`acceptMatch`/`completeMatch` (PUT body no longer needs it).
- [ ] In `CommitmentsTab.tsx`, update `handleDecline` and the accept/complete handlers to call without `currentUser.id`; remove the now-dead `currentUser` reads if they served only that purpose (keep any still used for UI).

- [ ] **Verify** frontend type check + unit tests

```bash
cd apps/frontend && npx tsc --noEmit && npm run test:unit
```

- [ ] **`/simplify`** on the frontend diff

---

## Task 4: SSE nginx log scrub + token-TTL decision

**Files:**
- Modify: `infrastructure/nginx/nginx.conf`

- [ ] At `http{}` scope, add a `map` that produces a sanitized request line/args with the `access_token` value masked (e.g. `access_token=***`). Reference the masked variable from a location-scoped `log_format` + `access_log` on the `location ~ ^/api/notifications(/.*)?$` block.
- [ ] Confirm `nginx -t` syntax is valid (config test only; reload happens on deploy).

```bash
# Local syntax sanity (if nginx available); otherwise verified on deploy
nginx -t -c "$PWD/infrastructure/nginx/nginx.conf" 2>&1 || echo "validated on deploy via deploy.sh"
```

- [ ] Note the token-TTL retention decision (1h) inline near the SSE block as a comment, and in notification-service CONTEXT (Task 8).

---

## Task 5: Promote SSE auth test to regression tier

**Files:**
- Move: `services/notification-service/tests/tdd/sprint-81-sse-auth.test.ts` → `services/notification-service/tests/regression/sprint-81-sse-auth.test.ts`

- [ ] `git mv` the file; fix any relative imports broken by the path change.

- [ ] **Verify it passes in the blocking tier**

```bash
cd services/notification-service && npm run test:regression
```

---

## Task 6: Delete Sprint-79 orphaned graph code

**Files:**
- Modify: `trustEdgeDb.ts`, `trustEdgeService.ts`, `trustGraph.ts`, `sprint-79-trust-metric-and-depth.test.ts`, `TrustGraph.tsx`

- [ ] **Grep first** — confirm the only importers of `getTrustGraphAggregateForCenter` and the `center?` param are the known files.

```bash
grep -rn "getTrustGraphAggregateForCenter\|center" services/social-graph-service/src
```

- [ ] Delete `getTrustGraphAggregateForCenter` and remove the `center?` param threading from `trustEdgeDb.ts` → `trustEdgeService.ts` → `trustGraph.ts` route.
- [ ] Remove only the `getTrustGraphAggregateForCenter` assertion from the sprint-79 test (keep unrelated coverage).
- [ ] Inline `TrustGraph.tsx` dispatcher at callers **only if** it's a clean pass-through with few callers; otherwise leave a note and skip.

- [ ] **Verify** social-graph build + tests, frontend type check

```bash
cd services/social-graph-service && npx tsc --noEmit && npm run test:tdd -- sprint-79
cd apps/frontend && npx tsc --noEmit
```

- [ ] **`/simplify`** on the deletion diff

---

## Task 7: Demo-data cleanup script (dry-run first)

**Files:**
- Create: `scripts/cleanup-demo-data.ts`

- [ ] Implement orphan/stale detection as **read-only by default**:
  - Matches/offers referencing deleted requests, users, or communities
  - Requests/offers closed-and-expired past TTL
  - Simulation-tagged rows from retired sim runs
- [ ] Print per-table counts + sample rows; mutate **only** when invoked with `--apply`. Rank orphan detection against real FK targets (don't assume a single canonical row).

- [ ] **Verify dry-run** runs clean against a local/demo DB and prints a report without mutating

```bash
node scripts/cleanup-demo-data.ts   # dry-run, no --apply
```

---

## Task 8: ADR-064 + docs + CONTEXT + registry

**Files:**
- Create: `docs/adr/ADR-064-authorize-from-authenticated-identity.md`, `apps/landing/src/data/docs/concepts/adr-064-authorize-from-authenticated-identity.json`
- Modify: `docs/adr/README.md`, `apps/landing/src/data/docs/nav.json`, the relevant user guide, 3× CONTEXT.md, root `package.json`

- [ ] Write ADR-064 (status Implemented): the authorize-from-identity rule, Sprint 81 SSE as prior instance, the three match-action endpoints as this sprint's instance, and the token-TTL=1h decision.
- [ ] Add ADR-064 to `docs/adr/README.md` index.
- [ ] Create the landing ADR JSON; add nav.json entry under "Architecture Decisions"; run generate-docs from `apps/landing/`; **grep-verify nav.json + re-apply if reverted**; `git add -f` landing docs.
- [ ] Update the relevant matching/safety user guide to note match actions are tied to your signed-in identity (no behavior change).
- [ ] Update `services/request-service/CONTEXT.md` (auth source + Recent Fixes), `services/notification-service/CONTEXT.md` (log scrub + TTL decision), `services/social-graph-service/CONTEXT.md` (removed fn).
- [ ] Bump root `package.json` 10.7.0 → 10.8.0; update `v10-polish` version-invariant test if it pins the number.

- [ ] **Verify** docs feedback loop

```bash
npm run feedback:check
```

---

## Task 9: Promote auth test to regression + full type check

**Files:**
- Move: `services/request-service/tests/tdd/sprint-83-match-action-auth.test.ts` → `services/request-service/tests/regression/` (once green)

- [ ] `git mv` the now-passing auth test into `regression/` (locks the access-control contract forever).

- [ ] **Verify** backend builds + full test suite

```bash
cd services/request-service && npx tsc --noEmit
npm test            # unit + regression, must pass
```

---

## Task 10: SDLC quality gates

- [ ] **`/simplify`** — final pass on the whole branch diff

```bash
# /simplify on the branch diff
```

- [ ] **`/code-review`** — resolve correctness/logic findings before merge

```bash
# /code-review on the branch diff
```

- [ ] **`/security-review`** — confirm the match-action fix closes the IDOR and the nginx scrub masks the token; resolve real findings, justify dismissals (the api.ts baseURL request-forgery FP recurs — dismiss with justification)

```bash
# /security-review on the branch diff
```

- [ ] **Standing CI gates** — dependency audit + CodeQL run on push

```bash
npm audit --package-lock-only --audit-level=high
```

---

## Task 11: Final verification + pre-push

- [ ] **Verify everything green**

```bash
npm test                  # unit + regression (must pass)
npm run test:tdd          # report (known pre-existing failures only — no NEW ones)
npm run feedback:check    # docs complete
```

- [ ] Confirm no NEW tdd failures beyond the documented pre-existing set.

---

## Task 12: Merge + Deploy

Use the `/deploy` skill.

- [ ] Open PR per the PR contract template (Summary / Validation / Docs / Quality gates / Security dismissals / Follow-ups / Lane); ensure all 6 required checks green (`pr-contract`, Lint & Type Check, Test Frontend, Test Backend Services, Code Scanning Gate, Security Audit).
- [ ] On Admin authorization ("pull it in"), merge to master.
- [ ] Push triggers GitHub Actions → deploy to demo. **Monitor the run.**
- [ ] **SSH step required this sprint:** nginx.conf change takes effect only when `deploy.sh` copies + reloads nginx — confirm the reload happened (or run it). Run `node scripts/cleanup-demo-data.ts` dry-run against the demo DB, review output, then `--apply` only after human review.
- [ ] Verify demo health post-deploy (`npm run health:check`).
