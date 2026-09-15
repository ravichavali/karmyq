# Sprint 130 — Stop Asking for Reputation We Can't Be Given — Handoff

**Date**: 2026-09-15
**Outcome**: **PR A SHIPPED v11.54.0** (#241, squash `8e940560`, Deploy to Demo job success, live-verified 2026-09-15). **PR B READY** on `feature/sprint-130-security`: log-injection fix + test, #578 dismissed, #239 spliced, docs, all gates clean (code-review medium: 0 findings), full suite 26/26, v11.55.0.

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
| **Version** | master is **v11.53.0**. PR A → **v11.54.0 (bumped on the branch)**, PR B → v11.55.0, each re-derived from `origin/master` at merge time. |
| **Active editor** | Claude (Windows box), executing PR B |
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

## PR A post-deploy verification (2026-09-15) — PASSED

- #241 merged as `8e940560`; CI/CD run 35016914690 success, **Deploy to Demo job success**; master v11.54.0.
- Smoke: `POST /api/auth/login` 200, `POST /api/auth/demo-session` 200.
- Browser as `maria.reyes` at 1440px, fresh login, saved mode seeded to `interests`:
  - `/communities` (first load AND reload): **0 console errors**; **exactly 6** community-trust requests,
    equal to her 6 joined ids (was 37 discovery-card requests); **one** `GET /communities`; all 6 chips
    badged (★ 2/1/17/18/5/4% trust); 0 discovery cards with a badge; storage still `interests` and
    "By Interest" `aria-pressed=true` after reload.
  - Portland Mutual Aid Network People tab (157 members), opened after load: **0 `/reputation/trust/`
    requests**, 0 score pills, 0 errors on open.
- Found, pre-existing, out of scope: that community page logs 2 console errors on load from
  `GET /communities/:id/config` → 404 → filed as **BUG-045** (rides PR B).
- The login page's 6 errors in the Playwright profile were a stale expired token from an earlier
  session, gone after a fresh login.

## PR B execution record (2026-09-15, in progress)

- Branch `feature/sprint-130-security` off `origin/master` `8e940560`.
- Baseline: open code-scanning exactly #540, #541, #542, #578; 0 open Dependabot alerts.
  `npm ls --all | grep -c invalid` prints **15** on this box, but that counts tree lines (deduped
  repeats plus `character-reference-invalid`). **Distinct** `npm error invalid:` packages = **3**
  (color-string, ms, picomatch), matching the plan's baseline. Compare distinct counts.
- **#540–#542:** `tests/regression/sprint-130-log-injection.test.js` (11 cases: `\n`, `\r\n`, U+2028 on
  miss/hit/cached paths + cache-key contract). Red pre-fix (6 hostile log cases + the normal-query log
  line); contract cases green before and after. Fix: the three log lines use `normalized`. Geocoding
  suite 18/18.
- **#578:** dismissed once as false positive (host fixed to `api.github.com`; package name from the
  repo's own file, URL-encoded). 170-char comment.
- **#239:** spliced by script, 13 lock lines + 3 manifests. Semantically identical to #239's head lock for
  every changed entry, except two deliberate skips: Dependabot rewrote the tests workspace pin to
  `^2.9.1` (kept exact `2.9.1`, matching the manifest) and the lock root version (not bumped, as in
  previous sprints). Its `expo/node_modules/*` reordering was key-order-only. Strict
  `npx -y npm@11.19.0 ci` exit 0 (lock unchanged); distinct invalids 3; `eslint-config-next@16.3.5`, `yaml@2.9.1` single versions; `next` 15.5.24 unchanged; eslint counts on PR A files identical to 16.3.4.
- **Tooling trap hit twice:** escape sequences typed into sed/Write/node -e (`\n`, `\u2028`) became literal
  characters and broke files. Use `String.fromCharCode` or line-index rewrites for such content.

## PR A execution record (2026-09-15)

- **Commits:** `4146f86d` (implementation + docs), `e245d09a` (/simplify), `1f016f95` (/code-review fix).
- **Tests:** `apps/frontend/tests/regression/sprint-130-reputation-fanout.test.tsx` (11 cases) and the reworked
  `sprint-129-community-trust-empty-state.test.tsx`, both moved to `regression/` by hand. Proven red pre-fix;
  mutation checks: reverting the `modeResolved` gate doubles every fetch, and removing the stale-response guard
  fails the join race test.
- **Found while testing:** a cold `?tab=people` load passed even pre-fix (the old fan-out ran before members
  loaded), so the People-tab test opens the tab after load. Recorded in BUG-042's fix note.
- **/simplify:** inlined the single-use trust fetch into its effect (also cleared a new
  `react-hooks/set-state-in-effect` lint finding; file back to its 16 pre-existing errors).
- **/code-review (medium):** 1 finding, real, introduced by the /simplify change: a slow pre-join trust
  response could overwrite newer scores. Fixed with a cleanup ignore flag + regression test.
- **/security-review:** no findings. The chip badge only asks for the caller's joined ids; the server's live
  membership check still decides. Per-member reads removed.
- **Also changed:** `DiscoveryToggle` buttons gained `aria-pressed`; `finding-communities-guide.md` and
  `concepts/community-discovery.md` updated (badge on chips; mode saved on click).
- `getTrustScore(` call sites: exactly one (`LeftSidebar.tsx:42`).

## Plan review checkpoint (2026-09-15) — RESOLVED

All five findings were verified by Claude against the repo and **applied to the spec, the plan and critical notes 1, 7, 12, 15 and 16**. Evidence:
- F1: reproduced with the real toggle; saved `interests` became `geography` with one unfiltered request.
- F2: `apps/frontend/package.json` `test` = unit + regression only.
- F3: `normalizeQuery("Main St\nFORGED 200 OK")` → `"main st forged 200 ok"`; `validateSearchQuery` returns `ok: true`.
- F4: `index.tsx:167-174`.
- F5: accepted as process. Follow-up review of `e1fc1f3f` verified the API shapes on PR #240:
  `analyses?ref=refs/pull/240/head` returned `commit_sha`, `category` and an empty `error` for both
  JavaScript/TypeScript and Actions on `16eaf4cd`; the ref-scoped open-alert query succeeded with
  no results. PR #239 returned no analyses, so its empty alert list alone proves nothing.
  Corrected note 16 in all three artifacts: `.github/workflows/ci.yml:129-130` already targets
  the PR head, not the merge ref. Task 18 now explicitly checks the JavaScript analysis and open
  findings. Recognition of the future sanitizer remains an execution-time check.

BUG-043 in `docs/BUGS.md` is re-diagnosed accordingly: the saved mode is lost on every load; the double fetch was a mock artefact.

The reviewer's original findings, kept for the record:

- **Saved mode is overwritten on mount.** The real `DiscoveryToggle` writes its initial mode to
  storage (`apps/frontend/src/components/DiscoveryToggle.tsx:14`) before the page reads storage
  (`apps/frontend/src/pages/communities/index.tsx:248`). A focused render of the actual page and
  toggle with saved `interests` yielded saved `geography` and one unfiltered list request. Task 4's
  fetch gate does not gate the toggle's write; Task 2's mock hides it. Preserve storage until mode
  resolution and test the real toggle.
- **Request assertion does not match the builder.** Task 2 (`plan:131`) requires `params.mode` on
  every initial fetch, but the builder only sends it with coordinates or nonempty tags
  (`apps/frontend/src/pages/communities/index.tsx:167`). Tags start empty. Define assertions for
  geography success/fallback and initial interests without silently changing the API contract.
- **Promote frontend tests manually.** Task 9 (`plan:204`) leaves green `.tsx` tests in `tdd/`,
  outside the blocking scripts (`apps/frontend/package.json:11`). Move this sprint's green tests
  to `regression/`, as Task 13 already does for JavaScript; BUG-033 can remain deferred.
- **Preserve the existing cache normalization.** Tasks 12/13 (`plan:239`, `plan:247`) specify a
  mixed-case key and returning collapsed input. `normalizeQuery` already lowercases and collapses
  whitespace (`services/geocoding-service/src/geocodingService.js:5`), and validation already uses
  it (`:23`). A direct call returned `main st portland`. Fix raw-query logging while retaining
  the lowercase cache contract; correct the spec's claim that whitespace collapse is new.
- **Separate PR and master scan verification.** Task 18 (`plan:296`) must verify completed analyses
  for the PR head and ref-scoped findings before merge; verify default-branch alert closure after
  merge and the master rescan. An open default-branch alert alone is not evidence that the PR's
  sanitizer failed. GitHub documents the distinction at
  https://docs.github.com/en/code-security/concepts/code-scanning/code-scanning-alerts.

`plan` above means `docs/superpowers/plans/2026-09-15-sprint-130-maintenance.md`.
Live read-only reconciliation: master remains `6752f925`; no Sprint 130 PR is open; #239 is open,
MERGEABLE, with the four planned files; #540–#542 and #578 remain open on master (all medium).
Review validation: source tracing plus isolated Node/jsdom probes; no full test suite run and no
application code changed.

## Artifacts

- **Spec**: [`docs/superpowers/specs/2026-09-15-sprint-130-maintenance-design.md`](../../docs/superpowers/specs/2026-09-15-sprint-130-maintenance-design.md)
- **Plan**: [`docs/superpowers/plans/2026-09-15-sprint-130-maintenance.md`](../../docs/superpowers/plans/2026-09-15-sprint-130-maintenance.md)
- **Previous sprint**: [`archive/2026-09-15-sprint-129-maintenance-SHIPPED-v11.53.0.md`](archive/2026-09-15-sprint-129-maintenance-SHIPPED-v11.53.0.md)

## Two PRs, merged in order

| PR | Branch | Scope | State |
|---|---|---|---|
| **A** | `feature/sprint-130-maintenance` | BUG-044, BUG-043, BUG-042 + doc corrections | **SHIPPED** v11.54.0 (#241, `8e940560`), live-verified |
| **B** | `feature/sprint-130-security` | #540–#542 log-injection fix, #578 dismissal, #239 surgical dependency bump | **Tasks 11–17 done**, suite 26/26, v11.55.0 bumped; PR opening → CodeQL PR-head evidence → merge auth → deploy → master rescan |

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

1. **BUG-043 needs both halves, tested with the REAL `DiscoveryToggle`.**
   - (a) The toggle must not write storage on mount.
   - (b) The first fetch waits for the resolved mode.
   - Never use a lazy `useState` initialiser that reads localStorage: the page is prerendered, and a
     mismatch logs a hydration error.
   - **Do not mock `@/components/DiscoveryToggle` in BUG-043 tests.** The mock hid the overwrite.
   - Assert, per case:
     - Saved `interests`: storage still reads `interests` after mount, exactly one `getCommunities`
       call, and no `mode`/`tags` params, because tags start empty.
     - Saved `geography` with `navigator.geolocation` mocked to succeed: exactly one call with
       `mode: 'geography'`, `lat` and `lng`.
     - Geography fallback (no geolocation, or denied): exactly one unfiltered call.
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
   `\n`/`\r` mid-query, and the three log lines print the raw query. The regression test feeds
   `"Main St\nFORGED 200 OK"` and asserts two things. First, no logged string contains `\n` or `\r`
   on the miss, hit and cached paths. Second, the cache key stays exactly what `normalizeQuery`
   produces today (`"main st forged 200 ok"`): the lowercase contract is preserved, not changed.
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
    don't belong to the PR. **Frontend `.tsx` tests never promote** (BUG-033), and
    `apps/frontend/package.json`'s blocking `test` runs only `tests/unit` + `tests/regression`. So
    **move this sprint's green `.tsx` tests to `apps/frontend/tests/regression/` by hand**, as for
    geocoding's `.js`. That includes the reworked Sprint 129 test, which has sat non-blocking in
    `tdd/` since it shipped. BUG-033 itself stays deferred.
13. **`apps/landing/src/data/docs/` is only partly tracked, and its directory is gitignored.** Stage
    tracked regenerations with `git add -u`, keep content changes, and revert `architecture.json` and
    `build.json` timestamp churn.
14. **One merge at a time, and PR B branches after PR A merges.** Every master push is a full deploy.
    Take the version bump from `origin/master` at merge time.
15. **Verify live after each deploy, in a browser, as `maria.reyes`:**
    - `/communities`: 0 console errors, **no** community-trust request for a discovery-card id,
      exactly one `GET /communities`, a badge on any joined chip whose score is non-null, and **a
      saved "By Interest" mode still selected after a reload**.
    - Community People tab: 0 `/reputation/trust/` requests.
16. **CodeQL: PR evidence and master evidence are different things.**
    - **Before merge:** confirm the CodeQL analyses for the PR's **exact head SHA** have *completed*
      (not just that a check exists), and read the ref-scoped open findings for the PR ref:
      `code-scanning/alerts?ref=refs/pull/N/head&state=open`, with check-run annotations as
      supplementary evidence. They must show #540–#542's rule
      no longer firing at those lines.
    - **After merge:** wait for the master rescan to complete, then verify default-branch alert
      closure.
    - An alert still open on master before that rescan is expected (GitHub's alert status is per
      branch) and never justifies another sanitiser change.
    - The ADR-060 gate already targets the PR head ref and head SHA
      (`.github/workflows/ci.yml:129-130`); the merge-ref mismatch is historical.

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
