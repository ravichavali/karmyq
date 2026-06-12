# Sprint 95 — karmyq.org Multi-Route Relaunch — ✅ IMPLEMENTED, ready for PR/deploy

> **▶ STATUS (2026-06-11):** Sprint 95 is **CODE-COMPLETE** on branch
> `feature/sprint-95-karmyq-org-routes` (v11.4.0). All 13 plan tasks done; SDLC gates passed
> (`/simplify` applied, `/code-review` → 2 fixes applied, `/security-review` → no findings,
> `npm audit` → 0 vulns). Full monorepo `npm test` green (25/25 turbo tasks); landing build exports
> all 6 routes (`/`, `/principles`, `/how-it-works`, `/research`, `/join`, `/docs`).
> **Next:** open PR, merge after Admin authorization, then post-deploy mobile-nav + copy validation.
> Sprint 96 = backend-backed founding-circle intake from `/join`.
>
> **What shipped:** five static routes built in the existing Tailwind/Fraunces design system
> (decision: keep current design system, migrate v5 *content* only — not a redesign); route/nav/copy
> contract extracted to `landingRoutes.ts` + `landingContent.ts` with a 22-assertion regression test;
> route-aware Header (desktop + mobile loop, single Join CTA); merged reputation essay
> ("The Problem with Stars") + new "Why No Role Is Permanent"; `/join` form-shaped with encoded
> mailto + visible fallback; per-route OG/canonical metadata; ADR-075; queued logo fix folded in;
> dead `components/sections/` deleted.
>
> ⚠️ **Post-deploy still owed:** desktop + mobile nav loop across all 5 routes + `/docs`; `/join`
> mailto opens encoded note; live copy free of forbidden strings; frontend shell logo renders.
> ⚠️ **S93 closeout still owed:** post-deploy smoke + human validation on the live demo were not
> recorded as passed. Confirm the provider link-up + carry-forward fixes work on karmyq.com before
> leaning on them.

**Sprint goal (one sentence):** Split `karmyq.org` from one long landing page into five static
routes using the supplied v5 HTML files as content/organization source of truth, preserve `/docs`,
preserve the current design system, and keep `/join` mailto-backed until Sprint 96 adds real
backend intake.

**Branch:** `feature/sprint-95-karmyq-org-routes` (create from `master`).

**Spec:** `docs/superpowers/specs/2026-06-11-sprint-95-karmyq-org-routes-design.md`

**Plan:** `docs/superpowers/plans/2026-06-11-sprint-95-karmyq-org-routes.md`

---

## Quick Start

1. Read this handoff.
2. Check out branch: `git checkout -b feature/sprint-95-karmyq-org-routes`.
3. Open plan: `docs/superpowers/plans/2026-06-11-sprint-95-karmyq-org-routes.md`.
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development).
5. Preserve the existing unstaged logo fix in `apps/frontend/src/styles/karmyq-shell.css`.

---

## Sprint 95 Scope

### Route mapping

| Source file | Route |
|---|---|
| `C:\Users\ravic\Downloads\Karmyq\karmyq-v5-home.html` | `/` |
| `C:\Users\ravic\Downloads\Karmyq\karmyq-v5-principles.html` | `/principles` |
| `C:\Users\ravic\Downloads\Karmyq\karmyq-v5-how-it-works.html` | `/how-it-works` |
| `C:\Users\ravic\Downloads\Karmyq\karmyq-v5-research.html` | `/research` |
| `C:\Users\ravic\Downloads\Karmyq\karmyq-v5-join.html` | `/join` |

### Required nav

Every public page needs:

`Story` · `Principles` · `How it works` · `Research` · `Join the circle` · `Docs`

`Join the circle` is the nav button. `/docs` remains unchanged.

### Carry-forward logo fix

There is already an uncommitted frontend logo fix in the working tree:

- `apps/frontend/src/styles/karmyq-shell.css`
- `.kq-wordmark-seed` uses `/brand/karmyq-mark.svg`
- full 3-level mark, 24px

Fold it into the Sprint 95 PR. Do not revert it.

---

## Critical Implementation Notes

1. The five supplied HTML files are the content and organization source of truth, but the live landing design system remains the visual source of truth. Do not paste their standalone CSS wholesale.
2. `/docs` must remain unchanged and reachable from every page.
3. `apps/landing` is a static export (`output: 'export'`), so Sprint 95 cannot use Next API routes for join submission.
4. Sprint 96 owns backend-backed founding-circle intake. Sprint 95 keeps mailto/contact fallback and should not create database/API surface.
5. Use each source file's meta description exactly for its corresponding route.
6. Never imply: acts broadcast to the community; karma carrying to daughter communities after fission; automatic splitting at the Dunbar threshold; a founder group; moderation features; governance templates; user-level questionnaires; Bayesian updating; federation; or a community-of-communities layer.
7. Copy voice test: any sentence touched should feel like it could appear in a long-form magazine essay. Avoid body-copy spec language such as "executes atomically," "in parallel," "algorithm," and similar implementation phrasing.
8. "The Problem with Stars" is the single merged reputation essay. "In Defense of Gossip" may appear as an internal section heading inside that essay only if it reads naturally, but not as a separate essay/card.
9. `.star-line` text should be styled as isolated emphasis lines, not visually treated as body paragraphs.
10. Mobile nav validation is mandatory after deployment because five pages make the hamburger menu a real primary navigation surface.
11. Preserve the existing unstaged logo fix in `apps/frontend/src/styles/karmyq-shell.css`; do not revert it while editing landing files.
12. `apps/landing` currently has a pure TypeScript Jest harness only (`**/tests/**/*.test.ts`, no `.tsx`, no jsdom). Do not create `.test.tsx` component-rendering tests unless the harness is explicitly upgraded. Prefer pure `.test.ts` tests against extracted route/nav/content modules.

---

## Cross-agent Review Fixes Applied

Claude reviewed Codex's initial Sprint 95 plan and found one blocker: the proposed
`apps/landing/tests/sprint-95-routes.test.tsx` would not run because the landing Jest harness only
matches and transforms `.test.ts` files, and the package uses `jest --passWithNoTests`.

Codex revised the plan to use option (b): pure `.test.ts` regression tests against extracted
route/nav/content modules (`landingRoutes.ts`, `landingContent.ts`) instead of adding a React/jsdom
component harness. The plan also now includes:

- a guard to list/run the exact route test file so `--passWithNoTests` cannot mask a no-op;
- a root `11.4.0` version-bump task;
- explicit ADR-075 generated-docs/nav.json verification and `git add -f` reminder;
- explicit homepage section split instructions.

---

## Sprint 96 Preview — Founding Circle Backend Intake

The user considered replacing the `/join` mailto with a real backend write. Decision:
**plan this into Sprint 96**, not Sprint 95.

Likely Sprint 96 scope:

- public endpoint such as `POST /founding-circle/submissions`;
- database table and migration for submissions;
- fields: email, lens, contribution, concern, source page, status, created_at, reviewed_at;
- rate limit, honeypot/spam control, input validation, canonical error responses;
- `/join` client submit flow with success/error states;
- visible `contact@karmyq.org` fallback preserved;
- optional email notification/export/admin review only if explicitly scoped.

---

## Multi-sprint Arc

- **S92 (done):** Matching & Dibs Repair — dibs correctness floor, 8-bug sweep (v11.1.0).
- **S93 (done):** Provider↔Community link-up (audit-first) + carry-forward fixes (v11.2.0, PR #80
  merged + deployed).
- **S94 (done):** Error Contract Cleanup (v11.3.0, PR #82 merged + deployed).
- **S95 (code-complete, v11.4.0):** `karmyq.org` multi-route relaunch + queued logo fix — branch
  `feature/sprint-95-karmyq-org-routes`, awaiting PR/merge/deploy.
- **S96 (next):** Backend-backed founding-circle intake for `/join`.
- **Deferred:** Service Consolidation Phase 2 — geocoding → client-side, 10→9 (ADR-071).
- **Deferred to post-rollout:** mobile parity, including mobile error-read tolerance.

---

## Validation Focus

- Landing tests for route rendering, nav links, forbidden copy, and mailto encoding.
- Static export build creates:
  - `apps/landing/out/index.html`
  - `apps/landing/out/principles/index.html`
  - `apps/landing/out/how-it-works/index.html`
  - `apps/landing/out/research/index.html`
  - `apps/landing/out/join/index.html`
  - `apps/landing/out/docs/index.html`
- Human post-deploy validation must walk the desktop and mobile nav loops.
- Live copy must not contain `LinkedIn`, `Roy`, or a standalone `In Defense of Gossip` essay.

---

## Persistent Context

### Multi-agent PR process — live on master

- `.github/pull_request_template.md` = the cross-agent PR contract.
- master branch protection requires CI checks, 1 approving review, and Admin merge authority.
- Agents do not self-merge or push directly to `master`.
- Every task = one branch = one PR.
- When using `gh pr create`, manually copy `.github/pull_request_template.md` into the PR body.

### Architecture Gotchas

- **Landing page docs**: `apps/landing/src/data/docs/` is gitignored — `git add -f` when generated docs must be committed. Generated by `scripts/generate-docs.ts`; edit sources, never generated JSON.
- **ADR numbering**: ADR-074 shipped in S94; **next free ADR = 075**.
- **JWT field** is `communities`, not `communityMemberships`.
- **Schema is `communities.communities`** (plural schema name).
- **API response unwrap**: `createApiClient` interceptor already unwraps the envelope — use `res.data`, not `res.data.data`.
- **trust_edges_live is a VIEW**: never INSERT/UPDATE it.
- **`git add` on CLAUDE.md**: tracked as lowercase `claude.md`.
- **Solo dev — no worktrees**: work directly on feature branches.
- **Root package.json version**: `11.3.0`; Sprint 95 target is `11.4.0`.
- **CI security gates**: dependency audit (ADR-059) + CodeQL (ADR-060) run on push.
- **request-forgery FP on `apps/frontend/src/lib/api.ts`** is known recurring false positive.
- **request-service serves the feed** now (`/requests/feed`); there is no feed-service.

### Workflow Gotchas

- Every sprint runs testing, `/simplify`, `/code-review`, and `/security-review`.
- Every sprint updates docs; do not treat docs as optional.
- UI sprints should start with structured page organization and layout reasoning before implementation.
- No docs-only push to `master`; every master push triggers full deploy.
- Cross-agent review protocol: the agent that did not author a plan/PR reviews it when two models are available.

### Deploy Drift Watch

`karmyq.org` live content has drifted from `master` before. Confirm the latest deploy succeeded and live content matches `master` before judging by live content.
