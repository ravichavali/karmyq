# Sprint 130 — Stop Asking for Reputation We Can't Be Given — Handoff

**Date**: 2026-09-15
**Outcome**: **PLANNED, ready to execute.** Spec + plan committed on `feature/sprint-130-maintenance`. Nothing implemented yet.

> Single stream. `CURRENT_HANDOFF.md` **is** the state, not a router: there is no second machine.
> This file is branch-local and reserves nothing. Contended resources are allocated by the
> maintainer (`CLAUDE.md` → *Parallel Development*).

---

## Sprint goal

Remove every frontend reputation request that ADR-082 guarantees will be denied, show the community
trust badge where a score can actually exist, and clear the carried security and dependency backlog
to **0 open code-scanning alerts**.

## Arc context

- **Sprint 129** (shipped v11.53.0): a denied community-trust aggregate became `200 { data: null }`
  (BUG-031, verified live: 0 console errors). Its live check (C4) showed the badge could never
  render (BUG-044) and surfaced two sibling fan-outs (BUG-042, BUG-043).
- **Sprint 130** (this sprint) removes those fan-outs, and clears #540–#542, #578 and #239.
- **Next candidates** (not planned): BUG-036 (CI healthcheck race), BUG-033 (the promoter can't see
  `.tsx`/`.js`), BUG-034 (messaging-service has no tests), and the seven major bumps #224–#230.

## Ownership and base

| Field | Value |
|---|---|
| **Branch (PR A)** | `feature/sprint-130-maintenance` off `origin/master` at `6752f925`. It already holds the Sprint 129 close-out (`71b4efe8`: archived handoff, BUG-031 verified, BUG-044 filed) plus this planning commit. |
| **Branch (PR B)** | `feature/sprint-130-security`, branched from `origin/master` **after PR A merges and deploys**. |
| **Version** | master is **v11.53.0**. PR A → v11.54.0, PR B → v11.55.0, each re-derived from `origin/master` at merge time. |
| **Active editor** | unassigned; execution starts in a fresh chat |
| **Shared resources** | **Claude holds the dependency lane for PR B** (maintainer decision 2026-09-15). PR A touches no manifests. No demo-server data operation is needed; the live checks are read-only browser loads as `maria.reyes`. |

## Quick Start

1. Read this handoff.
2. Reuse the existing task branch: `git fetch origin && git switch feature/sprint-130-maintenance`,
   then confirm it contains `origin/master`. If master moved, merge it in with a merge commit; never
   rebase or force-push. PR B later: `git switch -c feature/sprint-130-security origin/master`.
   Never branch off a stale local master: unpushed local-master commits leak in via the squash-merge.
3. Open the plan: [`docs/superpowers/plans/2026-09-15-sprint-130-maintenance.md`](../../docs/superpowers/plans/2026-09-15-sprint-130-maintenance.md)
4. Run `/execute-plan` (uses superpowers:subagent-driven-development). **Start at Task 1**, and
   write the tests first (Task 2).

## Artifacts

- **Spec**: [`docs/superpowers/specs/2026-09-15-sprint-130-maintenance-design.md`](../../docs/superpowers/specs/2026-09-15-sprint-130-maintenance-design.md)
- **Plan**: [`docs/superpowers/plans/2026-09-15-sprint-130-maintenance.md`](../../docs/superpowers/plans/2026-09-15-sprint-130-maintenance.md)
- **Previous sprint**: [`archive/2026-09-15-sprint-129-maintenance-SHIPPED-v11.53.0.md`](archive/2026-09-15-sprint-129-maintenance-SHIPPED-v11.53.0.md)

## Two PRs, merged in order

| PR | Branch | Scope | State |
|---|---|---|---|
| **A** | `feature/sprint-130-maintenance` | BUG-044 (badge on joined chips, no discovery fan-out), BUG-043 (one list fetch), BUG-042 (remove per-member score pill and fan-out), plus doc corrections | **NEXT**: Task 1 |
| **B** | `feature/sprint-130-security` | #540–#542 log-injection fix, #578 dismissal, #239 surgical dependency bump | after PR A deploys |

⚠️ **One merge at a time.** Every master push is a full deploy.

## Maintainer decisions (2026-09-15, do not re-litigate)

| Question | Decision |
|---|---|
| Scope | Fan-out + security. BUG-033, BUG-034, BUG-036 and majors #224–#230 stay out. |
| BUG-044 | **Move the badge to the "Your Communities" chips**; fetch trust only for joined communities. |
| BUG-042 | **Remove the per-member score pill**; no per-member reputation reads. |
| Dependency lane | **Claude holds it** for PR B (#239). |

## What planning established (so it isn't re-derived)

- **#540–#542 are REAL, not false positives.** `SAFE_ADDRESS_QUERY_PATTERN`
  (`geocodingService.js:2`) allows `\s`, and `trim()` removes only the ends, so `"Main St\nFORGED"`
  passes validation. `:111`, `:118` and `:129` also log the raw `query`, not the validated value.
- **#578 is the monitor doing its job.** It reads `security/audit-exemptions.json` (a repo file) and
  sends the package name URL-encoded to `api.github.com`. Dismiss once, with justification.
- **BUG-043 cannot use a lazy `useState(readDiscoveryMode)`.** `pages/communities/index.tsx` has no
  data-fetching export, so it is prerendered with `'geography'`, and a client initialiser returning
  `'interests'` is a hydration mismatch, which logs a console error.
- **The "Your Communities" chips read the JWT** (`user.communities`, `index.tsx:428-446`), are
  rendered client-side only, and today carry no badge.
- **`getTrustScore(` has two call sites.** `LeftSidebar.tsx:42` is a self read and **stays**;
  `useCommunityData.ts:192` is the per-member fan-out and **goes**.
- **Geocoding tests are `.js`.** The promoter matches `*.test.ts` only (`promote-tdd-tests.js:33`),
  and geocoding's `test` script runs only `tests/unit` and `tests/regression`, so a TDD file must be
  moved to `regression/` by hand.
- **#239** is MERGEABLE, touches 4 files (`apps/frontend`, `apps/landing`, `tests` manifests plus the
  lock), and is a patch within `eslint-config-next` 16.x. No `next` movement.
- Onboarding `workflows.ts` has no per-member score or discovery-badge step (`:27` is about request
  cards), so no change is needed there.

## Critical implementation notes (verbatim from the spec)

1. **Never fix BUG-043 with a lazy `useState` initialiser that reads localStorage.** The page is
   prerendered, so a client/server mismatch logs a hydration error to the console. Gate the first
   fetch on a resolved flag instead. Prove it with a test that asserts `getCommunities` is called
   **exactly once**, with the persisted mode, for both `'interests'` and `'geography'`.
2. **A test must reach a state the real page can reach.** Sprint 129's badge test mocked a score for a
   card the real grid filters out, and passed while the feature was dead (BUG-044). Every PR A
   render test builds its fixture from the page's real filters: joined ids come from
   `user.communities`, and the grid is `communities` minus joined.
3. **Assert the absence of requests, not only of UI.** BUG-042/044 are about requests. Tests must
   assert `getTrustScore` is **not called** on People tab open, and that `getCommunityTrust` is called
   with **exactly** the joined ids, never a discovery-card id.
4. **Keep `LeftSidebar`'s self read.** Only the per-member fan-out in `useCommunityData` goes.
   Grep `getTrustScore(` before and after; exactly one call site should remain.
5. **The server contract doesn't change.** Don't touch `reputation.ts`, `health.ts` or any 404/200
   status. BUG-042's fix is removing the caller, never changing the self-only 404.
6. **Don't edit `apps/frontend/src/lib/api.ts`.** A line shift re-raises the CodeQL
   `js/request-forgery` false positive as new alert ids and blocks the master deploy.
7. **#540–#542 are real, so fix them, never dismiss.** `\s` in `SAFE_ADDRESS_QUERY_PATTERN` admits
   `\n`/`\r` mid-query. The regression test must feed a query containing `\n` and assert that no
   logged string contains `\n` or `\r`, and that the cache key is whitespace-collapsed.
8. **#578 is one dismissal, with its justification recorded in the PR body.** Never loop the
   dismissal API.
9. **Geocoding tests are `.js`, and the promoter only moves `*.test.ts`** (`promote-tdd-tests.js:33`,
   the same blind spot as BUG-033). The geocoding `test` script runs only `tests/unit` and
   `tests/regression`. Write the test in `tests/tdd/` first, prove red with a direct `npx jest`, then
   **move it to `tests/regression/` by hand** in the same PR. A test left in `tdd/` there runs nowhere.
10. **The dependency edit is surgical** (CLAUDE.md, *Workspace dependencies*). Splice the #239 entries
    in place. Prove with `npx -y npm@11.19.0 ci` **and** `npm ls --all | grep invalid` (baseline is 3
    pre-existing invalids: color-string, ms, picomatch). Never `npm install --workspace`, dedupe or
    scratch-regen on this Windows box.
11. **`eslint-config-next` is already 16.x against `next` 15** (the mismatch recorded on #229). #239
    is a patch within 16, and it must not become a `next` bump.
12. **The TDD promoter sweeps unrelated files.** After any full `npm test`, restore promotions that
    don't belong to the PR.
13. **`apps/landing/src/data/docs/` is only partly tracked, and its directory is gitignored.** Stage
    tracked regenerations with `git add -u`, keep content changes, and revert `architecture.json` and
    `build.json` timestamp churn.
14. **One merge at a time, and PR B branches after PR A merges.** Every master push is a full deploy.
    Take the version bump from `origin/master` at merge time.
15. **Verify live after each deploy, in a browser, as `maria.reyes`:**
    - `/communities`: 0 console errors, **no** community-trust request for a discovery-card id,
      exactly one `GET /communities` for the saved mode, and a badge on any joined chip whose score
      is non-null.
    - Community People tab: 0 `/reputation/trust/` requests.

## Dated obligations (carried)

- **Demo stories expire 2026-11-12** (hard-deleted about 2026-11-19). The demo-health monitor warns
  14 days ahead. Rotation is one operator command on the demo host (see the Sprint 129 archive,
  *Operational gate*).
- **BUG-041** (`decode-uri-component`, dismissed): re-check by **2026-11-14**.

---

## Still open, not in this sprint

- **`enforce_admins: false`** on `master`. Six required checks and one required approval are all
  admin-bypassable, yet the review requirement is also what stalls every sprint's end: the PR author
  and the authenticated account are the same, so the required approval can never be self-provided.
  **This has shaped the end of four consecutive sprints** — Sprints 128 and 129 all ended in an admin-override merge (#240 on 2026-09-15, on explicit maintainer authorization).
  One API call either way.
- **`apps/landing/src/data/docs/` is only PARTIALLY git-tracked.** `apps/landing/.gitignore:2`
  ignores the directory, but ~160 files were committed before that and remain tracked; ADRs 095+ are
  not. `CLAUDE.md` calls it "git-tracked" without qualification, which is misleading.
- **Sprint 128 PR C architectural follow-through** — three deferred items (one definition of the
  trust metrics instead of a SQL copy and a TypeScript copy; a single `projectApply`; interpolating
  `COMPLETED_MATCH_REASONS` into the SQL). Detail in
  `.claude/handoff/archive/2026-09-11-sprint-128-standing-preview-SHIPPED-v11.50.0.md`.

## Process notes worth carrying

**Demo-host traps, all hit and fixed while wiring rotation — they will recur:**
- **`npm --workspace` sets cwd to the WORKSPACE directory**, not the repo root, so a relative path
  in an env var silently misresolves under `services/<name>/`. Both host scripts now re-anchor to
  the repo root from `${BASH_SOURCE[0]}`, and the env file uses absolute paths.
- **The rotation env file is SHELL-SOURCED.** A value containing spaces must be quoted or
  `set -a; . ./file` executes it instead of assigning it. CRLF fails as `$'\r': command not found`
  on every line — `.gitattributes` now pins `.env*` to LF.
- **Compose on the demo host reads the PROCESS ENVIRONMENT**, not an env_file: `deploy.sh` does
  `set -a; source .env.demo`. There is no `.env` on the host. It also uses **two** compose files
  (base + `docker-compose.prod.yml`) — recreating a container without both drops every prod override.
- **`grep -q $'\r'` is not a reliable CRLF check** in a loop; count bytes instead
  (`python -c "...count(b'\r')"`). It reported clean on a file with 59 CR bytes.

- **Merging needs the maintainer.** GitHub forbids self-approval, so the only merge path is
  `gh pr merge --squash --admin`, and that needs **explicit per-PR authorization**. It succeeded for
  #240 (2026-09-15). The permission classifier refused it in Sprint 128, so if it refuses again, hand
  the merge back rather than retrying variants.
- **`gh run list` on master is drowned by Dependabot.** Filter by `--workflow=ci.yml`, and verify
  the `Deploy to Demo` **job**, not just the run.
- **Git hooks are LIVE on this clone** — a push costs a full suite run. A silent, instant push means
  no hook ran; treat that as the alarm.
- **`/health` is not exposed via nginx.** Smoke-test with `POST /api/auth/login`, and now also
  `POST /api/auth/demo-session`.
- **Windows + Git Bash:** `curl` flag parsing is unreliable and `jq` is not installed — use
  `node -e` for HTTP probes and JSON parsing. No local Docker.

⚠️ GitHub observations were reconciled on 2026-09-14. Re-derive with `gh pr list`,
`gh run list` and `git log origin/master` before trusting any of it.
