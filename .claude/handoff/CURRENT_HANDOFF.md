# Sprint 83: Consolidation — ✅ IMPLEMENTED, PR open, awaiting Admin merge (v10.8.0)

> **▶ STATUS:** All 4 items implemented on `feature/sprint-83-consolidation` with tests + docs.
> Quality gates run (simplify/code-review/security-review clean; audit 0 vulns; feedback:check clean).
> PR open against master — **awaiting Admin authorization to merge** ("pull it in"). On merge,
> GitHub Actions deploys to demo; an **SSH step is required** to confirm the nginx reload picked up
> the log-scrub, and to run `node scripts/cleanup-demo-data.ts` dry-run → `--apply` after review.

## What shipped this sprint
1. **Match-action auth hardening (ADR-064)** — accept/reject/complete authorize from `req.user.userId`,
   never `body.user_id`; closes an IDOR (forged `complete` → karma award). Regression test locks it.
   Frontend (`api.ts`, `CommitmentsTab`, `MyRequestsTab`) stops sending `user_id`.
2. **SSE JWT log scrub** — nginx http-scope `map` masks `access_token` in the `/api/notifications`
   access log; SSE auth test promoted `tdd/`→`regression/`. **Discovered + fixed:** notification-service
   `jest.config.js` never included the regression tier — wiring it in un-dormanted `notificationTemplates.test.ts`
   (52 tests). Per Admin decision, **fixed the templates to the test's documented design intent** (match_completed
   `high`→`medium`, karma_milestone `low`/no-push → `medium`/push, karma_awarded in_app on, match_created title +
   `/dashboard` URL, provider templates get push). Token TTL retained at 1h (documented).
3. **Sprint-79 orphan graph code deleted** — `getTrustGraphAggregateForCenter` + `?center=` aggregate path
   removed across db/service/route + frontend `getTrustGraphAggregate(center?)`; sprint-79 test trimmed.
   `TrustGraph.tsx` dispatcher left in place (not a clean inline — 2 callers rely on its mode default).
4. **`scripts/cleanup-demo-data.ts`** — dry-run by default, `--apply` to mutate; orphan detection via
   `NOT EXISTS` against real FK targets; stale-terminal + sim-owned (`@test.karmyq.com`) targets; `--ttl-days` flag.

## ⚠️ Known follow-up (logged in ADR-064)
- `DELETE /matches/:id` (cancel) still reads `body.user_id` — same IDOR class, deferred (was outside scope).
- `match_created` action URL changed `/requests/:id` → `/dashboard` to match test intent — revisit if the
  per-request deep link is preferred UX.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-83-consolidation`
3. Open plan: `docs/superpowers/plans/2026-06-02-sprint-83-consolidation.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

---

## Sprint Goal

Pay down four debt items — fix a match-action **broken-access-control bug** (authorize from JWT, not body `user_id`), scrub the SSE JWT out of nginx access logs, delete Sprint-79 orphaned graph code, and add a dry-run-first demo-data cleanup script — each with tests and docs, shipping **v10.8.0**.

---

## Spec + Plan

- **Design spec**: `docs/superpowers/specs/2026-06-02-sprint-83-consolidation-design.md`
- **Implementation plan**: `docs/superpowers/plans/2026-06-02-sprint-83-consolidation.md`

---

## The four items (confirmed scope)

1. **Match-action authorization hardening (security, ADR-064).** `accept`/`reject`/`complete` in `services/request-service/src/routes/matches.ts` authorize against `req.body.user_id` while sitting behind `authMiddleware` → any logged-in user can act on another's match (IDOR). `complete` is worst — a forged completion publishes `match_completed` → awards karma. Fix: read `req.user!.userId`, ignore body. + regression test (responder-can-withdraw; cross-user forbidden). The **original "Withdraw Offer" symptom is already fixed** (Sprint 62) — this fixes the auth *source*, not the old guard.
2. **SSE JWT-in-URL log hardening (Sprint 81 carry-forward).** Mask `access_token` query arg in nginx access logs for the `/api/notifications` location ([nginx.conf:205](../../infrastructure/nginx/nginx.conf#L205)); promote `sprint-81-sse-auth.test.ts` from `tdd/` → `regression/`; **retain 1h token TTL** as a documented decision (no code change).
3. **Sprint-79 orphaned graph code deletion.** Delete `getTrustGraphAggregateForCenter` + `center?` param chain (`trustEdgeDb.ts` → `trustEdgeService.ts` → `trustGraph.ts`); update the sprint-79 test assertion; inline `TrustGraph.tsx` dispatcher if clean. Grep before deleting.
4. **Demo-data hygiene (IDEAS 2026-05-24).** `scripts/cleanup-demo-data.ts` — dry-run by default, `--apply` to mutate, prints per-table counts + sample rows. Run dry-run on demo DB, apply after human review.

### Confirmed planning decisions
- **Item #1 reframed** from "fix withdraw bug" → "harden match-action auth" (original symptom already fixed; real IDOR found in its place).
- **No schema changes** — cleanup script only deletes rows.
- **Token TTL stays 1h** — documented, not shortened.
- **Version**: 10.7.0 → 10.8.0.
- **ADR-064** = authorize from authenticated identity, not client-supplied ids.

---

## ⚠️ Critical Implementation Notes (copied from spec)

1. **Identity from JWT, never the body.** accept/reject/complete read `req.user!.userId`; type handlers `AuthenticatedRequest`; guard comparison logic unchanged — only the identity source. Tolerate a leftover `body.user_id` (ignore it).
2. **`complete` is highest-impact** — forged completion → `match_completed` → karma award. Its test MUST cover cross-user-forbidden.
3. **Original "Withdraw Offer" symptom already fixed** (Sprint 62). Don't re-fix the guard; fix the auth source + add the locking regression test.
4. **nginx maps live at `http{}` scope** (not inside `location`); sanitized `access_log`/`log_format` are location-scoped. Changes take effect only on deploy (`deploy.sh` copies + reloads nginx).
5. **Token TTL retained at 1h** — documented decision, no code change.
6. **Promote, don't duplicate** the SSE test — `git mv` `tdd/` → `regression/`, fix imports, confirm green.
7. **Grep before deleting graph code** — confirm no other importer of `getTrustGraphAggregateForCenter` / `center?`; update the sprint-79 assertion, keep unrelated coverage.
8. **Cleanup script dry-run by default** — mutate only under `--apply`, after printing counts + samples; rank orphan detection against real FK targets.
9. **JWT field is `communities`**, never `communityMemberships`.
10. **Version 10.7.0 → 10.8.0** — update `v10-polish` version-invariant test if it pins the number.
11. **Landing docs gitignored** — `git add -f`; run generate-docs from `apps/landing/`; nav.json reverts — grep-verify + re-apply.
12. **No worktrees** — work directly on `feature/sprint-83-consolidation`.

---

## Multi-Sprint Arc

This sprint is **not** part of an arc — it clears debt after the closed Trust Graph arc.

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

> **Express 5 upgrade (why it's its own sprint):** Dependabot's grouped `production-deps` PR (#26)
> silently bundled a major Express `4.22.2 → 5.2.1` bump; passed PR CI on Turbo cache but broke the
> cache-cold master build (notification-service 8× `TS2345` on `req.params`/`req.query` now
> `string | string[]`). Reverted in `ebf67b5`. Express 5 is a real migration (stricter request typing,
> changed route-matching syntax, immutable `req.query`, removed methods). Plan as a dedicated sprint
> across all 11 services with full integration testing. Dependabot now keeps majors out of groups (PR #29).

---

## Persistent Context (carry forward unchanged)

### Multi-agent PR process — ✅ LIVE on master (2026-06-02, PR #45)
- `.github/pull_request_template.md` = the cross-agent PR contract (Summary / Validation / Docs / Quality gates / Security dismissals / Follow-ups / Lane).
- `.github/workflows/pr-contract.yml` fails a PR whose body is empty or missing the four required headers; `dependabot[bot]` passes through.
- master **branch protection**: required checks = `pr-contract`, `Lint & Type Check`, `Test Frontend`, `Test Backend Services (Unit + Regression)`, `Code Scanning Gate (ADR-060)`, `Security Audit`; `strict: true`; 1 approving review; `enforce_admins: false`.
- **Merge authority:** Admin owns approval + merge; Claude validates merge-readiness and recommends, executes merge only on Admin authorization ("pull it in"). Agents never self-merge.
- **Enforcement is identity-based** — same-machine agents (Claude, Codex) share admin `gh` creds, so "no direct push to master" is convention-by-discipline for them, not a hard gate. See AGENTS.md "Enforcement reality".
- A deliberate empty marker commit `90b9067` exists on master — do NOT "clean it up".

### ⚠️ NEXT-SESSION WARM-UP — unblock dependabot PRs
The 8 open dependabot PRs (#33–41) predate `pr-contract.yml`; their stale branches have no `pr-contract` status, so the now-required check **blocks** them. To unblock each: comment **`@dependabot rebase`** → recreated branch includes the workflow and passes via bot pass-through. Then review/merge per dependabot merge discipline (**inspect grouped PRs for MAJOR bumps; don't rapid-merge** — 5 concurrent deploys caused ENOTEMPTY).

### Architecture Gotchas (Persistent)
- **Landing page docs**: `apps/landing/src/data/docs/` is in `.gitignore` — always `git add -f`
- **nav.json revert bug**: `generate-docs.ts` regenerates nav.json — run from `apps/landing/`; grep-verify after; re-apply if reverted
- **ADR numbering**: 059 = dependency gate, 060 = code-scanning gate, 061 = supply-chain hardening, 062 = community identity/idempotent creation, 063 = canonical trust metric + unified graph viz. **064 = authorize from authenticated identity (this sprint).**
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`
- **Schema is `communities.communities`** (plural schema name) — older `community.*` comments are stale
- **API response unwrap**: `createApiClient` interceptor already unwraps the envelope — use `res.data`, not `res.data.data`
- **trust_edges_live is a VIEW**: never INSERT/UPDATE it — write `trust_edges`, read `trust_edges_live`
- **`git add` on CLAUDE.md**: tracked as lowercase `claude.md`
- **Solo dev — no worktrees**: work directly on feature branches
- **Root package.json version**: 10.7.0 (→ 10.8.0 this sprint)
- **CI security gates**: dependency audit (ADR-059, blocking `--audit-level=high`) + CodeQL code-scanning gate (ADR-060) run automatically on push

### Pre-Existing TDD Failures (do NOT fix — a NEW failure this sprint is a real regression)
`sprint-39-provider-ux` (7), `sprint-43-feed-ranking` (crashes), `admin-schemas-api.test.ts` (request-service), `sprint-68-halflife` (6 DB-conn), `sprint-67-governance` (DB-conn), social-graph-service tdd `sprint-66`/`sprint-67`/`sprint-68`.

### Sprint 81 residual (now being addressed by item #2 above)
- JWT-in-URL exposure → nginx log scrub (item 2). Token TTL kept at 1h (documented). SSE auth tests promoted to regression.
