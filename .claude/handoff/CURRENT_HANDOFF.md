# Sprint 96 — Founding-Circle Backend Intake — ✅ IMPLEMENTED, ready for PR/deploy (v11.4.0 → v11.5.0)

> **▶ STATUS (2026-06-12):** Sprint 96 is **IMPLEMENTED** on branch
> `feature/sprint-96-founding-circle-intake`. All 11 build tasks done; SDLC gates passed
> (`/simplify` applied; `/code-review` → 5 fixes applied; `/security-review` → no findings;
> `npm audit` → 0 vulns). Full monorepo `npm test` green (25/25 turbo tasks); auth-service unit
> (25) + tdd (6) + regression (9) and landing (51) all pass; cross-workspace sprint-76 gate tests
> re-pointed and green; landing static export builds. Version bumped to 11.5.0 in `package.json` +
> `package-lock.json`. **Next:** open one PR, cross-agent review, then human Admin merge → CI
> auto-deploys v11.5.0. **At deploy, the two `.env.demo` server changes + migration are still
> required (see Task 12 below).**
>
> **Code-review fixes folded in (round 1):** (1) re-pointed the two cross-workspace Sprint-76 gate
> tests that referenced the now-deleted `buildSubscribeMailto.ts` (the mailto DOM-XSS surface is
> *eliminated*, not just encoded); (2) `resolveApiBase()` now rejects a relative
> `NEXT_PUBLIC_API_URL` (shared `/api` with frontend) and falls back to `https://karmyq.com/api`;
> (3) added `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` guard to the migration; (4) added
> `karmyq.org`/`www` to `ALLOWED_ORIGINS` in `.env.demo.example`; (5) regenerated landing service
> doc so `auth-service.json` lists the new endpoint.
>
> **Sprint 96 goal:** Replace the `/join` mailto with a real persisted founding-circle submission —
> a public `POST /founding-circle/submissions` in **auth-service** writing to a new
> `auth.founding_circle_submissions` table, protected by a **honeypot + input validation**, reached
> cross-origin from the static `karmyq.org` landing page (CORS + nginx), with success/error UI and
> the visible `contact@karmyq.org` fallback preserved. **Persist-only — no email notify.**
>
> **Decisions locked (this planning session):**
> - **Host service:** auth-service (existing public front door; has CORS + global rate limiter).
> - **Scope:** persist-only. There is **no email/SMTP infrastructure anywhere** in the platform, so
>   "notify the team" can't be done honestly without standing up email transport — explicitly
>   deferred to a later sprint. Review submissions via `psql` for now.
> - **Anti-spam:** honeypot field (`website`) + app-level input validation. No dedicated rate-limit
>   layer (rely on the app-wide `globalRateLimiter`); no dedup.
> - **Folded-in content change:** swap the "Trust when you can afford to." copy in
>   `apps/landing/src/lib/landingContent.ts` (the 2am-friend passage) — see Task 8. Rides this PR so
>   it is **not** a docs-only push to master.

**Branch:** `feature/sprint-96-founding-circle-intake` (create from `master`).

**Spec:** `docs/superpowers/specs/2026-06-12-sprint-96-founding-circle-intake-design.md`

**Plan:** `docs/superpowers/plans/2026-06-12-sprint-96-founding-circle-intake.md`

---

## Quick Start

1. Read this handoff.
2. Check out branch: `git checkout -b feature/sprint-96-founding-circle-intake`.
3. Open plan: `docs/superpowers/plans/2026-06-12-sprint-96-founding-circle-intake.md`.
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development).

---

## Critical Implementation Notes (from the spec — read before coding)

1. **No email infrastructure exists** (no nodemailer/SMTP/SES) — persist-only by decision. Do not
   add an email send; defer notify to a later sprint.
2. **Cross-origin is the whole game — TWO `.env.demo` changes at deploy (Task 12):**
   (a) add `https://karmyq.org,https://www.karmyq.org` to `ALLOWED_ORIGINS` (CORS); and
   (b) set `NEXT_PUBLIC_API_URL=https://karmyq.com/api` — consumed at **build time** (`deploy.sh`
   sources `.env.demo` before building landing). Client must use a production-safe fallback of
   `https://karmyq.com/api`, never `localhost`/relative. Missing either → `/join` silently fails.
3. **Static export** (`output: 'export'`) — no Next API routes; the submit is a client `fetch` to
   `NEXT_PUBLIC_API_URL`.
4. **Honeypot = silent success.** Non-empty `website` field → return success **without persisting**.
5. **Canonical error contract (ADR-074):** `{ success:false, message, error:"CODE" }` via shared
   `sendValidationError` / `sendError`. Never a literal object in `error`.
6. **Do not add auth middleware** to the endpoint — it is public.
7. **Mount without `rateLimiters.standard`** — rely on the app-wide `globalRateLimiter` only.
8. **Mirror schema** in both the migration file and `init.sql`; guard with `IF NOT EXISTS`.
9. **ADR docs are GENERATED.** Write `docs/adr/ADR-076-*.md` + add slug to `ADR_GROUPS` in
   `scripts/generate-docs.ts`, regenerate, then `git add -f` the generated `concepts/adr-076-*.json`
   + `apps/landing/src/data/docs/nav.json` (top-level path — there is **no** `concepts/nav.json`).
   Prebuild overwrites hand-edited generated JSON.
10. **Keep the visible `contact@karmyq.org` fallback** in the form at all times.
11. **auth-service tests are service-local** (`services/auth-service/tests/{unit,tdd}`).
12. **No real integration test-DB harness in auth-service** — test the route with the isolated
    `express()` + `jest.mock`ed DB + supertest pattern (`tests/regression/auth.routes.test.ts`);
    real persistence is verified by migration + post-deploy DB check.
13. **Exact response helpers:** `sendSuccess(res, data, status, opts)` has **no top-level message**;
    `sendError(res, code, message, status, …)` is **code-first**; use `sendValidationError` /
    `sendInternalError` for the error paths.
14. **Version bump = `package.json` AND `package-lock.json`** (root `version`, in place).
15. **Retire the stray `/join` mailto CTAs.** `joinContent.lanes[*]` ("For specialists",
    "For organizers") render as visible `LaneCard` buttons *outside* JoinForm and still point to
    `mailto:`. Repoint them at `#join-form` (Task 6). **Acceptance is scoped to the join
    body/lanes** — no `mailto:` there except the JoinForm fallback; the **global footer `Contact`
    link** (`Footer.tsx` via `PageShell`, on every route) is a separate shared mailto and is
    **allowed**. The landing client (`submitFoundingCircle`) needs a
    pure-TS Jest test (`apps/landing/tests/*.test.ts`, mocked `fetch`). **No separate "Join the
    circle" user guide exists** — `/join` copy lives in `landingContent.ts`; ADR-076 is the docs
    artifact.

---

## Data Model (new)

```sql
CREATE TABLE IF NOT EXISTS auth.founding_circle_submissions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(320) NOT NULL,
  lens          VARCHAR(200),
  contribution  TEXT,
  concern       TEXT,
  source_page   VARCHAR(64)  NOT NULL DEFAULT 'join',
  status        VARCHAR(24)  NOT NULL DEFAULT 'new',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at   TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_founding_circle_status_created
  ON auth.founding_circle_submissions (status, created_at DESC);
```

---

## Landing copy swap (Task 8 — verbatim new text)

Replace the `thinking` section blocks (`landingContent.ts` ~108–116). New order `p, p, star, p`:

- **p:** Think of your most reliable friend. The one who shows up at 2am. You didn't get there by saving them for emergencies — you got there by calling on each other for things big and small, until the trust was deep enough to hold the 2am call. Trace any friendship like that backwards and you find the same thing: small mutual dependence, repeated, until it became something you could stake everything on.
- **p:** That logic applies at the community scale, and we've abandoned it. The contracts, ratings, background checks, and platform guarantees we layer over modern life aren't worthless — but they're substitutes, and leaning on them lets the underlying muscle go slack.
- **star:** Crisis doesn't create trust. It reveals the trust that was already there — or exposes its absence.
- **p:** That's the real risk. Not that people are bad — the evidence runs the other way. It's that trust takes time to build, and we keep waiting until we need it. By then it's too late to start. Karmyq isn't a substitute for institutions, and it isn't a bet that people are angels. It's the practice ground for the relationships you can't summon on demand — built now, while there's no emergency, so they're there when there is.

---

## Multi-sprint Arc

- **S92 (done):** Matching & Dibs Repair (v11.1.0).
- **S93 (done):** Provider↔Community link-up + carry-forward fixes (v11.2.0, PR #80).
- **S94 (done):** Error Contract Cleanup / ADR-074 (v11.3.0, PR #82).
- **S95 (done):** karmyq.org multi-route relaunch + logo fix (v11.4.0, PR #83, deployed at `bceb034`).
- **S96 (this sprint, v11.5.0):** Founding-circle backend intake — persist-only.
- **S97+ (deferred):** Notify on submission (needs email/Slack transport) + optional authenticated
  admin review surface (list + status transitions).
- **Deferred:** Service Consolidation Phase 2 — geocoding → client-side, 10→9 (ADR-071).
- **Deferred to post-rollout:** mobile parity.

---

## Carry-forward / still-owed from Sprint 95 (verify, do not re-do)

- Mobile hamburger nav loop across all 5 routes + `/docs` (needs a real device) was not recorded as
  validated. Confirm during S96 post-deploy if convenient.
- ADR-075 status bump `Accepted` → `Implemented` was queued to fold into the next PR — fold into the
  S96 PR if not already done (do **not** push docs-only to master).

---

## Persistent Context

### Multi-agent PR process — live on master

- `.github/pull_request_template.md` = the cross-agent PR contract.
- master branch protection requires CI checks, 1 approving review, and Admin merge authority.
- Agents do not self-merge or push directly to `master`.
- Every task = one branch = one PR.
- When using `gh pr create`, manually copy `.github/pull_request_template.md` into the PR body.
- Cross-agent review protocol: the agent that did not author a plan/PR reviews it when two models
  are available.

### Architecture Gotchas

- **Landing page docs**: `apps/landing/src/data/docs/` is gitignored — `git add -f` when generated
  docs must be committed. Generated by `scripts/generate-docs.ts`; edit sources, never generated JSON.
- **ADR numbering**: ADR-075 shipped in S95; **next free ADR = 076** (this sprint).
- **JWT field** is `communities`, not `communityMemberships`.
- **Schema is `communities.communities`** (plural schema name); auth tables are `auth.*`.
- **API response unwrap**: `createApiClient` interceptor already unwraps the envelope — use
  `res.data`, not `res.data.data`.
- **Error contract (ADR-074)**: `{ success:false, message:string, error:string }`; use shared
  `sendError`/`sendValidationError`.
- **CORS on auth-service** is driven by `ALLOWED_ORIGINS` env (comma-separated origins).
- **auth-service public routes**: `/auth/login` + `/auth/register` are already unauthenticated;
  the new `/founding-circle` route follows the same public pattern (no auth middleware).
- **trust_edges_live is a VIEW**: never INSERT/UPDATE it.
- **`git add` on CLAUDE.md**: tracked as lowercase `claude.md`.
- **Solo dev — no worktrees**: work directly on feature branches.
- **Root package.json version**: `11.4.0`; Sprint 96 target is `11.5.0`.
- **CI security gates**: dependency audit (ADR-059) + CodeQL (ADR-060) run on push.
- **request-forgery FP on `apps/frontend/src/lib/api.ts`** is a known recurring false positive.
- **request-service serves the feed** now (`/requests/feed`); there is no feed-service.

### Workflow Gotchas

- Every sprint runs testing, `/simplify`, `/code-review`, and `/security-review`.
- Every sprint updates docs; do not treat docs as optional.
- No docs-only push to `master`; every master push triggers a full deploy.
- nginx.conf changes take effect on the next deploy (deploy.sh copies + reloads).

### Deploy Drift Watch

`karmyq.org` live content has drifted from `master` before. Confirm the latest deploy succeeded and
live content matches `master` before judging by live content.
